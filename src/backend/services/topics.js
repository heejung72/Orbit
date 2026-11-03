const db = require('../db');
const { getVectors, commonTags } = require('./matching');

// 1:1 대화 주제 (#13) — 두 사람의 공통 취향으로 템플릿 문장 1~3개, 공통 취향이 없으면 일반 질문
// 태그 이름 뒤에 조사가 붙지 않는 문장으로 (받침 여부와 상관없이 자연스럽게)
// 같은 카테고리 태그가 여러 개면 문장이 겹치지 않게 순서대로 다른 템플릿을 쓴다
const TEMPLATES = {
  music: ['{tag} 노래 중 최애 곡은 뭐예요?', '{tag}, 처음 듣게 된 계기가 있어요?', '{tag} 좋아하는 사람에게 추천하고 싶은 곡은?'],
  movie: ['{tag}, 가장 기억에 남는 작품이 있어요?', '{tag} 중에 몇 번이고 다시 본 게 있어요?', '{tag} 입문자에게 추천한다면?'],
  book: ['{tag} 중에 추천하고 싶은 책이 있어요?', '{tag}, 요즘 읽고 있는 게 있어요?', '{tag} 하면 떠오르는 문장이 있어요?'],
  food: ['{tag} 하면 떠오르는 최고의 한 끼는?', '{tag}, 단골집이 있어요?', '{tag} 중에 꼭 먹어봐야 할 메뉴는?'],
  travel: ['{tag}, 다시 가고 싶은 곳이 있어요?', '{tag} 하면 떠오르는 장면이 있어요?', '{tag}, 다음에 가 보고 싶은 곳은?'],
  sports: ['{tag}, 얼마나 자주 해요?', '{tag} 시작하고 달라진 게 있어요?', '{tag} 하기 좋은 장소를 알아요?'],
  hobby: ['{tag}, 어떻게 시작하게 됐어요?', '{tag} 하면서 가장 뿌듯했던 순간은?', '{tag} 처음 해보는 사람에게 팁이 있다면?'],
};
const GENERAL = ['요즘 가장 자주 듣는 노래는 뭐예요?', '최근에 본 것 중 추천하고 싶은 게 있어요?', '주말에는 주로 뭐 하면서 보내요?'];
const LIMIT = 3;

// memberKeys: 방 참여자 actorKey 두 개
async function topicsFor(memberKeys) {
  const vectors = await getVectors(memberKeys);
  const [a, b] = memberKeys.map((k) => vectors.get(k));
  const common = a && b ? commonTags(a, b).slice(0, LIMIT) : [];
  if (common.length === 0) return GENERAL.slice(0, 2);
  const { rows } = await db.query(
    `SELECT tt.id, tt.name, tc.code FROM taste_tags tt JOIN taste_categories tc ON tc.id = tt.category_id
     WHERE tt.id = ANY($1::int[])`,
    [common]
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const used = new Map(); // 카테고리 → 이미 쓴 템플릿 수
  return common
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((t) => {
      const list = TEMPLATES[t.code] || ['{tag} 이야기 해볼까요?'];
      const n = used.get(t.code) || 0;
      used.set(t.code, n + 1);
      return list[n % list.length].replace('{tag}', t.name);
    });
}

// 방 참여자 actorKey (PG 방은 chat_members, Redis 방은 room.members)
// 상대가 나갔거나 탈퇴한 방은 공통 취향 대신 일반 질문
async function topicsForRoom(room) {
  if (room.store === 'redis') {
    if (room.left.size > 0) return GENERAL.slice(0, 2);
    return topicsFor(room.members.map((m) => m.key));
  }
  const { rows } = await db.query(
    'SELECT user_id FROM chat_members WHERE room_id = $1 AND left_at IS NULL ORDER BY joined_at',
    [room.id]
  );
  if (rows.length < 2) return GENERAL.slice(0, 2);
  return topicsFor(rows.map((r) => `member:${r.user_id}`));
}

module.exports = { topicsForRoom };
