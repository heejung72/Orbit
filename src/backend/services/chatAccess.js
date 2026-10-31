const db = require('../db');
const { toUuid } = require('../utils/validate');

// 회원이 채팅방에 접근할 수 있는지 확인
// - direct: chat_members에 있고 나가지 않았어야 함
// - lounge: 라운지 채팅은 로그인한 회원이면 열람·전송 가능 (참여는 목록/알림용)
// TODO(#10): Guest(Redis 방) 지원, 차단 관계 확인(#16)
async function getRoomForMember(rawRoomId, userId) {
  const roomId = toUuid(rawRoomId);
  if (!roomId) return null;
  const { rows } = await db.query(
    `SELECT cr.id, cr.type, cr.closed_at,
            (SELECT cm.left_at IS NULL FROM chat_members cm WHERE cm.room_id = cr.id AND cm.user_id = $2) AS is_member
     FROM chat_rooms cr WHERE cr.id = $1`,
    [roomId, userId]
  );
  const room = rows[0];
  if (!room) return null;
  if (room.type === 'direct' && !room.is_member) return null;
  return room;
}

module.exports = { getRoomForMember };
