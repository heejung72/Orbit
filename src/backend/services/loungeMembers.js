const db = require('../db');
const { getRedis } = require('../redis');

// 라운지 참여 (PRD §3-3, docs/system_design.md §4-1)
// 회원: PG lounge_members / Guest: Redis만 (PG에는 회원만 기록)
//   guest:lounges:{guestId}  Set  — 이 Guest가 참여한 loungeId (세션 expiresAt에 만료)
//   lounge:{loungeId}:guests Sorted Set — guestId, score = 세션 expiresAt (score로 만료 Guest를 거른다)

const SESSION_MS = (Number(process.env.GUEST_SESSION_MINUTES) || 30) * 60 * 1000;
const guestLoungesKey = (guestId) => `guest:lounges:${guestId}`;
const loungeGuestsKey = (loungeId) => `lounge:${loungeId}:guests`;

const loungeError = (code, message) => Object.assign(new Error(message), { code });

// loungeId → 만료 전 Guest 수. Redis가 끊기면 빈 Map (회원 수만으로 표시해 회원 기능은 계속 동작)
async function guestCounts(loungeIds) {
  if (loungeIds.length === 0) return new Map();
  try {
    const now = Date.now();
    const multi = getRedis().multi();
    for (const id of loungeIds) multi.zCount(loungeGuestsKey(id), `(${now}`, '+inf');
    const counts = await multi.exec();
    return new Map(loungeIds.map((id, i) => [id, Number(counts[i])]));
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') return new Map();
    throw err;
  }
}

// 내가 참여한 loungeId Set (회원 PG / Guest Redis)
async function joinedLoungeIds(actor) {
  if (actor.type === 'guest') return new Set(await getRedis().sMembers(guestLoungesKey(actor.id)));
  const { rows } = await db.query('SELECT lounge_id FROM lounge_members WHERE user_id = $1', [actor.id]);
  return new Set(rows.map((r) => r.lounge_id));
}

// 참여 — 이미 참여 중이면 그대로 성공. 정원(max_members)은 Guest 포함으로 세고,
// 동시 참여로 정원을 넘지 않도록 라운지 행을 잠근 채 확인·기록한다 (Guest 기록도 잠금 안에서)
async function joinLounge(loungeId, actor) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const lounge = await client.query('SELECT max_members FROM lounges WHERE id = $1 FOR UPDATE', [loungeId]);
    if (!lounge.rows[0]) throw loungeError('NOT_FOUND', '라운지를 찾을 수 없습니다');

    if ((await joinedLoungeIds(actor)).has(loungeId)) {
      await client.query('COMMIT');
      return;
    }
    const members = await client.query('SELECT COUNT(*)::int AS n FROM lounge_members WHERE lounge_id = $1', [loungeId]);
    const guests = (await guestCounts([loungeId])).get(loungeId) || 0;
    if (members.rows[0].n + guests >= lounge.rows[0].max_members) throw loungeError('FULL', '라운지 정원이 가득 찼어요');

    if (actor.type === 'guest') {
      const gKey = guestLoungesKey(actor.id);
      const lKey = loungeGuestsKey(loungeId);
      await getRedis()
        .multi()
        .sAdd(gKey, loungeId)
        .pExpireAt(gKey, actor.expiresAt)
        .zAdd(lKey, { score: actor.expiresAt, value: actor.id })
        .zRemRangeByScore(lKey, '-inf', Date.now()) // 만료된 Guest 정리
        .pExpire(lKey, SESSION_MS) // 마지막 참여 후 30분이면 모든 Guest가 만료됐으므로 키도 사라짐
        .exec();
    } else {
      await client.query('INSERT INTO lounge_members (lounge_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [loungeId, actor.id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function leaveLounge(loungeId, actor) {
  if (actor.type === 'guest') {
    await getRedis().multi().sRem(guestLoungesKey(actor.id), loungeId).zRem(loungeGuestsKey(loungeId), actor.id).exec();
    return;
  }
  await db.query('DELETE FROM lounge_members WHERE lounge_id = $1 AND user_id = $2', [loungeId, actor.id]);
}

// Guest가 둘러보기를 직접 끝낼 때 참여한 모든 라운지에서 즉시 제거 (시간 만료는 score·TTL로 처리)
async function removeGuestFromLounges(guestId) {
  const redis = getRedis();
  const ids = await redis.sMembers(guestLoungesKey(guestId));
  const multi = redis.multi().del(guestLoungesKey(guestId));
  for (const id of ids) multi.zRem(loungeGuestsKey(id), guestId);
  await multi.exec();
}

module.exports = { guestCounts, joinedLoungeIds, joinLounge, leaveLounge, removeGuestFromLounges };
