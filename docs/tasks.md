# Orbit 작업 목록 (이슈 기준)

- 저장소: https://github.com/heejung72/Orbit
- 진행 방식: **이슈 1개 = 브랜치 1개 = PR 1개** ([CONTRIBUTING.md](../CONTRIBUTING.md))
- 현재 진행 상황은 [progress.md](./progress.md)에서 관리
- 상태: ⬜ 대기 · 🟦 진행 중 · 🟨 PR 리뷰 · ✅ 머지 완료

## 한눈에 보기

| # | 이슈 | 브랜치 | 선행 | 상태 |
|---|---|---|---|---|
| 1 | [DOCS] 프로젝트 재정비 및 Git/브랜치 전략 세팅 | `docs/#1-project-setup` | - | 🟨 |
| 2 | [REFACTOR] 디렉토리 구조 개편 | `refactor/#2-directory-structure` | 1 | ⬜ |
| 3 | [REFACTOR] 스키마 재설계 | `refactor/#3-db-schema` | 2 | ⬜ |
| 4 | [FEAT] 회원 인증 | `feat/#4-member-auth` | 3 | ⬜ |
| 5 | [FEAT] Guest 세션 | `feat/#5-guest-session` | 3 | ⬜ |
| 6 | [FEAT] Welcome 화면 | `feat/#6-welcome` | 4, 5 | ⬜ |
| 7 | [FEAT] 취향 시스템 | `feat/#7-taste-system` | 4, 5 | ⬜ |
| 8 | [FEAT] Orbit Dashboard (Home) | `feat/#8-dashboard` | 7, 9 | ⬜ |
| 9 | [FEAT] 하단 탭 네비게이션 | `feat/#9-tab-navigation` | 6 | ⬜ |
| 10 | [FEAT] Socket.io 실시간 채팅 기반 | `feat/#10-socket-chat` | 4, 5 | ⬜ |
| 11 | [FEAT] 취향 라운지 | `feat/#11-lounge` | 10 | ⬜ |
| 12 | [FEAT] Guest Time Attack | `feat/#12-guest-time-attack` | 5, 10 | ⬜ |
| 13 | [FEAT] 1:1 취향 매칭 | `feat/#13-matching` | 7, 10 | ⬜ |
| 14 | [FEAT] Guest → 회원 전환 | `feat/#14-guest-upgrade` | 12, 13 | ⬜ |
| 15 | [FEAT] 오늘의 질문 | `feat/#15-today-question` | 8, 13 | ⬜ |
| 16 | [FEAT] 신고·차단, 비속어 필터·스팸 Rate Limit | `feat/#16-safety` | 10 | ⬜ |
| 17 | [FEAT] My Orbit *(GitHub 이슈 미등록 — 등록 필요)* | `feat/#17-my-orbit` | 7, 9 | ⬜ |

**권장 진행 순서:** 1 → 2 → 3 → 4 → 5 → 6 → 9 → 7 → 8 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17

---

