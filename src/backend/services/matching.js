const db = require('../db');

// 가중치 코사인 유사도 (docs/system_design.md §6)
// 벡터: { tagId: weight(1~3) }
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [tagId, w] of a) {
    normA += w * w;
    const wb = b.get(tagId);
    if (wb) dot += w * wb;
  }
  for (const w of b.values()) normB += w * w;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 매칭 후보 찾기
// TODO(#13): 온라인 actor(Redis)만 후보로, Guest 포함, 카테고리 가중치, 최근 거절(24h) 제외
async function findMatches(userId, limit = 10) {
  // 한 번의 쿼리로 나와 후보들의 취향을 모두 가져옴
  const { rows } = await db.query(
    `SELECT ut.user_id, ut.tag_id, ut.weight
     FROM user_tastes ut
     JOIN users u ON u.id = ut.user_id AND u.status = 'active'
     WHERE ut.user_id = $1
        OR ut.user_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = $1
          UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1
          UNION SELECT target_id FROM match_history WHERE requester_id = $1 AND status IN ('pending', 'accepted')
          UNION SELECT requester_id FROM match_history WHERE target_id = $1 AND status IN ('pending', 'accepted')
        )`,
    [userId]
  );

  const vectors = new Map();
  for (const r of rows) {
    if (!vectors.has(r.user_id)) vectors.set(r.user_id, new Map());
    vectors.get(r.user_id).set(r.tag_id, r.weight);
  }

  const mine = vectors.get(userId);
  if (!mine) return [];
  vectors.delete(userId);

  const scored = [];
  for (const [candidateId, vec] of vectors) {
    const score = cosineSimilarity(mine, vec);
    if (score > 0) {
      const commonTagIds = [...mine.keys()].filter((t) => vec.has(t));
      scored.push({ userId: candidateId, score, commonTagIds });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = { findMatches, cosineSimilarity };
