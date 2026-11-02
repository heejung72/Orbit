const express = require('express');
const { listLounges, recommendLounges, getLounge } = require('../services/lounges');
const { joinLounge, leaveLounge } = require('../services/loungeMembers');
const { toUuid, toId } = require('../utils/validate');

// /api/lounges — optionalAuth 아래 (회원·Guest, 토큰 없으면 401). 판단은 req.actor 기준
const router = express.Router();

function sendError(res, err, where) {
  if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
  if (err.code === 'FULL') return res.status(400).json({ error: err.message, code: 'LOUNGE_FULL' });
  if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
  console.error(`${where} 실패:`, err.message);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
}

// 라운지 목록 (카테고리 필터·검색, 인원순) + 내 참여 여부
router.get('/', async (req, res) => {
  try {
    const { category_id, search } = req.query;
    const categoryId = category_id === undefined ? null : toId(category_id);
    if (category_id !== undefined && !categoryId) return res.status(400).json({ error: 'category_id가 올바르지 않습니다' });
    res.json(await listLounges({ categoryId, search: typeof search === 'string' ? search : undefined, viewer: req.actor }));
  } catch (err) {
    sendError(res, err, 'GET /api/lounges');
  }
});

// 내 취향 기반 추천 (/:id보다 먼저)
router.get('/recommended', async (req, res) => {
  try {
    res.json(await recommendLounges(req.actor));
  } catch (err) {
    sendError(res, err, 'GET /api/lounges/recommended');
  }
});

// 라운지 상세 (chat_room_id, 대표 태그, 회원 참여자, guest_count, 내 참여 여부)
router.get('/:id', async (req, res) => {
  try {
    const lounge = await getLounge(req.params.id, req.actor);
    if (!lounge) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
    res.json(lounge);
  } catch (err) {
    sendError(res, err, 'GET /api/lounges/:id');
  }
});

// 라운지 생성 — V2
router.post('/', (req, res) => {
  res.status(501).json({ error: '라운지 만들기는 준비 중이에요' });
});

// 참여 (회원 PG / Guest Redis, 정원은 Guest 포함)
router.post('/:id/join', async (req, res) => {
  const loungeId = toUuid(req.params.id);
  if (!loungeId) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
  try {
    await joinLounge(loungeId, req.actor);
    res.json({ message: '라운지에 참여했어요' });
  } catch (err) {
    sendError(res, err, 'POST /api/lounges/:id/join');
  }
});

// 나가기
router.delete('/:id/leave', async (req, res) => {
  const loungeId = toUuid(req.params.id);
  if (!loungeId) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
  try {
    await leaveLounge(loungeId, req.actor);
    res.json({ message: '라운지에서 나갔어요' });
  } catch (err) {
    sendError(res, err, 'DELETE /api/lounges/:id/leave');
  }
});

module.exports = router;
