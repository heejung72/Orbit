// 라운지 API (기존 동호회 API) — DB 테이블(clubs, club_members)은 #3에서 lounges로 변경
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// 라운지 목록 (카테고리 필터 가능)
router.get('/', async (req, res) => {
  try {
    const { category_id, search } = req.query;
    let query = `
      SELECT c.*, tc.name as category_name, tc.icon as category_icon,
        u.nickname as owner_nickname,
        (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count
      FROM clubs c
      JOIN taste_categories tc ON c.category_id = tc.id
      JOIN users u ON c.owner_id = u.id
      WHERE 1=1`;
    const params = [];

    if (category_id) {
      params.push(category_id);
      query += ` AND c.category_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`;
    }

    query += ' ORDER BY member_count DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 상세
router.get('/:id', async (req, res) => {
  try {
    const club = await db.query(
      `SELECT c.*, tc.name as category_name, u.nickname as owner_nickname,
        (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count
       FROM clubs c
       JOIN taste_categories tc ON c.category_id = tc.id
       JOIN users u ON c.owner_id = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (club.rows.length === 0) {
      return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
    }

    const members = await db.query(
      `SELECT u.id, u.nickname, u.profile_image, cm.role, cm.joined_at
       FROM club_members cm JOIN users u ON cm.user_id = u.id
       WHERE cm.club_id = $1 ORDER BY cm.joined_at`,
      [req.params.id]
    );

    res.json({ ...club.rows[0], members: members.rows });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 생성
router.post('/', async (req, res) => {
  try {
    const { name, description, category_id, max_members } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({ error: '라운지 이름과 카테고리를 입력해주세요' });
    }

    const clubId = uuidv4();

    // 라운지 생성
    await db.query(
      `INSERT INTO clubs (id, name, description, category_id, owner_id, max_members) VALUES ($1, $2, $3, $4, $5, $6)`,
      [clubId, name, description || '', category_id, req.userId, max_members || 50]
    );

    // 생성자를 owner로 멤버 추가
    await db.query(
      `INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [clubId, req.userId]
    );

    // 그룹 채팅방 생성
    const roomId = uuidv4();
    await db.query(
      `INSERT INTO chat_rooms (id, type, club_id) VALUES ($1, 'club', $2)`,
      [roomId, clubId]
    );

    res.status(201).json({ clubId, chatRoomId: roomId });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 가입
router.post('/:id/join', async (req, res) => {
  try {
    const clubId = req.params.id;

    // 인원 확인
    const club = await db.query('SELECT max_members FROM clubs WHERE id = $1', [clubId]);
    if (club.rows.length === 0) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });

    const memberCount = await db.query('SELECT COUNT(*) FROM club_members WHERE club_id = $1', [clubId]);
    if (parseInt(memberCount.rows[0].count) >= club.rows[0].max_members) {
      return res.status(400).json({ error: '정원이 초과되었습니다' });
    }

    await db.query(
      `INSERT INTO club_members (club_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [clubId, req.userId]
    );

    res.json({ message: '가입되었습니다' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 탈퇴
router.delete('/:id/leave', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM club_members WHERE club_id = $1 AND user_id = $2 AND role != 'owner'`,
      [req.params.id, req.userId]
    );
    res.json({ message: '탈퇴되었습니다' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
