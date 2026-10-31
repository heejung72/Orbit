require('dotenv').config();
const { pool } = require('../db');

// 개발용 DB 초기화: public 스키마를 통째로 지우고 다시 만듭니다.
// 사용: npm run db:reset && npm run migrate && npm run seed
async function reset() {
  if (process.env.NODE_ENV === 'production') {
    console.error('production 환경에서는 db:reset을 실행할 수 없습니다.');
    process.exit(1);
  }
  // .env가 원격 DB를 가리키면 실수로 지우지 않도록, 로컬이 아니면 명시적 플래그 필요
  let host = '';
  try {
    const url = new URL(process.env.DATABASE_URL);
    host = url.searchParams.get('host') || url.hostname;
  } catch {
    /* 파싱 실패 → 로컬로 보지 않음 */
  }
  const isLocal = ['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(host) || host.startsWith('/');
  if (!isLocal && process.env.ALLOW_DB_RESET !== '1') {
    console.error(`로컬이 아닌 DB(${host || '알 수 없음'})입니다. 정말 초기화하려면 ALLOW_DB_RESET=1을 지정하세요.`);
    process.exit(1);
  }
  try {
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    console.log('Database reset: public schema recreated');
  } catch (err) {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

reset();
