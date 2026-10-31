// 회원 인증 E2E 테스트 (#4)
// 실행: 서버(npm run dev)를 켠 상태에서 `npm run test:auth` (DB 시드 필요: npm run db:setup)
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');

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
  const id = crypto.randomBytes(4).toString('hex'); // 여러 번 실행해도 이메일이 겹치지 않게
  const email = `Auth_${id}@Orbit.TEST`;
  const reg = (overrides) => call('POST', '/auth/register', { email, password: 'pw123456', nickname: '여행자', ...overrides });

  try {
    await check('캐릭터 목록 공개 조회', async () => {
      const a = await call('GET', '/public/avatars');
      assert.strictEqual(a.s, 200);
      assert.ok(a.j.length >= 1 && a.j[0].emoji);
    });

    await check('잘못된 입력 → 400 (이메일·비밀번호·닉네임·캐릭터·비문자열)', async () => {
      for (const body of [
        { email: 'not-an-email' },
        { password: 'short1' },
        { password: 'a'.repeat(73) },
        { password: '가'.repeat(25) }, // 25자지만 75바이트
        { nickname: ' a ' },
        { nickname: '가'.repeat(13) },
        { avatar_id: '2' },
        { avatar_id: 0 },
        { password: 12345678 },
        { email: ['x@y.z'] },
      ]) {
        const r = await reg(body);
        assert.strictEqual(r.s, 400, JSON.stringify(body));
      }
    });

    let token;
    await check('가입 성공: 이메일 소문자 저장, 닉네임 trim, 선택한 캐릭터, id·email 미노출', async () => {
      const r = await reg({ nickname: '  궤도여행자  ', avatar_id: 3 });
      assert.strictEqual(r.s, 201);
      assert.deepStrictEqual(Object.keys(r.j.user).sort(), ['avatar_id', 'nickname']);
      assert.strictEqual(r.j.user.nickname, '궤도여행자');
      assert.strictEqual(r.j.user.avatar_id, 3);
      token = r.j.token;
    });

    await check('대소문자만 다른 이메일 → 409', async () => {
      assert.strictEqual((await reg({ email: email.toLowerCase() })).s, 409);
    });

    await check('없는 캐릭터 → 400', async () => {
      assert.strictEqual((await reg({ email: `x_${id}@orbit.test`, avatar_id: 99999 })).s, 400);
    });

    await check('동시 가입 같은 이메일 → 1건만 201, 나머지 409', async () => {
      const e = `race_${id}@orbit.test`;
      const results = await Promise.all([1, 2, 3].map(() => reg({ email: e })));
      assert.deepStrictEqual(results.map((r) => r.s).sort(), [201, 409, 409]);
    });

    await check('로그인: 대문자 이메일로도 성공, 잘못된 비밀번호 401, 비문자열 400', async () => {
      const ok = await call('POST', '/auth/login', { email: email.toUpperCase(), password: 'pw123456' });
      assert.strictEqual(ok.s, 200);
      assert.ok(ok.j.token);
      assert.strictEqual((await call('POST', '/auth/login', { email, password: 'wrongpass' })).s, 401);
      assert.strictEqual((await call('POST', '/auth/login', { email, password: { $ne: 1 } })).s, 400);
      assert.strictEqual((await call('POST', '/auth/login')).s, 400);
    });

    await check('가입 토큰으로 바로 /auth/me', async () => {
      const m = await call('GET', '/auth/me', undefined, { Authorization: 'Bearer ' + token });
      assert.strictEqual(m.j.type, 'member');
      assert.strictEqual(m.j.nickname, '궤도여행자');
    });

    await check('무효 토큰 → 401 UNAUTHORIZED (앱이 로그인 화면으로 보냄)', async () => {
      const r = await call('GET', '/users/me', undefined, { Authorization: 'Bearer invalid.token.here' });
      assert.strictEqual(r.s, 401);
      assert.strictEqual(r.j.code, 'UNAUTHORIZED');
    });

    console.log(`\n${passed}개 통과`);
  } catch (err) {
    console.error('FAIL ', err.message);
    process.exitCode = 1;
  }
})();
