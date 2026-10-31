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
- CodeRabbit 리뷰를 반영해 달라고 하면 `gh pr view <번호> --comments`로 확인 후 수정 커밋을 push 한다.
- `main`에 직접 commit/push 하지 않는다. `git push --force`, `git reset --hard`는 사용자 확인 없이 쓰지 않는다.

## 이슈를 시작할 때
- 직전 이슈가 머지됐다면 첫 커밋으로 `docs/progress.md`·`docs/tasks.md`에 완료 반영 (✅, 완료 표에 PR 번호·머지일, "지금 상태"를 새 이슈로) — 커밋 `[DOCS] #번호 progress.md 갱신 (#이전 완료 반영)`
- PR은 `--body` 대신 템플릿을 채운 파일로 `--body-file` 사용

## 이슈를 마칠 때
- `docs/tasks.md` 해당 이슈 체크리스트 체크 + 상태 표 갱신(🟨 PR 리뷰)
- `docs/progress.md`의 "지금 상태", 결정 로그, 미결정 사항 갱신 (같은 PR에 포함)
- 기획·설계가 바뀌었다면 prd / system_design / api_spec / database도 갱신

## 코드 규칙 (핵심)
- Guest 데이터는 **Redis에만** 저장(TTL). PostgreSQL·로그에 Guest 메시지 본문을 남기지 않는다. 예외: 신고 시 `reports` 스냅샷.
- Guest 세션은 **30분 절대 시간제**. 연장 금지. 만료는 서버가 매 요청·소켓 이벤트마다 `expiresAt`으로 검증한다.
- 인증은 `memberAuth` / `guestAuth` / `optionalAuth` + `req.actor = {type, id}`로 통일.
- 클라이언트에는 실제 user_id·이메일을 노출하지 않는다. 채팅에서는 `display_name`, `avatar_id`만.
- SQL은 파라미터 바인딩만. 비밀값은 `.env`에서만. `.env`는 커밋 금지.
- 토큰은 iOS·Android에서 Expo SecureStore에 저장. Web 저장 방식은 #5에서 결정(`Platform.OS` 분기). 색상·폰트는 `theme/` 토큰 사용.

## 실행
- backend: `cd src/backend && npm run dev` (PostgreSQL·Redis: `docker compose up -d postgres redis`)
- frontend: `cd src/frontend && npx expo start`
- 작업 후 최소한 서버/앱이 에러 없이 뜨는지 확인하고 PR 본문 "동작 확인"에 적는다.
