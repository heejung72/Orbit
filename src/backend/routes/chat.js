const express = require('express');
const db = require('../db');
const { getRoomForActor } = require('../services/chatAccess');
const { getMessages } = require('../services/chat');
const { joinedLoungeIds } = require('../services/loungeMembers');
const { listDirectRooms, leaveDirectRoom } = require('../services/directRooms');
const { topicsForRoom } = require('../services/topics');
const { actorKey } = require('../services/actors');
const { toPositiveInt, toIsoDate } = require('../utils/validate');

// /api/chat — optionalAuth 아래 (회원·Guest, 토큰 없으면 401). 접근 판단은 항상 req.actor 기준
const router = express.Router();

// 참여한 라운지의 채팅방 목록 (최근 메시지순)
const LOUNGE_ROOMS_SQL = `
  SELECT cr.id, cr.type, cr.created_at, l.id AS lounge_id, l.name AS lounge_name,
         lmsg.content AS last_message, lmsg.created_at AS last_message_at
  FROM lounges l
  JOIN chat_rooms cr ON cr.lounge_id = l.id
  LEFT JOIN LATERAL (
    SELECT content, created_at FROM messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1
  ) lmsg ON true
  WHERE l.id = ANY($1::uuid[])
  ORDER BY lmsg.created_at DESC NULLS LAST`;

// 최근 메시지(없으면 방 생성 시각) 내림차순
const byRecent = (a, b) => {
  const at = (r) => new Date(r.last_message_at || r.created_at).getTime();
  return at(b) - at(a);
};

// 1:1 Redis 방 목록 — 회원은 Redis가 끊겨도 PG 방만으로 목록을 보여준다
async function redisDirectRooms(actor) {
  try {
    return await listDirectRooms(actorKey(actor));
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE' && actor.type === 'member') return [];
    throw err;
  }
}

// 내 채팅방 목록 — 1:1은 PG 방(회원끼리) + Redis 방(Guest가 낀 방, #13), 라운지는 참여 목록
router.get('/rooms', async (req, res) => {
  try {
    const loungeIds = [...(await joinedLoungeIds(req.actor))];
    const loungeRooms = loungeIds.length ? (await db.query(LOUNGE_ROOMS_SQL, [loungeIds])).rows : [];
    const redisRooms = await redisDirectRooms(req.actor);
    if (req.actor.type === 'guest') return res.json({ direct: redisRooms.sort(byRecent), lounges: loungeRooms });

    // 1:1 채팅방 — 상대는 방 단위 익명 표시 이름으로
    const directRooms = await db.query(
      `SELECT cr.id, cr.type, cr.created_at,
              partner.display_name AS partner_nickname, a.emoji AS partner_avatar_emoji, false AS partner_is_guest,
              lm.content AS last_message, lm.created_at AS last_message_at
       FROM chat_members me
       JOIN chat_rooms cr ON cr.id = me.room_id AND cr.type = 'direct'
       JOIN chat_members partner ON partner.room_id = cr.id AND partner.user_id <> me.user_id
       JOIN avatars a ON a.id = partner.avatar_id
       LEFT JOIN LATERAL (
         SELECT content, created_at FROM messages WHERE room_id = cr.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE me.user_id = $1 AND me.left_at IS NULL
       ORDER BY lm.created_at DESC NULLS LAST`,
      [req.userId]
    );

    res.json({ direct: [...directRooms.rows, ...redisRooms].sort(byRecent), lounges: loungeRooms });
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    console.error('GET /api/chat/rooms 실패:', err.message);
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

// 1:1 대화 주제 — 두 사람의 공통 취향으로 1~3개 (#13)
router.get('/rooms/:roomId/topics', async (req, res) => {
  try {
    const room = await getRoomForActor(req.params.roomId, req.actor);
    if (!room) return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });
    if (room.type !== 'direct') return res.status(400).json({ error: '대화 주제는 1:1 대화에서만 볼 수 있어요' });
    res.json({ topics: await topicsForRoom(room) });
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    console.error('GET /api/chat/rooms/:id/topics 실패:', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 1:1 방 나가기 — 두 사람 모두 나가면 방 종료(closed_at). 라운지 나가기는 #11
// Redis 방(Guest가 낀 방)은 나간 사람을 표시하고, 두 사람 모두 나가면 방·메시지를 지운다
router.post('/rooms/:roomId/leave', async (req, res) => {
  try {
    const room = await getRoomForActor(req.params.roomId, req.actor);
    if (!room) return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });
    if (room.type !== 'direct') return res.status(400).json({ error: '라운지는 라운지 화면에서 나갈 수 있어요' });

    if (room.store === 'redis') await leaveDirectRoom(room, actorKey(req.actor));
    else await leavePgRoom(room.id, req.actor.id);

    // 이 사람의 모든 기기 소켓을 방에서 빼서, 나간 뒤에는 새 메시지를 받지 않게 한다
    const io = req.app.get('io');
    for (const s of await io.in(room.id).fetchSockets()) {
      if (s.data.actor.type === req.actor.type && s.data.actor.id === req.actor.id) s.leave(room.id);
    }
    res.json({ message: '대화방을 나갔어요' });
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    console.error('POST /api/chat/rooms/:id/leave 실패:', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 동시에 나가도 방 종료가 누락되지 않도록 chat_rooms 행을 잠그고 처리
async function leavePgRoom(roomId, userId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM chat_rooms WHERE id = $1 FOR UPDATE', [roomId]);
    await client.query('UPDATE chat_members SET left_at = now() WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL', [roomId, userId]);
    await client.query(
      `UPDATE chat_rooms SET closed_at = now()
       WHERE id = $1 AND closed_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM chat_members WHERE room_id = $1 AND left_at IS NULL)`,
      [roomId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = router;
