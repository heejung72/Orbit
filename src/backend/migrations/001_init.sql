-- Orbit DB Schema v1 (#3)
-- 원칙: PostgreSQL에는 회원(Member) 데이터만 저장한다.
--       Guest 관련 데이터는 Redis에만 두고, 가입 전환(#14) 시 이곳으로 INSERT 한다.
--       예외: reports 는 Guest 신고를 위해 *_guest_id(text) 컬럼을 둔다.
-- 문서: docs/database.md

-- ─────────────────────────────────────────────
-- 캐릭터 (MVP: 기본 캐릭터 선택만, 커스터마이징은 V2)
-- ─────────────────────────────────────────────
CREATE TABLE avatars (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30)  NOT NULL UNIQUE,
  name        VARCHAR(30)  NOT NULL,
  emoji       VARCHAR(10)  NOT NULL,
  color       VARCHAR(7)   NOT NULL,          -- #RRGGBB
  sort_order  INT          NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- 회원
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  nickname       VARCHAR(20)  NOT NULL,
  avatar_id      INT          NOT NULL DEFAULT 1 REFERENCES avatars(id),
  status         VARCHAR(20)  NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'warned', 'suspended', 'banned')),
  report_count   INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 취향: 카테고리 → 태그, 회원별 중요도(1~3)
-- ─────────────────────────────────────────────
CREATE TABLE taste_categories (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE,     -- music, movie, book, food, travel, sports, hobby
  name        VARCHAR(20) NOT NULL,
  icon        VARCHAR(10) NOT NULL,
  sort_order  INT         NOT NULL DEFAULT 0
);

CREATE TABLE taste_tags (
  id           SERIAL PRIMARY KEY,
  category_id  INT         NOT NULL REFERENCES taste_categories(id) ON DELETE CASCADE,
  name         VARCHAR(50) NOT NULL,
  sort_order   INT         NOT NULL DEFAULT 0,
  UNIQUE (category_id, name)
);
CREATE INDEX idx_taste_tags_category ON taste_tags(category_id);

CREATE TABLE user_tastes (
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id      INT         NOT NULL REFERENCES taste_tags(id) ON DELETE CASCADE,
  weight      SMALLINT    NOT NULL DEFAULT 2 CHECK (weight BETWEEN 1 AND 3), -- 3 매우 좋아함 / 2 좋아함 / 1 관심 있음
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag_id)
);
CREATE INDEX idx_user_tastes_tag ON user_tastes(tag_id);

-- ─────────────────────────────────────────────
-- 라운지 (MVP: 운영자가 만든 공식 라운지만, 사용자 생성은 V2)
-- ─────────────────────────────────────────────
CREATE TABLE lounges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(50)  NOT NULL,
  description  TEXT         NOT NULL DEFAULT '',
  category_id  INT          NOT NULL REFERENCES taste_categories(id),
  icon         VARCHAR(10)  NOT NULL DEFAULT '',
  is_official  BOOLEAN      NOT NULL DEFAULT true,
  created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,   -- V2(사용자 생성)용
  max_members  INT          NOT NULL DEFAULT 200,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (name)
);
CREATE INDEX idx_lounges_category ON lounges(category_id);

-- 라운지 대표 태그 (취향 기반 라운지 추천에 사용)
CREATE TABLE lounge_tags (
  lounge_id  UUID NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
  tag_id     INT  NOT NULL REFERENCES taste_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lounge_id, tag_id)
);

-- 라운지 참여 (회원만. Guest 참여는 Redis)
CREATE TABLE lounge_members (
  lounge_id  UUID        NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lounge_id, user_id)
);
CREATE INDEX idx_lounge_members_user ON lounge_members(user_id);

