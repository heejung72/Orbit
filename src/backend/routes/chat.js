const express = require('express');
const db = require('../db');

const router = express.Router();

// 내 채팅방 목록
router.get('/rooms', async (req, res) => {
  try {
    // 1:1 채팅방
    const directRooms = await db.query(
      `SELECT cr.id, cr.type, cr.created_at,
        u.nickname as partner_nickname, u.profile_image as partner_image,
        (SELECT content FROM messages WHERE chat_room_id = cr.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE chat_room_id = cr.id ORDER BY created_at DESC LIMIT 1) as last_message_at
       FROM chat_rooms cr
       JOIN matches m ON cr.match_id = m.id
       JOIN users u ON u.id = CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
       WHERE cr.type = 'direct' AND (m.user1_id = $1 OR m.user2_id = $1) AND m.status = 'accepted'
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.userId]
    );

    // 동호회 채팅방
    const clubRooms = await db.query(
      `SELECT cr.id, cr.type, cr.created_at, c.name as lounge_name,
        (SELECT content FROM messages WHERE chat_room_id = cr.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE chat_room_id = cr.id ORDER BY created_at DESC LIMIT 1) as last_message_at
       FROM chat_rooms cr
       JOIN clubs c ON cr.club_id = c.id
       JOIN club_members cm ON cm.club_id = c.id AND cm.user_id = $1
       WHERE cr.type = 'club'
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.userId]
    );

    res.json({ direct: directRooms.rows, lounges: clubRooms.rows });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 메시지 조회
router.get('/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // 커서 기반 페이지네이션

    let query = `
      SELECT m.id, m.content, m.type, m.created_at, m.sender_id, m.guest_session_id,
        u.nickname as sender_nickname, u.profile_image as sender_image, u.is_guest
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id OR m.guest_session_id = u.id
      WHERE m.chat_room_id = $1`;
    const params = [roomId];

    if (before) {
      query += ` AND m.created_at < $2`;
      params.push(before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
