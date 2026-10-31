const db = require('../db');

// 코사인 유사도 계산
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 유저의 취향을 벡터로 변환
async function getUserTasteVector(userId) {
  const allOptions = await db.query('SELECT id FROM taste_options ORDER BY id');
  const userTastes = await db.query(
    'SELECT taste_option_id FROM user_tastes WHERE user_id = $1',
    [userId]
  );

  const userTasteSet = new Set(userTastes.rows.map(r => r.taste_option_id));
  return allOptions.rows.map(opt => userTasteSet.has(opt.id) ? 1 : 0);
}

// 매칭 후보 찾기
async function findMatches(userId, limit = 10) {
  const myVector = await getUserTasteVector(userId);

  // 이미 매칭/차단된 유저 제외
  const excluded = await db.query(
    `SELECT user2_id AS uid FROM matches WHERE user1_id = $1
     UNION SELECT user1_id FROM matches WHERE user2_id = $1
     UNION SELECT blocked_id FROM blocks WHERE blocker_id = $1
     UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1`,
    [userId]
  );
  const excludeSet = new Set(excluded.rows.map(r => r.uid));
  excludeSet.add(userId);

  // 취향이 있는 활성 유저들
  const candidates = await db.query(
    `SELECT DISTINCT ut.user_id FROM user_tastes ut
     JOIN users u ON ut.user_id = u.id
     WHERE u.status = 'active' AND ut.user_id != $1`,
    [userId]
  );

  const scored = [];
  for (const candidate of candidates.rows) {
    if (excludeSet.has(candidate.user_id)) continue;
    const candidateVector = await getUserTasteVector(candidate.user_id);
    const score = cosineSimilarity(myVector, candidateVector);
    if (score > 0) {
      scored.push({ userId: candidate.user_id, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = { findMatches, cosineSimilarity };
