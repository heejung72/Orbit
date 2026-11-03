const db = require('../db');
const { getRedis } = require('../redis');

// actor(회원·Guest) 공통 도우미 (#13)
// actorKey: 'member:{userId}' | 'guest:{guestId}' — 서버 내부용, 클라이언트에는 내려주지 않는다

const actorKey = (actor) => `${actor.type}:${actor.id}`;
const parseActorKey = (key) => {
  const i = key.indexOf(':');
  return { type: key.slice(0, i), id: key.slice(i + 1) };
};
// 소켓 연결 시 들어가는 actor 전용 방 — 같은 사람의 모든 기기에 이벤트를 보낼 때
const actorRoom = (key) => `actor:${key}`;
const emitToActor = (io, key, event, payload) => io.to(actorRoom(key)).emit(event, payload);

// Guest 표시 정보 — guestId로 찾을 수 있게 세션과 따로, 세션과 같은 시각에 만료 (guestSession.js가 저장)
const guestProfileKey = (guestId) => `guest:profile:${guestId}`;

// actorKey 목록 → Map(key → { nickname, avatarId, avatarEmoji, isGuest, expiresAt? })
// 탈퇴·정지 회원, 만료된 Guest는 빠진다
async function getProfiles(keys) {
  const profiles = new Map();
  const members = keys.filter((k) => k.startsWith('member:')).map((k) => parseActorKey(k).id);
  const guests = keys.filter((k) => k.startsWith('guest:')).map((k) => parseActorKey(k).id);
  if (members.length) {
    const { rows } = await db.query(
      `SELECT u.id, u.nickname, u.avatar_id, a.emoji FROM users u JOIN avatars a ON a.id = u.avatar_id
       WHERE u.id = ANY($1::uuid[]) AND u.status = 'active'`,
      [members]
    );
    for (const r of rows) {
      profiles.set(`member:${r.id}`, { nickname: r.nickname, avatarId: r.avatar_id, avatarEmoji: r.emoji, isGuest: false });
    }
  }
  if (guests.length) {
    const multi = getRedis().multi();
    for (const id of guests) multi.hGetAll(guestProfileKey(id));
    const results = await multi.exec();
    const now = Date.now();
    guests.forEach((id, i) => {
      const p = results[i];
      const expiresAt = Number(p.expiresAt);
      if (!(expiresAt > now)) return;
      profiles.set(`guest:${id}`, { nickname: p.nickname, avatarId: Number(p.avatarId), avatarEmoji: p.avatarEmoji, isGuest: true, expiresAt });
    });
  }
  return profiles;
}

// 참여자 중 가장 먼저 만료되는 Guest의 시각 (Guest가 없으면 null)
const earliestExpiry = (profiles) => {
  const times = [...profiles.values()].filter((p) => p.isGuest).map((p) => p.expiresAt);
  return times.length ? Math.min(...times) : null;
};

module.exports = { actorKey, parseActorKey, actorRoom, emitToActor, guestProfileKey, getProfiles, earliestExpiry };
