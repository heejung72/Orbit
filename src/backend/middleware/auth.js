const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.isGuest = decoded.isGuest || false;
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
}

// 게스트 차단 미들웨어 (회원 전용 기능에 사용)
function membersOnly(req, res, next) {
  if (req.isGuest) {
    return res.status(403).json({ error: '회원만 이용할 수 있는 기능입니다. 회원가입 후 이용해주세요.' });
  }
  next();
}

module.exports = { authMiddleware, membersOnly };
