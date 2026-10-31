const jwt = require('jsonwebtoken');

// 회원·Guest 모두 허용
// 현재: 기존 뼈대 방식(JWT 하나로 회원/Guest 구분, decoded.isGuest) 그대로 유지
// 목표(#5): Authorization(JWT) 또는 X-Guest-Token(Redis 세션) 중 하나가 유효하면 통과 — docs/system_design.md §3
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.isGuest = decoded.isGuest || false;
    req.actor = { type: req.isGuest ? 'guest' : 'member', id: decoded.userId };
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
}

module.exports = optionalAuth;
