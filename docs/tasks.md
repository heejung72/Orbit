# Orbit 작업 목록 (이슈 기준)

- 저장소: https://github.com/heejung72/Orbit
- 진행 방식: **이슈 1개 = 브랜치 1개 = PR 1개** ([CONTRIBUTING.md](../CONTRIBUTING.md))
- 현재 진행 상황은 [progress.md](./progress.md)에서 관리
- 상태: ⬜ 대기 · 🟦 진행 중 · 🟨 PR 리뷰 · ✅ 머지 완료

## 한눈에 보기

| # | 이슈 | 브랜치 | 선행 | 상태 |
|---|---|---|---|---|
| 1 | [DOCS] 프로젝트 재정비 및 Git/브랜치 전략 세팅 | `docs/#1-project-setup` | - | ✅ |
| 2 | [REFACTOR] 디렉토리 구조 개편 | `refactor/#2-directory-structure` | 1 | ✅ |
| 3 | [REFACTOR] 스키마 재설계 | `refactor/#3-db-schema` | 2 | ✅ |
| 4 | [FEAT] 회원 인증 | `feat/#4-member-auth` | 5 | 🟨 |
| 5 | [FEAT] Guest 세션 | `feat/#5-guest-session` | 3 | ✅ |
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

**권장 진행 순서:** 1 → 2 → 3 → **5 → 4** → 6 → 9 → 7 → 8 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17

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
- [x] frontend: `screens/*Screen.js` → 폴더 구조 (Welcome, Auth, GuestEntry, TasteSelect, Home, Lounge, Chat, TodayQuestion, MyOrbit)
- [x] Club 화면 → Lounge (ClubList→LoungeList, ClubDetail→LoungeChat, 화면 문구 동호회→라운지), ClubCreate는 V2라 `_legacy/` 보관 + 목록의 생성 버튼 제거
- [x] Profile → `MyOrbit/MyOrbitScreen`
- [x] `components/` placeholder (OrbitVisualization, Avatar, TasteTags, GuestTimer, SignupNudgeModal) + 빈 화면(Welcome, GuestEntry, TodayQuestion)
- [x] `RadarChart`, `VennDiagram` → `_legacy/components/` (Home·MyOrbit 임시 사용, #8·#17에서 제거)
- [x] `navigation/`(RootNavigator, MainTabs), `context/AuthContext`, `theme/`, `services/storage.js` 생성 — 탭 이름 Home / Lounge / Chat / MyOrbit
- [x] frontend API: `/clubs` → `/lounges`, `getClub*` → `getLounge*`
- [x] backend: `routes/clubs.js` → `routes/lounges.js` (`/api/lounges`), `public.js`의 `/clubs` → `/lounges`, 응답 키 `popularClubs`→`popularLounges`, 채팅 목록 `clubs`→`lounges`, `club_name`→`lounge_name` (DB 테이블명은 #3)
- [x] backend: 빈 라우터 `routes/guest.js`(#5), `routes/questions.js`(#15) 생성·마운트
- [x] backend: `socket/index.js`, `seeds/`, `redis.js`(연결은 #5), middleware 분리 — `optionalAuth`(기존 동작), `memberAuth`, `guestAuth`(501, #5), `rateLimit`(통과, #16), `profanityFilter`
- [x] `jobs/cleanupGuests.js` → `jobs/guestExpiry.js`, 스크립트 `npm run guest:expiry`
- [x] (추가) `app.json`의 미설치 `expo-router` 플러그인 제거 — 기존에 앱 빌드가 실패하던 원인
- [x] (추가) 깨진 1×1 아이콘·스플래시 PNG를 임시 Orbit 아이콘으로 교체, 미사용 카메라·사진 권한 문구 제거
- [x] 확인: backend 전체 `node --check` + `server.js` 모듈 로드 / frontend `npx expo export --platform web` 성공

**완료 기준:** `npm run dev`(backend), `npx expo start`(frontend)가 에러 없이 실행된다.
> DB 연결이 필요한 실제 서버 실행·앱 화면 이동은 로컬(Mac)에서 확인 필요

## #3 [REFACTOR] 스키마 재설계
**목표:** Orbit 설계에 맞는 새 스키마 + 시드를 만들고, **기존 라우트 SQL도 새 스키마로 수정**해 앱이 계속 동작하게 한다.
**결정:** PG에는 회원만 저장(Guest는 Redis), 예외로 `reports`만 `*_guest_id` 컬럼 — [database.md §1](./database.md)

### 스키마
- [x] `001_init.sql` 새로 작성, `002_guest_and_images.sql` 제거
- [x] 16개 테이블: avatars, users, taste_categories, taste_tags, user_tastes(weight 1~3), lounges, lounge_tags, lounge_members, chat_rooms, chat_members, messages, match_history, questions, question_answers, reports, blocks
- [x] CHECK·UNIQUE·부분 인덱스 (자기 자신 차단·매칭 금지, 같은 두 사람 pending 1개, 메시지 1~1000자 등)
- [x] [database.md](./database.md) 확정 + ERD(mermaid)

### 마이그레이션·시드
- [x] `migrations/run.js`: `schema_migrations` 기록 + 파일별 트랜잭션, 적용한 파일은 skip
- [x] `npm run db:reset` (production 거부), `npm run db:setup` (reset+migrate+seed)
- [x] `npm run seed` (`seeds/data.js`): 캐릭터 6 · 카테고리 7 · 태그 62 · 라운지 7(+채팅방) · 질문 30, 재실행 안전

### 기존 쿼리 수정 (동작 유지)
- [x] auth: 새 users 컬럼, `POST /auth/guest`(PG Guest)는 #5 전까지 501
- [x] users: 프로필(avatar), 취향 `tags: [{tagId, weight}]` 트랜잭션 저장
- [x] tastes / public / lounges: `taste_tags`, `lounges`·`lounge_members`, 공통 조회 `services/lounges.js`, 응답에서 user_id 제외
- [x] lounges: 라운지 상세에 `chat_room_id`·`is_member` 추가, 생성은 501(V2), Guest 참여 403(#11에서 Redis)
- [x] chat: `chat_members` 기반 1:1 목록(익명 display_name), 라운지 목록, **방 접근 권한 확인**(`services/chatAccess.js`)
- [x] matching: `match_history`, 가중치 코사인 유사도 + 공통 태그, 수락 시 방+`chat_members` 트랜잭션 생성
- [x] reports: 새 컬럼·사유 목록, 신고·제재를 트랜잭션으로
- [x] socket: 방 접근 확인 후 join/send, 메시지 1~1000자, 새 `messages` 컬럼
- [x] frontend: 취향 저장 형식, 라운지 채팅 진입 시 `chat_room_id` 사용(기존 버그), 라운지 멤버 표시, 자기소개(bio) 제거

### CodeRabbit 리뷰 반영 (PR #20)
- [x] 메시지 REST·소켓에서 `sender_id` 제거 → `is_mine`
- [x] 입력 검증 `utils/validate.js`: chat(roomId·before·limit), lounges(id·category_id), matching, reports·blocks (UUID 소문자 정규화로 자기 신고·차단 우회 차단)
- [x] 취향 저장: null·중복·없는 태그 → 400
- [x] 매칭 요청·수락 시 차단 확인 (`services/blocks.js`)
- [x] 홈: 이미지 없는 태그 카드 표시, 매칭 모달은 `common_tags` 사용 / 라운지: 채팅방 없으면 버튼 비활성화
- [ ] 소켓 Rate Limit → #16으로 이관

### 확인
- [x] 빈 DB에서 `npm run db:setup` 성공, migrate·seed 재실행 안전
- [x] API 시나리오 37개 + 소켓 시나리오 5개 + 리뷰 반영 검사 28개 통과 (가입→취향→라운지 참여→매칭 요청·수락→1:1·라운지 메시지→신고·차단)
- [x] frontend `npx expo export --platform web` 성공

**완료 기준:** 빈 DB에서 migrate + seed가 한 번에 성공하고, 기존 화면이 새 스키마로 동작한다.

## #4 [FEAT] 회원 인증
**선행:** #5 (머지 완료, #5 리뷰 반영분까지 병합)
> 가입·로그인 API, bcrypt, JWT, memberAuth/optionalAuth, `/auth/me`, SecureStore 저장은 #3·#5에서 완료
### Backend
- [x] 가입 검증: 이메일 형식·trim·**소문자 정규화**, 비밀번호 8자~72바이트(bcrypt 한계), 닉네임 2~12자(trim), avatar_id 양의 정수, 비문자열 400
- [x] 로그인 검증: 비문자열·누락 400, 이메일 소문자 정규화
- [x] 중복 확인을 INSERT의 UNIQUE에 맡김 → 동시 가입도 23505 → 409, 없는 캐릭터 23503 → 400
- [x] `GET /api/public/avatars`
### Frontend
- [x] 가입 화면: 캐릭터 선택, 서버와 같은 검증, 가입 후 바로 입장 (`saveMemberSession`: Guest 흔적 정리)
- [x] 회원 토큰 401 `UNAUTHORIZED` → 세션 정리 후 로그인 화면 (Guest 만료와 같은 콜백)
- [x] 앱 시작 시 `/auth/me`로 서버 계정·세션 확인 (DB 초기화 후 남은 토큰 처리)
- [ ] 빈 `context/AuthContext.js` 삭제 (`git rm`) — props로 충분, 필요해지면 #12
### 확인
- [x] `tests/auth.e2e.js` (`npm run test:auth`) 9개 + `test:guest` 8개 통과, 기존 시나리오 회귀 없음(의도 변경 제외), 웹 빌드
- [x] 셀프 리뷰(ponytail-review): Must 0 / Should 1 반영(앱 시작 시 /auth/me) / Nice 1(AuthContext 삭제)
### 하지 않은 것
- 로그인 Rate Limit → #16 / 비밀번호 찾기·이메일 인증 → MVP 밖 / 가입 시 Guest 데이터 이전 → #14

## #5 [FEAT] Guest 세션
**설계:** [system_design.md §3·§4](./system_design.md) · GitHub 이슈 #5 본문
### Backend
- [x] `redis.js`: 서버 시작 시 연결, 미연결이면 `getRedis()`가 throw → Guest 기능만 503
- [x] `services/guestSession.js`: 발급(32바이트 토큰, Redis 키는 SHA-256 해시, `PEXPIREAT` 30분) / 조회(**expiresAt 직접 비교**) / 삭제
- [x] `POST /api/guest/session` (닉네임 "형용사 명사 4자리" + 랜덤 캐릭터), `DELETE /api/guest/session`
- [x] `guestAuth` 구현, `memberAuth` 독립(JWT만, Guest 토큰이면 403 `MEMBER_ONLY`), `optionalAuth` = Bearer 우선 → 없으면 Guest
- [x] `GET /api/auth/me` (회원·Guest 공통, Guest는 `expires_at` 포함)
- [x] 예전 PG Guest 제거: `POST /auth/guest`, JWT `isGuest` 거부(HTTP·소켓 공통 `verifyMemberToken`)
- [x] Guest 허용 범위: 라운지 읽기·취향 카테고리·공개 API·`/auth/me` / users·chat은 `memberAuth`로 이동, 라운지 참여·나가기 403
### Frontend
- [x] `services/storage.js`: 네이티브 SecureStore / 웹 localStorage(`shortcut:`), `clearSession()`
- [x] `api.js`: `X-Guest-Token` 헤더, `GUEST_EXPIRED` → 세션 정리 후 로그인 화면, `err.code` 전달
- [x] 회원 JWT도 SecureStore로 이동 (Login·App·socket·MyOrbit 로그아웃)
- [x] 로그인 "둘러보기" → `GuestEntry`(캐릭터·닉네임·종료 시각) → "둘러보기 시작"
- [x] 앱 재시작 시 Guest 만료 시각 확인, 지났으면 세션 정리
### 확인
- [x] Guest 시나리오 24개 (발급, 해시 저장, TTL, 허용/차단 범위, 위조·만료·삭제 토큰, TTL 남아도 expiresAt 지나면 401, 옛 Guest JWT 거부)
- [x] Redis 중단 시 Guest 503·회원/공개 API 정상, 기존 API·소켓·리뷰 시나리오 회귀 없음, 웹 빌드 성공
- [x] 저장소 테스트 `src/backend/tests/guest.e2e.js` (`npm run test:guest`, 서버·Redis 실행 필요) — 8개
- [x] 셀프 리뷰(ponytail-review): Must 0 / Should 2 반영(발급 시 Redis multi, 테스트 추가) / Nice 1 반영(Redis 로그 정리)
### 하지 않은 것
- 소켓 Guest 연결·Guest 채팅 → #10 / 만료 카운트다운·`guest:expired`·`guest:id` 역조회 → #12 / 가입 시 이전 → #14 / 발급 Rate Limit → #16

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
- [ ] Guest 라운지 참여는 Redis(TTL)로만 관리, `lounge_members`(PG)에는 회원만 기록 — PR #19 CodeRabbit 지적
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
- [ ] 수락 시 1:1 방 생성 (회원끼리는 PG, Guest가 끼면 Redis 임시방)
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
- [ ] `rateLimit` (Redis, 메시지 초당 2회 / 동일 메시지 3회 연속 차단) — **HTTP + 소켓 `send_message` 둘 다** (PR #20 CodeRabbit 지적), 방 조회·DB 작업 전에 적용
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
