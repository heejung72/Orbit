const db = require('../db');
const { getRedis } = require('../redis');
const { findGuestSession } = require('../services/guestSession');
const { guestMessagesKey } = require('../services/chat');

// 만료된 Guest 정리 (보조 스케줄러) — docs/system_design.md §4-2, PRD §2-3
// 소켓별 만료 타이머(#11)가 1차로 종료하고, 여기서는 30초마다 나머지를 정리한다 (단일 서버 MVP 기준)
// 1) 연결된 Guest 소켓 중 만료됐거나 세션이 없어진 소켓 종료 (예: 다른 기기에서 둘러보기 종료 후 쉬고 있는 소켓)
// 2) 라운지 참여 Sorted Set에서 만료된 Guest 제거
// 3) 라운지 Guest 메시지 리스트에서 만료된 작성자의 메시지 제거 (회원 메시지는 PG라 영향 없음)
// 세션·취향·참여 목록 키는 세션과 같은 시각의 TTL로 이미 사라진다

const INTERVAL_MS = Number(process.env.GUEST_CLEANUP_INTERVAL_MS) || 30000;

async function cleanupSockets(io) {
  const now = Date.now();
  for (const s of await io.fetchSockets()) {
    const { actor, guestToken } = s.data;
    if (actor?.type !== 'guest') continue;
    if (actor.expiresAt <= now || !(await findGuestSession(guestToken))) {
      s.emit('guest:expired', {});
      s.disconnect(true);
    }
  }
}

async function cleanupRedis() {
  const redis = getRedis();
  const now = Date.now();
  const [lounges, rooms] = await Promise.all([
    db.query('SELECT id FROM lounges'),
    db.query("SELECT id FROM chat_rooms WHERE type = 'lounge'"),
  ]);

  const multi = redis.multi();
  for (const { id } of lounges.rows) multi.zRemRangeByScore(`lounge:${id}:guests`, '-inf', now);

  // 동시에 들어오는 새 메시지를 잃지 않도록 리스트를 다시 쓰지 않고, 만료된 항목만 값으로 지운다(LREM)
  for (const { id } of rooms.rows) {
    const key = guestMessagesKey(id);
    for (const raw of await redis.lRange(key, 0, -1)) {
      if (!(JSON.parse(raw).expiresAt > now)) multi.lRem(key, 0, raw);
    }
  }
  await multi.exec();
}

async function runGuestCleanup(io) {
  try {
    await cleanupSockets(io);
    await cleanupRedis();
  } catch (err) {
    // Redis가 끊겨 있으면 다음 주기에 다시 시도 (redis.js가 끊김 로그를 한 번 남김)
    if (err.code !== 'REDIS_UNAVAILABLE') console.error('Guest 정리 실패:', err.message);
  }
}

// 서버 시작 시 호출. 이전 실행이 끝나기 전에는 다음 실행을 시작하지 않는다
function startGuestCleanup(io) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    await runGuestCleanup(io);
    running = false;
  }, INTERVAL_MS);
  timer.unref();
}

module.exports = { startGuestCleanup, runGuestCleanup };
