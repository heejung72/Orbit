const crypto = require('crypto');
const db = require('../db');
const { getRedis } = require('../redis');
const { filterMessage, containsBadWords } = require('../middleware/profanityFilter');

// 메시지 저장·조회 — docs/system_design.md §4-3
// 회원 메시지: PG messages / Guest 메시지: Redis room:{roomId}:guestmsgs (PG·로그에 남기지 않음)
// 클라이언트에는 실제 user_id·guestId 대신 is_mine만 내려준다

const MAX_LENGTH = 1000;
const GUEST_MSG_LIMIT = 500; // 방마다 최근 Guest 메시지 수
const GUEST_MSG_TTL_MS = (Number(process.env.GUEST_SESSION_MINUTES) || 30) * 60 * 1000; // 마지막 Guest 메시지 이후 키 유지 시간

const guestMessagesKey = (roomId) => `room:${roomId}:guestmsgs`;
const senderKeyOf = (actor) => `${actor.type}:${actor.id}`;

// 앞뒤 공백 제거 후 1~1000자면 비속어를 가린 본문, 아니면 null
function normalizeContent(content) {
  if (typeof content !== 'string') return null;
  const text = content.trim();
  if (!text || text.length > MAX_LENGTH) return null;
  return containsBadWords(text) ? filterMessage(text) : text;
}

// 저장 후 보낼 메시지 (senderKey는 서버 내부용, toClient에서 is_mine으로 바뀜)
async function saveMessage(room, actor, content) {
  if (actor.type === 'guest') {
    const message = {
      id: crypto.randomUUID(),
      room_id: room.id,
      content,
      created_at: new Date().toISOString(),
      is_guest: true,
      sender_nickname: actor.nickname,
      sender_avatar_emoji: actor.avatarEmoji,
    };
    const key = guestMessagesKey(room.id);
    const stored = JSON.stringify({ ...message, guestId: actor.id, expiresAt: actor.expiresAt });
    await getRedis().multi().rPush(key, stored).lTrim(key, -GUEST_MSG_LIMIT, -1).pExpire(key, GUEST_MSG_TTL_MS).exec();
    return { ...message, senderKey: senderKeyOf(actor) };
  }

  // 1:1은 방 단위 익명 표시 이름·캐릭터, 라운지는 회원 닉네임·캐릭터
  const { rows } = await db.query(
    `WITH m AS (
       INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, created_at
     )
     SELECT m.id, m.created_at, COALESCE(cm.display_name, u.nickname) AS sender_nickname, a.emoji AS sender_avatar_emoji
     FROM m CROSS JOIN users u
     LEFT JOIN chat_members cm ON cm.room_id = $1 AND cm.user_id = u.id
     JOIN avatars a ON a.id = COALESCE(cm.avatar_id, u.avatar_id)
     WHERE u.id = $2`,
    [room.id, actor.id, content]
  );
  const r = rows[0];
  return {
    id: r.id,
    room_id: room.id,
    content,
    created_at: r.created_at.toISOString(),
    is_guest: false,
    sender_nickname: r.sender_nickname,
    sender_avatar_emoji: r.sender_avatar_emoji,
    senderKey: senderKeyOf(actor),
  };
}

// 받는 사람(viewer)마다 is_mine 계산 — 같은 회원의 여러 기기도 내 메시지로 보인다
function toClient(message, viewer) {
  const { senderKey, ...rest } = message;
  return { ...rest, is_mine: senderKey === senderKeyOf(viewer) };
}

// 기록: PG(회원) + Redis(Guest, 만료 전 작성자만)를 시간순으로 합쳐 before 이전 limit개
async function getMessages(room, viewer, { before = null, limit = 50 } = {}) {
  const params = [room.id];
  let where = 'm.room_id = $1';
  if (before) {
    params.push(before);
    where += ` AND m.created_at < $${params.length}`;
  }
  params.push(limit);
  const pg = await db.query(
    `SELECT m.id, m.room_id, m.content, m.created_at, m.sender_id,
            COALESCE(cm.display_name, u.nickname, '떠난 궤도') AS sender_nickname,
            a.emoji AS sender_avatar_emoji
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     LEFT JOIN chat_members cm ON cm.room_id = m.room_id AND cm.user_id = m.sender_id
     LEFT JOIN avatars a ON a.id = COALESCE(cm.avatar_id, u.avatar_id)
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  const members = pg.rows.map(({ sender_id, created_at, ...r }) => ({
    ...r,
    created_at: created_at.toISOString(),
    is_guest: false,
    senderKey: sender_id ? `member:${sender_id}` : null,
  }));

  let guests = [];
  if (room.type === 'lounge') {
    const now = Date.now();
    let raw = [];
    try {
      raw = await getRedis().lRange(guestMessagesKey(room.id), 0, -1);
    } catch (err) {
      if (viewer.type === 'guest' || err.code !== 'REDIS_UNAVAILABLE') throw err;
      // Redis가 끊겨도 회원은 회원 메시지만으로 기록을 본다
    }
    guests = raw
      .map((raw) => JSON.parse(raw))
      .filter((g) => g.expiresAt > now && (!before || g.created_at < before))
      .map(({ guestId, expiresAt, ...g }) => ({ ...g, senderKey: `guest:${guestId}` }));
  }

  return [...members, ...guests]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
    .reverse()
    .map((m) => toClient(m, viewer));
}

module.exports = { MAX_LENGTH, guestMessagesKey, normalizeContent, saveMessage, toClient, getMessages };
