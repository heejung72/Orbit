const db = require('../db');
const { toUuid } = require('../utils/validate');

// 채팅방 접근 확인 (회원·Guest 공통) — actor: { type: 'member' | 'guest', id }
// - direct(1:1): chat_members에 있고 나가지 않은 회원만. Guest가 낀 1:1 방(Redis)은 #13에서 추가
// - lounge: 회원·Guest 모두 열람·전송 가능 (라운지 참여는 목록·알림용, #11)
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
  if (!room) return null;
  if (room.type === 'direct' && !(actor.type === 'member' && room.is_member)) return null;
  return room;
}

module.exports = { getRoomForActor };
