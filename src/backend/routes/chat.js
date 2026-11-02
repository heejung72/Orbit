const express = require('express');
const db = require('../db');
const { getRoomForActor } = require('../services/chatAccess');
const { getMessages } = require('../services/chat');
const { toPositiveInt, toIsoDate } = require('../utils/validate');

// /api/chat — optionalAuth 아래 (회원·Guest, 토큰 없으면 401). 접근 판단은 항상 req.actor 기준
const router = express.Router();

// 내 채팅방 목록 — Guest는 1:1 방(#13)·라운지 참여(#11)가 아직 없어 빈 목록
router.get('/rooms', async (req, res) => {
  if (req.actor.type === 'guest') return res.json({ direct: [], lounges: [] });
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

// 메시지 기록 (커서: before = ISO 시각) — 회원(PG) + Guest(Redis) 메시지를 시간순으로 합쳐서
router.get('/rooms/:roomId/messages', async (req, res) => {
  try {
    const room = await getRoomForActor(req.params.roomId, req.actor);
    if (!room) return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });

    let before = null;
    if (req.query.before !== undefined) {
      before = toIsoDate(req.query.before);
      if (!before) return res.status(400).json({ error: 'before 값이 올바르지 않습니다' });
    }
    res.json(await getMessages(room, req.actor, { before, limit: toPositiveInt(req.query.limit, 50, 100) }));
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    console.error('GET /api/chat/rooms/:id/messages 실패:', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 1:1 방 나가기 — 두 사람 모두 나가면 방 종료(closed_at). 라운지 나가기는 #11
// 동시에 나가도 방 종료가 누락되지 않도록 chat_rooms 행을 잠그고 처리
router.post('/rooms/:roomId/leave', async (req, res) => {
  try {
    const room = await getRoomForActor(req.params.roomId, req.actor);
    if (!room) return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });
    if (room.type !== 'direct') return res.status(400).json({ error: '라운지는 라운지 화면에서 나갈 수 있어요' });

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM chat_rooms WHERE id = $1 FOR UPDATE', [room.id]);
      await client.query('UPDATE chat_members SET left_at = now() WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL', [room.id, req.actor.id]);
      await client.query(
        `UPDATE chat_rooms SET closed_at = now()
         WHERE id = $1 AND closed_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM chat_members WHERE room_id = $1 AND left_at IS NULL)`,
        [room.id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ message: '대화방을 나갔어요' });
  } catch (err) {
    console.error('POST /api/chat/rooms/:id/leave 실패:', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
