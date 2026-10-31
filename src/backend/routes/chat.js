const express = require('express');
const db = require('../db');
const { getRoomForMember } = require('../services/chatAccess');

const router = express.Router();

const UUID_RE = /^[0-9a-f-]{36}$/i;

// 내 채팅방 목록
router.get('/rooms', async (req, res) => {
  try {
    // 1:1 채팅방 — 상대는 방 단위 익명 표시 이름으로
    const directRooms = await db.query(
      `SELECT cr.id, cr.type, cr.created_at,
              partner.display_name AS partner_nickname,
              lm.content AS last_message, lm.created_at AS last_message_at
       FROM chat_members me
       JOIN chat_rooms cr ON cr.id = me.room_id AND cr.type = 'direct'
       JOIN chat_members partner ON partner.room_id = cr.id AND partner.user_id <> me.user_id
       LEFT JOIN LATERAL (
         SELECT content, created_at FROM messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE me.user_id = $1 AND me.left_at IS NULL
       ORDER BY lm.created_at DESC NULLS LAST`,
      [req.userId]
    );

    // 내가 참여한 라운지 채팅방
    const loungeRooms = await db.query(
      `SELECT cr.id, cr.type, cr.created_at, l.id AS lounge_id, l.name AS lounge_name,
              lmsg.content AS last_message, lmsg.created_at AS last_message_at
       FROM lounge_members lm
       JOIN lounges l ON l.id = lm.lounge_id
       JOIN chat_rooms cr ON cr.lounge_id = l.id
       LEFT JOIN LATERAL (
         SELECT content, created_at FROM messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1
       ) lmsg ON true
       WHERE lm.user_id = $1
       ORDER BY lmsg.created_at DESC NULLS LAST`,
      [req.userId]
    );

    res.json({ direct: directRooms.rows, lounges: loungeRooms.rows });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 메시지 조회 (커서: before = ISO 시각)
router.get('/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!UUID_RE.test(roomId)) return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });

    const room = await getRoomForMember(roomId, req.userId);
    if (!room) return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const params = [roomId];
    let where = 'm.room_id = $1';
    if (req.query.before) {
      params.push(req.query.before);
      where += ` AND m.created_at < $${params.length}`;
    }
    params.push(limit);

    // 표시 이름: 1:1은 방 단위 display_name, 라운지는 회원 닉네임
    // TODO(#10): sender_id 대신 is_mine 플래그로 바꿔 실제 user_id 노출 제거
    const result = await db.query(
      `SELECT m.id, m.content, m.created_at, m.sender_id,
              COALESCE(cm.display_name, u.nickname, '떠난 궤도') AS sender_nickname,
              false AS is_guest
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN chat_members cm ON cm.room_id = m.room_id AND cm.user_id = m.sender_id
       WHERE ${where}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
