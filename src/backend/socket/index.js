const jwt = require('jsonwebtoken');
const db = require('../db');
const { filterMessage, containsBadWords } = require('../middleware/profanityFilter');
const { getRoomForMember } = require('../services/chatAccess');

// Socket.io
// TODO(#10): 이벤트 이름을 설계(room:join, message:send, message:new …)로 변경, Guest(Redis) 지원,
//            모든 이벤트에서 Guest expiresAt 검사
// TODO(#16): send_message 사용자 단위 Rate Limit (Redis)
function setupSocket(io) {
  // 인증: 회원 JWT만 허용 (Guest는 #5에서 guestToken으로 추가)
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('인증이 필요합니다'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.isGuest) return next(new Error('Guest 연결은 준비 중입니다'));
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('유효하지 않은 토큰입니다'));
    }
  });

  io.on('connection', (socket) => {
    // 채팅방 참가 — 접근 가능한 방만
    socket.on('join_room', async (roomId) => {
      try {
        const room = await getRoomForMember(roomId, socket.userId);
        if (!room) return socket.emit('error', { message: '채팅방에 들어갈 수 없습니다' });
        socket.join(room.id);
      } catch {
        socket.emit('error', { message: '채팅방에 들어갈 수 없습니다' });
      }
    });

    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
    });

    // 메시지 전송
    socket.on('send_message', async (data) => {
      const roomId = data && data.roomId;
      const content = typeof data?.content === 'string' ? data.content.trim() : '';
      if (!roomId || !content || content.length > 1000) {
        return socket.emit('error', { message: '메시지를 확인해주세요' });
      }

      try {
        const room = await getRoomForMember(roomId, socket.userId);
        if (!room || room.closed_at) return socket.emit('error', { message: '메시지를 보낼 수 없는 방입니다' });

        const filtered = containsBadWords(content) ? filterMessage(content) : content;
        const { rows } = await db.query(
          `INSERT INTO messages (room_id, sender_id, content) VALUES ($1, $2, $3)
           RETURNING id, created_at`,
          [room.id, socket.userId, filtered]
        );
        const sender = await db.query(
          `SELECT COALESCE(cm.display_name, u.nickname) AS nickname
           FROM users u LEFT JOIN chat_members cm ON cm.room_id = $1 AND cm.user_id = u.id
           WHERE u.id = $2`,
          [room.id, socket.userId]
        );

        // 실제 user_id 대신 is_mine: 보낸 사람에게는 true, 나머지에게는 false
        const message = {
          id: rows[0].id,
          room_id: room.id,
          sender_nickname: sender.rows[0]?.nickname,
          is_guest: false,
          content: filtered,
          created_at: rows[0].created_at,
        };
        socket.emit('new_message', { ...message, is_mine: true });
        socket.to(room.id).emit('new_message', { ...message, is_mine: false });
      } catch {
        socket.emit('error', { message: '메시지 전송에 실패했습니다' });
      }
    });

    socket.on('typing', (roomId) => {
      if (socket.rooms.has(roomId)) socket.to(roomId).emit('user_typing', {});
    });
  });
}

module.exports = { setupSocket };
