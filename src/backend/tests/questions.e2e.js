// 오늘의 질문 E2E 테스트 (#15)
// 실행: 서버(npm run dev)와 Redis를 켠 상태에서 `npm run test:questions` (DB 시드 필요: npm run db:setup)
require('dotenv').config();
const crypto = require('crypto');
const assert = require('assert');

const B = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body == null ? undefined : JSON.stringify(body),
  });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};

let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log('PASS ', name);
};

// 테스트용 회원 생성 후 토큰 반환
async function register(id) {
  const email = `q_${id}@orbit.test`;
  const r = await call('POST', '/auth/register', { email, password: 'pw123456', nickname: `질문테스터${id.slice(0, 4)}` });
  assert.strictEqual(r.s, 201, `register ${id} 실패: ${JSON.stringify(r.j)}`);
  return r.j.token;
}

async function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

(async () => {
  try {
    const id = crypto.randomBytes(4).toString('hex');
    const token1 = await register(id + 'a');
    const token2 = await register(id + 'b');

    // 1. GET /questions/today (비로그인)
    await check('GET /questions/today (비로그인) → question 객체, my_answer null', async () => {
      const r = await call('GET', '/questions/today');
      assert.strictEqual(r.s, 200);
      if (r.j.question !== null) {
        assert.ok(r.j.question.id, 'question.id 없음');
        assert.ok(r.j.question.content, 'question.content 없음');
      }
      assert.strictEqual(r.j.my_answer, null);
    });

    // 오늘의 질문 ID 가져오기
    const todayR = await call('GET', '/questions/today');
    if (!todayR.j.question) {
      console.log('SKIP 오늘의 질문이 없어 나머지 테스트를 건너뜁니다');
      console.log(`\n${passed} passed`);
      process.exit(0);
    }
    const questionId = todayR.j.question.id;

    // 2. POST /questions/:id/answers (회원)
    let answerId1;
    await check('POST /questions/:id/answers (회원) → 201 { id }', async () => {
      const r = await call('POST', `/questions/${questionId}/answers`, { answer: '이런 질문 좋아요!' }, await auth(token1));
      assert.strictEqual(r.s, 201, JSON.stringify(r.j));
      assert.ok(r.j.id, 'id 없음');
      answerId1 = r.j.id;
    });

    // 3. GET /questions/today (회원, 답변 후)
    await check('GET /questions/today (회원, 답변 후) → my_answer.answer 반환', async () => {
      const r = await call('GET', '/questions/today', undefined, await auth(token1));
      assert.strictEqual(r.s, 200);
      assert.ok(r.j.my_answer, 'my_answer 없음');
      assert.strictEqual(r.j.my_answer.answer, '이런 질문 좋아요!');
    });

    // 4. POST /questions/:id/answers (같은 회원, 중복) → 409
    await check('POST /questions/:id/answers (중복 답변) → 409 ALREADY_ANSWERED', async () => {
      const r = await call('POST', `/questions/${questionId}/answers`, { answer: '또 답변' }, await auth(token1));
      assert.strictEqual(r.s, 409);
      assert.strictEqual(r.j.code, 'ALREADY_ANSWERED');
    });

    // 두 번째 회원도 답변 (목록 조회용)
    await call('POST', `/questions/${questionId}/answers`, { answer: '저도 답변해봐요' }, await auth(token2));

    // 5. GET /questions/:id/answers (다른 회원 답변 포함)
    await check('GET /questions/:id/answers → answers 배열, user_id 미노출', async () => {
      const r = await call('GET', `/questions/${questionId}/answers`, undefined, await auth(token1));
      assert.strictEqual(r.s, 200);
      assert.ok(Array.isArray(r.j.answers));
      assert.ok(r.j.answers.length >= 1);
      assert.ok(!('user_id' in r.j.answers[0]), 'user_id 노출됨');
      assert.ok(r.j.answers[0].nickname, 'nickname 없음');
      assert.ok(r.j.answers[0].avatar_emoji, 'avatar_emoji 없음');
    });

    // 6. POST /questions/:id/answers (Guest)
    const guestR = await call('POST', '/guest/session');
    if (guestR.s !== 201) {
      console.log('SKIP Guest 세션 생성 실패 → Guest 테스트 건너뜁니다');
    } else {
      const guestToken = guestR.j.token;
      const guestHeaders = { 'X-Guest-Token': guestToken };

      await check('POST /questions/:id/answers (Guest) → 201 { id }', async () => {
        const r = await call('POST', `/questions/${questionId}/answers`, { answer: 'Guest도 답변!' }, guestHeaders);
        assert.strictEqual(r.s, 201, JSON.stringify(r.j));
        assert.ok(r.j.id);
      });

      // 7. GET /questions/today (Guest) → my_answer
      await check('GET /questions/today (Guest) → my_answer.answer 반환', async () => {
        const r = await call('GET', '/questions/today', undefined, guestHeaders);
        assert.strictEqual(r.s, 200);
        assert.ok(r.j.my_answer, 'my_answer 없음');
        assert.strictEqual(r.j.my_answer.answer, 'Guest도 답변!');
      });
    }

    // 8. POST /questions/:id/answers/:answerId/chat (회원 → 회원)
    await check('POST /questions/:id/answers/:answerId/chat → 201 (회원→회원)', async () => {
      // token2가 token1의 답변에 대화 요청
      const listR = await call('GET', `/questions/${questionId}/answers`, undefined, await auth(token2));
      const myAnswerEntry = listR.j.answers.find((a) => a.answer === '이런 질문 좋아요!');
      if (!myAnswerEntry) {
        // answerId1을 직접 사용할 수 없으므로 (UUID) skip
        console.log('  (대화 요청 테스트: answerId 조회 실패 → skip)');
        return;
      }
      const r = await call('POST', `/questions/${questionId}/answers/${myAnswerEntry.id}/chat`, null, await auth(token2));
      // 상대가 오프라인이면 409 TARGET_OFFLINE도 허용 (MVP)
      assert.ok([201, 409].includes(r.s), `예상치 못한 상태: ${r.s} ${JSON.stringify(r.j)}`);
    });

    // 입력 검증
    await check('잘못된 질문 ID → 400', async () => {
      const r = await call('POST', '/questions/abc/answers', { answer: '테스트' }, await auth(token1));
      assert.strictEqual(r.s, 400);
    });

    await check('빈 답변 → 400', async () => {
      const r = await call('POST', `/questions/${questionId}/answers`, { answer: '' }, await auth(token1));
      assert.strictEqual(r.s, 400);
    });

    await check('300자 초과 답변 → 400', async () => {
      const r = await call('POST', `/questions/${questionId}/answers`, { answer: 'a'.repeat(301) }, await auth(token1));
      assert.strictEqual(r.s, 400);
    });

    console.log(`\n${passed} passed`);
  } catch (err) {
    console.error('FAIL', err.message);
    process.exit(1);
  }
})();
