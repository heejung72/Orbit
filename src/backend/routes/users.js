const express = require('express');
const db = require('../db');

const router = express.Router();

// 내 프로필 조회
router.get('/me', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.nickname, u.avatar_id, u.status, u.created_at,
              a.emoji AS avatar_emoji, a.color AS avatar_color
       FROM users u JOIN avatars a ON a.id = u.avatar_id
       WHERE u.id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    // 취향 (category/taste 필드는 기존 화면 호환용)
    const tastes = await db.query(
      `SELECT tc.name AS category, tc.icon AS category_icon, tt.id AS tag_id, tt.name AS taste, ut.weight
       FROM user_tastes ut
       JOIN taste_tags tt ON ut.tag_id = tt.id
       JOIN taste_categories tc ON tt.category_id = tc.id
       WHERE ut.user_id = $1
       ORDER BY tc.sort_order, ut.weight DESC, tt.sort_order`,
      [req.userId]
    );

    res.json({ ...result.rows[0], tastes: tastes.rows });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 프로필 수정 (닉네임, 캐릭터)
router.put('/me', async (req, res) => {
  try {
    const { nickname, avatar_id } = req.body;
    const result = await db.query(
      `UPDATE users SET nickname = COALESCE($1, nickname), avatar_id = COALESCE($2, avatar_id), updated_at = now()
       WHERE id = $3 RETURNING id, email, nickname, avatar_id`,
      [nickname || null, avatar_id || null, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
