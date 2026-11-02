const db = require('../db');

// 오늘의 질문 선택 (Home #8, 이후 #15 GET /questions/today에서 재사용)
// 1) publish_date가 오늘(KST)인 질문  2) 없으면 publish_date 없는 질문을 sort_order 순으로 하루에 하나씩 순환

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// KST 기준 날짜 문자열(YYYY-MM-DD)과 1970-01-01부터 지난 일수
function kstDay(now) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  return { date: shifted.toISOString().slice(0, 10), index: Math.floor(shifted.getTime() / DAY_MS) };
}

async function getTodayQuestion(now = new Date()) {
  const { date, index } = kstDay(now);
  const fixed = await db.query('SELECT id, content FROM questions WHERE publish_date = $1', [date]);
  if (fixed.rows[0]) return fixed.rows[0];
  const { rows } = await db.query(
    `SELECT id, content FROM questions WHERE publish_date IS NULL
     ORDER BY sort_order, id
     OFFSET $1 % GREATEST((SELECT COUNT(*) FROM questions WHERE publish_date IS NULL), 1) LIMIT 1`,
    [index]
  );
  return rows[0] || null;
}

module.exports = { getTodayQuestion, kstDay };

// self-check: KST 자정 경계 (UTC 14:59 → 23:59 KST, UTC 15:00 → 다음날 00:00 KST)
const assert = require('assert');
assert.strictEqual(kstDay(new Date('2026-11-02T14:59:59Z')).date, '2026-11-02');
assert.strictEqual(kstDay(new Date('2026-11-02T15:00:00Z')).date, '2026-11-03');
