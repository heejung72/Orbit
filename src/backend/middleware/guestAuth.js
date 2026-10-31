const { findGuestSession } = require('../services/guestSession');

// Guest만 허용 — X-Guest-Token을 Redis 세션과 대조하고 expiresAt을 매 요청 직접 검사
// req.actor = { type: 'guest', id, expiresAt }, req.guest = 세션 정보
async function guestAuth(req, res, next) {
  const token = req.headers['x-guest-token'];
  if (!token) return res.status(401).json({ error: '인증이 필요합니다', code: 'UNAUTHORIZED' });
  try {
    const session = await findGuestSession(token);
    if (!session) {
      return res.status(401).json({ error: '둘러보기 시간이 끝났어요', code: 'GUEST_EXPIRED' });
    }
    req.isGuest = true;
    req.guest = session;
    req.actor = { type: 'guest', id: session.guestId, expiresAt: session.expiresAt };
    next();
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') {
      return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    }
    next(err);
  }
}

module.exports = guestAuth;
