// Guest 세션 E2E 테스트 (#5)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:guest`
// 환경: API_URL(기본 http://localhost:3000/api), REDIS_URL, JWT_SECRET (.env)
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');

const B = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const keyOf = (t) => 'guest:session:' + crypto.createHash('sha256').update(t).digest('hex');
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
    const r = await call('POST', '/guest/session');
    const G = { 'X-Guest-Token': r.j.guestToken };

    await check('발급: 201, 닉네임·캐릭터·30분 만료', async () => {
      assert.strictEqual(r.s, 201);
      assert.ok(r.j.guestToken && r.j.nickname && r.j.avatarId && r.j.avatarEmoji);
      assert.ok(Math.abs(Date.parse(r.j.expiresAt) - Date.now() - 30 * 60 * 1000) < 5000);
    });

    await check('Redis에는 토큰 원본이 아닌 해시 키 + TTL', async () => {
      const key = keyOf(r.j.guestToken);
      assert.strictEqual(await redis.exists(key), 1);
      assert.ok((await redis.pTTL(key)) > 29 * 60 * 1000);
      assert.ok(!JSON.stringify(await redis.hGetAll(key)).includes(r.j.guestToken));
    });

    await check('/auth/me: Guest 정보 + expires_at, guestId 미노출', async () => {
      const m = await call('GET', '/auth/me', null, G);
      assert.strictEqual(m.j.type, 'guest');
      assert.ok(m.j.expires_at && !('guestId' in m.j));
    });

    await check('허용 범위: 라운지 읽기 200 / users는 403 MEMBER_ONLY (chat #10, 라운지 참여 #11, 매칭 #13부터 Guest 허용)', async () => {
      const list = await call('GET', '/lounges', null, G);
      assert.strictEqual(list.s, 200);
      assert.strictEqual((await call('GET', '/users/me', null, G)).j.code, 'MEMBER_ONLY');
      assert.strictEqual((await call('GET', '/matching/requests', null, G)).s, 200);
    });

    await check('위조 토큰 → 401 GUEST_EXPIRED', async () => {
      const x = await call('GET', '/lounges', null, { 'X-Guest-Token': 'x'.repeat(43) });
      assert.strictEqual(x.s, 401);
      assert.strictEqual(x.j.code, 'GUEST_EXPIRED');
    });

    await check('TTL이 남아 있어도 expiresAt이 지나면 401 (TTL에만 의존하지 않음)', async () => {
      const r2 = await call('POST', '/guest/session');
      const key = keyOf(r2.j.guestToken);
      await redis.hSet(key, 'expiresAt', String(Date.now() - 1000));
      await redis.persist(key);
      const x = await call('GET', '/auth/me', null, { 'X-Guest-Token': r2.j.guestToken });
      assert.strictEqual(x.j.code, 'GUEST_EXPIRED');
      await redis.del(key);
    });

    await check('직접 종료 후 같은 토큰 → 401', async () => {
      assert.strictEqual((await call('DELETE', '/guest/session', null, G)).s, 200);
      assert.strictEqual((await call('GET', '/auth/me', null, G)).s, 401);
    });

    await check('이전 뼈대의 Guest JWT(isGuest) 거부', async () => {
      const old = jwt.sign({ userId: crypto.randomUUID(), isGuest: true }, process.env.JWT_SECRET);
      assert.strictEqual((await call('GET', '/users/me', null, { Authorization: 'Bearer ' + old })).s, 401);
    });

    console.log(`\n${passed}개 통과`);
  } catch (err) {
    console.error('FAIL ', err.message);
    process.exitCode = 1;
  } finally {
    await redis.quit();
  }
})();
