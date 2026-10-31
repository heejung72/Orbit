# 배포 가이드

## 로컬 개발

```bash
# 백엔드 + DB + Redis
docker compose up -d postgres redis
cd src/backend && npm install && npm run migrate && npm run dev

# 프론트엔드
cd src/frontend && npm install && npm start
```

## iOS 빌드

### 사전 준비
1. Apple Developer 계정 등록
2. EAS CLI 설치: `npm install -g eas-cli`
3. EAS 로그인: `eas login`
4. `eas.json`에서 appleId, ascAppId, appleTeamId 설정
5. `app.json`에서 `extra.eas.projectId` 설정

### 빌드
```bash
cd src/frontend

# 개발 빌드 (시뮬레이터)
npm run build:ios:dev

# 프리뷰 빌드 (실기기 테스트)
npm run build:ios:preview

# 프로덕션 빌드
npm run build:ios:prod
```

### App Store 제출
```bash
npm run submit:ios
```

## 웹 배포

### Expo 웹 빌드
```bash
cd src/frontend
npm run build:web
```
빌드 결과물: `dist/` 디렉토리

### 정적 호스팅 배포 (Vercel / Netlify / Cloudflare Pages)
```bash
# Vercel
npx vercel dist/

# Netlify
npx netlify deploy --dir=dist --prod
```

## 백엔드 배포

### Docker
```bash
docker compose up -d
```

### 마이그레이션
```bash
cd src/backend && npm run migrate
```

### 게스트 정리 크론
서버에서 매시간 실행:
```cron
0 * * * * cd /app && node jobs/cleanupGuests.js
```

## 환경 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| DATABASE_URL | PostgreSQL 접속 URL | postgresql://user:pass@host:5432/orbit |
| REDIS_URL | Redis 접속 URL | redis://host:6379 |
| JWT_SECRET | JWT 서명 키 (반드시 변경) | 랜덤 64자 문자열 |
| JWT_EXPIRES_IN | 토큰 만료 기간 | 7d |
| PORT | 서버 포트 | 3000 |
