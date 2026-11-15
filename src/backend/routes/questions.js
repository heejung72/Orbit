const express = require('express');
const db = require('../db');
const optionalAuth = require('../middleware/optionalAuth');
const { toId, toUuid, toPositiveInt } = require('../utils/validate');
const { getTodayQuestion } = require('../services/questions');
const qa = require('../services/questionAnswers');
const { commonTags, getVectors, issueRef, createRequest, actorKey } = require('../services/matching');
const { emitToActor } = require('../services/actors');

// /api/questions — optionalAuth (회원·Guest·비로그인) #15
const router = express.Router();

function fail(res, err, where) {
  if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
  console.error(`${where} 실패:`, err.message);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
}

// GET /api/questions/today — 오늘의 질문 + 내 답변
router.get('/today', optionalAuth, async (req, res) => {
  try {
    const q = await getTodayQuestion();
    if (!q) return res.json({ question: null });
    const myAnswer = req.actor ? await qa.getMyAnswer(req.actor, q.id) : null;
    res.json({ question: { id: q.id, content: q.content }, my_answer: myAnswer });
  } catch (err) {
    fail(res, err, 'GET /api/questions/today');
  }
});

// POST /api/questions/:id/answers — 답변 등록
router.post('/:id/answers', optionalAuth, async (req, res) => {
  const questionId = toId(req.params.id);
  if (!questionId) return res.status(400).json({ error: '잘못된 질문 ID입니다', code: 'INVALID_ID' });

  const content = req.body?.answer;
  if (typeof content !== 'string' || content.length < 1 || content.length > 300) {
    return res.status(400).json({ error: '답변은 1~300자여야 합니다', code: 'INVALID_ANSWER' });
  }

  if (!req.actor) {
    return res.status(401).json({ error: '인증이 필요합니다', code: 'UNAUTHORIZED' });
  }

  try {
    const { rows } = await db.query('SELECT id FROM questions WHERE id = $1', [questionId]);
    if (!rows[0]) return res.status(404).json({ error: '질문을 찾을 수 없어요', code: 'NOT_FOUND' });

    const result = await qa.saveAnswer(req.actor, questionId, content);
    if (!result) return res.status(409).json({ error: '이미 답변했어요', code: 'ALREADY_ANSWERED' });
    res.status(201).json(result);
  } catch (err) {
    fail(res, err, 'POST /api/questions/:id/answers');
  }
});

// GET /api/questions/:id/answers — 답변 목록
router.get('/:id/answers', optionalAuth, async (req, res) => {
  const questionId = toId(req.params.id);
  if (!questionId) return res.status(400).json({ error: '잘못된 질문 ID입니다', code: 'INVALID_ID' });

  const limit = toPositiveInt(req.query.limit, 20, 50);
  const before = req.query.before || null;
  const myActorKey = req.actor ? actorKey(req.actor) : null;

  try {
    const answers = await qa.listAnswers(questionId, myActorKey, { limit, before });

    if (req.actor) {
      const meKey = actorKey(req.actor);
      const targetKeys = answers.map((a) => `member:${a.user_id}`);
      const vectors = await getVectors([meKey, ...targetKeys]);
      const myVec = vectors.get(meKey);
      for (const a of answers) {
        const targetKey = `member:${a.user_id}`;
        const vec = vectors.get(targetKey);
        const common = myVec && vec ? commonTags(myVec, vec).slice(0, 3) : [];
        a.ref = await issueRef(meKey, targetKey, 0, common);
        delete a.user_id;
      }
    } else {
      answers.forEach((a) => delete a.user_id);
    }

    res.json({ answers, next_before: answers.at(-1)?.created_at || null });
  } catch (err) {
    fail(res, err, 'GET /api/questions/:id/answers');
  }
});

// POST /api/questions/:id/answers/:answerId/chat — 답변자와 대화 요청
router.post('/:id/answers/:answerId/chat', optionalAuth, async (req, res) => {
  const questionId = toId(req.params.id);
  if (!questionId) return res.status(400).json({ error: '잘못된 질문 ID입니다', code: 'INVALID_ID' });

  const answerId = toUuid(req.params.answerId);
  if (!answerId) return res.status(400).json({ error: '잘못된 답변 ID입니다', code: 'INVALID_ID' });

  if (!req.actor) {
    return res.status(401).json({ error: '인증이 필요합니다', code: 'UNAUTHORIZED' });
  }

  try {
    const { rows } = await db.query(
      'SELECT user_id FROM question_answers WHERE id = $1 AND question_id = $2',
      [answerId, questionId]
    );
    if (!rows[0]) return res.status(404).json({ error: '답변을 찾을 수 없어요', code: 'NOT_FOUND' });

    const targetKey = `member:${rows[0].user_id}`;
    if (actorKey(req.actor) === targetKey) {
      return res.status(400).json({ error: '자신에게 대화를 요청할 수 없어요', code: 'SELF_CHAT' });
    }

    const meKey = actorKey(req.actor);
    const vectors = await getVectors([meKey, targetKey]);
    const myVec = vectors.get(meKey);
    const targetVec = vectors.get(targetKey);
    const common = myVec && targetVec ? commonTags(myVec, targetVec).slice(0, 3) : [];
    const ref = await issueRef(meKey, targetKey, 0, common);

    const { forRequester, forTarget, targetKey: tk } = await createRequest(req.actor, ref);
    emitToActor(req.app.get('io'), tk, 'match:request', forTarget);
    res.status(201).json(forRequester);
  } catch (err) {
    fail(res, err, 'POST /api/questions/:id/answers/:answerId/chat');
  }
});

module.exports = router;
