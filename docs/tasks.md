# 태스크 분해: Orbit

## 플랫폼: iOS (App Store) + Web
## 기술 스택 수정: React Native (iOS) + React (Web) + Node.js + Express + PostgreSQL + Socket.io + Redis

### Phase 1: 백엔드 기반
1. [x] 프로젝트 초기화 (package.json, 디렉토리 구조)
2. [x] DB 스키마 생성 (migration) — 게스트 컬럼 + 이미지 URL 추가
3. [x] 인증 API (회원가입/로그인/JWT/게스트 세션)
4. [x] 취향 API (카테고리/옵션/유저 취향 CRUD + 옵션별 이미지 URL)
5. [x] 비로그인 공개 API (홈 화면, 동호회 목록 열람)
6. [x] 게스트 세션 관리 (만료 데이터 정리 CRON job)
7. [ ] 매칭 API (유사도 계산, 매칭 요청/수락)
8. [ ] 채팅 (Socket.io 실시간 메시지 + 게스트 참여 지원)
9. [ ] 동호회 API (CRUD, 가입/탈퇴, 그룹채팅)
10. [ ] 신고/차단 API
11. [ ] 비속어 필터링 미들웨어

### Phase 2: 프론트엔드 (iOS + Web 공유)
12. [x] 프로젝트 초기화 (React Native + React Native Web)
13. [x] 로그인/회원가입 화면 + 게스트 진입 ("둘러보기" 버튼)
14. [x] 취향 선택 온보딩 화면 (사진 이미지 카드 + 선택 애니메이션)
15. [x] 홈 화면 (비로그인 열람 가능, 오늘의 매칭 카드 슬라이더)
16. [x] 취향 시각화 컴포넌트 (레이더 차트, 벤다이어그램)
17. [x] 1:1 채팅 화면 (게스트 뱃지 표시, 가입 유도 배너)
18. [x] 동호회 목록/상세/생성 화면
19. [x] 그룹 채팅 화면
20. [x] 프로필/설정 화면
21. [x] 신고/차단 UI

### Phase 3: 배포 준비
22. [x] iOS 빌드 설정 (EAS Build, App Store 제출 스크립트)
23. [x] Web 빌드 및 배포 설정 (Expo web export, Docker, 배포 가이드)
