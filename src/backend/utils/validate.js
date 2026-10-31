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

// 유효한 날짜 문자열이면 ISO 문자열, 아니면 null
function toIsoDate(value) {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = { toUuid, toPositiveInt, toIsoDate };
