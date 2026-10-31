const { createClient } = require('redis');

// Redis 클라이언트 (Guest 세션·임시 데이터, 온라인 상태, Rate Limit)
// 연결은 #5(Guest 세션)에서 server.js 시작 시 connectRedis()를 호출하도록 연결합니다.
// 지금은 서버 실행에 Redis가 필요하지 않습니다.
let client = null;

async function connectRedis() {
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', (err) => console.error('Redis error:', err.message));
  await client.connect();
  return client;
}

function getRedis() {
  if (!client) throw new Error('Redis가 연결되지 않았습니다. connectRedis()를 먼저 호출하세요.');
  return client;
}

module.exports = { connectRedis, getRedis };
