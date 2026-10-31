const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { filterMessage, containsBadWords } = require('../middleware/filter');

function setupSocket(io) {
  // 인증 미들웨어 (게스트 토큰도 허용)
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('인증이 필요합니다'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.isGuest = decoded.isGuest || false;
      next();
    } catch {
      next(new Error('유효하지 않은 토큰입니다'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // 채팅방 참가
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
    });

    // 채팅방 나가기
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
    });

    // 메시지 전송
    socket.on('send_message', async (data) => {
      const { roomId, content, type = 'text' } = data;

      // 비속어 필터링
      const filteredContent = containsBadWords(content) ? filterMessage(content) : content;

      // DB 저장
      const msgId = uuidv4();
      try {
        await db.query(
          `INSERT INTO messages (id, chat_room_id, sender_id, guest_session_id, content, type) VALUES ($1, $2, $3, $4, $5, $6)`,
          [msgId, roomId, socket.isGuest ? null : socket.userId, socket.isGuest ? socket.userId : null, filteredContent, type]
        );

        const sender = await db.query(
          'SELECT nickname, profile_image, is_guest FROM users WHERE id = $1',
          [socket.userId]
        );

        const message = {
          id: msgId,
          chat_room_id: roomId,
          sender_id: socket.userId,
          sender_nickname: sender.rows[0].nickname,
          sender_image: sender.rows[0].profile_image,
          is_guest: sender.rows[0].is_guest,
          content: filteredContent,
          type,
          created_at: new Date().toISOString(),
        };

        // 같은 방 전체에 브로드캐스트
        io.to(roomId).emit('new_message', message);
      } catch (err) {
        socket.emit('error', { message: '메시지 전송에 실패했습니다' });
      }
    });

    // 타이핑 표시
    socket.on('typing', (roomId) => {
      socket.to(roomId).emit('user_typing', { userId: socket.userId });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
}

module.exports = { setupSocket };
