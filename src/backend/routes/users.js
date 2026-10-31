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

// 취향 업데이트
// body: { tags: [{ tagId, weight(1~3) }] }
// TODO(#7): PUT /api/tastes/me 로 이동, Guest(Redis) 지원
router.put('/me/tastes', async (req, res) => {
  const { tags } = req.body;

  if (!Array.isArray(tags) || tags.length < 3) {
    return res.status(400).json({ error: '최소 3개의 취향을 선택해주세요' });
  }
  const valid = tags.every(
    (t) => Number.isInteger(t.tagId) && Number.isInteger(t.weight) && t.weight >= 1 && t.weight <= 3
  );
  if (!valid) {
    return res.status(400).json({ error: '취향 형식이 올바르지 않습니다' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_tastes WHERE user_id = $1', [req.userId]);
    await client.query(
      `INSERT INTO user_tastes (user_id, tag_id, weight)
       SELECT $1, t.tag_id, t.weight
       FROM UNNEST($2::int[], $3::smallint[]) AS t(tag_id, weight)
       ON CONFLICT (user_id, tag_id) DO UPDATE SET weight = EXCLUDED.weight`,
      [req.userId, tags.map((t) => t.tagId), tags.map((t) => t.weight)]
    );
    await client.query('COMMIT');
    res.json({ message: '취향이 업데이트되었습니다' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

module.exports = router;
