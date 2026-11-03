const express = require('express');
const { toUuid } = require('../utils/validate');
const { emitToActor, actorKey } = require('../services/actors');
const matching = require('../services/matching');

// /api/matching — optionalAuth 아래 (회원·Guest) #13
// 실제 user_id·guestId는 내려주지 않는다: 후보는 ref, 요청은 matchId로만
// 실시간: 대상에게 match:request, 수락 시 양쪽에 match:accepted, 거절 시 요청자에게 match:rejected
const router = express.Router();

function fail(res, err, where) {
  if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
  console.error(`${where} 실패:`, err.message);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
}

// 추천 후보 (지금 접속 중, 유사도 상위 10명)
router.get('/candidates', async (req, res) => {
  try {
    const candidates = await matching.getCandidates(req.actor);
    res.json({ candidates, ...(candidates.length ? {} : { message: '지금은 취향이 비슷한 사람이 없어요. 라운지를 둘러보세요' }) });
  } catch (err) {
    fail(res, err, 'GET /api/matching/candidates');
  }
});

// 대기 중인 요청 { received, sent }
router.get('/requests', async (req, res) => {
  try {
    res.json(await matching.listRequests(req.actor));
  } catch (err) {
    fail(res, err, 'GET /api/matching/requests');
  }
});

// 대화 요청 { ref }
router.post('/requests', async (req, res) => {
  try {
    const { targetKey, forRequester, forTarget } = await matching.createRequest(req.actor, req.body?.ref);
    emitToActor(req.app.get('io'), targetKey, 'match:request', forTarget);
    res.status(201).json(forRequester);
  } catch (err) {
    fail(res, err, 'POST /api/matching/requests');
  }
});

// 수락 → 1:1 방. 양쪽 모든 기기에 match:accepted { matchId, roomId, title(상대 닉네임) }
router.post('/requests/:id/accept', async (req, res) => {
  const matchId = toUuid(req.params.id);
  if (!matchId) return res.status(404).json({ error: '대화 요청을 찾을 수 없어요', code: 'NOT_FOUND' });
  try {
    const { roomId, requesterKey, profiles } = await matching.acceptRequest(req.actor, matchId);
    const meKey = actorKey(req.actor);
    const io = req.app.get('io');
    const titleFor = (key) => profiles.get(key === meKey ? requesterKey : meKey)?.nickname || '떠난 궤도';
    emitToActor(io, requesterKey, 'match:accepted', { matchId, roomId, title: titleFor(requesterKey) });
    emitToActor(io, meKey, 'match:accepted', { matchId, roomId, title: titleFor(meKey) });
    res.json({ matchId, roomId, title: titleFor(meKey), status: 'accepted' });
  } catch (err) {
    fail(res, err, 'POST /api/matching/requests/:id/accept');
  }
});

// 거절 → 요청자에게 match:rejected { matchId }
router.post('/requests/:id/reject', async (req, res) => {
  const matchId = toUuid(req.params.id);
  if (!matchId) return res.status(404).json({ error: '대화 요청을 찾을 수 없어요', code: 'NOT_FOUND' });
  try {
    const requesterKey = await matching.rejectRequest(req.actor, matchId);
    emitToActor(req.app.get('io'), requesterKey, 'match:rejected', { matchId });
    res.json({ matchId, status: 'rejected' });
  } catch (err) {
    fail(res, err, 'POST /api/matching/requests/:id/reject');
  }
});

module.exports = router;
