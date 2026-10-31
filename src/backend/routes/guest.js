const express = require('express');

const router = express.Router();

// Guest 세션 API — #5에서 구현
// POST   /api/guest/session  → { guestToken, guestId, nickname, avatarId, expiresAt }
// DELETE /api/guest/session  → 직접 종료
// 참고: docs/api_spec.md "Guest", docs/system_design.md §4
// (기존 POST /api/auth/guest 는 #5에서 이 라우터로 대체 후 제거)

module.exports = router;
