const db = require('../db');
const { toUuid } = require('../utils/validate');
const { guestCounts, joinedLoungeIds } = require('./loungeMembers');
const { getMemberTastes, getGuestTastes } = require('./tastes');

// 라운지 공통 조회 (public / lounges / home 라우트에서 함께 사용)
// 실제 사용자 ID는 반환하지 않습니다 — docs/prd.md §3-6
// member_count = 회원 참여 수 + 만료 전 Guest 참여 수. viewer(req.actor)가 있으면 is_member 포함

const LIST_SELECT = `
  SELECT l.id, l.name, l.description, l.icon, l.category_id, l.sort_order,
         tc.name AS category_name, tc.icon AS category_icon,
         (SELECT COUNT(*)::int FROM lounge_members lm WHERE lm.lounge_id = l.id) AS member_count
  FROM lounges l
  JOIN taste_categories tc ON tc.id = l.category_id`;

// PG 회원 수에 Guest 수를 더하고, viewer가 있으면 참여 여부를 붙인다
async function withCounts(rows, viewer) {
  const guests = await guestCounts(rows.map((r) => r.id));
  const joined = viewer ? await joinedLoungeIds(viewer) : null;
  return rows.map(({ sort_order, ...r }) => ({
    ...r,
    member_count: r.member_count + (guests.get(r.id) || 0),
    ...(joined ? { is_member: joined.has(r.id) } : {}),
    _order: sort_order,
  }));
}

const byPopularity = (a, b) => b.member_count - a.member_count || a._order - b._order;
const strip = ({ _order, ...r }) => r;

async function listLounges({ categoryId, search, limit, viewer } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (categoryId) {
    params.push(categoryId);
    where += ` AND l.category_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (l.name ILIKE $${params.length} OR l.description ILIKE $${params.length})`;
  }
  const { rows } = await db.query(`${LIST_SELECT} ${where}`, params);
  const sorted = (await withCounts(rows, viewer)).sort(byPopularity); // Guest 수가 더해진 인원으로 정렬
  return (limit ? sorted.slice(0, limit) : sorted).map(strip);
}

// 내 취향 기반 추천: 라운지 대표 태그와 겹치는 내 태그의 중요도 × 2 + 같은 카테고리 취향 중요도 합. 0점 제외
async function recommendLounges(viewer, limit = 5) {
  const tastes = viewer.type === 'guest' ? await getGuestTastes(viewer.id) : await getMemberTastes(viewer.id);
  if (tastes.length === 0) return [];
  const tagWeight = new Map(tastes.map((t) => [t.tag_id, t.weight]));
  const categoryWeight = new Map();
  for (const t of tastes) categoryWeight.set(t.category_id, (categoryWeight.get(t.category_id) || 0) + t.weight);

  const [{ rows }, loungeTags] = await Promise.all([
    db.query(LIST_SELECT),
    db.query('SELECT lounge_id, tag_id FROM lounge_tags'),
  ]);
  const scores = new Map(rows.map((l) => [l.id, categoryWeight.get(l.category_id) || 0]));
  for (const { lounge_id, tag_id } of loungeTags.rows) {
    if (tagWeight.has(tag_id)) scores.set(lounge_id, scores.get(lounge_id) + tagWeight.get(tag_id) * 2);
  }
  return (await withCounts(rows.filter((l) => scores.get(l.id) > 0), viewer))
    .sort((a, b) => scores.get(b.id) - scores.get(a.id) || byPopularity(a, b))
    .slice(0, limit)
    .map((l) => ({ ...strip(l), score: scores.get(l.id) }));
}

async function getLounge(rawLoungeId, viewer = null) {
  const loungeId = toUuid(rawLoungeId);
  if (!loungeId) return null;
  const lounge = await db.query(
    `SELECT l.id, l.name, l.description, l.icon, l.category_id, l.max_members, l.created_at, l.sort_order,
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

  const [tags, members, guests] = await Promise.all([
    db.query(
      `SELECT tt.id, tt.name FROM lounge_tags lt JOIN taste_tags tt ON tt.id = lt.tag_id
       WHERE lt.lounge_id = $1 ORDER BY tt.sort_order`,
      [loungeId]
    ),
    // 회원 참여자 (최근 50명). Guest는 이름 없이 인원만 (guest_count)
    db.query(
      `SELECT u.nickname, a.emoji AS avatar_emoji, lm.joined_at
       FROM lounge_members lm
       JOIN users u ON u.id = lm.user_id
       JOIN avatars a ON a.id = u.avatar_id
       WHERE lm.lounge_id = $1
       ORDER BY lm.joined_at DESC
       LIMIT 50`,
      [loungeId]
    ),
    guestCounts([loungeId]),
  ]);
  const [withCount] = await withCounts(lounge.rows, viewer);
  return { ...strip(withCount), guest_count: guests.get(loungeId) || 0, tags: tags.rows, members: members.rows };
}

module.exports = { listLounges, recommendLounges, getLounge };
