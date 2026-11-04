const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const optionalAuth = require('../middleware/optionalAuth');
const { bearerOf } = require('../middleware/memberAuth');
const { guestHasTastes } = require('../services/tastes');
const { findGuestSession } = require('../services/guestSession');
const upgrade = require('../services/guestUpgrade');

const router = express.Router();

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// 실제 user_id·이메일은 응답에 넣지 않음 (docs/prd.md §3-6)
const publicUser = (u) => ({ nickname: u.nickname, avatar_id: u.avatar_id });

// 가입 규칙 — 앱(RegisterScreen)과 같은 기준
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : null);

// 회원가입 — X-Guest-Token이 유효하면 Guest 데이터를 새 계정으로 이전 (#14, docs/system_design.md §4-4)
// 만료·잘못된 토큰이면 이전 없이 가입. 이전이 실패하면 회원 생성까지 되돌리고 Guest는 그대로 둔다
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
  if (avatar_id !== undefined && avatar_id !== null && !(Number.isInteger(avatar_id) && avatar_id > 0 && avatar_id <= 2147483647)) {
    return res.status(400).json({ error: '캐릭터를 다시 선택해주세요' });
  }

  let guest = null;
  const guestToken = !bearerOf(req) && req.headers['x-guest-token'];
  if (guestToken) {
    try {
      guest = await findGuestSession(guestToken);
      // 이미 옮긴 Guest(정리 실패로 토큰이 남은 경우)는 이전 없이 일반 가입
      if (guest && (await upgrade.alreadyUpgraded(guest.guestId))) guest = null;
      if (guest && !(await upgrade.claimGuest(guest.guestId))) {
        return res.status(409).json({ error: '이미 가입을 진행하고 있어요. 잠시 후 다시 확인해주세요', code: 'UPGRADE_IN_PROGRESS' });
      }
    } catch (err) {
      // Redis가 끊기면 Guest 데이터를 읽을 수 없으니 이전 없이 가입시키지 않고 다시 시도하게 한다
      if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
      console.error('POST /api/auth/register Guest 확인 실패:', err.message);
      return res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
  }

  let client;
  let user;
  let data = null;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    if (guest) data = await upgrade.collectGuestData(guest);
    client = await db.pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, nickname, avatar_id, upgraded_from_guest)
       VALUES ($1, $2, $3, COALESCE($4, 1), $5)
       RETURNING id, nickname, avatar_id`,
      [email, passwordHash, nick, avatar_id ?? null, data ? guest.guestId : null]
    );
    user = rows[0];
    if (data) await upgrade.writeToPg(client, user.id, data);
    await client.query('COMMIT');
  } catch (err) {
    await client?.query('ROLLBACK').catch(() => {});
    if (guest) await upgrade.releaseGuest(guest.guestId).catch(() => {});
    // 중복 확인을 INSERT에 맡겨 동시 가입에도 409 하나만 성공
    if (err.code === '23505' && err.constraint === 'users_email_key') return res.status(409).json({ error: '이미 가입된 이메일입니다' });
    // 같은 Guest를 두 번 옮기려 한 경우(선점이 만료된 뒤의 재시도 등) — PG 유니크 제약이 최종 방어선
    if (err.code === '23505' && err.constraint === 'users_upgraded_from_guest_key') {
      return res.status(409).json({ error: '이미 가입을 진행하고 있어요. 잠시 후 다시 확인해주세요', code: 'UPGRADE_IN_PROGRESS' });
    }
    // 없는 캐릭터(users FK)만 400. 이전 데이터의 FK 위반(지워진 태그 등)은 아래 500
    if (err.code === '23503' && err.table === 'users') return res.status(400).json({ error: '캐릭터를 다시 선택해주세요' });
    if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    console.error('POST /api/auth/register 실패:', err.message);
    return res.status(500).json({ error: data ? '둘러본 기록을 옮기지 못했어요. 잠시 후 다시 시도해주세요' : '서버 오류가 발생했습니다' });
  } finally {
    client?.release();
  }

  if (guest) {
    try {
      await upgrade.cleanupRedis(guestToken, user.id, guest.guestId, data);
    } catch (err) {
      console.error('가입 전환 후 Redis 정리 실패:', err.message); // 남은 Guest 키는 세션 만료 시각에 TTL로 사라짐
    }
    // Guest 소켓은 이벤트 없이 끊는다 (guest:expired를 보내면 앱이 "궤도가 사라졌어요"로 감). 앱은 회원 토큰으로 다시 연결
    try {
      for (const s of await req.app.get('io').fetchSockets()) {
        if (s.data.actor?.type === 'guest' && s.data.actor.id === guest.guestId) s.disconnect(true);
      }
    } catch (err) {
      console.error('가입 전환 후 소켓 정리 실패:', err.message);
    }
  }
  res.status(201).json({ token: signToken(user.id), user: publicUser(user), migrated: data ? upgrade.summary(data) : false });
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
  try {
    if (req.isGuest) {
      const { guestId, nickname, avatarId, avatarEmoji, expiresAt } = req.guest;
      return res.json({
        type: 'guest',
        nickname,
        avatar_id: avatarId,
        avatar_emoji: avatarEmoji,
        expires_at: new Date(expiresAt).toISOString(),
        has_tastes: await guestHasTastes(guestId),
      });
    }
    const { rows } = await db.query(
      `SELECT u.nickname, u.avatar_id, a.emoji AS avatar_emoji,
              EXISTS (SELECT 1 FROM user_tastes ut WHERE ut.user_id = u.id) AS has_tastes
       FROM users u JOIN avatars a ON a.id = u.avatar_id WHERE u.id = $1`,
      [req.userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'UNAUTHORIZED' });
    res.json({ type: 'member', ...rows[0] });
  } catch (err) {
    if (err.code === 'REDIS_UNAVAILABLE') return res.status(503).json({ error: '잠시 후 다시 시도해주세요', code: 'UNAVAILABLE' });
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
