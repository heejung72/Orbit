const db = require('../db');

// 두 회원 사이에 어느 방향으로든 차단이 있는지 (docs/prd.md §3-6: 차단은 양방향으로 확인)
async function isBlockedBetween(userA, userB, client = db) {
  const { rows } = await client.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}

module.exports = { isBlockedBetween };