## #1 [DOCS] 프로젝트 재정비 및 Git/브랜치 전략 세팅
**목표:** 새 기획 기준으로 문서·협업 규칙을 정리해서, 언제 끊어도 docs만 보고 이어갈 수 있게 한다.
- [x] `.gitignore` (node_modules, .env, .expo, .idea, .claude)
- [x] `docs/prd.md` — 확정 기획 (Member/Guest, 30분, 1:1 허용, 가입 시 이전)
- [x] `docs/system_design.md` — 아키텍처, 인증, Guest 세션, 소켓 이벤트, 디렉토리 구조
- [x] `docs/database.md` — 테이블 목록 초안 (상세는 #3)
- [x] `docs/api_spec.md` — 엔드포인트 목록 초안
- [x] `docs/tasks.md` — 이슈별 작업 범위 (이 문서)
- [x] `docs/progress.md` — 진행 현황·다음 할 일·결정 로그
- [x] `README.md` 재작성 (소개, 회원/Guest, 아키텍처·API 흐름 다이어그램)
- [x] `CONTRIBUTING.md` — 브랜치·커밋·PR 규칙
- [x] `.github/ISSUE_TEMPLATE/` (feat, refactor, docs) + `.github/pull_request_template.md`
- [x] TasteMate·음식 앱 관련 문구 정리 (문서·package.json description 등. 코드 구조는 #2)

**완료 기준:** README와 docs만 읽고 다음 이슈(#2)를 바로 시작할 수 있다.

## #2 [REFACTOR] 디렉토리 구조 개편
**목표:** [system_design.md §7](./system_design.md) 구조로 옮긴다. 기능 추가는 하지 않는다.
- [ ] frontend: `screens/*Screen.js` → 폴더 구조 (Welcome, Auth, GuestEntry, TasteSelect, Home, Lounge, Chat, TodayQuestion, MyOrbit)
- [ ] Club 화면 3개 → Lounge (ClubList→LoungeList, ClubDetail→LoungeChat, ClubCreate는 V2라 제거 또는 보관)
- [ ] `components/` 폴더 생성 (OrbitVisualization, Avatar, TasteTags, GuestTimer, SignupNudgeModal) — 빈 placeholder
- [ ] 기존 `RadarChart`, `VennDiagram` 처리 결정 (MVP 미사용 → `_legacy/` 이동 또는 삭제)
- [ ] `navigation/`, `context/`, `theme/` 생성
- [ ] backend: `routes/clubs.js` → `routes/lounges.js`, `routes/public.js` 정리, `guest`, `questions` 라우트 파일 생성(빈 라우터)
- [ ] backend: `socket/`, `seeds/`, `redis.js`, middleware 분리(memberAuth/guestAuth/optionalAuth/rateLimit/profanityFilter)
- [ ] `jobs/cleanupGuests.js` → `jobs/guestExpiry.js`
- [ ] 앱·서버가 기존처럼 실행되는지 확인

**완료 기준:** `npm run dev`(backend), `npx expo start`(frontend)가 에러 없이 실행된다.

## #3 [REFACTOR] 스키마 재설계
- [ ] 기존 `001_init.sql`, `002_guest_and_images.sql` 정리 → 새 `001_init.sql`
- [ ] [database.md](./database.md) 테이블 확정 + ERD(mermaid)
- [ ] Guest 참조 방식 확정 (`actor_type` + `actor_id` 여부)
- [ ] seeds: 카테고리 7종, 태그(카테고리당 8~12개), 기본 캐릭터 6종, 라운지 6~8개, 오늘의 질문 30개
- [ ] `npm run migrate`, `npm run seed` 스크립트
- [ ] docker-compose에 Redis 포함 확인

**완료 기준:** 빈 DB에서 migrate + seed가 한 번에 성공한다.

## #4 [FEAT] 회원 인증
- [ ] `POST /auth/register` (email, password, nickname, avatarId) — bcrypt
- [ ] `POST /auth/login` → JWT
- [ ] `GET /auth/me`
- [ ] `memberAuth`, `optionalAuth` 미들웨어 (`req.actor`)
- [ ] Login / Register 화면, `AuthContext`, SecureStore 저장
- [ ] 입력 검증(이메일 형식, 비밀번호 8자 이상, 닉네임 2~12자)

## #5 [FEAT] Guest 세션
- [ ] `redis.js` 연결
- [ ] `POST /guest/session` — 랜덤 닉네임("형용사 + 명사", 예: 익명의 여행자) + 기본 캐릭터 + `expiresAt = now+30m`
- [ ] Redis 키 저장 ([system_design.md §4-1](./system_design.md))
- [ ] `guestAuth` 미들웨어, `optionalAuth`에 Guest 지원 추가
- [ ] `guestAuth`가 **모든 HTTP 요청마다** `expiresAt`을 직접 검사 → 지났으면 `401 GUEST_EXPIRED` (TTL에만 의존 X)
- [ ] 기존 `routes/auth.js`의 PG 기반 Guest(24h JWT) 제거
- [ ] 앱: guestToken SecureStore 저장, `AuthContext`에 actor 타입 반영
- [ ] GuestEntry 화면 (발급된 닉네임·캐릭터, "30분 동안 머물 수 있어요" 안내)

## #6 [FEAT] Welcome 화면
- [ ] Orbit 로고/카피 "Find your people in the same orbit."
- [ ] [회원가입] [로그인] [가입 없이 둘러보기]
- [ ] 진입 분기: 토큰 있음 → Home / Guest 토큰 유효 → Home / 없음 → Welcome
- [ ] 첫 진입 후 취향 미설정이면 TasteSelect로

## #7 [FEAT] 취향 시스템
- [ ] `GET /tastes/categories`, `GET/PUT /tastes/me` (Member→PG, Guest→Redis)
- [ ] TasteSelect: 카테고리 탭 → 태그 칩 다중 선택 → 중요도(3/2/1) 선택
- [ ] 선택 요약 ("선택한 취향 4개: Oasis · The 1975 · ...")
- [ ] `TasteTags` 컴포넌트 (Home·MyOrbit 재사용)

## #8 [FEAT] Orbit Dashboard (Home)
- [ ] `GET /home` 묶음 API
- [ ] `OrbitVisualization`: 중앙 내 캐릭터, 주변 취향 행성(카테고리별), 바깥 궤도 점(비슷한 사람, 온라인은 빛남), 행성 터치 → 해당 카테고리 라운지
- [ ] Header (인사말, 닉네임, Guest 타이머 자리)
- [ ] My Taste / Today's Question 카드 / Active Lounges / Quick Action
- [ ] `theme/` 컬러·폰트 토큰 정의 + `docs/design.md` 작성

## #9 [FEAT] 하단 탭 네비게이션
- [ ] RootNavigator (Welcome/Auth/Guest 스택 ↔ MainTabs)
- [ ] MainTabs: Home / Lounge / Chat / My Orbit (아이콘, 활성 색)
- [ ] 각 탭 placeholder 화면 연결

## #10 [FEAT] Socket.io 실시간 채팅 기반
- [ ] 소켓 인증 (JWT / guestToken) — 연결 시 + **모든 이벤트 처리 전** Guest `expiresAt` 검사, 지났으면 `guest:expired` 전송 후 disconnect
- [ ] 브로드캐스트 시 만료된 Guest 수신자 제외
- [ ] 이벤트: `room:join`, `room:leave`, `message:send`, `message:new`, `typing` ([system_design.md §5](./system_design.md))
- [ ] 저장 규칙: Member→PG, Guest 관련→Redis ([§4-3](./system_design.md))
- [ ] 로거 마스킹 (Guest 메시지 본문 로그 금지)
- [ ] `GET /chat/rooms`, `GET /chat/rooms/:id/messages`, 나가기
- [ ] ChatList, ChatRoom 화면 (말풍선, 익명 닉네임·캐릭터)
- [ ] 온라인 상태 `online:actors`

## #11 [FEAT] 취향 라운지
- [ ] `GET /lounges`, `/lounges/recommended`, `/lounges/:id`, `/lounges/:id/messages`
- [ ] 실시간 인원 `room:presence`
- [ ] LoungeList (카테고리 필터, 인기순), LoungeChat (그룹 채팅)
- [ ] Home의 Active Lounges 연결

## #12 [FEAT] Guest Time Attack
- [ ] `GuestTimer` 컴포넌트 (mm:ss, 5분 이하 강조색)
- [ ] 소켓별 만료 타이머 (`expiresAt - now`): `guest:expired` **전송 후** disconnect → 방 퇴장 브로드캐스트 → Redis 정리
- [ ] 보조 스케줄러 `jobs/guestExpiry.js` (30초 주기): 타이머에서 누락된 소켓·키 정리
- [ ] `guest:warning`(5분 전), `guest:expired` 이벤트
- [ ] 앱: 만료 시 토큰 삭제 → "궤도가 사라졌어요" 화면 → Welcome
- [ ] 앱이 백그라운드였다가 돌아와도 `expiresAt` 기준으로 정확히 계산

## #13 [FEAT] 1:1 취향 매칭
- [ ] `services/matching` 가중치 코사인 유사도 + 제외 규칙 ([system_design.md §6](./system_design.md)) — 후보는 온라인 actor만
- [ ] `GET /matching/candidates`, 요청/수락/거절 API + `match:request`/`match:accepted` 이벤트
- [ ] Matching 화면 (상대 캐릭터, 닉네임, 공통 취향 3개, [대화 요청])
- [ ] 수락 시 1:1 방 생성 (Guest 포함 시 `is_temporary=true`)
- [ ] 대화 주제 추천 `GET /chat/rooms/:id/topics` + ChatRoom 상단 카드

## #14 [FEAT] Guest → 회원 전환
- [ ] `SignupNudgeModal` (3가지 트리거: 기록 저장 버튼 / 만료 5분 전 / 메시지 20개)
- [ ] Register에 `X-Guest-Token` 전달
- [ ] `services/migration` 트랜잭션 ([system_design.md §4-4](./system_design.md)): 취향·방·답변 이전, 메시지는 **본인 것만** 새 userId로, Member 메시지 작성자 유지, 상대 Guest 메시지는 이전 X
- [ ] 소켓 재인증 `auth:upgrade`, 상대 화면 닉네임 유지
- [ ] 상대도 Guest인 방의 처리 방식 결정 후 문서 반영

## #15 [FEAT] 오늘의 질문
- [ ] seed 질문 순환 (publish_date 기준, 없으면 순번)
- [ ] `GET /questions/today`, 답변 작성/조회, 답변자에게 대화 요청
- [ ] Home 카드 + TodayQuestion 화면 (답변 → 다른 답변 리스트 → 대화 시작)
- [ ] Guest 답변은 Redis

## #16 [FEAT] 신고·차단, 비속어 필터·스팸 Rate Limit
- [ ] `POST /reports` (메시지 스냅샷 저장), `POST/DELETE /blocks`
- [ ] 차단 시: 1:1 방 종료, 매칭 후보 제외, 라운지 메시지 숨김
- [ ] `profanityFilter` (단어 목록 + 마스킹 `***`)
- [ ] `rateLimit` (Redis, 메시지 초당 2회 / 동일 메시지 3회 연속 차단)
- [ ] 메시지 길게 누르기 → 신고/차단 시트, Report 화면

## #17 [FEAT] My Orbit
- [ ] 내 캐릭터·닉네임 표시 및 변경 (`PATCH /users/me`)
- [ ] 취향 관리 (TasteSelect 재사용)
- [ ] 계정 설정: 로그아웃, 탈퇴
- [ ] Guest: 남은 시간 + 가입 유도 카드

---

## 이후 버전 (이슈 미생성)
- V2: 아바타 커스터마이징, 라운지 직접 생성, 즐겨찾기, 채팅 이미지, 추천 고도화
- V3: 소모임, 음성 대화, 함께 듣기, 취향 리포트, 캐릭터 아이템
