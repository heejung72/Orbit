// Orbit 초기 데이터 (docs/prd.md §3)
// 수정 후 `npm run seed`를 다시 실행하면 새 항목만 추가됩니다. (기존 행은 이름 기준으로 건너뜀)

const avatars = [
  { code: 'comet', name: '혜성', emoji: '☄️', color: '#8C82FF' },
  { code: 'moon', name: '달', emoji: '🌙', color: '#FFD678' },
  { code: 'planet', name: '행성', emoji: '🪐', color: '#FF9F7A' },
  { code: 'star', name: '별', emoji: '⭐', color: '#FFE66D' },
  { code: 'alien', name: '외계인', emoji: '👽', color: '#7AE3A1' },
  { code: 'rocket', name: '로켓', emoji: '🚀', color: '#7FD3FF' },
];

const categories = [
  {
    code: 'music', name: '음악', icon: '🎵',
    tags: ['Oasis', 'The 1975', 'Cigarettes After Sex', 'Radiohead', 'Laufey', '혁오', '인디 록', '얼터너티브', '시티팝', '재즈', 'K-인디', '힙합'],
  },
  {
    code: 'movie', name: '영화', icon: '🎬',
    tags: ['SF', '로맨스', '스릴러', '애니메이션', '다큐멘터리', '공포', '크리스토퍼 놀란', '봉준호', '지브리', '웨스 앤더슨'],
  },
  {
    code: 'book', name: '책', icon: '📚',
    tags: ['소설', '에세이', '인문학', 'SF 소설', '시', '추리 소설', '과학', '만화'],
  },
  {
    code: 'food', name: '음식', icon: '🍜',
    tags: ['한식', '일식', '양식', '디저트', '카페 투어', '맛집 탐방', '비건', '홈쿠킹'],
  },
  {
    code: 'travel', name: '여행', icon: '✈️',
    tags: ['유럽', '일본', '동남아', '국내 여행', '혼자 여행', '캠핑', '로드트립', '도시 산책'],
  },
  {
    code: 'sports', name: '운동', icon: '🏃',
    tags: ['러닝', '헬스', '등산', '요가', '클라이밍', '수영', '자전거', '축구'],
  },
  {
    code: 'hobby', name: '취미', icon: '🎮',
    tags: ['게임', '사진', '전시', '그림', '악기 연주', '보드게임', '글쓰기', '식물 키우기'],
  },
];

// tags: 라운지 대표 태그 (같은 카테고리의 태그 이름)
const lounges = [
  { name: '새벽의 음악 취향', category: 'music', icon: '🎵', description: 'Oasis부터 혁오까지, 요즘 듣는 노래 이야기', tags: ['Oasis', 'The 1975', '인디 록', 'K-인디'] },
  { name: '영화 이야기', category: 'movie', icon: '🎬', description: '오늘 본 영화, 인생 영화', tags: ['SF', '스릴러', '크리스토퍼 놀란', '봉준호'] },
  { name: '책 읽는 궤도', category: 'book', icon: '📚', description: '최근 읽은 책과 밑줄 긋고 싶은 문장', tags: ['소설', '에세이', '시'] },
  { name: '카페와 일상', category: 'food', icon: '☕', description: '오늘의 작은 이야기와 좋아하는 카페', tags: ['카페 투어', '디저트'] },
  { name: '어디든 떠나고 싶을 때', category: 'travel', icon: '✈️', description: '다녀온 곳, 가고 싶은 곳', tags: ['유럽', '일본', '혼자 여행'] },
  { name: '오늘도 움직였다', category: 'sports', icon: '🏃', description: '러닝·등산·헬스 기록 나누기', tags: ['러닝', '등산', '헬스'] },
  { name: '취미 생활 라운지', category: 'hobby', icon: '🎮', description: '게임, 사진, 전시… 요즘 빠진 것', tags: ['게임', '사진', '전시'] },
];

// category: null 이면 일상/생각 질문
const questions = [
  { category: 'music', content: '평생 한 아티스트의 음악만 들을 수 있다면?' },
  { category: 'music', content: '요즘 가장 많이 듣는 노래는?' },
  { category: 'music', content: '처음으로 좋아하게 된 노래를 기억해?' },
  { category: 'music', content: '비 오는 날 꼭 듣는 노래가 있다면?' },
  { category: 'music', content: '라이브로 꼭 보고 싶은 공연은?' },
  { category: 'movie', content: '가장 오래 기억에 남은 영화는?' },
  { category: 'movie', content: '인생 영화 한 편만 고른다면?' },
  { category: 'movie', content: '몇 번이고 다시 보는 영화가 있어?' },
  { category: 'movie', content: '영화 속 한 장면에 들어갈 수 있다면?' },
  { category: 'book', content: '누군가에게 꼭 추천하고 싶은 책은?' },
  { category: 'book', content: '최근에 밑줄 그은 문장이 있다면?' },
  { category: 'book', content: '어릴 때 가장 좋아했던 책은?' },
  { category: 'food', content: '하루 세 끼를 한 메뉴로만 먹어야 한다면?' },
  { category: 'food', content: '나만 알고 싶은 단골 가게가 있어?' },
  { category: 'food', content: '기분이 안 좋을 때 생각나는 음식은?' },
  { category: 'travel', content: '지금 당장 어디든 떠날 수 있다면, 어디로 가고 싶어?' },
  { category: 'travel', content: '혼자 여행을 떠난다면 어디로?' },
  { category: 'travel', content: '다시 가고 싶은 여행지는?' },
  { category: 'travel', content: '여행에서 가장 기억에 남는 순간은?' },
  { category: 'sports', content: '꾸준히 해보고 싶은 운동이 있어?' },
  { category: 'sports', content: '몸을 움직이고 나서 가장 좋았던 순간은?' },
  { category: 'hobby', content: '요즘 빠져 있는 취미는?' },
  { category: 'hobby', content: '시간이 무한하다면 배우고 싶은 것은?' },
  { category: null, content: '가장 좋아하는 계절은?' },
  { category: null, content: '요즘 가장 기다려지는 순간은?' },
  { category: null, content: '남들은 잘 모르지만 나만 좋아하는 것은?' },
  { category: null, content: '10년 전 나에게 한마디를 한다면?' },
  { category: null, content: '오늘 하루를 한 단어로 표현한다면?' },
  { category: null, content: '나를 웃게 만드는 작은 습관이 있어?' },
  { category: null, content: '새벽에 문득 떠오르는 생각은?' },
];

module.exports = { avatars, categories, lounges, questions };
