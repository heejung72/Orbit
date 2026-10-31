# Orbit 작업 규칙

## 1. 기본 흐름

```
이슈 생성 → 브랜치 생성 → 작업·커밋 → push → PR (Closes #번호) → 머지 → progress.md 갱신
```

**이슈 1개 = 브랜치 1개 = PR 1개.** 이슈 범위를 벗어나는 작업은 새 이슈로 분리합니다.

### 1인 개발 운영 방식
Orbit은 **혼자 개발**합니다. 그래도 이슈·브랜치·PR을 쓰는 이유는 작업 기록과 이어서 하기 위해서입니다.

- 리뷰어 승인 없이 **본인이 직접 머지**합니다.
- 사람 리뷰 대신 **CodeRabbit 자동 리뷰**(`.coderabbit.yaml`)를 받고, 지적 사항을 확인한 뒤 머지합니다.
  - 반영할 지적: `[FIX] #번호 CodeRabbit 리뷰 반영` 커밋 후 push → 다시 리뷰받기
  - 반영하지 않을 지적: 코멘트에 이유를 한 줄 남기고 resolve
- 머지 전 셀프 체크는 PR 템플릿 체크리스트로 대신합니다.
- 작은 오타 수정도 `main`에 직접 push하지 않고 브랜치 → PR을 거칩니다 (기록 유지).

## 2. 브랜치

### 이름 규칙
```
타입/#이슈번호-짧은-설명
```
| 타입 | 용도 | 예시 |
|---|---|---|
| `feat` | 새 기능 (`[FEAT]`) | `feat/#5-guest-session` |
| `fix` | 버그 수정 (`[FIX]`) | `fix/#21-timer-reset` |
| `refactor` | 동작 변경 없는 구조 개선 (`[REFACTOR]`) | `refactor/#2-directory-structure` |
| `docs` | 문서 (`[DOCS]`) | `docs/#1-project-setup` |
| `chore` | 설정, 빌드, 의존성 (`[CHORE]`) | `chore/#30-eslint` |
| `test` | 테스트 (`[TEST]`) | `test/#40-matching` |

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
[TYPE] #이슈번호 요약

(선택) 본문 — 무엇을, 왜
```
**타입은 대괄호 + 대문자**로 씁니다. (`docs:` ❌ → `[DOCS]` ✅)

| 타입 | 의미 |
|---|---|
| `[FEAT]` | 기능 추가 |
| `[FIX]` | 버그 수정, **CodeRabbit 리뷰 반영** |
| `[REFACTOR]` | 리팩터링 (동작 변경 없음) |
| `[DOCS]` | 문서 |
| `[STYLE]` | 포맷, 세미콜론 등 (로직 변경 없음) |
| `[TEST]` | 테스트 |
| `[CHORE]` | 설정, 패키지, 빌드 |

예시:
```
[FEAT] #5 Guest 세션 발급 API 추가
[FIX] #12 백그라운드 복귀 시 타이머 오차 수정
[DOCS] #1 기획·설계 문서 및 협업 규칙 정리
[REFACTOR] #2 screens 폴더 구조 변경
[FIX] #1 CodeRabbit 리뷰 반영
```
> **CodeRabbit 리뷰 반영 커밋은 이슈 타입과 상관없이 항상 `[FIX]`** 를 씁니다. (예: DOCS 이슈여도 `[FIX] #1 CodeRabbit 리뷰 반영`)
```bash
git commit -m "[FEAT] #5 Guest 세션 발급 API 추가"
```
- 요약은 한국어 OK, 50자 이내, 마침표 없음
- 한 커밋에는 한 가지 변경

## 4. Pull Request

- 제목: **`[TYPE] #번호 이슈 제목`** — 예: `[FEAT] #5 Guest 세션`, `[DOCS] #1 프로젝트 재정비`
- 본문에 **`Closes #번호`** 포함 → 머지 시 이슈 자동 종료
- `.github/pull_request_template.md` 양식 사용
- base 브랜치는 `main`
- 머지 방식: **Squash and merge** 권장 (squash 커밋 제목도 `[TYPE] #번호 ...` 형식 유지)

