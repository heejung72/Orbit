const memberAuth = require('./memberAuth');
const guestAuth = require('./guestAuth');

// 회원·Guest 모두 허용 — docs/system_design.md §3
// Authorization: Bearer <JWT> 가 있으면 회원, 없고 X-Guest-Token이 있으면 Guest
// Guest 요청에는 req.userId가 없으므로, 라우트는 req.isGuest로 분기해야 한다
function optionalAuth(req, res, next) {
  if (memberAuth.bearerOf(req) || !req.headers['x-guest-token']) return memberAuth(req, res, next);
  return guestAuth(req, res, next);
}

module.exports = optionalAuth;
