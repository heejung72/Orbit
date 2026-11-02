const express = require('express');
const db = require('../db');
const { listLounges } = require('../services/lounges');
const { getMemberTastes, getGuestTastes } = require('../services/tastes');
const { getTodayQuestion } = require('../services/questions');

// GET /api/home — Home 대시보드 묶음 응답 (optionalAuth: 회원·Guest, 토큰 없으면 401)
// { me, tastes, question, lounges } — 실제 user_id·guestId는 내려주지 않는다
const router = express.Router();

async function getMe(req) {
  if (req.isGuest) {
    const { nickname, avatarId, avatarEmoji, expiresAt } = req.guest;
    return { type: 'guest', nickname, avatar_id: avatarId, avatar_emoji: avatarEmoji, expires_at: new Date(expiresAt).toISOString() };
  }
  const { rows } = await db.query(
    `SELECT u.nickname, u.avatar_id, a.emoji AS avatar_emoji
     FROM users u JOIN avatars a ON a.id = u.avatar_id WHERE u.id = $1`,
    [req.userId]
  );
  return rows[0] ? { type: 'member', ...rows[0] } : null;
}

router.get('/', async (req, res) => {
  try {
    const [me, tastes, question, lounges] = await Promise.all([
      getMe(req),
      req.isGuest ? getGuestTastes(req.actor.id) : getMemberTastes(req.userId),
      getTodayQuestion(),
      listLounges(), // 공식 라운지 전체(참여 인원순): 앱이 상위 3개 표시 + 카테고리 행성 → 라운지 연결에 사용
    ]);
    if (!me) return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'UNAUTHORIZED' });
    res.json({ me, tastes, question, lounges });
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    console.error('GET /api/home 실패:', err); // 응답은 일반 문구, 원인은 서버 로그에만 (Guest 메시지 본문은 이 경로에 없음)
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
