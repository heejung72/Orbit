const optionalAuth = require('./optionalAuth');

// 회원만 허용 (Guest 차단)
// 목표(#4): JWT만 검증하고 req.actor = { type: 'member', id } — docs/system_design.md §3
function memberAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (req.isGuest) {
      return res.status(403).json({ error: '회원만 이용할 수 있는 기능입니다. 회원가입 후 이용해주세요.' });
    }
    next();
  });
}

module.exports = memberAuth;
