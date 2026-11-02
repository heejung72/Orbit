const { createClient } = require('redis');

// Redis 클라이언트 (Guest 세션·임시 데이터, 이후 온라인 상태·Rate Limit)
let client = null;

async function connectRedis() {
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  // 재연결 시도마다 찍히지 않도록 끊길 때·다시 붙을 때 한 번씩만 로그
  let down = false;
  client.on('error', (err) => {
    // 이 오류 객체로 대기 중인 명령이 reject되므로, 연결 오류임을 표시해 라우트가 503·대체 동작을 고를 수 있게 한다
    err.code = 'REDIS_UNAVAILABLE';
    if (!down) console.error('Redis 연결 끊김:', err.message);
    down = true;
  });
  client.on('ready', () => {
    if (down) console.log('Redis 다시 연결됨');
    down = false;
  });
  await client.connect();
  return client;
}

// 연결 전이거나 끊긴 상태면 throw → 라우트에서 503으로 응답
function getRedis() {
  if (!client || !client.isReady) {
    const err = new Error('Redis가 연결되지 않았습니다');
    err.code = 'REDIS_UNAVAILABLE';
    throw err;
  }
  return client;
}

module.exports = { connectRedis, getRedis };
