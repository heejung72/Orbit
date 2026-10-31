// 비속어 필터링 (확장 가능)
const BLOCKED_WORDS = [
  '시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '지랄', 'ㅈㄹ',
  '개새끼', '미친놈', '미친년', '꺼져', '죽어',
];

function containsBadWords(text) {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some(word => lower.includes(word));
}

function filterMessage(text) {
  let filtered = text;
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  }
  return filtered;
}

function filterMiddleware(req, res, next) {
  if (req.body.content && containsBadWords(req.body.content)) {
    req.body.content = filterMessage(req.body.content);
  }
  next();
}

module.exports = { filterMiddleware, filterMessage, containsBadWords };
