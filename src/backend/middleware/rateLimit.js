// 스팸 방지 Rate Limit
// 구현(#16): Redis 기반, 메시지 초당 2회 / 동일 메시지 3회 연속 차단 → 429 RATE_LIMITED
// 지금은 통과만 시킵니다.
function rateLimit(req, res, next) {
  next();
}

module.exports = rateLimit;
