# Orbit API 명세

> 상태: **엔드포인트 목록 초안.** 요청/응답 상세는 각 이슈 작업 시 채운다.
> - Base URL: `/api`
> - 인증: `M` = memberAuth, `G` = guestAuth, `O` = optionalAuth(회원·Guest), `-` = 없음
> - 에러 형식: `{ "error": "사용자에게 보여줄 메시지", "code": "GUEST_EXPIRED" }` (`code`는 클라이언트가 분기해야 할 때만)
> - Guest 인증 헤더: `X-Guest-Token: <guestToken>` (회원은 `Authorization: Bearer <JWT>`, 둘 다 있으면 회원 우선)
> - ⚠️ #3 시점 실제 구현은 이전 경로를 유지합니다 (`POST /matching/find`, `POST /matching/request/:targetId` 등). 각 기능 이슈에서 아래 명세로 교체합니다.

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
| POST | `/auth/register` | - (선택: `X-Guest-Token`) | `{email, password(8자~72바이트), nickname(2~12자), avatar_id?}` → `201 {token, user:{nickname, avatar_id}}`. 이메일은 소문자 저장, 중복 409, 없는 캐릭터 400. Guest 데이터 이전은 #14 |
| POST | `/auth/login` | - | `{email, password}` → `{token, user}` (이메일 대소문자 무시), 실패 401, 정지 403 |
| GET | `/auth/me` | O | `{type: 'member' \| 'guest', nickname, avatar_id, avatar_emoji, has_tastes, expires_at?(Guest)}` |

## Guest — #5
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/guest/session` | - | Guest 발급 → `201 {guestToken, nickname, avatarId, avatarEmoji, expiresAt(ISO)}` (guestId는 내려주지 않음) |
| DELETE | `/guest/session` | G | 직접 종료 |

## Users / My Orbit — #17
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| PATCH | `/users/me` | M | 닉네임, 캐릭터 변경 |
| DELETE | `/users/me` | M | 탈퇴 |
| GET | `/public/avatars` | - | 기본 캐릭터 목록 `[{id, name, emoji, color}]` |

## Tastes — #7
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/tastes/categories` | O | `[{ id, code, name, icon, tags: [{ id, name }] }]` |
| GET | `/tastes/me` | O | `[{ tag_id, name, category_id, category, weight }]` (카테고리·태그 순서) |
| PUT | `/tastes/me` | O | body `{ tags: [{ tagId, weight }] }` → 전체 교체 후 `GET /tastes/me`와 같은 목록 |

- 규칙: **3~20개**, `weight` 정수 1~3 (3 매우 좋아함 / 2 좋아함 / 1 관심 있음), `tagId` 중복 불가
- 400: 개수·형식·중복 위반, 존재하지 않는 태그 / 401: 토큰 없음·만료 / 503 `UNAVAILABLE`: Guest 요청인데 Redis 연결 끊김
- 저장 위치: 회원 `user_tastes`(트랜잭션 교체) / Guest Redis `guest:tastes:{guestId}` (세션 `expiresAt`에 함께 만료)
- `/auth/me`의 `has_tastes`는 회원·Guest 모두 내려준다 (0개면 앱이 TasteSelect부터 보여줌)

## Home — #8
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/home` | O | 대시보드 묶음 응답: 내 취향, 궤도 데이터(비슷한 사람 수/온라인), 오늘의 질문, 추천 라운지 |

## Lounges — #11
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/lounges?category=` | O | 라운지 목록 + 현재 인원 |
| GET | `/lounges/recommended` | O | 내 취향 기반 추천 |
| GET | `/lounges/:id` | O | 라운지 상세 |
| GET | `/lounges/:id/messages?before=` | O | 최근 메시지 (PG + Redis 병합) |

## Chat — #10
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/chat/rooms` | O | 내 1:1 방 목록 |
| GET | `/chat/rooms/:id/messages?before=` | O | 메시지 기록 |
| POST | `/chat/rooms/:id/leave` | O | 방 나가기 |
| GET | `/chat/rooms/:id/topics` | O | 공통 취향 기반 대화 주제 추천 |

## Matching — #13
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/matching/candidates` | O | 추천 후보 (유사도, 공통 태그 3개) |
| POST | `/matching/requests` | O | 매칭 요청 `{targetActorRef}` |
| POST | `/matching/requests/:id/accept` | O | 수락 → 1:1 방 생성 |
| POST | `/matching/requests/:id/reject` | O | 거절 |

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
