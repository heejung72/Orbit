# Orbit API 명세

> 상태: **엔드포인트 목록 초안.** 요청/응답 상세는 각 이슈 작업 시 채운다.
> - Base URL: `/api`
> - 인증: `M` = memberAuth, `G` = guestAuth, `O` = optionalAuth(회원·Guest), `-` = 없음
> - 에러 형식: `{ "error": "사용자에게 보여줄 메시지", "code": "GUEST_EXPIRED" }` (`code`는 클라이언트가 분기해야 할 때만)
> - Guest 인증 헤더: `X-Guest-Token: <guestToken>` (회원은 `Authorization: Bearer <JWT>`, 둘 다 있으면 회원 우선)
> - 매칭 API는 #13에서 아래 명세로 교체했습니다 (이전 `/matching/find` 등 삭제). 아직 구현 전인 기능(#14~#16)의 상세는 각 이슈에서 채웁니다.

## 공통 에러 코드
| code | HTTP | 설명 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 토큰 없음/무효 |
| `GUEST_EXPIRED` | 401 | Guest 세션 만료 |
| `MEMBER_ONLY` | 403 | 회원 전용 기능에 Guest 토큰으로 접근 |
| `UNAVAILABLE` | 503 | Redis 미연결 (Guest 기능) |
| `BLOCKED_USER` | 403 | 차단 관계 |
| `RATE_LIMITED` | 429 | 요청 과다 |
| `VALIDATION_ERROR` | 400 | 입력값 오류 |

## Auth — #4, #14
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/register` | - (선택: `X-Guest-Token`) | `{email, password(8자~72바이트), nickname(2~12자), avatar_id?}` → `201 {token, user:{nickname, avatar_id}, migrated}`. 이메일은 소문자 저장, 중복 409, 없는 캐릭터 400. **#14:** 유효한 Guest 토큰이면 취향·라운지·대화를 이전하고 `migrated: {tastes, lounges, lounge_messages, direct_rooms}`(아니면 `null`). 같은 토큰으로 동시 가입 409 `UPGRADE_IN_PROGRESS`, Redis 끊김 503, 이전 실패 500(가입도 취소, Guest 유지) |
| POST | `/auth/login` | - | `{email, password}` → `{token, user}` (이메일 대소문자 무시), 실패 401, 정지 403 |
| GET | `/auth/me` | O | `{type: 'member' \| 'guest', nickname, avatar_id, avatar_emoji, has_tastes, expires_at?(Guest)}` |

## Guest — #5
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/guest/session` | - | Guest 발급 → `201 {guestToken, nickname, avatarId, avatarEmoji, expiresAt(ISO)}` (guestId는 내려주지 않음) |
| DELETE | `/guest/session` | G | 직접 종료 |

## Users / My Orbit — #17
- 모두 회원 전용(`memberAuth`), Guest는 403 `MEMBER_ONLY`. 이전 `PUT /users/me`는 삭제
- 탈퇴한 회원의 메시지는 `sender_id = NULL`로 남고 상대 화면에는 "떠난 궤도"로 표시

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/users/me` | M | `{email, nickname, avatar_id, avatar_emoji, created_at}` (user id·취향은 내려주지 않음, 취향은 `GET /tastes/me`) |
| PATCH | `/users/me` | M | body `{nickname?, avatar_id?}` → `GET /users/me`와 같은 형식. 빈 body·닉네임(trim 후 2~12자)·없는 캐릭터는 400 |
| DELETE | `/users/me` | M | body `{password}` → `{message}`. 비밀번호 없음 400, 틀림 401 `WRONG_PASSWORD`. 한 트랜잭션에서 참여 중인 1:1 방 종료(`closed_at`) 후 계정 삭제, 커밋 뒤 내 소켓 연결 해제 |
| GET | `/public/avatars` | - | 기본 캐릭터 목록 `[{id, name, emoji, color}]` |

## Tastes — #7
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/tastes/categories` | O | `[{ id, code, name, icon, tags: [{ id, name }] }]` |
| GET | `/tastes/me` | O | `[{ tag_id, name, category_id, category, category_icon, weight }]` (카테고리·태그 순서) |
| PUT | `/tastes/me` | O | body `{ tags: [{ tagId, weight }] }` → 전체 교체 후 `GET /tastes/me`와 같은 목록 |

- 규칙: **3~20개**, `weight` 정수 1~3 (3 매우 좋아함 / 2 좋아함 / 1 관심 있음), `tagId` 중복 불가
- 400: 개수·형식·중복 위반, 존재하지 않는 태그 / 401: 토큰 없음·만료 / 503 `UNAVAILABLE`: Guest 요청인데 Redis 연결 끊김
- 저장 위치: 회원 `user_tastes`(트랜잭션 교체) / Guest Redis `guest:tastes:{guestId}` (세션 `expiresAt`에 함께 만료)
- `/auth/me`의 `has_tastes`는 회원·Guest 모두 내려준다 (0개면 앱이 TasteSelect부터 보여줌)

