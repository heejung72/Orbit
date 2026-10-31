# Orbit Database 설계

> 상태: **틀만 잡아둔 초안.** 확정은 #3 [REFACTOR] 스키마 재설계에서 진행하고 이 문서를 갱신한다.
> - PostgreSQL = Member 영구 데이터 / Redis = Guest 임시 데이터 ([system_design.md §4](./system_design.md))

## 1. 테이블 목록 (초안)

| 테이블 | 저장 데이터 | 관련 이슈 |
|---|---|---|
| `users` | 회원(email, password_hash, nickname, avatar_id, status) | #4 |
| `avatars` | 기본 캐릭터 목록(MVP) / 외형 파츠(V2) | #4, #17 |
| `taste_categories` | 7개 카테고리(음악·영화·책·음식·여행·운동·취미) | #7 |
| `taste_tags` | 카테고리별 세부 태그 | #7 |
| `user_tastes` | user_id, tag_id, **weight(1~3)** | #7 |
| `lounges` | 라운지(이름, 설명, 카테고리, 대표 태그, 아이콘) | #11 |
| `lounge_members` | 라운지 참여(회원만, Guest는 Redis) | #11 |
| `chat_rooms` | type(`direct`/`lounge`), lounge_id, **is_temporary** | #10 |
| `chat_members` | room_id, user_id, display_name, avatar_id, left_at | #10 |
| `messages` | room_id, sender_id, content, created_at (회원 메시지만) | #10 |
| `match_history` | requester, target, similarity, common_tags, status | #13 |
| `questions` | 오늘의 질문(문구, 카테고리, publish_date) | #15 |
| `question_answers` | question_id, user_id, answer | #15 |
| `reports` | reporter, target, room_id, **message_snapshot**, reason, status | #16 |
| `blocks` | blocker_id, blocked_id | #16 |

## 2. 설계 원칙 (확정)
- 익명 표시 정보(`display_name`, `avatar_id`)는 `chat_members`에 **방 단위**로 저장 → 실제 user_id는 클라이언트에 노출하지 않음
- Guest는 PostgreSQL에 행을 만들지 않는다. 단, `chat_members`/`reports`에서 Guest를 가리켜야 하면 `actor_type`('member'|'guest') + `actor_id` 컬럼 사용 여부를 #3에서 결정
- 모든 PK는 UUID (seed성 테이블인 카테고리·태그는 SERIAL 허용)
- `created_at TIMESTAMPTZ DEFAULT now()`

## 3. ERD
> #3에서 mermaid `erDiagram`으로 작성

## 4. 기존 스키마에서 바뀌는 점 (참고)
| 기존 (TasteMate) | 변경 |
|---|---|
| `taste_options` | `taste_tags` + `user_tastes.weight` 추가 |
| `clubs`, `club_members` | `lounges`, `lounge_members` |
| `matches` | `match_history` |
| users의 게스트 컬럼 (`002_guest_and_images.sql`) | 제거 — Guest는 Redis로 |
| `profile_image` | 제거 — `avatar_id`로 대체 |
| (없음) | `questions`, `question_answers`, `avatars`, `blocks` 추가 |

## 5. Redis 키
[system_design.md §4-1](./system_design.md) 참고
