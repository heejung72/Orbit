const express = require('express');
const db = require('../db');

const router = express.Router();

// 내 프로필 조회
router.get('/me', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, nickname, bio, profile_image, status, created_at FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    // 취향도 함께 조회
    const tastes = await db.query(
      `SELECT tc.name as category, to2.name as taste
       FROM user_tastes ut
       JOIN taste_options to2 ON ut.taste_option_id = to2.id
       JOIN taste_categories tc ON to2.category_id = tc.id
       WHERE ut.user_id = $1
       ORDER BY tc.id`,
      [req.userId]
    );

    res.json({ ...result.rows[0], tastes: tastes.rows });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 프로필 수정
router.put('/me', async (req, res) => {
  try {
    const { nickname, bio, profile_image } = req.body;
    const result = await db.query(
      `UPDATE users SET nickname = COALESCE($1, nickname), bio = COALESCE($2, bio), profile_image = COALESCE($3, profile_image)
       WHERE id = $4 RETURNING id, email, nickname, bio, profile_image`,
      [nickname, bio, profile_image, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 취향 업데이트
router.put('/me/tastes', async (req, res) => {
  try {
    const { taste_option_ids } = req.body; // [1, 3, 5, 12, ...]

    if (!Array.isArray(taste_option_ids) || taste_option_ids.length < 3) {
      return res.status(400).json({ error: '최소 3개의 취향을 선택해주세요' });
    }

    // 기존 취향 삭제 후 재삽입
    await db.query('DELETE FROM user_tastes WHERE user_id = $1', [req.userId]);

    const values = taste_option_ids.map((optId, i) =>
      `($1, $${i + 2})`
    ).join(', ');
    const params = [req.userId, ...taste_option_ids];

    await db.query(
      `INSERT INTO user_tastes (user_id, taste_option_id) VALUES ${values}`,
      params
    );

    res.json({ message: '취향이 업데이트되었습니다' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
