const { getRedis } = require('../redis');

// 온라인 상태 (#13) — Redis Hash online:actors (actorKey → 연결된 소켓 수)
// 소켓 연결 +1, 끊김 -1, 0이 되면 삭제. 서버 시작 시 비운다 (단일 서버 MVP, 여러 인스턴스는 V2)
// 서버 시작 직후 Redis 연결 전에 들어온 소켓은 비우기(resetOnline)가 끝난 뒤에 반영한다
// shortcut: Redis 없이 시작했다가 나중에 붙으면 서버 재시작 전까지 온라인 기록이 안 된다, 여러 인스턴스(V2) 때 재설계

const KEY = 'online:actors';
// 감소와 0 이하 삭제를 한 번에 (사이에 다른 기기의 +1이 끼면 그 연결이 지워지는 문제 방지)
const DECR = `local n = redis.call('HINCRBY', KEYS[1], ARGV[1], -1)
if n <= 0 then redis.call('HDEL', KEYS[1], ARGV[1]) end
return n`;

let markReady;
const ready = new Promise((resolve) => {
  markReady = resolve;
});

async function resetOnline() {
  await getRedis().del(KEY);
  markReady();
}

async function markOnline(key) {
  await ready;
  await getRedis().hIncrBy(KEY, key, 1);
}

async function markOffline(key) {
  await ready;
  await getRedis().eval(DECR, { keys: [KEY], arguments: [key] });
}

const onlineKeys = async () => Object.keys(await getRedis().hGetAll(KEY));
const isOnline = async (key) => Number(await getRedis().hExists(KEY, key)) === 1; // 버전에 따라 boolean 또는 0/1

module.exports = { resetOnline, markOnline, markOffline, onlineKeys, isOnline };
