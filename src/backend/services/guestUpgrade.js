const db = require('../db');
const { getRedis } = require('../redis');
const { guestTastesKey } = require('./tastes');
const { getProfiles } = require('./actors');
const { guestMessagesKey } = require('./chat');
const { removeGuestData, endGuestToken } = require('./guestSession');
const directRooms = require('./directRooms');

// Guest → 회원 전환 (#14) — docs/system_design.md §4-4
// 1) Redis에서 이전할 데이터를 읽고  2) PG 쓰기는 회원 생성과 한 트랜잭션  3) 커밋 후 Redis 정리(실패해도 TTL로 사라짐)
// 이전: 취향, 라운지 참여, 라운지에 쓴 본인 메시지, 회원과의 1:1 Redis 방(방·메시지 전부 → PG, 같은 roomId)
// 이전 안 함: 다른 Guest의 메시지, Guest끼리 방(Redis에 두고 참여자 키만 회원으로)

const CLAIM_MS = 60 * 1000;
const claimKey = (guestId) => `guest:upgrade:${guestId}`;
const msgCountKey = (guestId) => `guest:msgcount:${guestId}`;

// 같은 Guest 토큰으로 동시에 가입하면 한 요청만 이전한다 (나머지는 409)
async function claimGuest(guestId) {
  return (await getRedis().set(claimKey(guestId), '1', { NX: true, PX: CLAIM_MS })) === 'OK';
}
// async: Redis가 끊겨 getRedis()가 바로 던져도 호출부의 .catch로 가게
const releaseGuest = async (guestId) => getRedis().del(claimKey(guestId));

// 이미 회원으로 옮긴 Guest인지 (PG에 남는 기록이라 Redis 정리가 실패했거나 선점이 만료돼도 두 번 옮기지 않는다)
async function alreadyUpgraded(guestId) {
  return (await db.query('SELECT 1 FROM users WHERE upgraded_from_guest = $1', [guestId])).rowCount > 0;
}

// 트랜잭션 전에 Redis에서 읽어 둔다 (트랜잭션 안에서 Redis를 기다리며 PG 연결을 잡고 있지 않게)
async function collectGuestData(guest) {
  const redis = getRedis();
  const guestKey = `guest:${guest.guestId}`;
  const tastes = Object.entries(await redis.hGetAll(guestTastesKey(guest.guestId))).map(([tagId, w]) => ({
    tagId: Number(tagId),
    weight: Number(w),
  }));
  const loungeIds = await redis.sMembers(`guest:lounges:${guest.guestId}`);

  // 라운지 채팅에 남긴 본인 메시지 (참여하지 않은 라운지에도 쓸 수 있으므로 모든 라운지 방을 본다)
  const { rows: loungeRooms } = await db.query("SELECT id FROM chat_rooms WHERE type = 'lounge'");
  const loungeMessages = []; // { raw, roomId, msg }
  for (const { id } of loungeRooms) {
    for (const raw of await redis.lRange(guestMessagesKey(id), 0, -1)) {
      const msg = JSON.parse(raw);
      if (msg.guestId === guest.guestId) loungeMessages.push({ raw, roomId: id, msg });
    }
  }

  // 1:1 Redis 방: 상대가 회원이면 PG로, Guest면 Redis에 둔다
  const rooms = await directRooms.getActorRooms(guestKey);
  const partnerKeys = rooms.map((r) => r.members.find((m) => m.key !== guestKey).key);
  const partners = await getProfiles(partnerKeys); // 탈퇴한 회원·만료된 Guest는 빠짐
  const toPg = [];
  const toTransfer = [];
  for (const room of rooms) {
    const partnerKey = room.members.find((m) => m.key !== guestKey).key;
    const partner = partners.get(partnerKey);
    if (!partner) continue; // 상대가 사라진 방은 옮기지 않고 TTL로 정리
    if (partner.isGuest) toTransfer.push({ room, expiresAt: partner.expiresAt });
    else toPg.push({ room, messages: await directRooms.readDirectMessages(room, { limit: 1000 }) });
  }
  return { guestKey, tastes, loungeIds, loungeMessages, toPg, toTransfer };
}

const insertMessages = (client, rows) =>
  rows.length
    ? client.query(
      `INSERT INTO messages (id, room_id, sender_id, content, created_at)
       SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::uuid[], $4::text[], $5::timestamptz[])
       ON CONFLICT (id) DO NOTHING`,
      [rows.map((r) => r.id), rows.map((r) => r.roomId), rows.map((r) => r.senderId), rows.map((r) => r.content), rows.map((r) => r.createdAt)]
    )
    : null;

