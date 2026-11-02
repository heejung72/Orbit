const express = require('express');
const db = require('../db');
const { listLounges, getLounge } = require('../services/lounges');
const { toId } = require('../utils/validate');
const { getCategoriesWithTags } = require('./tastes');

const router = express.Router();

// 라운지 목록 (비로그인 열람)
router.get('/lounges', async (req, res) => {
  try {
    const { category_id, search } = req.query;
    const categoryId = category_id === undefined ? null : toId(category_id);
    if (category_id !== undefined && !categoryId) return res.status(400).json({ error: 'category_id가 올바르지 않습니다' });
    res.json(await listLounges({ categoryId, search: typeof search === 'string' ? search : undefined }));
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 상세 (비로그인 열람)
router.get('/lounges/:id', async (req, res) => {
  try {
    const lounge = await getLounge(req.params.id);
    if (!lounge) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
    res.json(lounge);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 기본 캐릭터 목록 (가입 화면에서 선택)
router.get('/avatars', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, emoji, color FROM avatars ORDER BY sort_order');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 취향 카테고리 + 태그 (비로그인 접근)
router.get('/tastes', async (req, res) => {
  try {
    res.json(await getCategoriesWithTags());
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
