const express = require('express');
const db = require('../db');

const router = express.Router();

// 전체 카테고리 + 옵션 목록
router.get('/categories', async (req, res) => {
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
