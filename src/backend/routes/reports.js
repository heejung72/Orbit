const express = require('express');
const db = require('../db');

const router = express.Router();

const REASONS = ['harassment', 'spam', 'inappropriate', 'personal_info', 'other'];

// 신고
// TODO(#16): Guest 신고(reporter_guest_id/reported_guest_id), room_id·message_snapshot 저장, 자동 제재 기준 재검토
router.post('/', async (req, res) => {
  const { reported_id, reason, description } = req.body;
  if (!reported_id || !REASONS.includes(reason)) {
    return res.status(400).json({ error: '신고 대상과 사유를 확인해주세요' });
  }
  if (reported_id === req.userId) {
    return res.status(400).json({ error: '자기 자신을 신고할 수 없습니다' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO reports (reporter_user_id, reported_user_id, reason, description) VALUES ($1, $2, $3, $4)`,
      [req.userId, reported_id, reason, description || '']
    );
    const result = await client.query(
      `UPDATE users SET report_count = report_count + 1,
         status = CASE
           WHEN report_count + 1 >= 10 THEN 'banned'
           WHEN report_count + 1 >= 5 THEN 'suspended'
           WHEN report_count + 1 >= 3 THEN 'warned'
           ELSE status END
       WHERE id = $1 RETURNING id`,
      [reported_id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '신고 대상을 찾을 수 없습니다' });
    }
    await client.query('COMMIT');
    res.status(201).json({ message: '신고가 접수되었습니다' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// 차단
router.post('/block', async (req, res) => {
  try {
    const { blocked_id } = req.body;
    if (!blocked_id || blocked_id === req.userId) {
      return res.status(400).json({ error: '차단 대상을 확인해주세요' });
    }
    await db.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, blocked_id]
    );
    res.json({ message: '차단되었습니다' });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: '차단 대상을 찾을 수 없습니다' });
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 차단 해제
router.delete('/block/:userId', async (req, res) => {
  try {
    await db.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [
      req.userId,
      req.params.userId,
    ]);
    res.json({ message: '차단이 해제되었습니다' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
