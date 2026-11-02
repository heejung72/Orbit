const db = require('../db');
const { getRedis } = require('../redis');

// 취향 저장·조회 — docs/system_design.md §4
// 회원: user_tastes(PG) / Guest: Redis guest:tastes:{guestId} 해시(tagId → weight), 세션과 같은 시각에 만료

const MIN_TAGS = 3;
const MAX_TAGS = 20;
const MAX_INT4 = 2147483647; // taste_tags.id 범위를 넘으면 PG가 22003(500)을 내므로 미리 거른다

const guestTastesKey = (guestId) => `guest:tastes:${guestId}`;

const TAG_COLUMNS = 'tt.id AS tag_id, tt.name, tt.category_id, tc.name AS category, tc.icon AS category_icon';
const TAG_JOIN = 'taste_tags tt JOIN taste_categories tc ON tc.id = tt.category_id';
const MEMBER_JOIN = 'user_tastes ut JOIN taste_tags tt ON tt.id = ut.tag_id JOIN taste_categories tc ON tc.id = tt.category_id';
const TAG_ORDER = 'ORDER BY tc.sort_order, tt.sort_order';

const unknownTag = () => Object.assign(new Error('존재하지 않는 취향이 포함되어 있습니다'), { code: 'UNKNOWN_TAG' });
const noUser = () => Object.assign(new Error('유효하지 않은 토큰입니다'), { code: 'UNAUTHORIZED' });

// body.tags = [{ tagId, weight(1~3) }] 검증. 문제가 있으면 안내 문구, 없으면 null
function validateTags(tags) {
  if (!Array.isArray(tags) || tags.length < MIN_TAGS) return `최소 ${MIN_TAGS}개의 취향을 선택해주세요`;
  if (tags.length > MAX_TAGS) return `취향은 최대 ${MAX_TAGS}개까지 선택할 수 있어요`;
  const valid = tags.every(
    (t) =>
      t !== null &&
      typeof t === 'object' &&
      Number.isInteger(t.tagId) &&
      t.tagId > 0 &&
      t.tagId <= MAX_INT4 &&
      Number.isInteger(t.weight) &&
      t.weight >= 1 &&
      t.weight <= 3
  );
  if (!valid) return '취향 형식이 올바르지 않습니다';
  if (new Set(tags.map((t) => t.tagId)).size !== tags.length) return '같은 취향이 중복으로 선택되었습니다';
  return null;
}

async function getMemberTastes(userId) {
  const { rows } = await db.query(
    `SELECT ${TAG_COLUMNS}, ut.weight FROM ${MEMBER_JOIN}
     WHERE ut.user_id = $1 ${TAG_ORDER}`,
    [userId]
  );
  return rows;
}

// 전체 교체 (DELETE → INSERT를 한 트랜잭션으로)
// 같은 회원이 여러 기기에서 동시에 저장하면 기본 격리 수준에선 두 목록이 합쳐질 수 있어
// users 행을 FOR UPDATE로 잠가 저장을 한 번에 하나씩 처리한다 (마지막 요청이 최종 목록)
async function saveMemberTastes(userId, tags) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (user.rowCount === 0) throw noUser(); // 토큰은 유효하지만 계정이 사라진 경우
    await client.query('DELETE FROM user_tastes WHERE user_id = $1', [userId]);
    await client.query(
      `INSERT INTO user_tastes (user_id, tag_id, weight)
       SELECT $1, t.tag_id, t.weight FROM UNNEST($2::int[], $3::smallint[]) AS t(tag_id, weight)`,
      [userId, tags.map((t) => t.tagId), tags.map((t) => t.weight)]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err.code === '23503' ? unknownTag() : err;
  } finally {
    client.release();
  }
}

async function getGuestTastes(guestId) {
  const stored = await getRedis().hGetAll(guestTastesKey(guestId));
  const weights = new Map(Object.entries(stored).map(([tagId, w]) => [Number(tagId), Number(w)]));
  if (weights.size === 0) return [];
  const { rows } = await db.query(`SELECT ${TAG_COLUMNS} FROM ${TAG_JOIN} WHERE tt.id = ANY($1::int[]) ${TAG_ORDER}`, [
    [...weights.keys()],
  ]);
  return rows.map((r) => ({ ...r, weight: weights.get(r.tag_id) }));
}

// Guest는 FK가 없으니 태그 존재를 PG로 확인한 뒤 저장. 삭제·저장·만료 설정을 한 번에 (세션 expiresAt과 같은 시각)
async function saveGuestTastes(guestId, expiresAt, tags) {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM taste_tags WHERE id = ANY($1::int[])', [
    tags.map((t) => t.tagId),
  ]);
  if (rows[0].n !== tags.length) throw unknownTag();
  const key = guestTastesKey(guestId);
  const fields = Object.fromEntries(tags.map((t) => [String(t.tagId), String(t.weight)]));
  await getRedis().multi().del(key).hSet(key, fields).pExpireAt(key, expiresAt).exec();
}

async function guestHasTastes(guestId) {
  return (await getRedis().exists(guestTastesKey(guestId))) === 1;
}

module.exports = {
  MIN_TAGS,
  MAX_TAGS,
  guestTastesKey,
  validateTags,
  getMemberTastes,
  saveMemberTastes,
  getGuestTastes,
  saveGuestTastes,
  guestHasTastes,
};
