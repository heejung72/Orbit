const express = require('express');
const db = require('../db');
const {
  validateTags,
  getMemberTastes,
  saveMemberTastes,
  getGuestTastes,
  saveGuestTastes,
} = require('../services/tastes');

// /api/tastes — optionalAuth 아래 (회원·Guest 모두, 토큰 없으면 401)
// 회원·Guest 구분은 항상 req.actor 기준 → 다른 사람의 취향에는 접근할 수 없다
const router = express.Router();

async function getCategoriesWithTags() {
  const categories = await db.query('SELECT id, code, name, icon FROM taste_categories ORDER BY sort_order');
  const tags = await db.query('SELECT id, category_id, name FROM taste_tags ORDER BY category_id, sort_order');
  return categories.rows.map((cat) => ({
    ...cat,
    tags: tags.rows.filter((t) => t.category_id === cat.id).map(({ id, name }) => ({ id, name })),
  }));
}

const getMine = (actor) => (actor.type === 'guest' ? getGuestTastes(actor.id) : getMemberTastes(actor.id));

function sendError(res, err) {
  if (err.code === 'UNKNOWN_TAG') return res.status(400).json({ error: err.message });
  if (err.code === 'UNAUTHORIZED') return res.status(401).json({ error: err.message, code: 'UNAUTHORIZED' });
  if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
}

router.get('/categories', async (req, res) => {
  try {
    res.json(await getCategoriesWithTags());
  } catch (err) {
    sendError(res, err);
  }
});

// 내 취향: [{ tag_id, name, category_id, category, weight }]
router.get('/me', async (req, res) => {
  try {
    res.json(await getMine(req.actor));
  } catch (err) {
    sendError(res, err);
  }
});

// 내 취향 전체 교체 — body: { tags: [{ tagId, weight(1~3) }] } (3~20개) → 저장된 목록
router.put('/me', async (req, res) => {
  const { tags } = req.body || {};
  const invalid = validateTags(tags);
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    if (req.actor.type === 'guest') await saveGuestTastes(req.actor.id, req.actor.expiresAt, tags);
    else await saveMemberTastes(req.actor.id, tags);
    res.json(await getMine(req.actor));
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
module.exports.getCategoriesWithTags = getCategoriesWithTags;
