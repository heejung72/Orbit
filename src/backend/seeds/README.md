# seeds

초기 데이터 입력 스크립트 (#3)

- `data.js` — 데이터 원본: 캐릭터 6 · 취향 카테고리 7 + 태그 · 라운지 7 · 오늘의 질문 30
- `run.js` — 입력 실행. 이름/코드 기준 upsert라 **여러 번 실행해도 안전**합니다.

```bash
npm run seed       # 시드만
npm run db:setup   # DB 초기화 + 마이그레이션 + 시드 (개발용)
```

항목을 추가하려면 `data.js`를 고치고 `npm run seed`를 다시 실행하세요.
