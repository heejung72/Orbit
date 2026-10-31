// 만료된 Guest 정리 (보조 스케줄러)
// #3에서 PostgreSQL의 Guest 컬럼을 제거해 이전 정리 로직(users.is_guest 삭제)은 더 이상 필요 없습니다.
// 구현(#12): 30초 주기로 타이머에서 누락된 Guest 소켓·Redis 키 정리 — docs/system_design.md §4
console.log('guestExpiry: #12에서 Redis 기반으로 구현 예정 (현재 정리할 데이터 없음)');
