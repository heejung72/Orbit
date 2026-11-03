// Guest → 회원 전환 E2E 테스트 (#14)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:guest-upgrade` (DB 시드 필요: npm run db:setup)
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
const sessionKey = (t) => 'guest:session:' + crypto.createHash('sha256').update(t).digest('hex');
const sockets = [];

function connect(auth) {
  return new Promise((resolve, reject) => {
    const s = io(SOCKET_URL, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    s.events = [];
    s.onAny((event, data) => s.events.push({ event, data }));
    s.on('disconnect', (reason) => s.events.push({ event: 'disconnect', data: reason }));
    s.once('connect', () => {
      sockets.push(s);
      resolve(s);
    });
    s.once('connect_error', (e) => reject(new Error(e.message)));
  });
}
const emit = (s, event, payload) => s.timeout(3000).emitWithAck(event, payload);

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
    const tags = cats.find((c) => c.code === 'travel').tags.slice(-3).map((t) => ({ tagId: t.id, weight: 3 }));
    const lounge = (await db.query(`SELECT l.id, cr.id AS room_id FROM lounges l JOIN chat_rooms cr ON cr.lounge_id = l.id ORDER BY l.created_at LIMIT 1`)).rows[0];

    const member = async (name) => {
      const r = await call('POST', '/auth/register', { email: `gu_${name}_${run}@orbit.test`, password: 'pw123456', nickname: name });
      await call('PUT', '/tastes/me', { tags }, { Authorization: 'Bearer ' + r.j.token });
      const s = await connect({ token: r.j.token });
      return { name, userId: jwt.decode(r.j.token).userId, H: { Authorization: 'Bearer ' + r.j.token }, s };
    };
    const guest = async () => {
      const g = (await call('POST', '/guest/session')).j;
      const H = { 'X-Guest-Token': g.guestToken };
      await call('PUT', '/tastes/me', { tags }, H);
      const s = await connect({ guestToken: g.guestToken });
      const guestId = await redis.hGet(sessionKey(g.guestToken), 'guestId');
      return { ...g, name: g.nickname, H, s, guestId };
    };
    // a가 b에게 요청, b가 수락 → roomId
    const match = async (a, b) => {
      const ref = (await call('GET', '/matching/candidates', null, a.H)).j.candidates.find((c) => c.nickname === b.name).ref;
      const r = await call('POST', '/matching/requests', { ref }, a.H);
      return (await call('POST', `/matching/requests/${r.j.id}/accept`, {}, b.H)).j.roomId;
    };
    const say = async (who, roomId, content) => {
      assert.ok((await emit(who.s, 'room:join', { roomId })).ok);
      const r = await emit(who.s, 'message:send', { roomId, content });
      assert.ok(r.ok, JSON.stringify(r));
      await sleep(5); // 같은 밀리초 시각으로 순서가 흔들리지 않게
    };
    const register = (g, email, nickname = '가입한궤도') =>
      call('POST', '/auth/register', { email, password: 'pw123456', nickname, avatar_id: g.avatarId }, g.H);

    const M = await member('전환상대');
    const G = await guest();
    const G2 = await guest();
    const G3 = await guest();
    await sleep(200);

    // Guest G의 둘러보기 기록 만들기
    assert.strictEqual((await call('POST', `/lounges/${lounge.id}/join`, {}, G.H)).s, 200);
    await say(G, lounge.room_id, `G 라운지 메시지 ${run}`);
    await say(G3, lounge.room_id, `G3 라운지 메시지 ${run}`);
    const memberRoom = await match(M, G);
    await say(M, memberRoom, '회원이 먼저');
    await say(G, memberRoom, 'Guest가 답장');
    await say(M, memberRoom, '회원 또 한 마디');
    const guestRoom = await match(G2, G);
    await say(G2, guestRoom, 'G2 인사');
    await say(G, guestRoom, 'G 답장');
    const pendingFromM2 = await member('대기요청');
    await sleep(150);
    const pendingRef = (await call('GET', '/matching/candidates', null, pendingFromM2.H)).j.candidates.find((c) => c.nickname === G.name).ref;
    const pending = await call('POST', '/matching/requests', { ref: pendingRef }, pendingFromM2.H);

    let userId;
    let res;
    await check('가입 + X-Guest-Token → 201, 이전 요약, 회원 토큰', async () => {
      res = await register(G, `gu_new_${run}@orbit.test`);
      assert.strictEqual(res.s, 201, JSON.stringify(res.j));
      assert.deepStrictEqual(res.j.migrated, { tastes: 3, lounges: 1, lounge_messages: 1, direct_rooms: 2 });
      userId = jwt.decode(res.j.token).userId;
      assert.ok(!('id' in res.j.user));
    });
    const U = { H: { Authorization: 'Bearer ' + res.j.token } };

    await check('취향·라운지 참여가 회원 계정으로, 라운지 메시지는 본인 것만 PG로', async () => {
      const mine = (await call('GET', '/tastes/me', null, U.H)).j;
      assert.deepStrictEqual(mine.map((t) => t.tag_id).sort(), tags.map((t) => t.tagId).sort());
      assert.strictEqual((await db.query('SELECT 1 FROM lounge_members WHERE lounge_id = $1 AND user_id = $2', [lounge.id, userId])).rowCount, 1);
      const pg = await db.query('SELECT sender_id, content FROM messages WHERE room_id = $1 AND content LIKE $2', [lounge.room_id, `%${run}`]);
      assert.deepStrictEqual(pg.rows.map((r) => [r.sender_id, r.content]), [[userId, `G 라운지 메시지 ${run}`]]);
      const history = (await call('GET', `/chat/rooms/${lounge.room_id}/messages?limit=100`, null, U.H)).j.filter((m) => m.content.endsWith(run));
      assert.deepStrictEqual(history.map((m) => [m.content, m.is_mine, m.is_guest]), [[`G 라운지 메시지 ${run}`, true, false], [`G3 라운지 메시지 ${run}`, false, true]]);
      assert.strictEqual(await redis.zScore(`lounge:${lounge.id}:guests`, G.guestId), null);
    });

    await check('회원과의 1:1 방 → 같은 roomId의 PG 방, 순서·작성자·표시 이름 유지, Redis에서 삭제', async () => {
      assert.strictEqual((await db.query('SELECT 1 FROM chat_rooms WHERE id = $1', [memberRoom])).rowCount, 1);
      const rows = (await db.query('SELECT sender_id, content FROM messages WHERE room_id = $1 ORDER BY created_at', [memberRoom])).rows;
      assert.deepStrictEqual(rows.map((r) => [r.sender_id, r.content]), [[M.userId, '회원이 먼저'], [userId, 'Guest가 답장'], [M.userId, '회원 또 한 마디']]);
      const seenByM = (await call('GET', `/chat/rooms/${memberRoom}/messages`, null, M.H)).j;
      assert.deepStrictEqual(seenByM.map((m) => [m.content, m.is_mine, m.is_guest]), [['회원이 먼저', true, false], ['Guest가 답장', false, false], ['회원 또 한 마디', true, false]]);
      assert.strictEqual(seenByM[1].sender_nickname, G.nickname, '상대 화면에서는 닉네임 그대로');
      assert.strictEqual(seenByM[1].sender_avatar_emoji, G.avatarEmoji);
      assert.strictEqual(await redis.exists([`room:${memberRoom}`, `room:${memberRoom}:msgs`]), 0);
      const listM = (await call('GET', '/chat/rooms', null, M.H)).j.direct.filter((r) => r.id === memberRoom);
      assert.strictEqual(listM.length, 1, '목록에 한 번만');
      assert.strictEqual(listM[0].partner_is_guest, false);
      // 이어서 대화하면 PG에 저장
      const U2 = await connect({ token: res.j.token });
      await say({ s: U2 }, memberRoom, '가입하고 이어서');
      assert.strictEqual((await db.query('SELECT sender_id FROM messages WHERE room_id = $1 AND content = $2', [memberRoom, '가입하고 이어서'])).rows[0].sender_id, userId);
    });

    await check('Guest끼리 방은 Redis에 그대로, 참여자·작성자만 회원으로 (상대 화면은 Guest 배지만 빠짐)', async () => {
      assert.strictEqual((await db.query('SELECT 1 FROM chat_rooms WHERE id = $1', [guestRoom])).rowCount, 0);
      const mine = (await call('GET', `/chat/rooms/${guestRoom}/messages`, null, U.H)).j;
      assert.deepStrictEqual(mine.map((m) => [m.content, m.is_mine]), [['G2 인사', false], ['G 답장', true]]);
      const seenByG2 = (await call('GET', `/chat/rooms/${guestRoom}/messages`, null, G2.H)).j;
      assert.deepStrictEqual(seenByG2.map((m) => [m.content, m.is_mine, m.is_guest, m.sender_nickname]), [['G2 인사', true, true, G2.nickname], ['G 답장', false, false, G.nickname]]);
      const expireAt = await redis.pExpireTime(`room:${guestRoom}`);
      assert.ok(Math.abs(expireAt - Date.parse(G2.expiresAt)) < 1000, '남은 Guest의 만료 시각까지');
      assert.ok((await call('GET', '/chat/rooms', null, U.H)).j.direct.some((r) => r.id === guestRoom && r.partner_is_guest));
    });

    await check('Guest 세션·대기 요청 정리, Guest 소켓은 guest:expired 없이 끊김', async () => {
      assert.strictEqual(await redis.exists([sessionKey(G.guestToken), `guest:tastes:${G.guestId}`, `guest:profile:${G.guestId}`, `actor:rooms:guest:${G.guestId}`]), 0);
      assert.strictEqual((await call('GET', '/auth/me', null, G.H)).j.code, 'GUEST_EXPIRED');
      assert.strictEqual(await redis.exists(`match:${pending.j.id}`), 0);
      assert.ok(G.s.events.some((e) => e.event === 'disconnect'));
      assert.ok(!G.s.events.some((e) => e.event === 'guest:expired'));
    });

    await check('같은 Guest 토큰을 다시 쓰면 이전 없이 가입 (한 번만 이전)', async () => {
      const again = await register(G, `gu_again_${run}@orbit.test`);
      assert.strictEqual(again.s, 201);
      assert.strictEqual(again.j.migrated, null);
      const otherId = jwt.decode(again.j.token).userId;
      assert.strictEqual((await db.query('SELECT count(*)::int AS n FROM user_tastes WHERE user_id = $1', [otherId])).rows[0].n, 0);
    });

    await check('같은 토큰으로 동시에 가입하면 한 요청만 이전', async () => {
      const H = await guest();
      await call('POST', `/lounges/${lounge.id}/join`, {}, H.H);
      const [a, b] = await Promise.all([register(H, `gu_c1_${run}@orbit.test`), register(H, `gu_c2_${run}@orbit.test`)]);
      const migrated = [a, b].filter((r) => r.s === 201 && r.j.migrated);
      assert.strictEqual(migrated.length, 1, JSON.stringify([a.s, a.j, b.s, b.j]));
      const other = migrated[0] === a ? b : a;
      assert.ok(other.s === 409 ? other.j.code === 'UPGRADE_IN_PROGRESS' : other.j.migrated === null);
    });

    await check('이전 중 실패하면 회원 생성까지 되돌리고 Guest는 그대로 (다시 시도 가능)', async () => {
      const F = await guest();
      await redis.hSet(`guest:tastes:${F.guestId}`, '999999', '3'); // 없는 태그 → user_tastes FK 위반
      const email = `gu_fail_${run}@orbit.test`;
      const r = await register(F, email);
      assert.strictEqual(r.s, 500);
      assert.strictEqual((await db.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount, 0);
      assert.strictEqual((await call('GET', '/auth/me', null, F.H)).j.type, 'guest');
      await redis.hDel(`guest:tastes:${F.guestId}`, '999999');
      const retry = await register(F, email);
      assert.strictEqual(retry.s, 201);
      assert.strictEqual(retry.j.migrated.tastes, 3);
    });

    await check('만료·위조 토큰이면 이전 없이 가입, 이메일 중복은 409 (Guest 유지)', async () => {
      const fake = await call('POST', '/auth/register', { email: `gu_fake_${run}@orbit.test`, password: 'pw123456', nickname: '위조토큰' }, { 'X-Guest-Token': 'x'.repeat(43) });
      assert.strictEqual(fake.s, 201);
      assert.strictEqual(fake.j.migrated, null);
      const K = await guest();
      const dup = await register(K, `gu_new_${run}@orbit.test`);
      assert.strictEqual(dup.s, 409);
      assert.strictEqual((await call('GET', '/auth/me', null, K.H)).j.type, 'guest');
      assert.strictEqual(await redis.exists(`guest:upgrade:${K.guestId}`), 0, '실패하면 선점 해제');
    });

    await check('Guest 메시지 20개째에 signup:nudge 한 번', async () => {
      const N = await guest();
      for (let i = 1; i <= 21; i += 1) {
        await emit(N.s, 'message:send', { roomId: lounge.room_id, content: `nudge ${i} ${run}` });
        if (i === 19) assert.ok(!N.s.events.some((e) => e.event === 'signup:nudge'));
      }
      await sleep(200);
      const nudges = N.s.events.filter((e) => e.event === 'signup:nudge');
      assert.deepStrictEqual(nudges.map((e) => e.data), [{ reason: 'messages' }]);
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
