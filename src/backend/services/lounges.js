const db = require('../db');
const { toUuid } = require('../utils/validate');

// 라운지 공통 조회 (public / lounges 라우트에서 함께 사용)
// 실제 사용자 ID는 반환하지 않습니다 — docs/prd.md §3-6

const LIST_SELECT = `
  SELECT l.id, l.name, l.description, l.icon, l.category_id,
         tc.name AS category_name, tc.icon AS category_icon,
         (SELECT COUNT(*)::int FROM lounge_members lm WHERE lm.lounge_id = l.id) AS member_count
  FROM lounges l
  JOIN taste_categories tc ON tc.id = l.category_id`;

async function listLounges({ categoryId, search, limit } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  const category = Number.parseInt(categoryId, 10);
  if (Number.isInteger(category) && category > 0) {
    params.push(category);
    where += ` AND l.category_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (l.name ILIKE $${params.length} OR l.description ILIKE $${params.length})`;
  }
  let sql = `${LIST_SELECT} ${where} ORDER BY member_count DESC, l.sort_order`;
  if (limit) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  return (await db.query(sql, params)).rows;
}

async function getLounge(rawLoungeId, viewerUserId = null) {
  const loungeId = toUuid(rawLoungeId);
  if (!loungeId) return null;
  const lounge = await db.query(
    `SELECT l.id, l.name, l.description, l.icon, l.category_id, l.max_members, l.created_at,
            tc.name AS category_name, tc.icon AS category_icon,
            cr.id AS chat_room_id,
            (SELECT COUNT(*)::int FROM lounge_members lm WHERE lm.lounge_id = l.id) AS member_count
     FROM lounges l
     JOIN taste_categories tc ON tc.id = l.category_id
     LEFT JOIN chat_rooms cr ON cr.lounge_id = l.id
     WHERE l.id = $1`,
    [loungeId]
  );
  if (lounge.rows.length === 0) return null;

  const tags = await db.query(
    `SELECT tt.id, tt.name FROM lounge_tags lt JOIN taste_tags tt ON tt.id = lt.tag_id
     WHERE lt.lounge_id = $1 ORDER BY tt.sort_order`,
    [loungeId]
  );

  const members = await db.query(
    `SELECT u.nickname, a.emoji AS avatar_emoji, lm.joined_at
     FROM lounge_members lm
     JOIN users u ON u.id = lm.user_id
     JOIN avatars a ON a.id = u.avatar_id
     WHERE lm.lounge_id = $1
     ORDER BY lm.joined_at
     LIMIT 50`,
    [loungeId]
  );

  let isMember = false;
  if (viewerUserId) {
    const m = await db.query('SELECT 1 FROM lounge_members WHERE lounge_id = $1 AND user_id = $2', [
      loungeId,
      viewerUserId,
    ]);
    isMember = m.rows.length > 0;
  }

  return { ...lounge.rows[0], tags: tags.rows, members: members.rows, is_member: isMember };
}

module.exports = { listLounges, getLounge };
