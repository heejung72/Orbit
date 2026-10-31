# CLAUDE.md — Orbit 작업 지침

Orbit은 취향 기반 익명 소셜 채팅·커뮤니티 앱이다. **1인 개발** 프로젝트이며, Claude가 이슈 단위로 브랜치·커밋·PR까지 진행한다.

## 작업 시작 전 반드시 읽을 것
1. `docs/progress.md` — 현재 이슈, 다음 할 일, 결정 로그, 미결정 사항
2. `docs/tasks.md` — 해당 이슈의 브랜치명, 체크리스트, 완료 기준
3. 필요 시 `docs/prd.md`(기획), `docs/system_design.md`(설계), `docs/api_spec.md`, `docs/database.md`

## Git 워크플로 (CONTRIBUTING.md 요약)
- 이슈 1개 = 브랜치 1개 = PR 1개. 이슈 범위 밖 작업은 하지 말고 새 이슈를 제안한다.
- 시작: `git checkout main && git pull && git checkout -b <tasks.md에 적힌 브랜치명>`
- 브랜치: `type/#번호-설명` (소문자) — 예: `feat/#5-guest-session`
- 커밋: `[TYPE] #번호 요약` — 예: `[FEAT] #5 Guest 세션 발급 API 추가`
  - TYPE: FEAT, FIX, REFACTOR, DOCS, STYLE, TEST, CHORE
  - 의미 있는 단위로 나눠 여러 번 커밋한다. 한 커밋 = 한 가지 변경.
- PR: `gh pr create --base main --title "[TYPE] #번호 이슈 제목" --body-file <파일>`
  - 본문은 `.github/pull_request_template.md` 양식, 반드시 `Closes #번호`
- **머지는 하지 않는다.** 사용자가 CodeRabbit 리뷰 확인 후 직접 Squash and merge 한다.
- 머지 안내 시: CodeRabbit 체크가 ✅가 될 때까지 기다리라고 알린다 (push 직후 머지하면 리뷰 취소 → ❌). 리뷰 반영 커밋은 모아서 한 번에 push (무료 플랜 시간당 10회).
- CodeRabbit 리뷰를 반영해 달라고 하면 `gh pr view <번호> --comments`로 확인 후 수정 커밋을 push 한다. 커밋 타입은 이슈 타입과 상관없이 **`[FIX] #번호 CodeRabbit 리뷰 반영`**. 오탐은 수정하지 말고 답글 문구를 사용자에게 제안한다.
- `main`에 직접 commit/push 하지 않는다. `git push --force`, `git reset --hard`는 사용자 확인 없이 쓰지 않는다.

## 이슈를 시작할 때
- 직전 이슈가 머지됐다면 첫 커밋으로 `docs/progress.md`·`docs/tasks.md`에 완료 반영 (✅, 완료 표에 PR 번호·머지일, "지금 상태"를 새 이슈로) — 커밋 `[DOCS] #번호 progress.md 갱신 (#이전 완료 반영)`
- PR은 `--body` 대신 템플릿을 채운 파일로 `--body-file` 사용

## PR 올리기 전 셀프 리뷰 (필수)
push·PR 전에 **ponytail-review** 기준으로 이번 변경(`git diff main...HEAD` + 작업 중 변경)을 직접 리뷰하고, Must fix·Should fix는 고친 뒤 올린다.
- 순서: 정확성 → 보안·데이터 → 동시 사용 → 테스트 → 속도 → 군더더기(lean)
- 이 프로젝트에서 반복된 지적은 꼭 확인:
  - 라우트 입구 입력 검증: UUID(`toUuid`), 숫자(`toId`/`toPositiveInt`), 날짜(`toIsoDate`) → 잘못된 값은 400/404, 500 금지
  - 응답·소켓 payload에 실제 user_id·email 노출 금지 (`is_mine`, `display_name`만)
  - 차단 관계 양방향 확인 (매칭 요청·수락, 1:1 방, 라운지 메시지)
  - 경계값: 빈 값, null 요소, 중복, 음수, 없는 날짜, 대소문자 UUID
  - 여러 테이블 쓰기는 트랜잭션, FK 위반(23503)은 4xx로
  - 같은 회원의 여러 기기·소켓
  - 색상·폰트는 `theme/` 토큰
