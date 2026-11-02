const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// 실제 user_id·이메일은 응답에 넣지 않음 (docs/prd.md §3-6)
const publicUser = (u) => ({ nickname: u.nickname, avatar_id: u.avatar_id });

// 가입 규칙 — 앱(RegisterScreen)과 같은 기준
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : null);

// 회원가입
// TODO(#14): X-Guest-Token이 있으면 Guest 데이터 이전
router.post('/register', async (req, res) => {
  const { password, nickname, avatar_id } = req.body || {};
  const email = normalizeEmail(req.body && req.body.email);
  const nick = typeof nickname === 'string' ? nickname.trim() : '';

  if (!email || !EMAIL_RE.test(email) || email.length > 255) {
    return res.status(400).json({ error: '이메일 형식을 확인해주세요' });
  }
  // bcrypt는 72바이트 이후를 무시하므로 상한을 둔다
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: '비밀번호는 8자 이상 72바이트 이하로 입력해주세요' });
  }
  if (nick.length < 2 || nick.length > 12) {
    return res.status(400).json({ error: '닉네임은 2~12자로 입력해주세요' });
  }
  if (avatar_id !== undefined && avatar_id !== null && !(Number.isInteger(avatar_id) && avatar_id > 0)) {
    return res.status(400).json({ error: '캐릭터를 다시 선택해주세요' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, nickname, avatar_id)
       VALUES ($1, $2, $3, COALESCE($4, 1))
       RETURNING id, nickname, avatar_id`,
      [email, passwordHash, nick, avatar_id ?? null]
    );
    res.status(201).json({ token: signToken(rows[0].id), user: publicUser(rows[0]) });
  } catch (err) {
    // 중복 확인을 INSERT에 맡겨 동시 가입에도 409 하나만 성공
    if (err.code === '23505') return res.status(409).json({ error: '이미 가입된 이메일입니다' });
    if (err.code === '23503') return res.status(400).json({ error: '캐릭터를 다시 선택해주세요' });
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const { password } = req.body || {};
  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
  }
  try {
    const result = await db.query(
      'SELECT id, nickname, avatar_id, password_hash, status FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }

    const user = result.rows[0];
    if (user.status === 'banned') {
      return res.status(403).json({ error: '정지된 계정입니다' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }

    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 현재 사용자 (회원·Guest 공통). Guest는 남은 시간 계산용 expiresAt 포함
router.get('/me', optionalAuth, async (req, res) => {
  if (req.isGuest) {
    const { nickname, avatarId, avatarEmoji, expiresAt } = req.guest;
    return res.json({ type: 'guest', nickname, avatar_id: avatarId, avatar_emoji: avatarEmoji, expires_at: new Date(expiresAt).toISOString() });
  }
  try {
    const { rows } = await db.query(
      `SELECT u.nickname, u.avatar_id, a.emoji AS avatar_emoji,
              EXISTS (SELECT 1 FROM user_tastes ut WHERE ut.user_id = u.id) AS has_tastes
       FROM users u JOIN avatars a ON a.id = u.avatar_id WHERE u.id = $1`,
      [req.userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'UNAUTHORIZED' });
    res.json({ type: 'member', ...rows[0] });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
