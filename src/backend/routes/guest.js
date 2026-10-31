const express = require('express');
const guestAuth = require('../middleware/guestAuth');
const { createGuestSession, deleteGuestSession } = require('../services/guestSession');

const router = express.Router();

// Guest 발급 (가입 없이 둘러보기) — 30분 절대 시간
// TODO(#16): IP 단위 발급 Rate Limit (지금은 발급 횟수 제한 없음, 세션은 30분 뒤 자동 삭제)
router.post('/session', async (req, res) => {
  try {
    const { token, nickname, avatarId, avatarEmoji, expiresAt } = await createGuestSession();
    res.status(201).json({ guestToken: token, nickname, avatarId, avatarEmoji, expiresAt: new Date(expiresAt).toISOString() });
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 직접 종료
router.delete('/session', guestAuth, async (req, res) => {
  try {
    await deleteGuestSession(req.headers['x-guest-token']);
    res.json({ message: '둘러보기를 마쳤어요' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