- 결과는 PR 본문 "메모"에 한 줄로 요약: `셀프 리뷰: Must 0 / Should n(반영) / 남긴 것: …`

## 이슈를 마칠 때
- `docs/tasks.md` 해당 이슈 체크리스트 체크 + 상태 표 갱신(🟨 PR 리뷰)
- `docs/progress.md`의 "지금 상태", 결정 로그, 미결정 사항 갱신 (같은 PR에 포함)
- 기획·설계가 바뀌었다면 prd / system_design / api_spec / database도 갱신

## 코드 작성 방식: ponytail (항상 적용)
출처: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT), 레벨 **full**

- **가장 작은 완전한 변경.** 아래에서 처음으로 되는 것을 고른다:
  1. 꼭 필요한가? 요청 안 한 기능·옵션·"나중을 위한" 코드는 만들지 말고 한 줄로 언급만
  2. 이 코드베이스에 이미 있나? (예: `utils/validate.js`, `services/*`, `theme/`) 있으면 주변 코드처럼 사용
  3. 표준 라이브러리·플랫폼 기능 → 4. 이미 설치된 의존성 (몇 줄을 위해 새 의존성 추가 금지)
  5. 한눈에 읽히는 한 줄 → 6. 그 외엔 동작하는 최소 코드
- **해결책엔 게으르게, 변경 자체엔 성실하게:** 바뀌는 호출부·테스트·fixture·문서까지 끝낸다. 버그는 호출부를 모두 grep한 뒤 공통 코드에서 원인을 한 번에 고친다.
- 요청 없는 추상화·래퍼·설정·보일러플레이트 금지. 삭제가 추가보다 낫다. 기존 구조·레이어·컨벤션 유지.
- 주석은 코드가 보여주지 못하는 "왜"만 한 줄로. 알려진 한계가 있는 지름길은 `// shortcut: <한계>, <언제 바꿀지>`.
- 새 비자명 로직(분기·루프·파서·보안·데이터 쓰기)은 작은 테스트나 assert 셀프체크를 하나 남긴다.
- **절대 줄이지 않는 것:** 신뢰 경계의 입력 검증, 데이터 손실을 막는 에러 처리, 보안, 접근성, 사용자가 요청한 것.
- 답변 끝에 한두 줄: 건너뛴 것·확인하지 못한 것, 사용자가 알아야 할 위험.

## 코드 규칙 (핵심)
- Guest 데이터는 **Redis에만** 저장(TTL). PostgreSQL·로그에 Guest 메시지 본문을 남기지 않는다. 예외: 신고 시 `reports` 스냅샷.
- Guest 세션은 **30분 절대 시간제**. 연장 금지. 만료는 서버가 매 요청·소켓 이벤트마다 `expiresAt`으로 검증한다.
- 인증은 `memberAuth` / `guestAuth` / `optionalAuth` + `req.actor = {type, id}`로 통일.
- 클라이언트에는 실제 user_id·이메일을 노출하지 않는다. 채팅에서는 `display_name`, `avatar_id`만.
- SQL은 파라미터 바인딩만. 비밀값은 `.env`에서만. `.env`는 커밋 금지.
- 토큰은 `services/storage.js`로만 저장: iOS·Android는 Expo SecureStore, Web은 localStorage(`Platform.OS` 분기). 웹 회원 로그인을 정식 지원할 때 HttpOnly 쿠키 전환 검토. 색상·폰트는 `theme/` 토큰 사용.

## 실행
- backend: `cd src/backend && npm run dev` (PostgreSQL·Redis: `docker compose up -d postgres redis`)
- frontend: `cd src/frontend && npx expo start`
- 테스트: `cd src/backend && npm run test:guest` (서버·Redis 실행 중이어야 함)
- 작업 후 최소한 서버/앱이 에러 없이 뜨는지 확인하고 PR 본문 "동작 확인"에 적는다.
