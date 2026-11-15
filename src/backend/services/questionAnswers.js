const crypto = require('crypto');
const db = require('../db');
const { getRedis } = require('../redis');

// 오늘의 질문 답변 서비스 (#15)
// Guest 답변: Redis only (TTL = expiresAt). 목록에는 회원 답변만 (Guest 본인 답변은 /today에서만 보임)

const answerKey = (guestId, questionId) => `guest:answer:${guestId}:${questionId}`;

// 답변 저장. 반환: { id } or null (이미 답변함)
async function saveAnswer(actor, questionId, content) {
  if (actor.type === 'member') {
    const { rows } = await db.query(
      `INSERT INTO question_answers (question_id, user_id, answer) VALUES ($1, $2, $3)
       ON CONFLICT (question_id, user_id) DO NOTHING RETURNING id`,
      [questionId, actor.id, content]
    );
    return rows[0] ? { id: rows[0].id } : null;
  }
  // Guest
  const redis = getRedis();
  const key = answerKey(actor.id, questionId);
  const existing = await redis.get(key);
  if (existing) return null;
  const id = crypto.randomUUID();
  await redis.set(key, JSON.stringify({ id, answer: content, created_at: new Date().toISOString() }), {
    PXAT: actor.expiresAt,
  });
  return { id };
}

// 내 답변 조회
async function getMyAnswer(actor, questionId) {
  if (actor.type === 'member') {
    const { rows } = await db.query(
      `SELECT answer, created_at FROM question_answers WHERE question_id = $1 AND user_id = $2`,
      [questionId, actor.id]
    );
    return rows[0] || null;
  }
  // Guest
  const raw = await getRedis().get(answerKey(actor.id, questionId));
  return raw ? JSON.parse(raw) : null;
}

// 회원 답변 목록 (내 답변 제외, 페이지네이션)
// 반환: [{ id, answer, created_at, user_id, nickname, avatar_emoji }]
// user_id는 ref 발급용으로만 사용 — 라우트에서 삭제
async function listAnswers(questionId, myActorKey, { limit = 20, before = null } = {}) {
  const myUserId = myActorKey && myActorKey.startsWith('member:') ? myActorKey.slice('member:'.length) : null;
  const params = [questionId, limit];
  let where = 'qa.question_id = $1';
  if (myUserId) {
    params.push(myUserId);
    where += ` AND qa.user_id <> $${params.length}::uuid`;
  }
  if (before) {
    params.push(before);
    where += ` AND qa.created_at < $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT qa.id, qa.answer, qa.created_at, qa.user_id, u.nickname, a.emoji AS avatar_emoji
     FROM question_answers qa
     JOIN users u ON u.id = qa.user_id AND u.status = 'active'
     JOIN avatars a ON a.id = u.avatar_id
     WHERE ${where}
     ORDER BY qa.created_at DESC
     LIMIT $2`,
    params
  );
  return rows;
}

module.exports = { answerKey, saveAnswer, getMyAnswer, listAnswers };
