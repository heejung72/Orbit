const crypto = require('crypto');
const db = require('../db');
const { getRedis } = require('../redis');
const { guestTastesKey } = require('./tastes');
const { onlineKeys, isOnline } = require('./online');
const { actorKey, parseActorKey, getProfiles, earliestExpiry } = require('./actors');
const directRooms = require('./directRooms');

// 1:1 취향 매칭 (#13) — docs/system_design.md §6
// 후보: 지금 접속 중(online:actors)이고 취향이 있는 회원·Guest. 응답에는 실제 id 대신 ref(10분)만
// 요청 저장: 회원↔회원 PG match_history / 한쪽이라도 Guest면 Redis
//   match:ref:{ref}        String JSON {owner, target, score, common}  TTL 10분, 발급받은 사람만 사용
//   match:{matchId}        Hash   requester, target, status, similarity, commonTagIds, createdAt, roomId
//   match:pair:{a}|{b}     String matchId — 두 사람 사이에 요청 하나만 (대기·거절 상태 유지)
//   actor:matches:{key}    Set    내가 보낸·받은 Redis 요청
//   (match·pair·Guest 목록은 참여 Guest 중 가장 이른 만료 시각에 사라진다 = Guest 만료 시 요청 정리)

const CANDIDATE_LIMIT = 10;
const COMMON_LIMIT = 3;
const REF_TTL_MS = 10 * 60 * 1000;
const COOLDOWN = '24 hours'; // 거절 후 다시 추천하지 않는 기간, 응답 없는 회원 요청의 유효 기간
const REF_RE = /^[A-Za-z0-9_-]{20,40}$/;

const refKey = (ref) => `match:ref:${ref}`;
const matchKey = (id) => `match:${id}`;
const pairKey = (a, b) => `match:pair:${[a, b].sort().join('|')}`;
const actorMatchesKey = (key) => `actor:matches:${key}`;
const matchError = (status, code, message) => Object.assign(new Error(message), { status, code });
const notFound = () => matchError(404, 'NOT_FOUND', '대화 요청을 찾을 수 없어요');

// 상태를 비교 후 바꾸기 (동시 수락·거절 중 하나만 성공)
const CAS_STATUS = `if redis.call('HGET', KEYS[1], 'target') ~= ARGV[1] then return 0 end
if redis.call('HGET', KEYS[1], 'status') ~= 'pending' then return 0 end
redis.call('HSET', KEYS[1], 'status', ARGV[2])
return 1`;

// 가중치 코사인 유사도 — 벡터: Map(tagId → weight 1~3), 카테고리 가중치는 MVP에선 모두 1
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

// 공통 태그를 두 사람 중요도 곱이 큰 순서로
const commonTags = (a, b) =>
  [...a.keys()].filter((t) => b.has(t)).sort((x, y) => b.get(y) * a.get(y) - b.get(x) * a.get(x));

// actorKey 목록 → Map(key → Map(tagId → weight)). 취향 없는 사람은 빠진다
async function getVectors(keys) {
  const vectors = new Map();
  const members = keys.filter((k) => k.startsWith('member:')).map((k) => parseActorKey(k).id);
  const guests = keys.filter((k) => k.startsWith('guest:')).map((k) => parseActorKey(k).id);
  if (members.length) {
    const { rows } = await db.query(
      `SELECT ut.user_id, ut.tag_id, ut.weight FROM user_tastes ut
       JOIN users u ON u.id = ut.user_id AND u.status = 'active'
       WHERE ut.user_id = ANY($1::uuid[])`,
      [members]
    );
    for (const r of rows) {
      const key = `member:${r.user_id}`;
      if (!vectors.has(key)) vectors.set(key, new Map());
      vectors.get(key).set(r.tag_id, r.weight);
    }
  }
  if (guests.length) {
    const multi = getRedis().multi();
    for (const id of guests) multi.hGetAll(guestTastesKey(id));
    const results = await multi.exec();
    guests.forEach((id, i) => {
      const entries = Object.entries(results[i]);
      if (entries.length) vectors.set(`guest:${id}`, new Map(entries.map(([t, w]) => [Number(t), Number(w)])));
    });
  }
  return vectors;
}

