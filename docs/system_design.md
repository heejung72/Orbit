# 시스템 설계: Orbit

## 1. 기술 스택
- **Frontend**: React Native (iOS/Android)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **실시간 통신**: Socket.io
- **캐시/매칭 큐**: Redis
- **인증**: JWT

## 2. 아키텍처

```
┌─────────────┐     ┌──────────────────────────────────────┐
│ React Native │────▶│           Node.js + Express           │
│   Mobile App │◀────│                                      │
└─────────────┘     │  ┌─────────┐  ┌──────────┐          │
       │            │  │  REST   │  │ Socket.io│          │
       │            │  │  API    │  │ (채팅)   │          │
       ▲            │  └────┬────┘  └────┬─────┘          │
       │            └───────┼────────────┼─────────────────┘
   Socket.io                │            │
                    ┌───────▼────────────▼──┐
                    │      PostgreSQL        │
                    │  - users              │
                    │  - tastes             │
                    │  - matches            │
                    │  - messages           │
                    │  - clubs              │
                    │  - reports            │
                    └───────────────────────┘
                    ┌───────────────────────┐
                    │        Redis          │
                    │  - 매칭 큐            │
                    │  - 온라인 상태         │
                    │  - 세션 캐시           │
                    └───────────────────────┘
```

## 3. DB 스키마

### users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | |
| email | VARCHAR UNIQUE (nullable) | 게스트는 null |
| password_hash | VARCHAR (nullable) | 게스트는 null |
| nickname | VARCHAR | 게스트: 자동 부여 (예: 궤도여행자#3847) |
| bio | TEXT | 자기소개 |
| profile_image | VARCHAR | |
| is_guest | BOOLEAN DEFAULT false | 비로그인 게스트 여부 |
| guest_expires_at | TIMESTAMP (nullable) | 게스트 세션 만료 시각 |
| status | ENUM | active/warned/suspended/banned |
| report_count | INT | 누적 신고 수 |
| created_at | TIMESTAMP | |

### taste_categories
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL (PK) | |
| name | VARCHAR | 음악, 영화, 운동 등 |

### taste_options
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL (PK) | |
| category_id | FK → taste_categories | |
| name | VARCHAR | 팝, 힙합, 액션 등 |
| image_url | VARCHAR | 취향 옵션 대표 사진 이미지 URL |

### user_tastes
| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | FK → users | |
| taste_option_id | FK → taste_options | |

### matches
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | |
| user1_id | FK → users | 요청자 |
| user2_id | FK → users | 수신자 |
| similarity_score | FLOAT | 유사도 점수 |
| status | ENUM | pending/accepted/rejected |
| created_at | TIMESTAMP | |

### chat_rooms
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | |
| type | ENUM | direct/club |
| match_id | FK → matches (nullable) | 1:1일 때 |
| club_id | FK → clubs (nullable) | 동호회일 때 |
| created_at | TIMESTAMP | |

### messages
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | |
| chat_room_id | FK → chat_rooms | |
| sender_id | FK → users (nullable) | 게스트는 guest_session_id로 식별 |
| guest_session_id | VARCHAR (nullable) | 비로그인 게스트 발신자 식별용 |
| content | TEXT | |
| type | ENUM | text/image |
| created_at | TIMESTAMP | |

### clubs (동호회)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | |
| name | VARCHAR | |
| description | TEXT | |
| category_id | FK → taste_categories | |
| owner_id | FK → users | |
| max_members | INT | |
| created_at | TIMESTAMP | |

### club_members
| 컬럼 | 타입 | 설명 |
|------|------|------|
| club_id | FK → clubs | |
| user_id | FK → users | |
| role | ENUM | owner/admin/member |
| joined_at | TIMESTAMP | |

### reports (신고)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | |
| reporter_id | FK → users | |
| reported_id | FK → users | |
| reason | ENUM | harassment/spam/inappropriate/other |
| description | TEXT | |
| status | ENUM | pending/resolved |
| created_at | TIMESTAMP | |

### blocks (차단)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| blocker_id | FK → users | |
| blocked_id | FK → users | |
| created_at | TIMESTAMP | |

## 4. API 설계

### 인증
- POST /api/auth/register — 회원가입
- POST /api/auth/login — 로그인
- POST /api/auth/guest — 게스트 세션 생성 (임시 닉네임 + 세션 토큰 발급)

### 비로그인 접근 (공개 API)
- GET /api/public/home — 홈 화면 (인기 취향, 추천 동호회 등)
- GET /api/public/clubs — 동호회 목록 열람
- GET /api/public/clubs/:id — 동호회 상세 열람

### 프로필
- GET /api/users/me — 내 프로필
- PUT /api/users/me — 프로필 수정
- PUT /api/users/me/tastes — 취향 업데이트

### 매칭
- POST /api/matching/find — 매칭 요청 (유사도 기반)
- POST /api/matching/:id/accept — 매칭 수락
- POST /api/matching/:id/reject — 매칭 거절

### 채팅
- GET /api/chat/rooms — 내 채팅방 목록
- GET /api/chat/rooms/:id/messages — 메시지 조회
- Socket: message:send — 메시지 전송
- Socket: message:receive — 메시지 수신

### 동호회
- POST /api/clubs — 동호회 생성
- GET /api/clubs — 동호회 목록 (카테고리 필터)
- GET /api/clubs/:id — 동호회 상세
- POST /api/clubs/:id/join — 가입
- DELETE /api/clubs/:id/leave — 탈퇴

### 신고/차단
- POST /api/reports — 신고
- POST /api/blocks — 차단
- DELETE /api/blocks/:userId — 차단 해제

## 5. 게스트(비로그인) 정책
- 게스트 세션은 앱 종료 또는 24시간 경과 시 자동 만료
- 만료된 게스트의 메시지·프로필은 배치 작업으로 삭제 (CRON)
- 게스트는 채팅 참여만 가능 (매칭 요청, 동호회 생성, 신고 불가)
- 채팅방 내 "게스트" 뱃지 표시
- Redis에 게스트 세션 TTL 관리

## 6. 취향 시각화
- taste_options 테이블에 image_url 필드로 각 취향 옵션별 대표 사진 저장
- 프론트엔드에서 취향 유사도를 레이더 차트(오각형)로 렌더링
- 매칭 상대와의 취향 겹침을 벤다이어그램으로 시각화
- 홈 화면 "오늘의 매칭" 카드에 취향 사진 이미지 + 유사도 % 표시

## 7. 매칭 알고리즘
1. 유저의 취향을 벡터로 변환 (원-핫 인코딩)
2. 코사인 유사도 계산
3. 유사도 높은 순으로 후보 정렬
4. 이미 매칭/차단된 유저 제외
5. 상위 후보를 매칭 제안
