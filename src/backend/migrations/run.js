require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runMigrations() {
  const migrationFiles = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort();

  try {
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await pool.query(sql);
      console.log(`Migration applied: ${file}`);
    }
    console.log('All migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

runMigrations();
