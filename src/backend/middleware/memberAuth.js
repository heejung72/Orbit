const jwt = require('jsonwebtoken');

// 회원 JWT 검증. 유효하면 userId, 아니면 null
// (이전 뼈대의 Guest JWT(isGuest)는 더 이상 인정하지 않음)
function verifyMemberToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.isGuest ? null : decoded.userId;
  } catch {
    return null;
  }
}

const bearerOf = (req) => {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.slice(7) : null;
};

// 회원만 허용 — req.actor = { type: 'member', id }
function memberAuth(req, res, next) {
  const token = bearerOf(req);
  if (!token) {
    if (req.headers['x-guest-token']) {
      return res.status(403).json({ error: '회원만 이용할 수 있는 기능이에요. 가입하면 이어서 사용할 수 있어요.', code: 'MEMBER_ONLY' });
    }
    return res.status(401).json({ error: '인증이 필요합니다', code: 'UNAUTHORIZED' });
  }
  const userId = verifyMemberToken(token);
  if (!userId) return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'UNAUTHORIZED' });

  req.userId = userId;
  req.isGuest = false;
  req.actor = { type: 'member', id: userId };
  next();
}

module.exports = memberAuth;
module.exports.verifyMemberToken = verifyMemberToken;
module.exports.bearerOf = bearerOf;
