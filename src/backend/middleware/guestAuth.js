// Guest만 허용
// 구현(#5): X-Guest-Token → Redis guest:session:{token} 조회
//   - 모든 요청마다 expiresAt을 직접 검사, 지났으면 401 GUEST_EXPIRED (TTL에만 의존하지 않음)
//   - req.actor = { type: 'guest', id, expiresAt }
// 참고: docs/system_design.md §3, §4
function guestAuth(req, res, next) {
  return res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'guestAuth는 #5에서 구현됩니다' } });
}

module.exports = guestAuth;