// Redis 1:1 방 → 같은 roomId로 PG 방 + 방 단위 표시 이름·캐릭터(상대 화면에서 그대로 보이게) + 메시지 순서·작성자 유지
// userIdOf: 방 참여자 actorKey → users.id
async function insertRoom(client, room, messages, userIdOf) {
  await client.query(`INSERT INTO chat_rooms (id, type, created_at) VALUES ($1, 'direct', $2) ON CONFLICT (id) DO NOTHING`, [room.id, room.created_at]);
  for (const m of room.members) {
    await client.query(
      `INSERT INTO chat_members (room_id, user_id, display_name, avatar_id, joined_at, left_at)
       VALUES ($1, $2, $3, COALESCE($4, (SELECT id FROM avatars WHERE emoji = $5 LIMIT 1), 1), $6, $7)
       ON CONFLICT DO NOTHING`,
      [room.id, userIdOf(m.key), m.nickname, m.avatarId ?? null, m.avatarEmoji, room.created_at, room.left.has(m.key) ? new Date() : null]
    );
  }
  await insertMessages(
    client,
    messages.map((msg) => ({ id: msg.id, roomId: room.id, senderId: userIdOf(msg.senderKey), content: msg.content, createdAt: msg.created_at }))
  );
}
const memberIdOf = (key) => key.slice('member:'.length);

// 회원 생성 트랜잭션 안에서 PG 쓰기 (client = 트랜잭션 클라이언트)
async function writeToPg(client, userId, data) {
  const { guestKey, tastes, loungeIds, loungeMessages, toPg } = data;
  if (tastes.length) {
    await client.query(
      `INSERT INTO user_tastes (user_id, tag_id, weight)
       SELECT $1, t.tag_id, t.weight FROM UNNEST($2::int[], $3::smallint[]) AS t(tag_id, weight)`,
      [userId, tastes.map((t) => t.tagId), tastes.map((t) => t.weight)]
    );
  }
  if (loungeIds.length) {
    // 이미 정원에 Guest로 포함돼 있던 자리라 정원 확인 없이 옮긴다. 사라진 라운지는 건너뜀
    await client.query(
      `INSERT INTO lounge_members (lounge_id, user_id)
       SELECT l.id, $1 FROM lounges l WHERE l.id = ANY($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [userId, loungeIds]
    );
  }
  await insertMessages(
    client,
    loungeMessages.map(({ roomId, msg }) => ({ id: msg.id, roomId, senderId: userId, content: msg.content, createdAt: msg.created_at }))
  );
  for (const { room, messages } of toPg) {
    await insertRoom(client, room, messages, (key) => (key === guestKey ? userId : memberIdOf(key)));
  }
}

// 두 Guest가 동시에 가입해 Redis 방에 Guest가 남지 않게 된 경우 → 회원끼리 방이므로 PG로 옮긴다
async function moveRoomToPg(roomId) {
  const room = await directRooms.getDirectRoom(roomId);
  if (!room || room.members.some((m) => m.isGuest)) return;
  const messages = await directRooms.readDirectMessages(room, { limit: 1000 });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await insertRoom(client, room, messages, memberIdOf);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await directRooms.dropDirectRoom(room);
}

// 커밋 후 Redis 정리 — 실패해도 회원 가입은 성공 (Guest 키는 세션 만료 시각에 TTL로 사라짐)
async function cleanupRedis(token, userId, guestId, data) {
  const redis = getRedis();
  // 토큰부터 무효로: 아래 정리가 중간에 실패해도 같은 토큰으로 다시 이전되지 않게
  await endGuestToken(token);
  const multi = redis.multi();
  for (const { raw, roomId } of data.loungeMessages) multi.lRem(guestMessagesKey(roomId), 0, raw); // PG로 옮긴 메시지가 두 번 보이지 않게
  await multi.exec();
  for (const { room } of data.toPg) await directRooms.dropDirectRoom(room);
  for (const { room, expiresAt } of data.toTransfer) {
    const guestsLeft = await directRooms.transferDirectRoom(room, data.guestKey, `member:${userId}`, expiresAt);
    if (guestsLeft === 0) await moveRoomToPg(room.id);
  }
  // 남은 것(취향·표시 정보·라운지 참여·대기 중인 요청·옮기지 않은 방)은 둘러보기 종료와 같은 정리
  await removeGuestData(guestId);
  await redis.del([msgCountKey(guestId), claimKey(guestId)]);
}

const summary = (data) => ({
  tastes: data.tastes.length,
  lounges: data.loungeIds.length,
  lounge_messages: data.loungeMessages.length,
  direct_rooms: data.toPg.length + data.toTransfer.length,
});

module.exports = { claimGuest, releaseGuest, alreadyUpgraded, collectGuestData, writeToPg, cleanupRedis, summary, msgCountKey };
