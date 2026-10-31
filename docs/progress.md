# Orbit 진행 현황

> **작업을 다시 시작할 때 이 파일부터 읽는다.** 작업이 끝날 때마다 갱신한다.

## 🔖 지금 상태
- **현재 이슈:** #3 [REFACTOR] 스키마 재설계
- **브랜치:** `refactor/#3-db-schema`
- **상태:** 작업 완료 → PR 리뷰 대기
- **다음 할 일:** #3 PR 머지 → 로컬 DB 초기화(`npm run db:setup`) → `feat/#4-member-auth` 브랜치 생성 → 첫 커밋으로 #3 완료 반영 → [tasks.md #4](./tasks.md#4-feat-회원-인증) 진행

## ✅ 완료한 이슈
| # | 제목 | PR | 머지일 |
|---|---|---|---|
| 1 | [DOCS] 프로젝트 재정비 및 Git/브랜치 전략 세팅 | #18 | 2026-10-31 |
| 2 | [REFACTOR] 디렉토리 구조 개편 | #19 | 2026-10-31 |

## 📌 결정 로그
| 날짜 | 결정 | 근거/비고 |
|---|---|---|
| 2026-10-31 | 제품 방향: **채팅 + 커뮤니티 중심** | 가상 공간은 홈 궤도 시각화로만 |
| 2026-10-31 | Guest 이용 시간 **30분 절대 시간제** | 활동해도 연장 X, MVP는 연장 불가 |
| 2026-10-31 | Guest **라운지 + 1:1 매칭 모두 허용** | |
| 2026-10-31 | Guest 가입 시 **대화·취향 회원 계정으로 이전** | |
| 2026-10-31 | Guest 데이터는 **Redis에만** (PG·로그 저장 X) | 신고 시 메시지 스냅샷만 예외 |
| 2026-10-31 | Club → **Lounge** 명칭 변경, 라운지 생성은 V2 | |
| 2026-10-31 | 오늘의 질문은 독립 탭 X, **Home 주요 카드** | |
| 2026-10-31 | Redis를 MVP부터 사용 | Guest 정책 때문 |
| 2026-10-31 | 이슈 1개 = 브랜치 1개 = PR 1개 | 브랜치명 `type/#번호-설명` |
| 2026-10-31 | Guest 만료는 **소켓별 타이머로 즉시 종료**, 30초 스케줄러는 보조 | CodeRabbit 리뷰(#18) |
| 2026-10-31 | Guest→회원 전환 시 **본인 메시지만** 이전, 상대 Guest 메시지는 PG로 옮기지 않음 | CodeRabbit 리뷰(#18) |
| 2026-10-31 | 1:1 매칭 후보는 **온라인 actor만** (오프라인 확장은 V2) | PRD와 일치 |
| 2026-10-31 | progress.md 완료 반영은 **다음 이슈 PR 첫 커밋**에서 | main 직접 push 금지 |
| 2026-10-31 | **1인 개발** — 셀프 머지, 사람 리뷰 대신 CodeRabbit 자동 리뷰 | CONTRIBUTING.md §1 |
| 2026-10-31 | 기존 `RadarChart`·`VennDiagram`은 `_legacy/`로 보관 (MVP 디자인에 없음) | #8·#17 재작성 시 제거 |
| 2026-10-31 | 라운지 직접 생성 화면은 `_legacy/`로 보관, 목록의 생성 버튼 제거 | V2 |
| 2026-10-31 | `optionalAuth`가 기존 authMiddleware 역할(회원+Guest), `memberAuth`가 membersOnly 역할 | #2 구조 개편 |
| 2026-10-31 | **PG에는 회원만 저장**, Guest가 낀 방·참여·매칭·차단은 Redis. 예외: `reports.*_guest_id` | #3, actor_type 방식 대신 선택 |
| 2026-10-31 | #3은 스키마 + **기존 라우트 SQL 수정까지** (앱 동작 유지) | PG Guest 로그인은 #5 전까지 501 |
| 2026-10-31 | 프로필 사진·자기소개(bio) 제거, 캐릭터(`avatar_id`)로 대체 | PRD 익명 원칙 |
| 2026-10-31 | 마이그레이션은 새 파일 추가 방식, `schema_migrations`로 기록 | 적용된 파일은 수정 금지 |
| 2026-10-31 | 메시지 응답은 `sender_id` 대신 **`is_mine`** | PR #20 CodeRabbit, 익명성 |
| 2026-10-31 | 라우트 입구에서 UUID·숫자·날짜 검증(`utils/validate.js`), 잘못된 값은 400/404 | PR #20 CodeRabbit |
| 2026-10-31 | 매칭 요청·수락 시 차단 관계 양방향 재확인, 차단 후 수락은 `cancelled` | PR #20 CodeRabbit |
| 2026-10-31 | 이전 스키마 → 새 스키마 변환 마이그레이션은 만들지 않음 (출시 전, 운영 데이터 없음). 이전 스키마 감지 시 `migrate` 중단 | PR #20 CodeRabbit. 운영 이후엔 보존형 마이그레이션 필수 |
| 2026-10-31 | 로그인·가입 응답 `user`에서 id·email 제거 (nickname, avatar_id만) | PR #20 CodeRabbit, 익명성 |
| 2026-10-31 | CodeRabbit 리뷰 반영 커밋은 항상 **`[FIX]`** | 이슈 타입과 무관 |
| 2026-10-31 | 이슈·커밋·PR 제목은 **`[TYPE]` 대문자 대괄호** 형식 | 예: `[FEAT] #5 Guest 세션 발급 API 추가`. 브랜치만 소문자 |

## ❓ 미결정 사항
| 항목 | 결정 예정 이슈 |
|---|---|
| 매칭·신고 API를 Guest에게도 열기 (현재 `memberAuth`) | #13, #16 |
| 상대도 Guest인 1:1 방을 가입 전환할 때 방·상대 메시지 처리 | #14 |
| 컬러·폰트 디자인 토큰 | #8 |
| 웹 버전 Guest 토큰 저장 방식 (HttpOnly 쿠키 vs localStorage) | #5 |

## 📝 작업 메모
- 기존 뼈대(TasteMate, 음식 취향 앱 기준)는 `main` 첫 커밋에 남아 있음 — 참고용
- frontend 임시 아이콘(`assets/*.png`)은 #2에서 만든 placeholder — 정식 디자인은 #8
- ⚠️ **#3 이후 로컬 DB는 초기화 필요**: `cd src/backend && npm run db:setup` (기존 TasteMate 테이블과 호환 안 됨)
- 임시 API 형태(#3에서 유지): `POST /matching/find`, `PUT /users/me/tastes` 등은 각 기능 이슈(#7, #13)에서 api_spec 형태로 교체
- 메시지(REST·소켓)는 `is_mine`만 내려줌(실제 user_id 제거, PR #20). 매칭 후보 `id`는 아직 실제 user_id → #13에서 익명 참조로 교체
- 소켓 `send_message` Rate Limit 없음 → #16에서 Redis 기반으로 추가
- ⚠️ **현재 코드는 아직 목표 설계와 다름**: `routes/auth.js`의 Guest는 PostgreSQL `users`에 저장되고 24시간 JWT를 씀. Redis 기반 30분 Guest는 #5·#12에서 구현
- `src/backend/.env`는 git 제외됨. 새 환경에서는 `.env.example` 복사
- GitHub 이슈 #17(My Orbit) 아직 미등록