async function tagNames(ids) {
  if (ids.length === 0) return new Map();
  const { rows } = await db.query('SELECT id, name FROM taste_tags WHERE id = ANY($1::int[])', [ids]);
  return new Map(rows.map((r) => [r.id, r.name]));
}

// Redis 요청 읽기 (사라진 요청은 목록 키에서 정리)
async function redisMatches(key) {
  const redis = getRedis();
  const ids = await redis.sMembers(actorMatchesKey(key));
  if (ids.length === 0) return [];
  const multi = redis.multi();
  for (const id of ids) multi.hGetAll(matchKey(id));
  const results = await multi.exec();
  const gone = ids.filter((id, i) => !results[i].status);
  if (gone.length) await redis.sRem(actorMatchesKey(key), gone);
  return ids
    .map((id, i) => ({ id, ...results[i] }))
    .filter((m) => m.status)
    .map((m) => ({ ...m, similarity: Number(m.similarity), commonTagIds: JSON.parse(m.commonTagIds || '[]') }));
}

// 추천·요청할 수 없는 상대 → Map(actorKey → 이유)
// blocked: 차단(양방향) / room: 대화 중인 1:1 / sent·received: 대기 중 요청 / rejected: 24시간 안의 거절
async function unavailablePartners(me) {
  const meKey = actorKey(me);
  const reasons = new Map();
  if (me.type === 'member') {
    const { rows } = await db.query(
      `SELECT blocked_id AS other, 'blocked' AS reason FROM blocks WHERE blocker_id = $1
       UNION ALL SELECT blocker_id, 'blocked' FROM blocks WHERE blocked_id = $1
       UNION ALL
       SELECT partner.user_id, 'room' FROM chat_members mine
       JOIN chat_rooms cr ON cr.id = mine.room_id AND cr.type = 'direct' AND cr.closed_at IS NULL
       JOIN chat_members partner ON partner.room_id = cr.id AND partner.user_id <> mine.user_id AND partner.left_at IS NULL
       WHERE mine.user_id = $1 AND mine.left_at IS NULL
       UNION ALL
       SELECT CASE WHEN requester_id = $1 THEN target_id ELSE requester_id END,
              CASE WHEN status = 'rejected' THEN 'rejected' WHEN requester_id = $1 THEN 'sent' ELSE 'received' END
       FROM match_history
       WHERE (requester_id = $1 OR target_id = $1)
         AND ((status = 'pending' AND created_at > now() - $2::interval)
           OR (status = 'rejected' AND responded_at > now() - $2::interval))`,
      [me.id, COOLDOWN]
    );
    // 차단이 가장 우선 (요청 단계에서 차단 사실이 드러나지 않게 404로 처리)
    for (const r of rows) if (!reasons.has(`member:${r.other}`) || r.reason === 'blocked') reasons.set(`member:${r.other}`, r.reason);
  }
  for (const key of await directRooms.activePartners(meKey)) if (!reasons.has(key)) reasons.set(key, 'room');
  for (const m of await redisMatches(meKey)) {
    const other = m.requester === meKey ? m.target : m.requester;
    if (reasons.has(other)) continue;
    if (m.status === 'pending') reasons.set(other, m.requester === meKey ? 'sent' : 'received');
    else if (m.status === 'rejected') reasons.set(other, 'rejected');
  }
  return reasons;
}

// 추천 후보 — 유사도 상위 10명, 공통 태그 3개, 요청용 ref
async function getCandidates(me) {
  const meKey = actorKey(me);
  const redis = getRedis(); // 온라인 상태가 Redis라 끊기면 503
  const online = (await onlineKeys()).filter((k) => k !== meKey);
  const myVector = (await getVectors([meKey])).get(meKey);
  if (!myVector || online.length === 0) return [];

  const unavailable = await unavailablePartners(me);
  const pool = online.filter((k) => !unavailable.has(k));
  const vectors = await getVectors(pool);
  const scored = [];
  for (const [key, vec] of vectors) {
    const score = cosineSimilarity(myVector, vec);
    if (score > 0) scored.push({ key, score, common: commonTags(myVector, vec).slice(0, COMMON_LIMIT) });
  }
  scored.sort((a, b) => b.score - a.score);

  const profiles = await getProfiles(scored.slice(0, CANDIDATE_LIMIT * 2).map((s) => s.key));
  const top = scored.filter((s) => profiles.has(s.key)).slice(0, CANDIDATE_LIMIT);
  const names = await tagNames([...new Set(top.flatMap((s) => s.common))]);

  const multi = redis.multi();
  const candidates = top.map((s) => {
    const ref = crypto.randomBytes(18).toString('base64url');
    multi.set(refKey(ref), JSON.stringify({ owner: meKey, target: s.key, score: s.score, common: s.common }), { PX: REF_TTL_MS });
    const p = profiles.get(s.key);
    return {
      ref,
      nickname: p.nickname,
      avatar_emoji: p.avatarEmoji,
      is_guest: p.isGuest,
      similarity: Math.round(s.score * 100),
      common_tags: s.common.map((id) => names.get(id)),
    };
  });
  if (candidates.length) await multi.exec();
  return candidates;
}

