require('dotenv').config();
const db = require('../db');

async function cleanupExpiredGuests() {
  try {
    // 만료된 게스트의 메시지 삭제
    await db.query(`
      DELETE FROM messages WHERE guest_session_id IN (
        SELECT id FROM users WHERE is_guest = true AND guest_expires_at < NOW()
      )
    `);

    // 만료된 게스트 유저 삭제
    const result = await db.query(`
      DELETE FROM users WHERE is_guest = true AND guest_expires_at < NOW()
    `);

    console.log(`Cleaned up ${result.rowCount} expired guest accounts`);
  } catch (err) {
    console.error('Guest cleanup failed:', err.message);
  } finally {
    await db.pool.end();
  }
}

cleanupExpiredGuests();
