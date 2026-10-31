# Orbit API 명세

> 상태: **엔드포인트 목록 초안.** 요청/응답 상세는 각 이슈 작업 시 채운다.
> - Base URL: `/api`
> - 인증: `M` = memberAuth, `G` = guestAuth, `O` = optionalAuth(회원·Guest), `-` = 없음
> - 에러 형식: `{ "error": { "code": "GUEST_EXPIRED", "message": "..." } }`

## 공통 에러 코드
| code | HTTP | 설명 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 토큰 없음/무효 |
| `GUEST_EXPIRED` | 401 | Guest 세션 만료 |
| `FORBIDDEN` | 403 | 권한 없음 (예: Guest 불가 기능) |
| `BLOCKED_USER` | 403 | 차단 관계 |
| `RATE_LIMITED` | 429 | 요청 과다 |
| `VALIDATION_ERROR` | 400 | 입력값 오류 |

## Auth — #4, #14
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/register` | - (선택: `X-Guest-Token`) | 회원가입. Guest 토큰이 있으면 데이터 이전 (#14) |
| POST | `/auth/login` | - | 로그인 → JWT |
| GET | `/auth/me` | O | 현재 actor 정보 (Guest면 expiresAt 포함) |

## Guest — #5
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/guest/session` | - | Guest 발급 → `{guestToken, guestId, nickname, avatarId, expiresAt}` |
| DELETE | `/guest/session` | G | 직접 종료 |

## Users / My Orbit — #17
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| PATCH | `/users/me` | M | 닉네임, 캐릭터 변경 |
| DELETE | `/users/me` | M | 탈퇴 |
| GET | `/avatars` | - | 기본 캐릭터 목록 |

## Tastes — #7
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/tastes/categories` | - | 카테고리 + 태그 목록 |
| GET | `/tastes/me` | O | 내 취향 |
| PUT | `/tastes/me` | O | 내 취향 저장 `[{tagId, weight}]` (Guest는 Redis) |

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