// 클라이언트에 내려줄 요청 형태 (상대 표시 정보만)
const toRequest = (id, direction, partner, similarity, commonNames, createdAt) => ({
  id,
  direction,
  nickname: partner.nickname,
  avatar_emoji: partner.avatarEmoji,
  is_guest: partner.isGuest,
  similarity: Math.round(similarity * 100),
  common_tags: commonNames,
  created_at: createdAt,
});

// 대화 요청 { ref } → { forRequester, forTarget, targetKey }
async function createRequest(me, ref) {
  const meKey = actorKey(me);
  if (typeof ref !== 'string' || !REF_RE.test(ref)) throw matchError(404, 'REF_INVALID', '추천이 만료됐어요. 목록을 새로고침해주세요');
  const redis = getRedis();
  const raw = await redis.get(refKey(ref));
  const info = raw ? JSON.parse(raw) : null;
  if (!info || info.owner !== meKey) throw matchError(404, 'REF_INVALID', '추천이 만료됐어요. 목록을 새로고침해주세요');
  const targetKey = info.target;

  if (!(await isOnline(targetKey))) throw matchError(409, 'TARGET_OFFLINE', '상대가 지금 접속해 있지 않아요');
  const reason = (await unavailablePartners(me)).get(targetKey);
  if (reason === 'blocked') throw matchError(404, 'REF_INVALID', '추천이 만료됐어요. 목록을 새로고침해주세요');
  if (reason === 'sent') throw matchError(409, 'ALREADY_REQUESTED', '이미 대화 요청을 보냈어요');
  if (reason === 'received') throw matchError(409, 'ALREADY_RECEIVED', '상대가 먼저 대화를 요청했어요. 받은 요청에서 수락해주세요');
  if (reason) throw matchError(409, 'NOT_AVAILABLE', '지금은 이 사람에게 대화를 요청할 수 없어요');

  const profiles = await getProfiles([meKey, targetKey]);
  if (!profiles.has(meKey) || !profiles.has(targetKey)) throw matchError(409, 'TARGET_OFFLINE', '상대가 지금 접속해 있지 않아요');
  const names = await tagNames(info.common);
  const commonNames = info.common.map((id) => names.get(id));
  const createdAt = new Date().toISOString();
  let id;

  if (me.type === 'member' && targetKey.startsWith('member:')) {
    const targetId = parseActorKey(targetKey).id;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // 응답 없이 24시간 지난 대기 요청은 만료 처리 (같은 두 사람의 대기 요청은 하나만 — uq_match_pending_pair)
      await client.query(
        `UPDATE match_history SET status = 'expired'
         WHERE status = 'pending' AND created_at <= now() - $3::interval
           AND LEAST(requester_id, target_id) = LEAST($1::uuid, $2::uuid) AND GREATEST(requester_id, target_id) = GREATEST($1::uuid, $2::uuid)`,
        [me.id, targetId, COOLDOWN]
      );
      const { rows } = await client.query(
        `INSERT INTO match_history (requester_id, target_id, similarity, common_tag_ids) VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING RETURNING id`,
        [me.id, targetId, Math.min(1, Math.max(0, info.score)), info.common]
      );
      await client.query('COMMIT');
      // 동시에 서로 요청한 경우 늦은 쪽은 여기서 걸린다
      if (rows.length === 0) throw matchError(409, 'ALREADY_REQUESTED', '이미 두 사람 사이에 대화 요청이 있어요');
      id = rows[0].id;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23503') throw matchError(409, 'TARGET_OFFLINE', '상대가 지금 접속해 있지 않아요');
      throw err;
    } finally {
      client.release();
    }
  } else {
    id = crypto.randomUUID();
    const expiresAt = earliestExpiry(profiles);
    // 두 사람 사이 요청 자리를 먼저 잡는다 (동시에 서로 요청하면 하나만 성공)
    const claimed = await redis.set(pairKey(meKey, targetKey), id, { NX: true, PXAT: expiresAt });
    if (claimed !== 'OK') throw matchError(409, 'ALREADY_REQUESTED', '이미 두 사람 사이에 대화 요청이 있어요');
    try {
      const multi = redis
        .multi()
        .hSet(matchKey(id), {
          requester: meKey,
          target: targetKey,
          status: 'pending',
          similarity: String(info.score),
          commonTagIds: JSON.stringify(info.common),
          createdAt,
        })
        .pExpireAt(matchKey(id), expiresAt);
      for (const key of [meKey, targetKey]) {
        multi.sAdd(actorMatchesKey(key), id);
        const p = profiles.get(key);
        if (p.isGuest) multi.pExpireAt(actorMatchesKey(key), p.expiresAt);
      }
      await multi.exec();
    } catch (err) {
      await redis.del(pairKey(meKey, targetKey)).catch(() => {});
      throw err;
    }
  }
  await redis.del(refKey(ref)); // ref는 한 번만

  return {
    targetKey,
    forRequester: toRequest(id, 'sent', profiles.get(targetKey), info.score, commonNames, createdAt),
    forTarget: toRequest(id, 'received', profiles.get(meKey), info.score, commonNames, createdAt),
  };
}

