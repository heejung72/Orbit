require('dotenv').config();
const { pool } = require('../db');

// 개발용 DB 초기화: public 스키마를 통째로 지우고 다시 만듭니다.
// 사용: npm run db:reset && npm run migrate && npm run seed
async function reset() {
  if (process.env.NODE_ENV === 'production') {
    console.error('production 환경에서는 db:reset을 실행할 수 없습니다.');
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
