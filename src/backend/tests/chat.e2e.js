// 실시간 채팅 E2E 테스트 (#10)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:chat` (DB 시드 필요: npm run db:setup)
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const { createClient } = require('redis');
const db = require('../db');

const B = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
const SOCKET_URL = B.replace(/\/api$/, '');
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const sessionKey = (t) => 'guest:session:' + crypto.createHash('sha256').update(t).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sockets = [];

// 연결되면 소켓, 거절되면 connect_error의 code로 reject
function connect(auth) {
  return new Promise((resolve, reject) => {
    const s = io(SOCKET_URL, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    s.received = [];
    s.on('message:new', (m) => s.received.push(m));
    s.once('connect', () => {
      sockets.push(s);
      resolve(s);
    });
    s.once('connect_error', (e) => {
      s.close();
      reject(Object.assign(new Error(e.message), { code: e.data?.code }));
    });
  });
}
const emit = (s, event, payload) => s.timeout(3000).emitWithAck(event, payload);
const once = (s, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} 미수신`)), ms);
    s.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
const rejectsWith = async (promise, code) => {
  const err = await promise.then(() => null, (e) => e);
  assert.ok(err, '연결이 거절되어야 함');
  assert.strictEqual(err.code, code);
};

let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log('PASS ', name);
};

(async () => {
  const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  await redis.connect();
  try {
    const id = crypto.randomBytes(4).toString('hex');
    const member = async (name) => {
      const r = await call('POST', '/auth/register', { email: `chat_${name}_${id}@orbit.test`, password: 'pw123456', nickname: name });
      const userId = jwt.decode(r.j.token).userId;
      return { token: r.j.token, userId, H: { Authorization: 'Bearer ' + r.j.token } };
    };
    const [A, Bm, C] = [await member('에이'), await member('비이'), await member('씨이')];
    const guest = async () => {
      const g = (await call('POST', '/guest/session')).j;
      return { ...g, H: { 'X-Guest-Token': g.guestToken } };
    };
    const G = await guest();
    const loungeRoom = (await db.query(`SELECT cr.id FROM chat_rooms cr WHERE cr.type = 'lounge' ORDER BY cr.created_at LIMIT 1`)).rows[0].id;

    // A·B의 1:1 방 (매칭 #13 대신 직접 생성)
    const direct = (await db.query(`INSERT INTO chat_rooms (type) VALUES ('direct') RETURNING id`)).rows[0].id;
    await db.query(
      `INSERT INTO chat_members (room_id, user_id, display_name, avatar_id) VALUES ($1, $2, '별빛 여행자', 1), ($1, $3, '조용한 혜성', 2)`,
      [direct, A.userId, Bm.userId]
    );

    await check('소켓 인증: 토큰 없음·잘못된 JWT·예전 Guest JWT → UNAUTHORIZED, 없는 Guest 토큰 → GUEST_EXPIRED', async () => {
      await rejectsWith(connect({}), 'UNAUTHORIZED');
      await rejectsWith(connect({ token: 'bad.jwt.token' }), 'UNAUTHORIZED');
      const oldGuestJwt = jwt.sign({ userId: crypto.randomUUID(), isGuest: true }, process.env.JWT_SECRET);
      await rejectsWith(connect({ token: oldGuestJwt }), 'UNAUTHORIZED');
      await rejectsWith(connect({ guestToken: 'x'.repeat(43) }), 'GUEST_EXPIRED');
    });

    const a1 = await connect({ token: A.token });
    const a2 = await connect({ token: A.token }); // A의 두 번째 기기
    const b = await connect({ token: Bm.token });
    const g = await connect({ guestToken: G.guestToken });

    await check('라운지 방: 회원·Guest 모두 입장', async () => {
      for (const s of [a1, a2, b, g]) assert.deepStrictEqual(await emit(s, 'room:join', { roomId: loungeRoom }), { ok: true });
    });

    await check('회원 메시지: 모두 수신, is_mine은 받는 소켓마다(같은 회원 다른 기기 포함), PG 저장, user_id 미노출', async () => {
      const ack = await emit(a1, 'message:send', { roomId: loungeRoom, content: `  회원 메시지 ${id}  ` });
      assert.strictEqual(ack.ok, true);
      await sleep(300);
      const got = Object.fromEntries([['a1', a1], ['a2', a2], ['b', b], ['g', g]].map(([k, s]) => [k, s.received.at(-1)]));
      assert.strictEqual(got.b.content, `회원 메시지 ${id}`); // 앞뒤 공백 제거
      assert.deepStrictEqual([got.a1.is_mine, got.a2.is_mine, got.b.is_mine, got.g.is_mine], [true, true, false, false]);
      assert.strictEqual(got.b.sender_nickname, '에이');
      assert.ok(got.b.sender_avatar_emoji && got.b.is_guest === false);
      assert.ok(!JSON.stringify(got.b).includes(A.userId));
      assert.strictEqual((await db.query('SELECT count(*)::int AS n FROM messages WHERE id = $1', [ack.id])).rows[0].n, 1);
    });

    await check('Guest 메시지: Redis에만 저장(PG X), 수신자 is_mine, Guest 배지 정보', async () => {
      const ack = await emit(g, 'message:send', { roomId: loungeRoom, content: `게스트 메시지 ${id}` });
      assert.strictEqual(ack.ok, true);
      await sleep(300);
      assert.strictEqual(g.received.at(-1).is_mine, true);
      const seen = b.received.at(-1);
      assert.deepStrictEqual([seen.content, seen.is_mine, seen.is_guest, seen.sender_nickname], [`게스트 메시지 ${id}`, false, true, G.nickname]);
      assert.strictEqual((await db.query('SELECT count(*)::int AS n FROM messages WHERE content = $1', [`게스트 메시지 ${id}`])).rows[0].n, 0);
      const stored = (await redis.lRange(`room:${loungeRoom}:guestmsgs`, 0, -1)).map((x) => JSON.parse(x));
      assert.ok(stored.some((m) => m.id === ack.id));
      assert.ok((await redis.pTTL(`room:${loungeRoom}:guestmsgs`)) > 0);
    });

    await check('기록 조회: PG + Redis 시간순 병합, 보는 사람마다 is_mine', async () => {
      const forB = (await call('GET', `/chat/rooms/${loungeRoom}/messages`, undefined, Bm.H)).j;
      const mine = forB.filter((m) => m.content.endsWith(id));
      assert.deepStrictEqual(mine.map((m) => m.content), [`회원 메시지 ${id}`, `게스트 메시지 ${id}`]);
      assert.deepStrictEqual(mine.map((m) => m.is_mine), [false, false]);
      const times = forB.map((m) => m.created_at);
      assert.deepStrictEqual(times, [...times].sort());
      const forG = (await call('GET', `/chat/rooms/${loungeRoom}/messages`, undefined, G.H)).j.filter((m) => m.content.endsWith(id));
      assert.deepStrictEqual(forG.map((m) => m.is_mine), [false, true]);
      assert.ok(forG.every((m) => !('guestId' in m) && !('expiresAt' in m) && !('senderKey' in m)));
    });

    await check('잘못된 메시지 → INVALID_MESSAGE, 비속어는 가려서 전달', async () => {
      for (const content of ['', '   ', 'x'.repeat(1001), 123, null]) {
        assert.strictEqual((await emit(a1, 'message:send', { roomId: loungeRoom, content })).code, 'INVALID_MESSAGE');
      }
      await emit(a1, 'message:send', { roomId: loungeRoom, content: '시발 진짜' });
      await sleep(300);
      assert.strictEqual(b.received.at(-1).content, '*** 진짜');
    });

    await check('1:1 방: 참여자만 입장·전송·기록 조회, 다른 회원·Guest는 거절', async () => {
      const c = await connect({ token: C.token });
      assert.strictEqual((await emit(c, 'room:join', { roomId: direct })).code, 'ROOM_NOT_FOUND');
      assert.strictEqual((await emit(c, 'message:send', { roomId: direct, content: '몰래' })).code, 'ROOM_NOT_FOUND');
      assert.strictEqual((await emit(g, 'room:join', { roomId: direct })).code, 'ROOM_NOT_FOUND');
      assert.strictEqual((await call('GET', `/chat/rooms/${direct}/messages`, undefined, C.H)).s, 404);
      assert.strictEqual((await call('GET', `/chat/rooms/${direct}/messages`, undefined, G.H)).s, 404);
      assert.strictEqual((await emit(a1, 'room:join', { roomId: direct })).ok, true);
      assert.strictEqual((await emit(b, 'room:join', { roomId: direct })).ok, true);
      await emit(a1, 'message:send', { roomId: direct, content: '안녕하세요' });
      await sleep(300);
      const seen = b.received.at(-1);
      assert.deepStrictEqual([seen.content, seen.sender_nickname, seen.room_id], ['안녕하세요', '별빛 여행자', direct]); // 방 단위 익명 이름
      assert.ok(!c.received.some((m) => m.room_id === direct));
    });

    await check('입력 중: 같은 방의 다른 사람에게만', async () => {
      const typing = once(b, 'typing');
      a1.emit('typing', { roomId: direct });
      assert.deepStrictEqual(await typing, { roomId: direct });
    });

    await check('Guest 목록 조회는 빈 목록, 토큰 없으면 401', async () => {
      assert.deepStrictEqual((await call('GET', '/chat/rooms', undefined, G.H)).j, { direct: [], lounges: [] });
      assert.strictEqual((await call('GET', '/chat/rooms')).s, 401);
    });

    await check('Guest 세션이 이벤트 사이에 만료 → 다음 이벤트에서 guest:expired 후 연결 종료', async () => {
      const G2 = await guest();
      const g2 = await connect({ guestToken: G2.guestToken });
      await redis.hSet(sessionKey(G2.guestToken), 'expiresAt', String(Date.now() - 1000));
      const expired = once(g2, 'guest:expired');
      const closed = once(g2, 'disconnect');
      g2.emit('typing', { roomId: loungeRoom });
      await expired;
      await closed;
    });

    await check('직접 종료(DELETE /guest/session)한 Guest도 다음 이벤트에서 종료', async () => {
      const G3 = await guest();
      const g3 = await connect({ guestToken: G3.guestToken });
      await call('DELETE', '/guest/session', undefined, G3.H);
      const expired = once(g3, 'guest:expired');
      g3.emit('room:join', { roomId: loungeRoom });
      await expired;
    });

    await check('브로드캐스트 때 만료된 Guest 수신자는 메시지를 받지 않고 종료, 만료 Guest 메시지는 기록에서 빠짐', async () => {
      const G4 = await guest();
      await redis.hSet(sessionKey(G4.guestToken), 'expiresAt', String(Date.now() + 2500)); // 2.5초 뒤 만료
      const g4 = await connect({ guestToken: G4.guestToken });
      await emit(g4, 'room:join', { roomId: loungeRoom });
      await emit(g4, 'message:send', { roomId: loungeRoom, content: `곧 사라질 메시지 ${id}` });
      await sleep(3000);
      const expired = once(g4, 'guest:expired');
      const before = g4.received.length;
      await emit(b, 'message:send', { roomId: loungeRoom, content: '만료 뒤 메시지' });
      await expired;
      assert.strictEqual(g4.received.length, before);
      const history = (await call('GET', `/chat/rooms/${loungeRoom}/messages`, undefined, Bm.H)).j;
      assert.ok(!history.some((m) => m.content === `곧 사라질 메시지 ${id}`));
    });

    await check('1:1 나가기: 나간 사람은 입장 불가, 둘 다 나가면 방 종료, 라운지는 400', async () => {
      assert.strictEqual((await call('POST', `/chat/rooms/${loungeRoom}/leave`, undefined, A.H)).s, 400);
      assert.strictEqual((await call('POST', `/chat/rooms/${direct}/leave`, undefined, A.H)).s, 200);
      // room:leave를 보내지 않은 기존 소켓(a1)도 나간 뒤 메시지는 받지 않음
      const before = a1.received.filter((m) => m.room_id === direct).length;
      await emit(b, 'message:send', { roomId: direct, content: '나간 뒤 메시지' });
      await sleep(300);
      assert.strictEqual(a1.received.filter((m) => m.room_id === direct).length, before);
      assert.strictEqual(b.received.at(-1).content, '나간 뒤 메시지');
      assert.strictEqual((await emit(a1, 'room:join', { roomId: direct })).code, 'ROOM_NOT_FOUND');
      assert.strictEqual((await call('GET', `/chat/rooms/${direct}/messages`, undefined, A.H)).s, 404);
      assert.strictEqual((await db.query('SELECT closed_at FROM chat_rooms WHERE id = $1', [direct])).rows[0].closed_at, null);
      assert.strictEqual((await call('POST', `/chat/rooms/${direct}/leave`, undefined, Bm.H)).s, 200);
      assert.ok((await db.query('SELECT closed_at FROM chat_rooms WHERE id = $1', [direct])).rows[0].closed_at);
    });

    console.log(`\n${passed}개 통과`);
  } catch (err) {
    console.error('FAIL ', err.message);
    process.exitCode = 1;
  } finally {
    sockets.forEach((s) => s.close());
    await redis.quit();
    await db.pool.end();
  }
})();
