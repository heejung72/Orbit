# Orbit 진행 현황

> **작업을 다시 시작할 때 이 파일부터 읽는다.** 작업이 끝날 때마다 갱신한다.

## 🔖 지금 상태
- **현재 이슈:** #2 [REFACTOR] 디렉토리 구조 개편
- **브랜치:** `refactor/#2-directory-structure`
- **상태:** 작업 완료 → PR 리뷰 대기
- **다음 할 일:** #2 PR 머지 → `refactor/#3-db-schema` 브랜치 생성 → 첫 커밋으로 #2 완료 반영 → [tasks.md #3](./tasks.md#3-refactor-스키마-재설계) 진행

## ✅ 완료한 이슈
| # | 제목 | PR | 머지일 |
|---|---|---|---|
| 1 | [DOCS] 프로젝트 재정비 및 Git/브랜치 전략 세팅 | #18 | 2026-10-31 |

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
| 2026-10-31 | CodeRabbit 리뷰 반영 커밋은 항상 **`[FIX]`** | 이슈 타입과 무관 |
| 2026-10-31 | 이슈·커밋·PR 제목은 **`[TYPE]` 대문자 대괄호** 형식 | 예: `[FEAT] #5 Guest 세션 발급 API 추가`. 브랜치만 소문자 |

## ❓ 미결정 사항
| 항목 | 결정 예정 이슈 |
|---|---|
| Guest를 DB 테이블에서 참조하는 방식 (`actor_type`+`actor_id`) | #3 |
| 매칭·신고 API를 Guest에게도 열기 (현재 `memberAuth`) | #13, #16 |
| 상대도 Guest인 1:1 방을 가입 전환할 때 상대 메시지 처리 | #14 |
| 컬러·폰트 디자인 토큰 | #8 |
| 웹 버전 Guest 토큰 저장 방식 (HttpOnly 쿠키 vs localStorage) | #5 |

## 📝 작업 메모
- 기존 뼈대(TasteMate, 음식 취향 앱 기준)는 `main` 첫 커밋에 남아 있음 — 참고용
- frontend 임시 아이콘(`assets/*.png`)은 #2에서 만든 placeholder — 정식 디자인은 #8
- API 경로는 `/lounges`로 바뀌었지만 DB 테이블은 아직 `clubs`, `club_members` (#3에서 변경)
- ⚠️ **현재 코드는 아직 목표 설계와 다름**: `routes/auth.js`의 Guest는 PostgreSQL `users`에 저장되고 24시간 JWT를 씀. Redis 기반 30분 Guest는 #5·#12에서 구현
- `src/backend/.env`는 git 제외됨. 새 환경에서는 `.env.example` 복사
- GitHub 이슈 #17(My Orbit) 아직 미등록
