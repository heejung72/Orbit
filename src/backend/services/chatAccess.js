const db = require('../db');
const { toUuid } = require('../utils/validate');
const { actorKey } = require('./actors');
const { getDirectRoom } = require('./directRooms');

// 채팅방 접근 확인 (회원·Guest 공통) — actor: { type: 'member' | 'guest', id }
// - direct(1:1, PG): chat_members에 있고 나가지 않은 회원만
// - direct(1:1, Redis): Guest가 낀 방(#13). 방 참여자이고 나가지 않은 사람만
// - lounge: 회원·Guest 모두 열람·전송 가능 (라운지 참여는 목록·알림용, #11)
// 반환: { id, type, closed_at, store: 'pg' | 'redis', ... } 또는 null
// TODO(#16): 차단 관계 확인
async function getRoomForActor(rawRoomId, actor) {
  const roomId = toUuid(rawRoomId);
  if (!roomId) return null;
  const { rows } = await db.query(
    `SELECT cr.id, cr.type, cr.closed_at,
            (SELECT cm.left_at IS NULL FROM chat_members cm WHERE cm.room_id = cr.id AND cm.user_id = $2) AS is_member
     FROM chat_rooms cr WHERE cr.id = $1`,
    [roomId, actor.type === 'member' ? actor.id : null]
  );
  const room = rows[0];
  if (room) {
    if (room.type === 'direct' && !(actor.type === 'member' && room.is_member)) return null;
    return { ...room, store: 'pg' };
  }

  let redisRoom;
  try {
    redisRoom = await getDirectRoom(roomId);
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE' && actor.type === 'member') return null; // 회원의 PG 방·라운지는 계속 동작
    throw err;
  }
  const key = actorKey(actor);
  if (!redisRoom || redisRoom.left.has(key) || !redisRoom.members.some((m) => m.key === key)) return null;
  // JWT만으로는 탈퇴 여부를 모른다 — 탈퇴 후 방 정리가 실패해도 남은 토큰으로 Redis 방에 쓰지 못하게
  if (actor.type === 'member') {
    const { rowCount } = await db.query("SELECT 1 FROM users WHERE id = $1 AND status = 'active'", [actor.id]);
    if (rowCount === 0) return null;
  }
  return redisRoom;
}

module.exports = { getRoomForActor };