// 받은 요청 수락 → 1:1 방. 회원끼리는 PG 방, Guest가 끼면 Redis 방
// → { matchId, roomId, requesterKey, titles: Map(actorKey → 상대 닉네임) }
async function acceptRequest(me, matchId) {
  const meKey = actorKey(me);
  const redisMatch = await findRedisMatch(me, matchId);
  if (redisMatch) {
    const redis = getRedis();
    const ok = await redis.eval(CAS_STATUS, { keys: [matchKey(matchId)], arguments: [meKey, 'accepted'] });
    if (Number(ok) !== 1) throw notFound();
    const keys = [redisMatch.requester, meKey];
    const profiles = await getProfiles(keys);
    if (keys.some((k) => !profiles.has(k))) throw notFound(); // 그사이 상대 Guest가 만료됨
    const roomId = await directRooms.createDirectRoom(
      keys.map((key) => ({ key, ...profiles.get(key) })),
      earliestExpiry(profiles)
    );
    await redis.multi().hSet(matchKey(matchId), 'roomId', roomId).del(pairKey(...keys)).exec();
    return { matchId, roomId, requesterKey: redisMatch.requester, profiles };
  }

  if (me.type !== 'member') throw notFound();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // 조건부 UPDATE라 동시에 수락해도 한 번만 통과
    const match = await client.query(
      `UPDATE match_history SET status = 'accepted', responded_at = now()
       WHERE id = $1 AND target_id = $2 AND status = 'pending' AND created_at > now() - $3::interval
       RETURNING requester_id`,
      [matchId, me.id, COOLDOWN]
    );
    if (match.rows.length === 0) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const requesterId = match.rows[0].requester_id;
    // 요청 이후 차단이 생겼다면 방을 만들지 않고 취소 (차단 사실은 드러내지 않음)
    const blocked = await client.query(
      `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [requesterId, me.id]
    );
    if (blocked.rowCount > 0) {
      await client.query(`UPDATE match_history SET status = 'cancelled' WHERE id = $1`, [matchId]);
      await client.query('COMMIT');
      throw notFound();
    }
    const room = await client.query(`INSERT INTO chat_rooms (type) VALUES ('direct') RETURNING id`);
    const roomId = room.rows[0].id;
    await client.query(
      `INSERT INTO chat_members (room_id, user_id, display_name, avatar_id)
       SELECT $1, u.id, u.nickname, u.avatar_id FROM users u WHERE u.id = ANY($2::uuid[])`,
      [roomId, [requesterId, me.id]]
    );
    await client.query('UPDATE match_history SET room_id = $1 WHERE id = $2', [roomId, matchId]);
    await client.query('COMMIT');
    const requesterKey = `member:${requesterId}`;
    return { matchId, roomId, requesterKey, profiles: await getProfiles([requesterKey, meKey]) };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// 받은 요청 거절 → 요청한 사람 actorKey (알림용)
async function rejectRequest(me, matchId) {
  const meKey = actorKey(me);
  const redisMatch = await findRedisMatch(me, matchId);
  if (redisMatch) {
    const ok = await getRedis().eval(CAS_STATUS, { keys: [matchKey(matchId)], arguments: [meKey, 'rejected'] });
    if (Number(ok) !== 1) throw notFound();
    return redisMatch.requester; // 거절 상태는 match·pair 키 만료(Guest 만료)까지 유지 → 그동안 다시 추천하지 않음
  }
  if (me.type !== 'member') throw notFound();
  const { rows } = await db.query(
    `UPDATE match_history SET status = 'rejected', responded_at = now()
     WHERE id = $1 AND target_id = $2 AND status = 'pending' RETURNING requester_id`,
    [matchId, me.id]
  );
  if (rows.length === 0) throw notFound();
  return `member:${rows[0].requester_id}`;
}

// 내가 받은 Redis 요청이면 { requester, ... }, 아니면 null
// 회원은 Redis가 끊겨도 PG 요청은 처리할 수 있게 한다
async function findRedisMatch(me, matchId) {
  try {
    const m = await getRedis().hGetAll(matchKey(matchId));
    if (!m.status) return null;
    if (m.target !== actorKey(me)) throw notFound();
    return m;
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE' && me.type === 'member') return null;
    throw err;
  }
}

// 대기 중인 요청 { received, sent }
async function listRequests(me) {
  const meKey = actorKey(me);
  const items = []; // { id, direction, otherKey, similarity, commonTagIds, createdAt }
  if (me.type === 'member') {
    const { rows } = await db.query(
      `SELECT id, similarity, common_tag_ids, created_at, requester_id = $1 AS is_sent,
              CASE WHEN requester_id = $1 THEN target_id ELSE requester_id END AS other
       FROM match_history
       WHERE (requester_id = $1 OR target_id = $1) AND status = 'pending' AND created_at > now() - $2::interval
       ORDER BY created_at DESC`,
      [me.id, COOLDOWN]
    );
    for (const r of rows) {
      items.push({
        id: r.id,
        direction: r.is_sent ? 'sent' : 'received',
        otherKey: `member:${r.other}`,
        similarity: r.similarity,
        commonTagIds: r.common_tag_ids,
        createdAt: r.created_at.toISOString(),
      });
    }
  }
  for (const m of await redisMatches(meKey)) {
    if (m.status !== 'pending') continue;
    const sent = m.requester === meKey;
    items.push({
      id: m.id,
      direction: sent ? 'sent' : 'received',
      otherKey: sent ? m.target : m.requester,
      similarity: m.similarity,
      commonTagIds: m.commonTagIds,
      createdAt: m.createdAt,
    });
  }

  const profiles = await getProfiles([...new Set(items.map((i) => i.otherKey))]);
  const names = await tagNames([...new Set(items.flatMap((i) => i.commonTagIds))]);
  const result = { received: [], sent: [] };
  for (const i of items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
    const p = profiles.get(i.otherKey);
    if (!p) continue; // 탈퇴·만료한 상대
    result[i.direction].push(toRequest(i.id, i.direction, p, i.similarity, i.commonTagIds.map((t) => names.get(t)), i.createdAt));
  }
  return result;
}

// Guest가 둘러보기를 직접 끝낼 때 요청을 바로 정리 (시간 만료는 TTL)
async function removeGuestMatches(guestId) {
  const redis = getRedis();
  const key = `guest:${guestId}`;
  const matches = await redisMatches(key);
  await redis.del([
    actorMatchesKey(key),
    ...matches.flatMap((m) => [matchKey(m.id), pairKey(m.requester, m.target)]),
  ]);
}

module.exports = {
  commonTags,
  getVectors,
  getCandidates,
  createRequest,
  acceptRequest,
  rejectRequest,
  listRequests,
  removeGuestMatches,
};
