const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password || !nickname) {
      return res.status(400).json({ error: '이메일, 비밀번호, 닉네임을 입력해주세요' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();

    await db.query(
      'INSERT INTO users (id, email, password_hash, nickname) VALUES ($1, $2, $3, $4)',
      [id, email, passwordHash, nickname]
    );

    const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({ token, user: { id, email, nickname } });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
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

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname, bio: user.bio, profile_image: user.profile_image },
    });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 게스트 세션 생성
router.post('/guest', async (req, res) => {
  try {
    const id = uuidv4();
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const nickname = `궤도여행자#${randomNum}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간 후

    await db.query(
      `INSERT INTO users (id, nickname, is_guest, guest_expires_at) VALUES ($1, $2, true, $3)`,
      [id, nickname, expiresAt]
    );

    const token = jwt.sign({ userId: id, isGuest: true }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    res.status(201).json({ token, user: { id, nickname, isGuest: true, expiresAt } });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
