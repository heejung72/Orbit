// Guest Time Attack E2E 테스트 (#12)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:guest-expiry`
// 정리 작업 주기(GUEST_CLEANUP_INTERVAL_MS, 기본 30초)만큼 기다리는 검사가 있어, 서버 .env에서 줄여두면 빨리 끝난다
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');
const { io } = require('socket.io-client');
const { createClient } = require('redis');
const db = require('../db');

const B = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
const SOCKET_URL = B.replace(/\/api$/, '');
const CLEANUP_MS = Number(process.env.GUEST_CLEANUP_INTERVAL_MS) || 30000;
const WARNING_MS = (Number(process.env.GUEST_WARNING_MINUTES) || 5) * 60 * 1000;
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
function connect(auth) {
  return new Promise((resolve, reject) => {
    const s = io(SOCKET_URL, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    s.events = [];
    for (const e of ['guest:warning', 'guest:expired']) s.on(e, (p) => s.events.push([e, p, Date.now()]));
    s.once('connect', () => {
      sockets.push(s);
      resolve(s);
    });
    s.once('connect_error', reject);
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
  // 세션 만료 시각을 테스트용으로 당긴다 (연결 전에 바꿔야 소켓 타이머에 반영됨)
  const guest = async (expiresInMs) => {
    const g = (await call('POST', '/guest/session')).j;
    const guestId = await redis.hGet(sessionKey(g.guestToken), 'guestId');
    if (expiresInMs !== undefined) {
      const at = Date.now() + expiresInMs;
      await redis.hSet(sessionKey(g.guestToken), 'expiresAt', String(at));
      await redis.pExpireAt(sessionKey(g.guestToken), at);
    }
    return { ...g, guestId, H: { 'X-Guest-Token': g.guestToken } };
  };
  try {
    const id = crypto.randomBytes(4).toString('hex');
    const reg = await call('POST', '/auth/register', { email: `expiry_${id}@orbit.test`, password: 'pw123456', nickname: '만료관찰' });
    const M = { Authorization: 'Bearer ' + reg.j.token };
    const lounge = (await call('GET', '/lounges', undefined, M)).j[0];
    const room = (await call('GET', `/lounges/${lounge.id}`, undefined, M)).j.chat_room_id;

    await check('만료 5분 전에 guest:warning 1회 (remainingSec ≈ 300)', async () => {
      const g = await guest(WARNING_MS + 1500);
      const s = await connect({ guestToken: g.guestToken });
      await sleep(2500);
      const warnings = s.events.filter(([e]) => e === 'guest:warning');
      assert.strictEqual(warnings.length, 1);
      assert.ok(Math.abs(warnings[0][1].remainingSec - WARNING_MS / 1000) <= 2, JSON.stringify(warnings[0][1]));
      assert.ok(!s.events.some(([e]) => e === 'guest:expired'));
    });

    await check('연결할 때 이미 5분 이하면 바로 guest:warning', async () => {
      const g = await guest(60 * 1000);
      const s = await connect({ guestToken: g.guestToken });
      await sleep(500);
      const w = s.events.find(([e]) => e === 'guest:warning');
      assert.ok(w && w[1].remainingSec <= 60 && w[1].remainingSec >= 58);
    });

    await check('정리 작업: 쉬고 있던 소켓도 세션이 없어지면(다른 곳에서 종료) guest:expired 후 연결 종료', async () => {
      const g = await guest();
      const s = await connect({ guestToken: g.guestToken });
      await redis.del(sessionKey(g.guestToken)); // 세션만 사라지고 이 소켓은 아무 이벤트도 보내지 않음
      await sleep(CLEANUP_MS + 1500);
      assert.ok(s.events.some(([e]) => e === 'guest:expired') && s.disconnected);
    });

    await check('정리 작업: 만료 Guest의 라운지 참여·라운지 메시지가 Redis에서 사라지고 회원 메시지는 남음', async () => {
      const g = await guest(2000);
      await call('POST', `/lounges/${lounge.id}/join`, undefined, g.H);
      const s = await connect({ guestToken: g.guestToken });
      await emit(s, 'room:join', { roomId: room });
      const guestMsg = await emit(s, 'message:send', { roomId: room, content: `만료될 메시지 ${id}` });
      const m = await connect({ token: reg.j.token });
      await emit(m, 'room:join', { roomId: room });
      await emit(m, 'message:send', { roomId: room, content: `남을 회원 메시지 ${id}` });
      assert.ok(await redis.zScore(`lounge:${lounge.id}:guests`, g.guestId));

      await sleep(2000 + CLEANUP_MS + 1500); // 만료 + 정리 한 주기
      assert.strictEqual(await redis.zScore(`lounge:${lounge.id}:guests`, g.guestId), null);
      const stored = (await redis.lRange(`room:${room}:guestmsgs`, 0, -1)).map((x) => JSON.parse(x));
      assert.ok(!stored.some((x) => x.id === guestMsg.id));
      assert.ok(stored.every((x) => x.expiresAt > Date.now()), '만료된 Guest 메시지가 남아 있음');
      const pg = await db.query('SELECT count(*)::int AS n FROM messages WHERE content = $1', [`남을 회원 메시지 ${id}`]);
      assert.strictEqual(pg.rows[0].n, 1);
      assert.ok(s.events.some(([e]) => e === 'guest:expired'));
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
