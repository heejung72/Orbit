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

    // #3 이전(TasteMate) 스키마가 남아 있으면 001을 다시 만들다 실패하므로 안내 후 중단
    // shortcut: 출시 전이라 데이터 변환 마이그레이션 없이 초기화로 대응, 운영 DB가 생기면 변환 파일 추가
    const legacy = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'taste_options'`
    );
    if (legacy.rows.length > 0) {
      throw new Error('이전(TasteMate) 스키마가 있는 DB입니다. 개발 DB라면 `npm run db:setup`으로 초기화하세요.');
    }

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
