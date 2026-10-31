const express = require('express');
const db = require('../db');

const router = express.Router();

// 카테고리별 태그 목록 (options 필드는 기존 화면 호환용, #7에서 tags로 정리)
async function getCategoriesWithTags() {
  const categories = await db.query('SELECT id, code, name, icon FROM taste_categories ORDER BY sort_order');
  const tags = await db.query('SELECT id, category_id, name FROM taste_tags ORDER BY category_id, sort_order');
  return categories.rows.map((cat) => {
    const catTags = tags.rows.filter((t) => t.category_id === cat.id).map(({ id, name }) => ({ id, name }));
    return { ...cat, tags: catTags, options: catTags };
  });
}

router.get('/categories', async (req, res) => {
  try {
    res.json(await getCategoriesWithTags());
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
module.exports.getCategoriesWithTags = getCategoriesWithTags;
