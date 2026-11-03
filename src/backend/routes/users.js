const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

// /api/users — memberAuth 아래 (Guest는 403 MEMBER_ONLY). 실제 user id는 내려주지 않는다
const router = express.Router();

const MAX_INT4 = 2147483647;
const PROFILE_SQL = `
  SELECT u.email, u.nickname, u.avatar_id, a.emoji AS avatar_emoji, u.created_at
  FROM users u JOIN avatars a ON a.id = u.avatar_id
  WHERE u.id = $1`;

// 내 프로필 (취향은 GET /tastes/me)
router.get('/me', async (req, res) => {
  try {
    const { rows } = await db.query(PROFILE_SQL, [req.userId]);
    if (rows.length === 0) return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'UNAUTHORIZED' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/users/me 실패:', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 프로필 수정 — 보낸 항목만 바꾼다 (가입과 같은 규칙)
router.patch('/me', async (req, res) => {
  const { nickname, avatar_id } = req.body || {};
  if (nickname === undefined && avatar_id === undefined) return res.status(400).json({ error: '바꿀 항목이 없어요' });
  const nick = typeof nickname === 'string' ? nickname.trim() : null;
  if (nickname !== undefined && (nick === null || nick.length < 2 || nick.length > 12)) {
    return res.status(400).json({ error: '닉네임은 2~12자로 입력해주세요' });
  }
  if (avatar_id !== undefined && !(Number.isInteger(avatar_id) && avatar_id > 0 && avatar_id <= MAX_INT4)) {
    return res.status(400).json({ error: '캐릭터를 다시 선택해주세요' });
  }
  try {
    const updated = await db.query(
      `UPDATE users SET nickname = COALESCE($1, nickname), avatar_id = COALESCE($2, avatar_id), updated_at = now()
       WHERE id = $3`,
      [nickname === undefined ? null : nick, avatar_id ?? null, req.userId]
    );
    if (updated.rowCount === 0) return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'UNAUTHORIZED' });
    res.json((await db.query(PROFILE_SQL, [req.userId])).rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: '캐릭터를 다시 선택해주세요' });
    console.error('PATCH /api/users/me 실패:', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 탈퇴 — 비밀번호 확인 후 삭제
// 취향·라운지·1:1 참여·매칭·차단은 FK CASCADE, 보낸 메시지는 sender_id가 NULL이 되어 "떠난 궤도"로 남는다
// 참여 중이던 1:1 방은 상대만 남지 않도록 종료하고, 이 회원의 소켓 연결을 끊는다
router.delete('/me', async (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || !password) return res.status(400).json({ error: '비밀번호를 입력해주세요' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT password_hash FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: '유효하지 않은 토큰입니다', code: 'UNAUTHORIZED' });
    }
    if (!(await bcrypt.compare(password, rows[0].password_hash))) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: '비밀번호가 맞지 않아요', code: 'WRONG_PASSWORD' });
    }
    await client.query(
      `UPDATE chat_rooms SET closed_at = now()
       WHERE type = 'direct' AND closed_at IS NULL
         AND id IN (SELECT room_id FROM chat_members WHERE user_id = $1)`,
      [req.userId]
    );
    await client.query('DELETE FROM users WHERE id = $1', [req.userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('DELETE /api/users/me 실패:', err.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }

  // 삭제는 이미 커밋됨 — 소켓 정리가 실패해도 응답은 성공 (남은 소켓은 다음 이벤트에서 계정 없음으로 막힌다)
  try {
    for (const s of await req.app.get('io').fetchSockets()) {
      if (s.data.actor?.type === 'member' && s.data.actor.id === req.userId) s.disconnect(true);
    }
  } catch (err) {
    console.error('탈퇴 후 소켓 정리 실패:', err.message);
  }
  res.json({ message: '탈퇴했어요. 그동안 고마웠어요' });
});

module.exports = router;
