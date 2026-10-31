require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

// 마이그레이션 실행기
// - schema_migrations 테이블에 적용 기록을 남기고, 이미 적용한 파일은 건너뜁니다.
// - 파일마다 트랜잭션으로 실행해서 중간에 실패하면 그 파일 전체를 되돌립니다.
async function runMigrations() {
  const client = await pool.connect();
  let failed = false;
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
    );

    const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip     ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`applied  ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${file}: ${err.message}`);
      }
    }
    console.log('Migrations complete');
  } catch (err) {
    failed = true;
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
    if (failed) process.exit(1);
  }
}

runMigrations();
