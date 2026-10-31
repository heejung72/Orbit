const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { findMatches } = require('../services/matching');

const router = express.Router();

// 매칭 후보 찾기
router.post('/find', async (req, res) => {
  try {
    const matches = await findMatches(req.userId);

    // 후보 유저 정보 조회
    if (matches.length === 0) {
      return res.json({ matches: [], message: '매칭 가능한 사용자가 없습니다' });
    }

    const userIds = matches.map(m => m.userId);
    const users = await db.query(
      `SELECT id, nickname, bio, profile_image FROM users WHERE id = ANY($1)`,
      [userIds]
    );

    const result = matches.map(m => {
      const user = users.rows.find(u => u.id === m.userId);
      return { ...user, similarity_score: Math.round(m.score * 100) };
    });

    res.json({ matches: result });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 매칭 요청
router.post('/request/:targetId', async (req, res) => {
  try {
    const { targetId } = req.params;

    // 중복 확인
    const existing = await db.query(
      `SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2 AND status = 'pending'`,
      [req.userId, targetId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 매칭 요청을 보냈습니다' });
    }

    const matchId = uuidv4();
    await db.query(
      `INSERT INTO matches (id, user1_id, user2_id, similarity_score) VALUES ($1, $2, $3, $4)`,
      [matchId, req.userId, targetId, req.body.similarity_score || 0]
    );

    res.status(201).json({ matchId, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 매칭 수락
router.post('/:matchId/accept', async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await db.query(
      `UPDATE matches SET status = 'accepted' WHERE id = $1 AND user2_id = $2 AND status = 'pending' RETURNING *`,
      [matchId, req.userId]
    );
    if (match.rows.length === 0) {
      return res.status(404).json({ error: '매칭 요청을 찾을 수 없습니다' });
    }

    // 채팅방 생성
    const roomId = uuidv4();
    await db.query(
      `INSERT INTO chat_rooms (id, type, match_id) VALUES ($1, 'direct', $2)`,
      [roomId, matchId]
    );

    res.json({ matchId, chatRoomId: roomId, status: 'accepted' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 매칭 거절
router.post('/:matchId/reject', async (req, res) => {
  try {
    const { matchId } = req.params;
    await db.query(
      `UPDATE matches SET status = 'rejected' WHERE id = $1 AND user2_id = $2`,
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
      `SELECT m.*, u.nickname, u.profile_image,
        CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END as partner_id
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
       WHERE (m.user1_id = $1 OR m.user2_id = $1)
       ORDER BY m.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
