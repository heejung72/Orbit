// 요청 값 검증 헬퍼
// 잘못된 형식의 값이 DB까지 내려가 500(22P02 등)이 되지 않도록 라우트 입구에서 거른다.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// UUID면 소문자로 정규화해서 반환, 아니면 null
function toUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value) ? value.toLowerCase() : null;
}

// 1 이상의 정수면 반환, 아니면 fallback (max로 상한)
function toPositiveInt(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

// 문자열 전체가 양의 정수일 때만 숫자로 ("1abc" → null)
function toId(value) {
  return typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null;
}

// 유효한 날짜 문자열이면 ISO 문자열, 아니면 null
// Date는 2019-02-30을 03-02로 자동 보정하므로 연·월·일이 그대로인지 다시 확인
function toIsoDate(value) {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (ymd) {
    const check = new Date(Date.UTC(+ymd[1], +ymd[2] - 1, +ymd[3]));
    if (check.getUTCMonth() !== +ymd[2] - 1 || check.getUTCDate() !== +ymd[3]) return null;
  }
  return d.toISOString();
}

module.exports = { toUuid, toPositiveInt, toId, toIsoDate };

// self-check
const assert = require('assert');
assert.strictEqual(toIsoDate('2019-02-30'), null);
assert.strictEqual(toIsoDate('2024-02-29T00:00:00Z'), '2024-02-29T00:00:00.000Z');
assert.strictEqual(toId('1abc'), null);
assert.strictEqual(toId('12'), 12);
