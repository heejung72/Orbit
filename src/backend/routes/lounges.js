const express = require('express');
const db = require('../db');
const { listLounges, getLounge } = require('../services/lounges');
const { toUuid } = require('../utils/validate');

const router = express.Router();

// 라운지 목록 (카테고리 필터·검색)
router.get('/', async (req, res) => {
  try {
    const { category_id, search } = req.query;
    res.json(await listLounges({ categoryId: category_id, search }));
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 상세 (chat_room_id, 내 참여 여부 포함)
router.get('/:id', async (req, res) => {
  try {
    const lounge = await getLounge(req.params.id, req.isGuest ? null : req.userId);
    if (!lounge) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
    res.json(lounge);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 생성 — V2
router.post('/', (req, res) => {
  res.status(501).json({ error: '라운지 만들기는 준비 중이에요' });
});

// 라운지 참여 (회원만 PG에 기록. Guest 참여는 #11에서 Redis로)
router.post('/:id/join', async (req, res) => {
  if (req.isGuest) {
    return res.status(403).json({ error: '회원만 라운지에 참여할 수 있어요' });
  }
  const loungeId = toUuid(req.params.id);
  if (!loungeId) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
  try {
    const lounge = await db.query(
      `SELECT l.max_members, (SELECT COUNT(*)::int FROM lounge_members WHERE lounge_id = l.id) AS member_count
       FROM lounges l WHERE l.id = $1`,
      [loungeId]
    );
    if (lounge.rows.length === 0) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
    if (lounge.rows[0].member_count >= lounge.rows[0].max_members) {
      return res.status(400).json({ error: '라운지 정원이 가득 찼어요' });
    }

    await db.query(
      'INSERT INTO lounge_members (lounge_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [loungeId, req.userId]
    );
    res.json({ message: '라운지에 참여했어요' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 라운지 나가기
router.delete('/:id/leave', async (req, res) => {
  const loungeId = toUuid(req.params.id);
  if (!loungeId) return res.status(404).json({ error: '라운지를 찾을 수 없습니다' });
  try {
    await db.query('DELETE FROM lounge_members WHERE lounge_id = $1 AND user_id = $2', [
      loungeId,
      req.userId,
    ]);
    res.json({ message: '라운지에서 나갔어요' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