```bash
git push -u origin feat/#5-guest-session

# 템플릿을 복사해서 Closes #5, 변경 사항, 체크리스트를 채운 뒤 --body-file로 전달
cp .github/pull_request_template.md /tmp/pr-body.md
# (편집기로 /tmp/pr-body.md 작성)
gh pr create --base main --title "[FEAT] #5 Guest 세션" --body-file /tmp/pr-body.md
```
> `--body "..."`를 쓰면 템플릿이 무시되므로 사용하지 않습니다. 웹에서 PR을 만들면 템플릿이 자동으로 채워집니다.

## 4-1. 이슈 제목
- 같은 형식: **`[TYPE] 제목`** — 예: `[FEAT] Guest 세션`, `[REFACTOR] 스키마 재설계`
- 이슈 템플릿을 쓰면 제목 앞부분이 자동으로 채워짐

## 4-2. 한눈에 정리
| 대상 | 형식 | 예시 |
|---|---|---|
| 이슈 제목 | `[TYPE] 제목` | `[FEAT] Guest 세션` |
| 브랜치 | `type/#번호-설명` (소문자) | `feat/#5-guest-session` |
| 커밋 | `[TYPE] #번호 요약` | `[FEAT] #5 Guest 세션 발급 API 추가` |
| PR 제목 | `[TYPE] #번호 제목` | `[FEAT] #5 Guest 세션` |

> 브랜치명만 소문자 `type/` 형식을 씁니다. git 브랜치 이름에 대괄호를 쓰면 터미널에서 따옴표가 필요해 불편하기 때문입니다.

## 4-2-1. PR 올리기 전 셀프 리뷰 (필수)
push·PR 전에 **ponytail-review** 기준으로 변경분을 먼저 리뷰하고, Must fix·Should fix를 고친 뒤 올립니다.
반복해서 나온 지적 목록은 [CLAUDE.md](CLAUDE.md) "PR 올리기 전 셀프 리뷰"에 있습니다.
PR 본문 "메모"에 결과를 한 줄로 남깁니다. (예: `셀프 리뷰: Must 0 / Should 2(반영) / 남긴 것: Rate Limit → #16`)

## 4-3. 머지 전 셀프 리뷰 순서
1. PR의 **Files changed** 탭에서 변경 파일을 한 번 훑기
2. CodeRabbit 리뷰 확인 → 반영 또는 resolve
3. 템플릿 체크리스트 체크
4. **CodeRabbit 체크가 ✅(완료)인지 확인** — 마지막 push 직후 바로 머지하면 리뷰가 취소되어 체크가 ❌(`Cancelled - Pull request is closed`)로 남음
5. **Squash and merge** → 브랜치 삭제
6. 다음 이슈 브랜치의 첫 커밋에서 `progress.md`에 완료 반영 (§5)

> CodeRabbit 무료 플랜은 **시간당 리뷰 10회**. 리뷰 반영 커밋은 모아서 한 번에 push한다.

## 5. 머지 후
```bash
git checkout main
git pull
git branch -d feat/#5-guest-session
```
### progress.md 갱신 규칙
`main` 직접 push는 금지이므로 진행 기록은 다음처럼 PR 안에서 갱신합니다.
- **머지 전 (현재 PR에서):** 해당 이슈 체크리스트 체크, 상태 🟨 PR 리뷰, "지금 상태"를 "PR 리뷰 중"으로, 이번에 내린 결정을 결정 로그에 추가
- **머지 후 (다음 이슈 PR의 첫 커밋에서):** 직전 이슈를 ✅ / "완료한 이슈" 표로 옮기고(PR 번호·머지일), "지금 상태"를 새 이슈로 변경
  - 커밋 예: `[DOCS] #2 progress.md 갱신 (#1 완료 반영)`

## 6. 지켜야 할 것
- `.env`는 절대 커밋하지 않기 (`.env.example`만)
- Guest 메시지 본문을 로그에 남기지 않기 ([system_design.md §4-2](docs/system_design.md))
- 기획이 바뀌면 `docs/prd.md`와 `docs/progress.md`의 결정 로그를 같이 수정