-- ─────────────────────────────────────────────
-- 채팅
-- direct: 1:1 (회원끼리만. Guest가 낀 방은 Redis)
-- lounge: 라운지마다 1개
-- ─────────────────────────────────────────────
CREATE TABLE chat_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'lounge')),
  lounge_id   UUID UNIQUE REFERENCES lounges(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ,                                   -- 차단·양쪽 퇴장 시
  CHECK ((type = 'lounge') = (lounge_id IS NOT NULL))
);

-- 1:1 방 참여자 + 방 단위 익명 표시 정보 (실제 user_id는 클라이언트에 노출하지 않음)
CREATE TABLE chat_members (
  room_id       UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name  VARCHAR(20) NOT NULL,
  avatar_id     INT         NOT NULL REFERENCES avatars(id),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at       TIMESTAMPTZ,
  last_read_at  TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX idx_chat_members_user ON chat_members(user_id);

-- 회원 메시지만 저장 (Guest 메시지는 Redis)
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID        NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id   UUID        REFERENCES users(id) ON DELETE SET NULL,   -- 탈퇴 시 NULL ("떠난 궤도")
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_room_created ON messages(room_id, created_at DESC);

-- ─────────────────────────────────────────────
-- 1:1 매칭 기록 (회원끼리. Guest 매칭은 Redis)
-- ─────────────────────────────────────────────
CREATE TABLE match_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  similarity      REAL        NOT NULL DEFAULT 0 CHECK (similarity BETWEEN 0 AND 1),
  common_tag_ids  INT[]       NOT NULL DEFAULT '{}',
  status          VARCHAR(10) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  room_id         UUID        REFERENCES chat_rooms(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  CHECK (requester_id <> target_id)
);
CREATE INDEX idx_match_history_requester ON match_history(requester_id, created_at DESC);
CREATE INDEX idx_match_history_target ON match_history(target_id, created_at DESC);
-- 같은 두 사람 사이에는 pending 요청이 하나만
CREATE UNIQUE INDEX uq_match_pending_pair ON match_history
  (LEAST(requester_id, target_id), GREATEST(requester_id, target_id))
  WHERE status = 'pending';

-- ─────────────────────────────────────────────
-- 오늘의 질문
-- ─────────────────────────────────────────────
CREATE TABLE questions (
  id            SERIAL PRIMARY KEY,
  content       VARCHAR(200) NOT NULL UNIQUE,
  category_id   INT          REFERENCES taste_categories(id) ON DELETE SET NULL,  -- NULL = 일상/생각
  publish_date  DATE         UNIQUE,                 -- 지정하면 그날 노출, NULL이면 sort_order 순환
  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE question_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  INT         NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer       TEXT        NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 300),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);
CREATE INDEX idx_question_answers_question ON question_answers(question_id, created_at DESC);

-- ─────────────────────────────────────────────
-- 안전: 신고 / 차단
-- ─────────────────────────────────────────────
CREATE TABLE reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  reporter_guest_id  VARCHAR(64),
  reported_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  reported_guest_id  VARCHAR(64),
  room_id            UUID,                     -- Redis 임시방일 수 있어 FK 없음
  message_id         UUID,
  message_snapshot   TEXT,                     -- 신고 시점 메시지 (Guest 메시지 보관의 유일한 예외)
  reason             VARCHAR(20) NOT NULL
                     CHECK (reason IN ('harassment', 'spam', 'inappropriate', 'personal_info', 'other')),
  description        TEXT        NOT NULL DEFAULT '',
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at        TIMESTAMPTZ,
  CHECK (reporter_user_id IS NOT NULL OR reporter_guest_id IS NOT NULL),
  CHECK (reported_user_id IS NOT NULL OR reported_guest_id IS NOT NULL)
);
CREATE INDEX idx_reports_reported_user ON reports(reported_user_id) WHERE reported_user_id IS NOT NULL;
CREATE INDEX idx_reports_status ON reports(status, created_at);

-- 회원 간 차단 (Guest가 관련된 차단은 Redis)
CREATE TABLE blocks (
  blocker_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);
