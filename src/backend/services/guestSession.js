const crypto = require('crypto');
const db = require('../db');
const { getRedis } = require('../redis');
const { guestTastesKey } = require('./tastes');

// Guest 세션 (docs/system_design.md §4)
// - 토큰 원본은 클라이언트만 가진다. Redis에는 SHA-256 해시를 키로 저장 (Redis 유출 시 토큰 재사용 방지)
// - 30분 절대 시간제: expiresAt은 발급 시 한 번 정하고 갱신하지 않는다

const SESSION_MS = (Number(process.env.GUEST_SESSION_MINUTES) || 30) * 60 * 1000;
const ADJECTIVES = ['익명의', '조용한', '반짝이는', '떠도는', '새벽의', '느긋한', '수줍은', '용감한'];
const NOUNS = ['여행자', '혜성', '별똥별', '행성', '위성', '탐험가', '관찰자', '항해자'];

const keyOf = (token) => `guest:session:${crypto.createHash('sha256').update(token).digest('hex')}`;
const pick = (list) => list[crypto.randomInt(list.length)];

async function createGuestSession() {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_MS;
  const { rows: avatars } = await db.query('SELECT id, emoji FROM avatars ORDER BY sort_order');
  const avatar = pick(avatars);
  const session = {
    guestId: crypto.randomUUID(),
    nickname: `${pick(ADJECTIVES)} ${pick(NOUNS)} ${crypto.randomInt(1000, 10000)}`,
    avatarId: avatar.id,
    avatarEmoji: avatar.emoji,
    expiresAt,
  };

  const key = keyOf(token);
  const fields = Object.fromEntries(Object.entries(session).map(([k, v]) => [k, String(v)]));
  // 저장과 만료 설정을 한 번에 (사이에 끊기면 만료 없는 키가 남음)
  await getRedis().multi().hSet(key, fields).pExpireAt(key, expiresAt).exec();
  return { token, ...session };
}

// 유효한 세션이면 객체, 없거나 만료면 null. TTL과 별개로 expiresAt을 직접 비교한다.
async function findGuestSession(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const s = await getRedis().hGetAll(keyOf(token));
  if (!s.guestId) return null;
  const expiresAt = Number(s.expiresAt);
  if (!(expiresAt > Date.now())) return null;
  return { guestId: s.guestId, nickname: s.nickname, avatarId: Number(s.avatarId), avatarEmoji: s.avatarEmoji, expiresAt };
}

// 세션과 함께 Guest 임시 데이터(취향)도 지운다. 시간 만료 시에는 같은 TTL로 함께 사라진다
async function deleteGuestSession(token) {
  const redis = getRedis();
  const guestId = await redis.hGet(keyOf(token), 'guestId');
  await redis.del(guestId ? [keyOf(token), guestTastesKey(guestId)] : [keyOf(token)]);
}

module.exports = { createGuestSession, findGuestSession, deleteGuestSession };
