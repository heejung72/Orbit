const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// 신고
router.post('/', async (req, res) => {
  try {
    const { reported_id, reason, description } = req.body;

    if (!reported_id || !reason) {
      return res.status(400).json({ error: '신고 대상과 사유를 입력해주세요' });
    }

    if (reported_id === req.userId) {
      return res.status(400).json({ error: '자기 자신을 신고할 수 없습니다' });
    }

    await db.query(
      `INSERT INTO reports (id, reporter_id, reported_id, reason, description) VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), req.userId, reported_id, reason, description || '']
    );

    // 신고 횟수 증가 및 자동 제재
    const result = await db.query(
      `UPDATE users SET report_count = report_count + 1 WHERE id = $1 RETURNING report_count, status`,
      [reported_id]
    );

    const { report_count } = result.rows[0];
    let newStatus = 'active';
    if (report_count >= 10) newStatus = 'banned';
    else if (report_count >= 5) newStatus = 'suspended';
    else if (report_count >= 3) newStatus = 'warned';

    if (newStatus !== 'active') {
      await db.query('UPDATE users SET status = $1 WHERE id = $2', [newStatus, reported_id]);
    }

    res.status(201).json({ message: '신고가 접수되었습니다' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 차단
router.post('/block', async (req, res) => {
  try {
    const { blocked_id } = req.body;
    await db.query(
      `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.userId, blocked_id]
    );
    res.json({ message: '차단되었습니다' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 차단 해제
router.delete('/block/:userId', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [req.userId, req.params.userId]
    );
    res.json({ message: '차단이 해제되었습니다' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
