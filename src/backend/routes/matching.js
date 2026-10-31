const express = require('express');
const db = require('../db');
const { findMatches } = require('../services/matching');
const { isBlockedBetween } = require('../services/blocks');
const { toUuid } = require('../utils/validate');

const router = express.Router();

// 매칭 후보 찾기
// TODO(#13): 실제 user_id 대신 익명 후보 참조값(targetActorRef) 사용, GET /matching/candidates 로 이동
router.post('/find', async (req, res) => {
  try {
    const matches = await findMatches(req.userId);
    if (matches.length === 0) {
      return res.json({ matches: [], message: '지금은 취향이 비슷한 사람이 없어요' });
    }

    const users = await db.query(
      `SELECT u.id, u.nickname, a.emoji AS avatar_emoji FROM users u JOIN avatars a ON a.id = u.avatar_id
       WHERE u.id = ANY($1)`,
      [matches.map((m) => m.userId)]
    );
    const allTagIds = [...new Set(matches.flatMap((m) => m.commonTagIds))];
    const tags = await db.query('SELECT id, name FROM taste_tags WHERE id = ANY($1)', [allTagIds]);
    const tagName = new Map(tags.rows.map((t) => [t.id, t.name]));

    const result = matches.map((m) => {
      const user = users.rows.find((u) => u.id === m.userId);
      return {
        ...user,
        similarity_score: Math.round(m.score * 100),
        common_tags: m.commonTagIds.map((id) => tagName.get(id)),
      };
    });
    res.json({ matches: result });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 매칭 요청
router.post('/request/:targetId', async (req, res) => {
  const targetId = toUuid(req.params.targetId);
  if (!targetId) return res.status(404).json({ error: '상대를 찾을 수 없습니다' });
  if (targetId === req.userId) return res.status(400).json({ error: '자기 자신에게는 요청할 수 없어요' });
  try {
    // 차단 관계(양방향)면 요청 불가 — 차단 사실이 드러나지 않도록 404와 같은 응답
    if (await isBlockedBetween(req.userId, targetId)) {
      return res.status(404).json({ error: '상대를 찾을 수 없습니다' });
    }

    const score = Math.max(0, Math.min(1, (Number(req.body.similarity_score) || 0) / 100));
    const { rows } = await db.query(
      `INSERT INTO match_history (requester_id, target_id, similarity) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [req.userId, targetId, score]
    );
    if (rows.length === 0) return res.status(409).json({ error: '이미 대화 요청을 보냈어요' });

    res.status(201).json({ matchId: rows[0].id, status: 'pending' });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: '상대를 찾을 수 없습니다' });
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 매칭 수락 → 1:1 채팅방 생성 (방 단위 익명 표시 정보 저장)
router.post('/:matchId/accept', async (req, res) => {
  const matchId = toUuid(req.params.matchId);
  if (!matchId) return res.status(404).json({ error: '대화 요청을 찾을 수 없습니다' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const match = await client.query(
      `UPDATE match_history SET status = 'accepted', responded_at = now()
       WHERE id = $1 AND target_id = $2 AND status = 'pending'
       RETURNING requester_id, target_id`,
      [matchId, req.userId]
    );
    if (match.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '대화 요청을 찾을 수 없습니다' });
    }
    // 요청 이후 차단이 생겼다면 방을 만들지 않고 요청을 취소 처리
    if (await isBlockedBetween(match.rows[0].requester_id, match.rows[0].target_id, client)) {
      await client.query(`UPDATE match_history SET status = 'cancelled' WHERE id = $1`, [matchId]);
      await client.query('COMMIT');
      return res.status(404).json({ error: '대화 요청을 찾을 수 없습니다' });
    }

    const room = await client.query(`INSERT INTO chat_rooms (type) VALUES ('direct') RETURNING id`);
    const roomId = room.rows[0].id;
    await client.query(
      `INSERT INTO chat_members (room_id, user_id, display_name, avatar_id)
       SELECT $1, u.id, u.nickname, u.avatar_id FROM users u WHERE u.id = ANY($2)`,
      [roomId, [match.rows[0].requester_id, match.rows[0].target_id]]
    );
    await client.query('UPDATE match_history SET room_id = $1 WHERE id = $2', [roomId, matchId]);
    await client.query('COMMIT');

    res.json({ matchId, chatRoomId: roomId, status: 'accepted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// 매칭 거절
router.post('/:matchId/reject', async (req, res) => {
  const matchId = toUuid(req.params.matchId);
  if (!matchId) return res.status(404).json({ error: '대화 요청을 찾을 수 없습니다' });
  try {
    await db.query(
      `UPDATE match_history SET status = 'rejected', responded_at = now()
       WHERE id = $1 AND target_id = $2 AND status = 'pending'`,
      [matchId, req.userId]
    );
    res.json({ status: 'rejected' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 내 매칭 목록
router.get('/my', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT mh.id, mh.status, mh.similarity, mh.room_id, mh.created_at,
              (mh.requester_id = $1) AS is_requester, u.nickname
       FROM match_history mh
       JOIN users u ON u.id = CASE WHEN mh.requester_id = $1 THEN mh.target_id ELSE mh.requester_id END
       WHERE mh.requester_id = $1 OR mh.target_id = $1
       ORDER BY mh.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
