# Orbit 작업 규칙

## 1. 기본 흐름

```
이슈 생성 → 브랜치 생성 → 작업·커밋 → push → PR (Closes #번호) → 머지 → progress.md 갱신
```

**이슈 1개 = 브랜치 1개 = PR 1개.** 이슈 범위를 벗어나는 작업은 새 이슈로 분리합니다.

## 2. 브랜치

### 이름 규칙
```
타입/#이슈번호-짧은-설명
```
| 타입 | 용도 | 예시 |
|---|---|---|
| `feat` | 새 기능 | `feat/#5-guest-session` |
| `fix` | 버그 수정 | `fix/#21-timer-reset` |
| `refactor` | 동작 변경 없는 구조 개선 | `refactor/#2-directory-structure` |
| `docs` | 문서 | `docs/#1-project-setup` |
| `chore` | 설정, 빌드, 의존성 | `chore/#30-eslint` |
| `test` | 테스트 | `test/#40-matching` |

- 설명은 영어 소문자 + 하이픈
- 이슈별 브랜치명은 [docs/tasks.md](docs/tasks.md)에 미리 정해둠

### 명령어
```bash
git checkout main
git pull
git checkout -b feat/#5-guest-session
```

## 3. 커밋 메시지

```
타입: #이슈번호 요약

(선택) 본문 — 무엇을, 왜
```
| 타입 | 의미 |
|---|---|
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 리팩터링 |
| `docs` | 문서 |
| `style` | 포맷, 세미콜론 등 (로직 변경 없음) |
| `test` | 테스트 |
| `chore` | 설정, 패키지 |

예시:
```
feat: #5 Guest 세션 발급 API 추가
fix: #12 백그라운드 복귀 시 타이머 오차 수정
docs: #1 PRD 및 시스템 설계 문서 작성
```
- 요약은 한국어 OK, 50자 이내, 마침표 없음
- 한 커밋에는 한 가지 변경

## 4. Pull Request

- 제목: `[타입] #번호 이슈 제목` — 예: `[Feat] #5 Guest 세션`
- 본문에 **`Closes #번호`** 포함 → 머지 시 이슈 자동 종료
- `.github/pull_request_template.md` 양식 사용
- base 브랜치는 `main`
- 머지 방식: **Squash and merge** 권장 (이슈 단위로 main 기록이 깔끔해짐)

```bash
git push -u origin feat/#5-guest-session
gh pr create --base main --title "[Feat] #5 Guest 세션" --body "Closes #5"
```

## 5. 머지 후
```bash
git checkout main
git pull
git branch -d feat/#5-guest-session
```
그리고 [docs/progress.md](docs/progress.md)의 **지금 상태 / 완료한 이슈 / 결정 로그**를 갱신합니다.

## 6. 지켜야 할 것
- `.env`는 절대 커밋하지 않기 (`.env.example`만)
- Guest 메시지 본문을 로그에 남기지 않기 ([system_design.md §4-2](docs/system_design.md))
- 기획이 바뀌면 `docs/prd.md`와 `docs/progress.md`의 결정 로그를 같이 수정
