// 취향 라운지 E2E 테스트 (#11)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:lounges` (DB 시드 필요: npm run db:setup)
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');
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
function connect(auth) {
  return new Promise((resolve, reject) => {
    const s = io(SOCKET_URL, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
    s.presence = [];
    s.on('room:presence', (p) => s.presence.push(p.count));
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
  let restoreMax = null;
  try {
    const id = crypto.randomBytes(4).toString('hex');
    const member = async (name) => {
      const r = await call('POST', '/auth/register', { email: `lounge_${name}_${id}@orbit.test`, password: 'pw123456', nickname: name });
      return { token: r.j.token, H: { Authorization: 'Bearer ' + r.j.token } };
    };
    const guest = async () => {
      const g = (await call('POST', '/guest/session')).j;
      return { ...g, H: { 'X-Guest-Token': g.guestToken }, guestId: await redis.hGet(sessionKey(g.guestToken), 'guestId') };
    };
    const [A, C] = [await member('라운지에이'), await member('라운지씨')];
    const G = await guest();
    const cats = (await call('GET', '/tastes/categories', undefined, A.H)).j;
    const music = cats.find((c) => c.code === 'music');
    const lounges = (await call('GET', '/lounges', undefined, A.H)).j;
    const musicLounge = lounges.find((l) => l.category_id === music.id);
    const L = musicLounge.id;
    const detail = async (h) => (await call('GET', `/lounges/${L}`, undefined, h)).j;
    const pgCount = async () => (await db.query('SELECT COUNT(*)::int AS n FROM lounge_members WHERE lounge_id = $1', [L])).rows[0].n;

    await check('목록: 인원·내 참여 여부, 카테고리 필터, 잘못된 category_id 400', async () => {
      assert.ok(lounges.length >= 1 && lounges.every((l) => typeof l.member_count === 'number' && l.is_member === false));
      const filtered = (await call('GET', `/lounges?category_id=${music.id}`, undefined, A.H)).j;
      assert.ok(filtered.length >= 1 && filtered.every((l) => l.category_id === music.id));
      assert.strictEqual((await call('GET', '/lounges?category_id=abc', undefined, A.H)).s, 400);
    });

    await check('회원 참여: PG 기록, 인원 +1, 다시 참여해도 중복 없음, 나가면 원래대로', async () => {
      const before = (await detail(A.H)).member_count;
      assert.strictEqual((await call('POST', `/lounges/${L}/join`, undefined, A.H)).s, 200);
      assert.strictEqual((await call('POST', `/lounges/${L}/join`, undefined, A.H)).s, 200);
      const d = await detail(A.H);
      assert.deepStrictEqual([d.member_count, d.is_member], [before + 1, true]);
      assert.ok(d.members.some((m) => m.nickname === '라운지에이') && !JSON.stringify(d.members).includes('user_id'));
      assert.strictEqual((await call('GET', '/lounges', undefined, A.H)).j.find((l) => l.id === L).is_member, true);
      await call('DELETE', `/lounges/${L}/leave`, undefined, A.H);
      assert.strictEqual((await detail(A.H)).member_count, before);
    });

    await check('Guest 참여: PG에는 기록 안 함, Redis에 세션 만료 시각으로, 인원·guest_count·is_member 반영, 채팅 목록 라운지 탭', async () => {
      const before = await detail(A.H);
      const pgBefore = await pgCount();
      assert.strictEqual((await call('POST', `/lounges/${L}/join`, undefined, G.H)).s, 200);
      assert.strictEqual(await pgCount(), pgBefore);
      assert.strictEqual(await redis.zScore(`lounge:${L}:guests`, G.guestId), Date.parse(G.expiresAt));
      assert.ok(await redis.sIsMember(`guest:lounges:${G.guestId}`, L));
      assert.ok((await redis.pTTL(`guest:lounges:${G.guestId}`)) > 0);
      const after = await detail(A.H);
      assert.deepStrictEqual([after.member_count, after.guest_count], [before.member_count + 1, before.guest_count + 1]);
      assert.strictEqual((await detail(G.H)).is_member, true);
      const rooms = (await call('GET', '/chat/rooms', undefined, G.H)).j;
      assert.ok(rooms.lounges.some((r) => r.lounge_id === L) && rooms.direct.length === 0);
      const home = (await call('GET', '/home', undefined, A.H)).j;
      assert.strictEqual(home.lounges.find((l) => l.id === L).member_count, after.member_count);
    });

    await check('Guest 나가기 → 인원에서 빠짐', async () => {
      const before = (await detail(A.H)).member_count;
      await call('DELETE', `/lounges/${L}/leave`, undefined, G.H);
      assert.strictEqual((await detail(A.H)).member_count, before - 1);
      assert.strictEqual((await detail(G.H)).is_member, false);
    });

    await check('만료된 Guest는 인원에서 빠지고, 직접 종료한 Guest는 즉시 제거', async () => {
      const base = (await detail(A.H)).member_count;
      const G2 = await guest();
      const G3 = await guest();
      await call('POST', `/lounges/${L}/join`, undefined, G2.H);
      await call('POST', `/lounges/${L}/join`, undefined, G3.H);
      assert.strictEqual((await detail(A.H)).member_count, base + 2);
      await redis.zAdd(`lounge:${L}:guests`, { score: Date.now() - 1000, value: G2.guestId }); // G2 시간 만료
      assert.strictEqual((await detail(A.H)).member_count, base + 1);
      await call('DELETE', '/guest/session', undefined, G3.H); // G3 직접 종료
      assert.strictEqual(await redis.zScore(`lounge:${L}:guests`, G3.guestId), null);
      assert.strictEqual(await redis.exists(`guest:lounges:${G3.guestId}`), 0);
      assert.strictEqual((await detail(A.H)).member_count, base);
    });

    await check('정원: 가득 차면 400 LOUNGE_FULL, 동시 참여로 정원을 넘지 않음 (Guest 포함)', async () => {
      const current = (await detail(A.H)).member_count;
      const { rows } = await db.query('UPDATE lounges SET max_members = $2 WHERE id = $1 RETURNING (SELECT max_members FROM lounges WHERE id = $1) AS old', [L, current + 1]);
      restoreMax = rows[0].old;
      const G4 = await guest();
      const results = await Promise.all([call('POST', `/lounges/${L}/join`, undefined, C.H), call('POST', `/lounges/${L}/join`, undefined, G4.H)]);
      assert.deepStrictEqual(results.map((r) => r.s).sort(), [200, 400]);
      assert.strictEqual(results.find((r) => r.s === 400).j.code, 'LOUNGE_FULL');
      assert.strictEqual((await detail(A.H)).member_count, current + 1);
      await db.query('UPDATE lounges SET max_members = $2 WHERE id = $1', [L, restoreMax]);
      restoreMax = null;
      await call('DELETE', `/lounges/${L}/leave`, undefined, C.H);
      await call('DELETE', `/lounges/${L}/leave`, undefined, G4.H);
    });

    await check('추천: 취향 0개면 빈 목록, 음악 취향이면 음악 라운지가 1위 (회원·Guest)', async () => {
      assert.deepStrictEqual((await call('GET', '/lounges/recommended', undefined, A.H)).j, []);
      const tags = music.tags.slice(0, 3).map((t) => ({ tagId: t.id, weight: 3 }));
      await call('PUT', '/tastes/me', { tags }, A.H);
      const rec = (await call('GET', '/lounges/recommended', undefined, A.H)).j;
      assert.strictEqual(rec[0].id, L);
      assert.ok(rec.every((l) => l.score > 0) && rec.length <= 5);
      const scores = rec.map((l) => l.score);
      assert.deepStrictEqual(scores, [...scores].sort((a, b) => b - a));
      await call('PUT', '/tastes/me', { tags }, G.H);
      assert.strictEqual((await call('GET', '/lounges/recommended', undefined, G.H)).j[0].id, L);
    });

    await check('room:presence: 입장·퇴장·끊김 때 지금 접속 인원, 같은 사람 여러 기기는 1명', async () => {
      const room = (await detail(A.H)).chat_room_id;
      const g = await connect({ guestToken: G.guestToken });
      await emit(g, 'room:join', { roomId: room });
      await sleep(200);
      assert.strictEqual(g.presence.at(-1), 1);
      const a1 = await connect({ token: A.token });
      const a2 = await connect({ token: A.token });
      await emit(a1, 'room:join', { roomId: room });
      await sleep(200);
      assert.strictEqual(g.presence.at(-1), 2);
      await emit(a2, 'room:join', { roomId: room }); // 같은 회원의 두 번째 기기
      await sleep(200);
      assert.strictEqual(g.presence.at(-1), 2);
      await emit(a1, 'room:leave', { roomId: room }); // a2가 남아 있으니 여전히 2
      await sleep(200);
      assert.strictEqual(g.presence.at(-1), 2);
      g.close(); // 끊김
      await sleep(300);
      assert.strictEqual(a2.presence.at(-1), 1);
    });

    console.log(`\n${passed}개 통과`);
  } catch (err) {
    console.error('FAIL ', err.message);
    process.exitCode = 1;
  } finally {
    if (restoreMax !== null) await db.query("UPDATE lounges SET max_members = $1 WHERE category_id = (SELECT id FROM taste_categories WHERE code = 'music')", [restoreMax]);
    sockets.forEach((s) => s.close());
    await redis.quit();
    await db.pool.end();
  }
})();
