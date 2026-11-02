// Home 대시보드 E2E 테스트 (#8)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:home` (DB 시드 필요: npm run db:setup)
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');
const db = require('../db');
const { getTodayQuestion, kstDay } = require('../services/questions');

const B = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log('PASS ', name);
};

(async () => {
  try {
    const id = crypto.randomBytes(4).toString('hex');
    const reg = await call('POST', '/auth/register', { email: `home_${id}@orbit.test`, password: 'pw123456', nickname: '궤도주인' });
    const M = { Authorization: 'Bearer ' + reg.j.token };

    await check('토큰 없이 /home → 401', async () => {
      assert.strictEqual((await call('GET', '/home')).s, 401);
    });

    await check('예전 공개 경로 /public/home 제거', async () => {
      assert.strictEqual((await call('GET', '/public/home')).s, 404);
    });

    await check('회원: me·tastes·question·lounges, user_id·email 미노출', async () => {
      const h = await call('GET', '/home', undefined, M);
      assert.strictEqual(h.s, 200);
      assert.deepStrictEqual(Object.keys(h.j).sort(), ['lounges', 'me', 'question', 'tastes']);
      assert.strictEqual(h.j.me.type, 'member');
      assert.strictEqual(h.j.me.nickname, '궤도주인');
      assert.ok(h.j.me.avatar_emoji);
      assert.ok(!('id' in h.j.me) && !('email' in h.j.me));
      assert.deepStrictEqual(h.j.tastes, []);
      assert.ok(h.j.question.id && h.j.question.content);
      assert.ok(h.j.lounges.length >= 1);
      const counts = h.j.lounges.map((l) => l.member_count);
      assert.deepStrictEqual(counts, [...counts].sort((a, b) => b - a), '참여 인원순');
      assert.ok(h.j.lounges.every((l) => l.category_id && l.name && !('owner_id' in l)));
    });

    await check('회원: 취향 저장 후 tastes에 반영', async () => {
      const tags = (await call('GET', '/tastes/categories', undefined, M)).j.flatMap((c) => c.tags).slice(0, 3);
      await call('PUT', '/tastes/me', { tags: tags.map((t, i) => ({ tagId: t.id, weight: i + 1 })) }, M);
      const h = await call('GET', '/home', undefined, M);
      assert.strictEqual(h.j.tastes.length, 3);
      assert.ok(h.j.tastes.every((t) => t.category_id && t.category_icon && t.weight));
    });

    await check('Guest: me.type guest + expires_at, guestId 미노출, Redis 취향 반영', async () => {
      const g = await call('POST', '/guest/session');
      const G = { 'X-Guest-Token': g.j.guestToken };
      const h = await call('GET', '/home', undefined, G);
      assert.strictEqual(h.s, 200);
      assert.strictEqual(h.j.me.type, 'guest');
      assert.ok(h.j.me.expires_at && !('guestId' in h.j.me));
      const tags = (await call('GET', '/tastes/categories', undefined, G)).j.flatMap((c) => c.tags).slice(0, 3);
      await call('PUT', '/tastes/me', { tags: tags.map((t) => ({ tagId: t.id, weight: 2 })) }, G);
      assert.strictEqual((await call('GET', '/home', undefined, G)).j.tastes.length, 3);
      await call('DELETE', '/guest/session', undefined, G);
      assert.strictEqual((await call('GET', '/home', undefined, G)).s, 401);
    });

    await check('오늘의 질문: 날짜마다 순환, KST 자정에 바뀜', async () => {
      const before = await getTodayQuestion(new Date('2026-11-02T14:59:00Z')); // 11/2 23:59 KST
      const after = await getTodayQuestion(new Date('2026-11-02T15:00:00Z')); // 11/3 00:00 KST
      assert.notStrictEqual(before.id, after.id);
      assert.strictEqual((await getTodayQuestion(new Date('2026-11-02T03:00:00Z'))).id, before.id); // 같은 날
    });

    await check('오늘의 질문: publish_date가 오늘인 질문이 우선', async () => {
      const content = `테스트 지정 질문 ${id}`;
      const today = kstDay(new Date()).date;
      const { rows } = await db.query(
        'INSERT INTO questions (content, publish_date) VALUES ($1, $2) ON CONFLICT (publish_date) DO NOTHING RETURNING id',
        [content, today]
      );
      try {
        const h = await call('GET', '/home', undefined, M);
        if (rows[0]) assert.strictEqual(h.j.question.content, content);
        else assert.ok(h.j.question.id); // 오늘 날짜 질문이 이미 있으면 그 질문이 나온다
      } finally {
        if (rows[0]) await db.query('DELETE FROM questions WHERE id = $1', [rows[0].id]);
      }
    });

    console.log(`\n${passed}개 통과`);
  } catch (err) {
    console.error('FAIL ', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
