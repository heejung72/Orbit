// 1:1 취향 매칭 E2E 테스트 (#13)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:matching` (DB 시드 필요: npm run db:setup)
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
    body: body == null ? undefined : JSON.stringify(body),
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sockets = [];

function connect(auth) {
  return new Promise((resolve, reject) => {
    const s = io(SOCKET_URL, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    s.events = [];
    s.onAny((event, data) => s.events.push({ event, data }));
    s.once('connect', () => {
      sockets.push(s);
      resolve(s);
    });
    s.once('connect_error', (e) => reject(new Error(e.message)));
  });
}
const emit = (s, event, payload) => s.timeout(3000).emitWithAck(event, payload);
const waitEvent = async (s, event, pred = () => true, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const found = s.events.find((e) => e.event === event && pred(e.data));
    if (found) return found.data;
    await sleep(50);
  }
  throw new Error(`${event} 미수신`);
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
    const run = crypto.randomBytes(4).toString('hex');
    const cats = (await call('GET', '/public/tastes')).j;
    // 다른 테스트 사용자와 섞이지 않게 잘 안 쓰는 태그 조합 (취미 카테고리 뒤쪽 태그)
    const hobby = cats.find((c) => c.code === 'hobby').tags.slice(-3);
    const tagsOf = (list, weight = 3) => list.map((t) => ({ tagId: t.id, weight }));
    const myTags = tagsOf(hobby);

    const member = async (name, { online = true, tags = myTags } = {}) => {
      const r = await call('POST', '/auth/register', { email: `mt_${name}_${run}@orbit.test`, password: 'pw123456', nickname: name });
      const H = { Authorization: 'Bearer ' + r.j.token };
      if (tags) await call('PUT', '/tastes/me', { tags }, H);
      const s = online ? await connect({ token: r.j.token }) : null;
      return { name, userId: jwt.decode(r.j.token).userId, H, s };
    };
    const guest = async ({ tags = myTags } = {}) => {
      const g = (await call('POST', '/guest/session')).j;
      const H = { 'X-Guest-Token': g.guestToken };
      if (tags) await call('PUT', '/tastes/me', { tags }, H);
      const s = await connect({ guestToken: g.guestToken });
      return { name: g.nickname, token: g.guestToken, expiresAt: Date.parse(g.expiresAt), H, s };
    };
    const candidates = async (a) => (await call('GET', '/matching/candidates', null, a.H)).j.candidates;
    const refFor = async (a, b) => (await candidates(a)).find((c) => c.nickname === b.name)?.ref;
    const request = async (a, b) => call('POST', '/matching/requests', { ref: await refFor(a, b) }, a.H);

    const A = await member('매칭에이');
    const Bm = await member('매칭비이');
    const C = await member('오프라인씨', { online: false });
    const N = await member('취향없음', { tags: null });
    const G = await guest();
    await sleep(200);

    await check('후보: 접속 중이고 취향 있는 회원·Guest만 (오프라인·취향 없음·본인 제외)', async () => {
      const list = await candidates(A);
      const names = list.map((c) => c.nickname);
      assert.ok(names.includes(Bm.name) && names.includes(G.name), names.join(','));
      assert.ok(!names.includes(C.name) && !names.includes(N.name) && !names.includes(A.name));
      const g = list.find((c) => c.nickname === G.name);
      assert.strictEqual(g.is_guest, true);
      assert.strictEqual(g.similarity, 100);
      assert.strictEqual(g.common_tags.length, 3);
      assert.ok(list.length <= 10);
    });

    await check('후보 응답에 user_id·guestId 없음 (ref만)', async () => {
      const text = JSON.stringify(await candidates(A));
      assert.ok(!text.includes(Bm.userId));
      const guestId = await redis.hGet('guest:session:' + crypto.createHash('sha256').update(G.token).digest('hex'), 'guestId');
      assert.ok(guestId && !text.includes(guestId));
      assert.ok(!/"(id|user_id|userId|guestId)"/.test(text));
    });

    await check('위조·남의 ref·만료 ref 요청은 404 REF_INVALID', async () => {
      assert.strictEqual((await call('POST', '/matching/requests', { ref: 'x'.repeat(24) }, A.H)).j.code, 'REF_INVALID');
      assert.strictEqual((await call('POST', '/matching/requests', {}, A.H)).s, 404);
      const ref = await refFor(A, Bm);
      assert.strictEqual((await call('POST', '/matching/requests', { ref }, G.H)).j.code, 'REF_INVALID'); // A에게 발급된 ref
      await redis.del(`match:ref:${ref}`);
      assert.strictEqual((await call('POST', '/matching/requests', { ref }, A.H)).j.code, 'REF_INVALID');
    });

    await check('예전 API(/find, /request/:id, /my) 제거', async () => {
      assert.strictEqual((await call('POST', '/matching/find', {}, A.H)).s, 404);
      assert.strictEqual((await call('GET', '/matching/my', null, A.H)).s, 404);
    });

    let pgMatchId;
    await check('회원↔회원 요청: PG 기록, 상대에게 match:request, 받은·보낸 목록, 후보에서 빠짐', async () => {
      const r = await request(A, Bm);
      assert.strictEqual(r.s, 201, JSON.stringify(r.j));
      pgMatchId = r.j.id;
      assert.strictEqual(r.j.direction, 'sent');
      assert.strictEqual(r.j.nickname, Bm.name);
      const ev = await waitEvent(Bm.s, 'match:request', (d) => d.id === pgMatchId);
      assert.strictEqual(ev.nickname, A.name);
      assert.strictEqual(ev.direction, 'received');
      const row = (await db.query('SELECT status FROM match_history WHERE id = $1', [pgMatchId])).rows[0];
      assert.strictEqual(row.status, 'pending');
      assert.ok((await call('GET', '/matching/requests', null, Bm.H)).j.received.some((m) => m.id === pgMatchId));
      assert.ok((await call('GET', '/matching/requests', null, A.H)).j.sent.some((m) => m.id === pgMatchId));
      assert.ok(!(await candidates(A)).some((c) => c.nickname === Bm.name));
      assert.ok(!(await candidates(Bm)).some((c) => c.nickname === A.name));
    });

    await check('중복 수락: 동시에 두 번 수락해도 방은 하나, 양쪽에 match:accepted', async () => {
      const [r1, r2] = await Promise.all([
        call('POST', `/matching/requests/${pgMatchId}/accept`, {}, Bm.H),
        call('POST', `/matching/requests/${pgMatchId}/accept`, {}, Bm.H),
      ]);
      assert.deepStrictEqual([r1.s, r2.s].sort(), [200, 404]);
      const roomId = (r1.s === 200 ? r1 : r2).j.roomId;
      const rooms = await db.query('SELECT room_id FROM match_history WHERE id = $1', [pgMatchId]);
      assert.strictEqual(rooms.rows[0].room_id, roomId);
      assert.strictEqual((await db.query(`SELECT count(*)::int AS n FROM chat_members WHERE room_id = $1`, [roomId])).rows[0].n, 2);
      const evA = await waitEvent(A.s, 'match:accepted', (d) => d.matchId === pgMatchId);
      assert.strictEqual(evA.roomId, roomId);
      assert.strictEqual(evA.title, Bm.name);
      assert.strictEqual((await waitEvent(Bm.s, 'match:accepted', (d) => d.matchId === pgMatchId)).title, A.name);
      assert.ok(!(await candidates(A)).some((c) => c.nickname === Bm.name), '대화 중인 상대는 후보에서 제외');
      const topics = (await call('GET', `/chat/rooms/${roomId}/topics`, null, A.H)).j.topics;
      assert.ok(topics.length >= 1 && topics.length <= 3 && topics.some((t) => hobby.some((h) => t.includes(h.name))), JSON.stringify(topics));
      // PG 방도 상대가 나가면 일반 질문
      await db.query('UPDATE chat_members SET left_at = now() WHERE room_id = $1 AND user_id = $2', [roomId, Bm.userId]);
      const after = (await call('GET', `/chat/rooms/${roomId}/topics`, null, A.H)).j.topics;
      assert.ok(after.length === 2 && !after.some((t) => hobby.some((h) => t.includes(h.name))), JSON.stringify(after));
    });

    await check('동시에 서로 요청(회원끼리): 하나만 성공', async () => {
      const D = await member('동시디');
      const E = await member('동시이');
      await sleep(150);
      const [refD, refE] = [await refFor(D, E), await refFor(E, D)];
      const [r1, r2] = await Promise.all([
        call('POST', '/matching/requests', { ref: refD }, D.H),
        call('POST', '/matching/requests', { ref: refE }, E.H),
      ]);
      assert.deepStrictEqual([r1.s, r2.s].sort(), [201, 409]);
      const n = await db.query(
        `SELECT count(*)::int AS n FROM match_history WHERE status = 'pending' AND requester_id = ANY($1::uuid[]) AND target_id = ANY($1::uuid[])`,
        [[D.userId, E.userId]]
      );
      assert.strictEqual(n.rows[0].n, 1);
      [D, E].forEach((x) => x.s.disconnect()); // 후보 상위 10명 안에 다른 테스트 대상이 들어오도록
    });

    await check('거절: 요청자에게 match:rejected, 24시간 동안 서로 후보에서 제외', async () => {
      const X = await member('거절엑스');
      const Y = await member('거절와이');
      await sleep(150);
      const r = await request(X, Y);
      const rej = await call('POST', `/matching/requests/${r.j.id}/reject`, {}, Y.H);
      assert.strictEqual(rej.s, 200);
      await waitEvent(X.s, 'match:rejected', (d) => d.matchId === r.j.id);
      assert.ok(!(await candidates(X)).some((c) => c.nickname === Y.name));
      assert.ok(!(await candidates(Y)).some((c) => c.nickname === X.name));
      assert.strictEqual((await call('POST', `/matching/requests/${r.j.id}/accept`, {}, Y.H)).s, 404, '거절한 요청은 수락 불가');
      assert.strictEqual((await call('POST', `/matching/requests/${r.j.id}/accept`, {}, X.H)).s, 404, '요청자는 수락 불가');
      [X, Y].forEach((x) => x.s.disconnect());
    });

    await check('차단 관계(양방향)는 후보에서 제외', async () => {
      const Z = await member('차단제트');
      await sleep(150);
      assert.ok((await candidates(A)).some((c) => c.nickname === Z.name));
      await db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [Z.userId, A.userId]);
      assert.ok(!(await candidates(A)).some((c) => c.nickname === Z.name));
      assert.ok(!(await candidates(Z)).some((c) => c.nickname === A.name));
      Z.s.disconnect();
    });

    await check('상대가 접속을 끊으면 요청은 409 TARGET_OFFLINE', async () => {
      const O = await member('곧나감');
      await sleep(150);
      const ref = await refFor(A, O);
      O.s.disconnect();
      await sleep(200);
      assert.strictEqual((await call('POST', '/matching/requests', { ref }, A.H)).j.code, 'TARGET_OFFLINE');
      assert.ok(!(await candidates(A)).some((c) => c.nickname === O.name), '오프라인 상대는 후보에서 제외');
    });

    let redisRoomId;
    let guestMatchId;
    await check('회원↔Guest: Redis 요청·방, PG에 방·메시지 없음, 양쪽 실시간 대화', async () => {
      const r = await request(A, G);
      assert.strictEqual(r.s, 201, JSON.stringify(r.j));
      guestMatchId = r.j.id;
      assert.strictEqual((await db.query('SELECT 1 FROM match_history WHERE id = $1', [guestMatchId])).rowCount, 0);
      assert.ok(await redis.exists(`match:${guestMatchId}`));
      await waitEvent(G.s, 'match:request', (d) => d.id === guestMatchId);
      assert.ok((await call('GET', '/matching/requests', null, G.H)).j.received.some((m) => m.id === guestMatchId));

      const acc = await call('POST', `/matching/requests/${guestMatchId}/accept`, {}, G.H);
      assert.strictEqual(acc.s, 200);
      redisRoomId = acc.j.roomId;
      assert.strictEqual(acc.j.title, A.name);
      assert.strictEqual((await waitEvent(A.s, 'match:accepted', (d) => d.matchId === guestMatchId)).roomId, redisRoomId);
      assert.strictEqual((await db.query('SELECT 1 FROM chat_rooms WHERE id = $1', [redisRoomId])).rowCount, 0);

      assert.ok((await emit(A.s, 'room:join', { roomId: redisRoomId })).ok);
      assert.ok((await emit(G.s, 'room:join', { roomId: redisRoomId })).ok);
      assert.ok((await emit(A.s, 'message:send', { roomId: redisRoomId, content: '회원 메시지' })).ok);
      assert.ok((await emit(G.s, 'message:send', { roomId: redisRoomId, content: 'Guest 메시지' })).ok);
      const got = await waitEvent(G.s, 'message:new', (m) => m.content === '회원 메시지');
      assert.strictEqual(got.is_mine, false);
      assert.strictEqual(got.sender_nickname, A.name);
      assert.strictEqual((await db.query('SELECT count(*)::int AS n FROM messages WHERE room_id::text = $1', [redisRoomId])).rows[0].n, 0);

      const history = (await call('GET', `/chat/rooms/${redisRoomId}/messages`, null, A.H)).j;
      assert.deepStrictEqual(history.map((m) => [m.content, m.is_mine, m.is_guest]), [['회원 메시지', true, false], ['Guest 메시지', false, true]]);
      const listA = (await call('GET', '/chat/rooms', null, A.H)).j.direct;
      const roomA = listA.find((x) => x.id === redisRoomId);
      assert.strictEqual(roomA.partner_nickname, G.name);
      assert.strictEqual(roomA.partner_is_guest, true);
      assert.strictEqual(roomA.last_message, 'Guest 메시지');
      assert.ok(listA.some((x) => x.partner_nickname === Bm.name), 'PG 방도 함께');
      assert.ok((await call('GET', '/chat/rooms', null, G.H)).j.direct.some((x) => x.id === redisRoomId && x.partner_nickname === A.name));
      const topics = (await call('GET', `/chat/rooms/${redisRoomId}/topics`, null, G.H)).j.topics;
      assert.ok(topics.length >= 1 && topics.length <= 3);

      const C2 = await member('구경꾼');
      assert.strictEqual((await call('GET', `/chat/rooms/${redisRoomId}/messages`, null, C2.H)).s, 404, '참여자가 아니면 접근 불가');
    });

    await check('Guest↔Guest: 동시에 서로 요청해도 하나만, Redis 방은 먼저 만료되는 Guest 시각에 사라짐', async () => {
      const G2 = await guest();
      const G3 = await guest();
      await sleep(150);
      const [ref2, ref3] = [await refFor(G2, G3), await refFor(G3, G2)];
      const [r1, r2] = await Promise.all([
        call('POST', '/matching/requests', { ref: ref2 }, G2.H),
        call('POST', '/matching/requests', { ref: ref3 }, G3.H),
      ]);
      assert.deepStrictEqual([r1.s, r2.s].sort(), [201, 409]);
      const [win, accepter] = r1.s === 201 ? [r1, G3] : [r2, G2];
      const acc = await call('POST', `/matching/requests/${win.j.id}/accept`, {}, accepter.H);
      assert.strictEqual(acc.s, 200);
      const expireAt = await redis.pExpireTime(`room:${acc.j.roomId}`);
      assert.ok(Math.abs(expireAt - Math.min(G2.expiresAt, G3.expiresAt)) < 1000, `${expireAt}`);
    });

    await check('Guest가 둘러보기를 끝내면 그 Guest의 1:1 방·요청 정리', async () => {
      const G4 = await guest();
      await sleep(150);
      const pending = await request(A, G4);
      assert.strictEqual(pending.s, 201);
      assert.strictEqual((await call('DELETE', '/guest/session', undefined, G.H)).s, 200);
      assert.strictEqual((await call('DELETE', '/guest/session', undefined, G4.H)).s, 200);
      // 채팅 목록을 열지 않아도 후보 계산 때 회원 목록 키에서 사라진 방이 정리됨
      assert.ok(await redis.sIsMember(`actor:rooms:member:${A.userId}`, redisRoomId));
      await candidates(A);
      assert.ok(!(await redis.sIsMember(`actor:rooms:member:${A.userId}`, redisRoomId)));
      assert.strictEqual((await call('GET', `/chat/rooms/${redisRoomId}/messages`, null, A.H)).s, 404);
      assert.ok(!(await call('GET', '/chat/rooms', null, A.H)).j.direct.some((x) => x.id === redisRoomId));
      assert.ok(!(await call('GET', '/matching/requests', null, A.H)).j.sent.some((m) => m.id === pending.j.id));
      assert.strictEqual(await redis.exists([`room:${redisRoomId}`, `room:${redisRoomId}:msgs`, `match:${guestMatchId}`, `match:${pending.j.id}`]), 0);
      assert.ok(!(await emit(A.s, 'message:send', { roomId: redisRoomId, content: '아직 있어요?' })).ok);
    });

    await check('Redis 1:1 방 나가기: 나간 사람은 접근 불가, 둘 다 나가면 방 삭제', async () => {
      const G5 = await guest();
      await sleep(150);
      const r = await request(G5, A);
      const acc = await call('POST', `/matching/requests/${r.j.id}/accept`, {}, A.H);
      const roomId = acc.j.roomId;
      assert.strictEqual((await call('POST', `/chat/rooms/${roomId}/leave`, {}, G5.H)).s, 200);
      assert.strictEqual((await call('GET', `/chat/rooms/${roomId}/messages`, null, G5.H)).s, 404);
      assert.strictEqual((await call('GET', `/chat/rooms/${roomId}/messages`, null, A.H)).s, 200);
      const topics = (await call('GET', `/chat/rooms/${roomId}/topics`, null, A.H)).j.topics;
      assert.ok(topics.length === 2 && !topics.some((t) => hobby.some((h) => t.includes(h.name))), '상대가 나간 방은 일반 질문');
      assert.strictEqual((await call('POST', `/chat/rooms/${roomId}/leave`, {}, A.H)).s, 200);
      assert.strictEqual(await redis.exists(`room:${roomId}`), 0);
    });

    await check('회원 탈퇴(#17) 시 Guest와의 Redis 1:1 방에서도 나감', async () => {
      const Q = await member('탈퇴할회원');
      const G6 = await guest();
      await sleep(150);
      const r = await request(Q, G6);
      const roomId = (await call('POST', `/matching/requests/${r.j.id}/accept`, {}, G6.H)).j.roomId;
      assert.strictEqual((await call('DELETE', '/users/me', { password: 'pw123456' }, Q.H)).s, 200);
      assert.ok(await redis.hExists(`room:${roomId}`, `left:member:${Q.userId}`));
      assert.strictEqual(await redis.exists(`actor:rooms:member:${Q.userId}`), 0);
      assert.strictEqual((await call('GET', `/chat/rooms/${roomId}/messages`, null, G6.H)).s, 200, '남은 Guest는 기록을 볼 수 있음');
    });

    await check('온라인 상태: 같은 사람 두 기기는 1명, 마지막 기기가 끊기면 제외', async () => {
      const M = await member('두기기');
      const tok = (await call('POST', '/auth/login', { email: `mt_두기기_${run}@orbit.test`, password: 'pw123456' })).j.token;
      const s2 = await connect({ token: tok });
      await sleep(150);
      assert.strictEqual(Number(await redis.hGet('online:actors', `member:${M.userId}`)), 2);
      M.s.disconnect();
      await sleep(150);
      assert.ok((await candidates(A)).some((c) => c.nickname === M.name));
      s2.disconnect();
      await sleep(150);
      assert.strictEqual(await redis.hExists('online:actors', `member:${M.userId}`), false);
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
