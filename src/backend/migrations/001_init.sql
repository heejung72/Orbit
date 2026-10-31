-- Orbit DB Schema (구버전, #3에서 재설계 예정)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 사용자
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  bio TEXT DEFAULT '',
  profile_image VARCHAR(500) DEFAULT '',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'warned', 'suspended', 'banned')),
  report_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 취향 카테고리
CREATE TABLE taste_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(10) DEFAULT ''
);

-- 취향 옵션
CREATE TABLE taste_options (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES taste_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL
);

-- 유저 취향
CREATE TABLE user_tastes (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  taste_option_id INT REFERENCES taste_options(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, taste_option_id)
);

-- 매칭
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  similarity_score FLOAT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 채팅방
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(10) CHECK (type IN ('direct', 'club')),
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  club_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 메시지
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type VARCHAR(10) DEFAULT 'text' CHECK (type IN ('text', 'image')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 동호회
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  category_id INT REFERENCES taste_categories(id),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  max_members INT DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW()
);

-- chat_rooms.club_id FK 추가
ALTER TABLE chat_rooms ADD CONSTRAINT fk_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;

-- 동호회 멤버
CREATE TABLE club_members (
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(10) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

-- 신고
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(20) CHECK (reason IN ('harassment', 'spam', 'inappropriate', 'other')),
  description TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 차단
CREATE TABLE blocks (
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- 인덱스
CREATE INDEX idx_user_tastes_user ON user_tastes(user_id);
CREATE INDEX idx_messages_room ON messages(chat_room_id, created_at);
CREATE INDEX idx_matches_users ON matches(user1_id, user2_id);
CREATE INDEX idx_club_members_club ON club_members(club_id);
CREATE INDEX idx_reports_reported ON reports(reported_id);

-- 시드 데이터: 취향 카테고리
INSERT INTO taste_categories (name, icon) VALUES
  ('음악', '🎵'),
  ('영화', '🎬'),
  ('운동', '💪'),
  ('음식', '🍔'),
  ('여행', '✈️'),
  ('게임', '🎮'),
  ('독서', '📚'),
  ('반려동물', '🐶');

-- 시드 데이터: 취향 옵션
INSERT INTO taste_options (category_id, name) VALUES
  -- 음악
  (1, '팝'), (1, '힙합'), (1, 'R&B'), (1, '클래식'), (1, '인디'), (1, '록'), (1, 'K-POP'), (1, '재즈'), (1, 'EDM'),
  -- 영화
  (2, '액션'), (2, '로맨스'), (2, '코미디'), (2, '호러'), (2, 'SF'), (2, '다큐멘터리'), (2, '애니메이션'), (2, '스릴러'),
  -- 운동
  (3, '러닝'), (3, '헬스'), (3, '등산'), (3, '축구'), (3, '농구'), (3, '수영'), (3, '요가'), (3, '테니스'), (3, '자전거'),
  -- 음식
  (4, '한식'), (4, '일식'), (4, '중식'), (4, '양식'), (4, '카페'), (4, '비건'), (4, '디저트'), (4, '길거리음식'),
  -- 여행
  (5, '배낭여행'), (5, '호캉스'), (5, '캠핑'), (5, '로드트립'), (5, '해외여행'), (5, '국내여행'), (5, '섬여행'),
  -- 게임
  (6, 'RPG'), (6, 'FPS'), (6, '모바일게임'), (6, '보드게임'), (6, '닌텐도'), (6, 'PC게임'),
  -- 독서
  (7, '소설'), (7, '자기계발'), (7, '에세이'), (7, '만화'), (7, '역사'), (7, '과학'),
  -- 반려동물
  (8, '강아지'), (8, '고양이'), (8, '물고기'), (8, '햄스터'), (8, '파충류');
