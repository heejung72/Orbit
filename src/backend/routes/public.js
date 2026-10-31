const express = require('express');
const db = require('../db');

const router = express.Router();

// 홈 화면 (비로그인 접근 가능)
router.get('/home', async (req, res) => {
  try {
    // 인기 취향 카테고리 + 옵션 (이미지 포함)
    const categories = await db.query('SELECT * FROM taste_categories ORDER BY id');
    const options = await db.query('SELECT * FROM taste_options ORDER BY category_id, id');

    const tastes = categories.rows.map(cat => ({
      ...cat,
      options: options.rows
        .filter(opt => opt.category_id === cat.id)
        .map(opt => ({ id: opt.id, name: opt.name, image_url: opt.image_url })),
    }));

    // 인기 라운지 (멤버 수 상위 10개)
    const popularLounges = await db.query(`
      SELECT c.id, c.name, c.description, tc.name as category_name, tc.icon as category_icon,
        (SELECT COUNT(*) FROM club_members WHERE club_id = c.id) as member_count
      FROM clubs c
      JOIN taste_categories tc ON c.category_id = tc.id
      ORDER BY member_count DESC
      LIMIT 10
    `);

    res.json({
      tastes,
      popularLounges: popularLounges.rows,
    });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 목록 (비로그인 열람)
router.get('/lounges', async (req, res) => {
  try {
    const { category_id, search } = req.query;
    let query = `
      SELECT c.id, c.name, c.description, tc.name as category_name, tc.icon as category_icon,
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

// 라운지 상세 (비로그인 열람)
router.get('/lounges/:id', async (req, res) => {
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

// 취향 카테고리 + 옵션 (이미지 포함, 비로그인 접근)
router.get('/tastes', async (req, res) => {
  try {
    const categories = await db.query('SELECT * FROM taste_categories ORDER BY id');
    const options = await db.query('SELECT * FROM taste_options ORDER BY category_id, id');

    const result = categories.rows.map(cat => ({
      ...cat,
      options: options.rows.filter(opt => opt.category_id === cat.id),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
