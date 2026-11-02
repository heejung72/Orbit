# Orbit 디자인 가이드

> 레퍼런스: `docs/reference/main.png` — **검은 우주 + 보라 네온 궤도 링 + 링 위를 도는 점 + 아래에서 떠오르는 빛나는 보라 행성**
> 토큰 원본: [`src/frontend/theme/index.js`](../src/frontend/theme/index.js)

## 1. 원칙
1. 배경은 거의 검정(`#05030D`), 색은 **보라 한 계열**만 쓴다. 강조가 필요하면 밝기(primaryLight)로 구분한다.
2. **이모지를 쓰지 않는다.** 캐릭터·행성은 PNG 이미지, 아이콘은 SVG 선 아이콘(`components/Space/Icon`).
3. 빛(glow)은 "선택됨·주요 행동"에만 쓴다 — 주 버튼, 선택한 탭, 선택한 캐릭터, 포커스된 입력창.
4. 움직임은 느리고 부드럽게. 반복 애니메이션은 별 반짝임·궤도 회전·떠 있기 정도로 제한한다.

## 2. 색 토큰
| 토큰 | 값 | 용도 |
|---|---|---|
| `background` | `#05030D` | 우주 배경 |
| `surface` | `rgba(139,92,246,0.08)` | 유리 카드 |
| `surfaceSolid` | `#120C24` | 입력창·모달·탭바 |
| `border` | `rgba(167,139,250,0.24)` | 카드·입력 테두리 |
| `primary` | `#8B5CF6` | 궤도 링, 주 버튼 |
| `primaryLight` | `#A78BFA` | 궤도 위 점, 강조 텍스트 |
| `glow` | `#C084FC` | 행성 빛, 로고 빛 |
| `text` / `textMuted` | `#F5F3FF` / `#9C95B8` | 본문 / 보조 |
| `danger` / `warning` | `#FB7185` / `#FBBF24` | 오류 / Guest 안내 |

## 3. 컴포넌트 (`components/Space`)
| 이름 | 역할 |
|---|---|
| `SpaceScreen` | 우주 배경 + `StarField` 위에 화면을 올림 |
| `StarField` | 고정 시드 별 42개, 3그룹이 박자를 나눠 반짝임 |
| `OrbitRings` | 동심원 궤도(SVG) + 궤도 위를 도는 점, 안쪽일수록 빠름. `children` = 가운데 행성 |
| `SpaceButton` | `primary` / `outline` / `ghost`, 누르면 0.96배로 줄었다 튕김 |
| `SpaceInput` | 포커스 시 테두리가 빛남 |
| `Icon` | SVG 선 아이콘: home, lounge, chat, orbit, check + 카테고리 7종 |
| `CategoryBadge` | 카테고리 아이콘 원형 배지 (`code` 또는 `categoryId`) |
| `FadeUp` / `Floating` | 진입 시 아래에서 떠오름 / 위아래로 떠 있음 |

`components/Avatar`: 캐릭터 이미지 6종 (`assets/avatars/*.png`, id 1~6 = seeds 순서)

## 4. 인터랙션
| 어디 | 무엇 |
|---|---|
| 모든 Space 화면 | 별 반짝임 |
| Welcome | 화면 아래에서 떠오르는 행성 + 회전하는 궤도 점, 제목·버튼 순차 등장 |
| GuestEntry | 내 캐릭터 주위 궤도 회전, 캐릭터 떠 있기 |
| Register | 캐릭터 선택 시 커지며 빛남 |
| 하단 탭 | 떠 있는 알약 모양 바, 선택 탭이 빛나는 원으로 통통 튐 |
| 버튼·입력 | 누름 축소, 포커스 빛 |

## 5. 이미지 에셋
- `assets/avatars/{comet,moon,planet,star,alien,rocket}.png` (256px), `assets/planet-hero.png` (720px)
- 앱 아이콘·스플래시·파비콘도 같은 스타일 (검정 + 보라 궤도 + 행성)
- 모두 직접 생성한 이미지 (외부 이미지 사용 안 함)

## 6. 남은 것
- Home·Lounge·Chat·MyOrbit·TasteSelect는 **색만 토큰으로 교체**한 상태 → 레이아웃은 각 기능 이슈(#8·#11·#10·#17·#7)에서 이 가이드대로 다시 만든다
- DB의 `avatars.emoji`, `taste_categories.icon`, `lounges.icon` 컬럼은 남아 있지만 화면에서는 쓰지 않는다 (정리는 스키마 변경이 필요할 때)
