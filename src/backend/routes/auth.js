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

// 회원가입
// TODO(#4): 입력 검증 강화(이메일 형식, 비밀번호 8자, 닉네임 2~12자), avatarId 선택
// TODO(#14): X-Guest-Token이 있으면 Guest 데이터 이전
router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname, avatar_id } = req.body;

    if (!email || !password || !nickname) {
      return res.status(400).json({ error: '이메일, 비밀번호, 닉네임을 입력해주세요' });
    }

    const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, nickname, avatar_id)
       VALUES ($1, $2, $3, COALESCE($4, 1))
       RETURNING id, email, nickname, avatar_id`,
      [email, passwordHash, nickname, avatar_id || null]
    );

    res.status(201).json({ token: signToken(rows[0].id), user: publicUser(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT id, email, nickname, avatar_id, password_hash, status FROM users WHERE email = $1',
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
      `SELECT u.nickname, u.avatar_id, a.emoji AS avatar_emoji FROM users u JOIN avatars a ON a.id = u.avatar_id WHERE u.id = $1`,
      [req.userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'UNAUTHORIZED' });
    res.json({ type: 'member', ...rows[0] });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