## Home — #8
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/home` | O | 대시보드 묶음 응답 `{ me, tastes, question, lounges }` |

- `me`: `{ type: 'member' \| 'guest', nickname, avatar_id, avatar_emoji, expires_at?(Guest) }` — user_id·guestId 미노출
- `tastes`: `GET /tastes/me`와 같은 형식
- `question`: 오늘의 질문 `{ id, content }` — `publish_date`가 오늘(KST)인 질문 우선, 없으면 `sort_order` 순으로 하루 하나씩 순환 (`services/questions.js`, #15 재사용). 질문이 없으면 `null`
- `lounges`: 공식 라운지 전체, 참여 인원순 (`id, name, icon, category_id, category_name, category_icon, member_count` …). 앱은 상위 3개를 Active Lounges로, 카테고리 → 라운지 매핑을 궤도 행성 터치에 사용
- 401: 토큰 없음·만료·계정 없음 / 503 `UNAVAILABLE`: Guest 요청인데 Redis 끊김
- 바깥 궤도의 비슷한 사람 수·온라인 표시는 #13·#10에서 추가
- 이전 `GET /public/home`은 #8에서 제거

## Lounges — #11
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/lounges?category_id=&search=` | O | 라운지 목록, 인원순. `member_count`(회원 + 만료 전 Guest), `is_member` |
| GET | `/lounges/recommended` | O | 내 취향 기반 추천 최대 5개 (`score` 포함). 취향 0개면 `[]` |
| GET | `/lounges/:id` | O | 상세: `chat_room_id`, `tags`, `members`(회원 최근 50명, 닉네임·캐릭터), `guest_count`, `member_count`, `is_member` |
| POST | `/lounges/:id/join` | O | 참여 (회원 PG / Guest Redis). 이미 참여 중이면 그대로 200, 정원 초과 400 `LOUNGE_FULL` |
| DELETE | `/lounges/:id/leave` | O | 나가기 |

- 추천 점수: 라운지 대표 태그와 겹치는 내 태그 중요도 × 2 + 같은 카테고리 내 취향 중요도 합. 동점은 인원순
- 정원(`max_members`)은 Guest 포함, 라운지 행 잠금으로 동시 참여에도 넘지 않음
- Redis가 끊기면 회원은 회원 수만으로 목록·상세·참여 가능, Guest 요청은 503
- 메시지 기록은 `GET /chat/rooms/:chatRoomId/messages` (#10) — 라운지 전용 메시지 API는 두지 않음
- 실시간 접속 인원은 소켓 `room:presence`

## Chat — #10
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/chat/rooms` | O | `{ direct: [...], lounges: [...] }` — 1:1은 PG 방(회원끼리) + Redis 방(Guest가 낀 방, #13)을 최근 메시지순으로 합침. direct 항목: `{id, type, created_at, partner_nickname, partner_avatar_emoji, partner_is_guest, last_message, last_message_at}` |
| GET | `/chat/rooms/:id/messages?before=&limit=` | O | 회원(PG) + Guest(Redis) 메시지를 시간순 병합, 최대 100개. 형식은 소켓 `message:new`와 같음. 만료된 Guest의 메시지는 제외 |
| POST | `/chat/rooms/:id/leave` | O | 1:1 방 나가기 (PG: 둘 다 나가면 `closed_at` / Redis: 둘 다 나가면 방·메시지 삭제). 라운지는 400 → 라운지 나가기는 #11 |
| GET | `/chat/rooms/:id/topics` | O | `{ topics: [문장 1~3개] }` — 공통 취향 템플릿, 없으면 일반 질문 2개. 라운지 방은 400 (#13) |

- 접근: 1:1은 참여 중인 사람만(PG 방은 회원, Redis 방은 회원·Guest), 라운지 방은 회원·Guest 모두. 접근할 수 없는 방은 404
- 실시간 송수신은 Socket.io (`docs/system_design.md` §5)

## Matching — #13
- 회원·Guest 모두(`optionalAuth`). 실제 user_id·guestId는 내려주지 않는다 (후보는 `ref`, 요청은 `id`)
- 요청 형태(`R`): `{ id, direction: 'received' | 'sent', nickname, avatar_emoji, is_guest, similarity(0~100), common_tags: [이름 최대 3개], created_at }`

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/matching/candidates` | O | `{ candidates: [{ ref, nickname, avatar_emoji, is_guest, similarity, common_tags }], message? }` — 지금 접속 중, 유사도 상위 10명. ref는 10분, 발급받은 사람만 사용 |
| GET | `/matching/requests` | O | `{ received: [R], sent: [R] }` — 대기 중인 요청 (회원 요청은 24시간 지나면 만료) |
| POST | `/matching/requests` | O | body `{ ref }` → `201 R(sent)`. 상대에게 소켓 `match:request`. 오류: 404 `REF_INVALID`(위조·만료·남의 ref·차단), 409 `TARGET_OFFLINE` / `ALREADY_REQUESTED` / `ALREADY_RECEIVED` / `NOT_AVAILABLE`(대화 중·24시간 내 거절) |
| POST | `/matching/requests/:id/accept` | O | 받은 요청만 → `{ matchId, roomId, title, status }`. 양쪽에 `match:accepted`. 회원끼리 PG 방, Guest가 끼면 Redis 방. 이미 처리·만료된 요청은 404 |
| POST | `/matching/requests/:id/reject` | O | 받은 요청만 → `{ matchId, status }`. 요청자에게 `match:rejected`. 24시간(Guest가 끼면 Guest 만료까지) 서로 추천하지 않음 |

- 예전 `POST /matching/find`, `/matching/request/:targetId`, `/matching/:id/accept·reject`, `GET /matching/my`는 삭제

## Today's Question — #15
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/questions/today` | O | 오늘의 질문 + 내 답변 여부 |
| POST | `/questions/:id/answers` | O | 답변 작성 |
| GET | `/questions/:id/answers` | O | 다른 사람 답변 (익명) |
| POST | `/questions/:id/answers/:answerId/chat` | O | 답변자에게 대화 요청 |

## Safety — #16
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/reports` | O | 신고 `{targetRef, roomId, messageId, reason}` |
| POST | `/blocks` | O | 차단 |
| DELETE | `/blocks/:targetRef` | M | 차단 해제 |

## Socket.io
[system_design.md §5](./system_design.md) 참고
