// 취향 시스템 E2E 테스트 (#7)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:tastes` (DB 시드 필요: npm run db:setup)
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');
const { createClient } = require('redis');

const B = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const sessionKey = (t) => 'guest:session:' + crypto.createHash('sha256').update(t).digest('hex');
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
    const reg = await call('POST', '/auth/register', { email: `taste_${id}@orbit.test`, password: 'pw123456', nickname: '취향탐험가' });
    const M = { Authorization: 'Bearer ' + reg.j.token };
    const cats = (await call('GET', '/tastes/categories', undefined, M)).j;
    const allTags = cats.flatMap((c) => c.tags);
    const pickTags = (n, weight = 2) => allTags.slice(0, n).map((t) => ({ tagId: t.id, weight }));

    await check('카테고리: tags만 내려가고 예전 options 필드는 없음', async () => {
      assert.ok(cats.length >= 1 && cats[0].tags.length >= 1);
      assert.ok(!('options' in cats[0]));
    });

    await check('토큰 없이 /tastes/me → 401', async () => {
      assert.strictEqual((await call('GET', '/tastes/me')).s, 401);
      assert.strictEqual((await call('PUT', '/tastes/me', { tags: pickTags(3) })).s, 401);
    });

    await check('잘못된 입력 → 400', async () => {
      const bad = [
        undefined,
        { tags: 'x' },
        { tags: pickTags(2) }, // 3개 미만
        { tags: pickTags(21) }, // 20개 초과
        { tags: [...pickTags(2), { tagId: allTags[2].id, weight: 0 }] },
        { tags: [...pickTags(2), { tagId: allTags[2].id, weight: 4 }] },
        { tags: [...pickTags(2), { tagId: String(allTags[2].id), weight: 2 }] },
        { tags: [...pickTags(2), null] },
        { tags: [...pickTags(3), pickTags(1)[0]] }, // 중복
        { tags: [...pickTags(2), { tagId: 2 ** 31, weight: 2 }] }, // int4 범위 밖
      ];
      for (const body of bad) {
        const r = await call('PUT', '/tastes/me', body, M);
        assert.strictEqual(r.s, 400, JSON.stringify(body));
      }
    });

    await check('없는 태그 → 400 (회원)', async () => {
      const r = await call('PUT', '/tastes/me', { tags: [...pickTags(2), { tagId: 999999, weight: 2 }] }, M);
      assert.strictEqual(r.s, 400);
    });

    await check('회원: 저장 → 조회 → 전체 교체', async () => {
      const tags = [
        { tagId: allTags[0].id, weight: 3 },
        { tagId: allTags[1].id, weight: 2 },
        { tagId: allTags[2].id, weight: 1 },
      ];
      const put = await call('PUT', '/tastes/me', { tags }, M);
      assert.strictEqual(put.s, 200);
      assert.deepStrictEqual(put.j.map((t) => [t.tag_id, t.weight]), tags.map((t) => [t.tagId, t.weight]));
      assert.ok(put.j[0].name && put.j[0].category);

      const next = pickTags(5, 1);
      await call('PUT', '/tastes/me', { tags: next }, M);
      const got = await call('GET', '/tastes/me', undefined, M);
      assert.strictEqual(got.j.length, 5);
      assert.ok(got.j.every((t) => t.weight === 1));
      assert.strictEqual((await call('GET', '/auth/me', undefined, M)).j.has_tastes, true);
    });

    await check('예전 경로 PUT /users/me/tastes 제거', async () => {
      assert.strictEqual((await call('PUT', '/users/me/tastes', { tags: pickTags(3) }, M)).s, 404);
    });

    const g = await call('POST', '/guest/session');
    const G = { 'X-Guest-Token': g.j.guestToken };
    const guestId = await redis.hGet(sessionKey(g.j.guestToken), 'guestId');
    const tasteKey = `guest:tastes:${guestId}`;

    await check('Guest: 처음엔 has_tastes false, 빈 목록', async () => {
      assert.strictEqual((await call('GET', '/auth/me', undefined, G)).j.has_tastes, false);
      assert.deepStrictEqual((await call('GET', '/tastes/me', undefined, G)).j, []);
    });

    await check('Guest: 없는 태그 → 400, Redis에 아무것도 저장 안 됨', async () => {
      const r = await call('PUT', '/tastes/me', { tags: [...pickTags(2), { tagId: 999999, weight: 2 }] }, G);
      assert.strictEqual(r.s, 400);
      assert.strictEqual(await redis.exists(tasteKey), 0);
    });

    await check('Guest: Redis에 저장, PG에는 저장 안 함, 세션과 같은 시각에 만료', async () => {
      const put = await call('PUT', '/tastes/me', { tags: pickTags(4, 3) }, G);
      assert.strictEqual(put.s, 200);
      assert.strictEqual(put.j.length, 4);
      assert.strictEqual(await redis.hLen(tasteKey), 4);
      const [sessionTtl, tasteTtl] = await Promise.all([redis.pTTL(sessionKey(g.j.guestToken)), redis.pTTL(tasteKey)]);
      assert.ok(tasteTtl > 0 && Math.abs(sessionTtl - tasteTtl) < 2000, `${sessionTtl} vs ${tasteTtl}`);
      assert.strictEqual((await call('GET', '/auth/me', undefined, G)).j.has_tastes, true);
    });

    await check('Guest: 다시 저장하면 전체 교체', async () => {
      await call('PUT', '/tastes/me', { tags: pickTags(3, 1) }, G);
      const got = await call('GET', '/tastes/me', undefined, G);
      assert.strictEqual(got.j.length, 3);
      assert.ok(got.j.every((t) => t.weight === 1));
    });

    await check('회원과 Guest 취향이 섞이지 않음', async () => {
      assert.strictEqual((await call('GET', '/tastes/me', undefined, M)).j.length, 5);
    });

    await check('Guest 직접 종료 → 취향 키도 삭제, 이후 401', async () => {
      assert.strictEqual((await call('DELETE', '/guest/session', undefined, G)).s, 200);
      assert.strictEqual(await redis.exists(tasteKey), 0);
      assert.strictEqual((await call('GET', '/tastes/me', undefined, G)).s, 401);
    });

    console.log(`\n${passed}개 통과`);
  } catch (err) {
    console.error('FAIL ', err.message);
    process.exitCode = 1;
  } finally {
    await redis.quit();
  }
})();
