const express = require('express');
const { listLounges, getLounge } = require('../services/lounges');
const { toId } = require('../utils/validate');
const { getCategoriesWithTags } = require('./tastes');

const router = express.Router();

// 홈 화면 (비로그인 접근 가능)
// TODO(#8): GET /api/home 묶음 응답(내 취향·궤도·오늘의 질문·추천 라운지)으로 교체
router.get('/home', async (req, res) => {
  try {
    const [tastes, popularLounges] = await Promise.all([
      getCategoriesWithTags(),
      listLounges({ limit: 10 }),
    ]);
    res.json({ tastes, popularLounges });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

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

// 취향 카테고리 + 태그 (비로그인 접근)
router.get('/tastes', async (req, res) => {
  try {
    res.json(await getCategoriesWithTags());
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
