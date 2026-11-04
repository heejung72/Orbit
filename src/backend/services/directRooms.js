const crypto = require('crypto');
const { getRedis } = require('../redis');

// Guest가 낀 1:1 방 (#13) — PG에는 남기지 않고 Redis에만. docs/system_design.md §4-1·§4-3
//   room:{roomId}          Hash  type, createdAt, expiresAt, members(JSON: [{key, nickname, avatarId, avatarEmoji, isGuest}]), left:{actorKey}
//   room:{roomId}:msgs     List  이 방의 모든 메시지(회원 메시지 포함) JSON, 최근 500개
//   actor:rooms:{actorKey} Set   참여 중인 Redis 1:1 roomId (Guest는 본인 만료 시각에 만료, 회원은 읽을 때 사라진 방 정리)
// 방·메시지는 참여 Guest 중 가장 이른 만료 시각에 함께 사라진다 (= Guest 만료 시 방 종료)

const MSG_LIMIT = 500;
const roomKey = (id) => `room:${id}`;
const msgsKey = (id) => `room:${id}:msgs`;
const actorRoomsKey = (key) => `actor:rooms:${key}`;

function parseRoom(id, h) {
  if (!h || !h.members) return null;
  const left = new Set(Object.keys(h).filter((f) => f.startsWith('left:')).map((f) => f.slice(5)));
  return {
    id,
    type: 'direct',
    store: 'redis',
    closed_at: null,
    created_at: h.createdAt,
    expiresAt: Number(h.expiresAt),
    members: JSON.parse(h.members),
    left,
  };
}

// members: [{ key, nickname, avatarEmoji, isGuest, expiresAt? }], expiresAt: 방이 사라질 시각
async function createDirectRoom(members, expiresAt) {
  const id = crypto.randomUUID();
  const multi = getRedis()
    .multi()
    .hSet(roomKey(id), {
      type: 'direct',
      createdAt: new Date().toISOString(),
      expiresAt: String(expiresAt),
      members: JSON.stringify(members.map(({ key, nickname, avatarId, avatarEmoji, isGuest }) => ({ key, nickname, avatarId, avatarEmoji, isGuest }))),
    })
    .pExpireAt(roomKey(id), expiresAt);
  for (const m of members) {
    multi.sAdd(actorRoomsKey(m.key), id);
    if (m.isGuest) multi.pExpireAt(actorRoomsKey(m.key), m.expiresAt);
  }
  await multi.exec();
  return id;
}

async function getDirectRoom(id) {
  return parseRoom(id, await getRedis().hGetAll(roomKey(id)));
}

// 나가기 — 나간 사람은 목록·접근에서 빠지고, 두 사람 모두 나가면 방과 메시지를 지운다
async function leaveDirectRoom(room, key) {
  const redis = getRedis();
  await redis.multi().hSet(roomKey(room.id), `left:${key}`, '1').sRem(actorRoomsKey(key), room.id).exec();
  const after = await getDirectRoom(room.id);
  if (after && after.members.every((m) => after.left.has(m.key))) await redis.del([roomKey(room.id), msgsKey(room.id)]);
}

// 내 Redis 1:1 방 목록 (사라진 방은 목록 키에서 정리)
async function listDirectRooms(key) {
  const redis = getRedis();
  const ids = await redis.sMembers(actorRoomsKey(key));
  if (ids.length === 0) return [];
  const multi = redis.multi();
  for (const id of ids) multi.hGetAll(roomKey(id)).lIndex(msgsKey(id), -1);
  const results = await multi.exec();
  const rooms = [];
  const gone = [];
  ids.forEach((id, i) => {
    const room = parseRoom(id, results[i * 2]);
    if (!room || room.left.has(key)) return gone.push(id);
    const partner = room.members.find((m) => m.key !== key);
    const last = results[i * 2 + 1] ? JSON.parse(results[i * 2 + 1]) : null;
    rooms.push({
      id,
      type: 'direct',
      created_at: room.created_at,
      partner_nickname: partner.nickname,
      partner_avatar_emoji: partner.avatarEmoji,
      partner_is_guest: partner.isGuest,
      last_message: last?.content ?? null,
      last_message_at: last?.created_at ?? null,
    });
  });
  if (gone.length) await redis.sRem(actorRoomsKey(key), gone);
  return rooms;
}

// 대화 중인 상대 actorKey (두 사람 모두 나가지 않은 방)
// 회원 목록 키는 TTL이 없어, 채팅 목록을 열지 않아도 여기서 사라진 방을 정리한다
async function activePartners(key) {
  const redis = getRedis();
  const ids = await redis.sMembers(actorRoomsKey(key));
  if (ids.length === 0) return new Set();
  const multi = redis.multi();
  for (const id of ids) multi.hGetAll(roomKey(id));
  const results = await multi.exec();
  const keys = new Set();
  const gone = [];
  ids.forEach((id, i) => {
    const room = parseRoom(id, results[i]);
    if (!room) return gone.push(id);
    if (room.left.size > 0) return;
    for (const m of room.members) if (m.key !== key) keys.add(m.key);
  });
  if (gone.length) await redis.sRem(actorRoomsKey(key), gone);
  return keys;
}

// 메시지 저장 (회원·Guest 모두 Redis). 방 단위 표시 이름·캐릭터는 방을 만들 때 정한 값
async function pushDirectMessage(room, senderKey, content) {
  const sender = room.members.find((m) => m.key === senderKey);
  const message = {
    id: crypto.randomUUID(),
    room_id: room.id,
    content,
    created_at: new Date().toISOString(),
    is_guest: sender.isGuest,
    sender_nickname: sender.nickname,
    sender_avatar_emoji: sender.avatarEmoji,
  };
  const key = msgsKey(room.id);
  await getRedis()
    .multi()
    .rPush(key, JSON.stringify({ ...message, senderKey }))
    .lTrim(key, -MSG_LIMIT, -1)
    .pExpireAt(key, room.expiresAt)
    .exec();
  return { ...message, senderKey };
}

// before 이전 최근 limit개 (시간순, senderKey 포함 — chat.js가 is_mine으로 바꾼다)
async function readDirectMessages(room, { before = null, limit = 50 } = {}) {
  const all = (await getRedis().lRange(msgsKey(room.id), 0, -1)).map((raw) => JSON.parse(raw));
  return all.filter((m) => !before || m.created_at < before).slice(-limit);
}

// 회원 탈퇴 시 참여 중인 모든 Redis 1:1 방에서 나간다 (상대 Guest가 혼자 남은 방으로 보이게)
async function leaveAllDirectRooms(key) {
  const redis = getRedis();
  for (const id of await redis.sMembers(actorRoomsKey(key))) {
    const room = await getDirectRoom(id);
    if (room) await leaveDirectRoom(room, key);
  }
  await redis.del(actorRoomsKey(key));
}

// 내가 참여 중인(나가지 않은) Redis 1:1 방 전체 (가입 전환용)
async function getActorRooms(key) {
  const rooms = [];
  for (const id of await getRedis().sMembers(actorRoomsKey(key))) {
    const room = await getDirectRoom(id);
    if (room && !room.left.has(key)) rooms.push(room);
  }
  return rooms;
}

// PG로 옮긴 방을 Redis에서 지운다 (참여자 목록 키에서도)
async function dropDirectRoom(room) {
  const multi = getRedis().multi().del([roomKey(room.id), msgsKey(room.id)]);
  for (const m of room.members) multi.sRem(actorRoomsKey(m.key), room.id);
  await multi.exec();
}

// Guest가 가입하면 Guest끼리 방은 Redis에 두고 참여자·작성자 키만 회원으로 바꾼다 (#14)
// 상대 화면에서는 닉네임·캐릭터 그대로, Guest 배지만 빠진다. 방은 남은 Guest의 만료 시각에 사라진다
// 방·메시지·두 사람의 방 목록 키를 한 번에 바꾸고(중간 실패로 회원이 방을 못 찾는 일이 없게), 남은 Guest 수를 돌려준다
// (-1 = 방이 이미 없음). 두 Guest가 동시에 가입해 0이 되면 호출한 쪽이 방을 PG로 옮긴다
const TRANSFER = `local raw = redis.call('HGET', KEYS[1], 'members')
if not raw then return -1 end
local members = cjson.decode(raw)
local guests = 0
for _, m in ipairs(members) do
  if m.key == ARGV[1] then m.key = ARGV[2]; m.isGuest = false end
  if m.isGuest then guests = guests + 1 end
end
redis.call('HSET', KEYS[1], 'members', cjson.encode(members), 'expiresAt', ARGV[3])
local list = redis.call('LRANGE', KEYS[2], 0, -1)
for i, v in ipairs(list) do
  local msg = cjson.decode(v)
  if msg.senderKey == ARGV[1] then
    msg.senderKey = ARGV[2]
    msg.is_guest = false
    redis.call('LSET', KEYS[2], i - 1, cjson.encode(msg))
  end
end
redis.call('PEXPIREAT', KEYS[1], ARGV[3])
if redis.call('EXISTS', KEYS[2]) == 1 then redis.call('PEXPIREAT', KEYS[2], ARGV[3]) end
redis.call('SADD', KEYS[4], ARGV[4])
redis.call('SREM', KEYS[3], ARGV[4])
return guests`;

// 목록 다시 쓰기와 새 메시지 추가가 섞이지 않게 Lua로 한 번에 → 남은 Guest 수
async function transferDirectRoom(room, oldKey, newKey, expiresAt) {
  const left = await getRedis().eval(TRANSFER, {
    keys: [roomKey(room.id), msgsKey(room.id), actorRoomsKey(oldKey), actorRoomsKey(newKey)],
    arguments: [oldKey, newKey, String(expiresAt), room.id],
  });
  return Number(left);
}

// Guest가 둘러보기를 직접 끝낼 때 그 Guest의 방을 바로 지운다 (시간 만료는 TTL)
async function removeGuestRooms(guestId) {
  const redis = getRedis();
  const key = actorRoomsKey(`guest:${guestId}`);
  const ids = await redis.sMembers(key);
  await redis.del([key, ...ids.flatMap((id) => [roomKey(id), msgsKey(id)])]);
}

module.exports = {
  createDirectRoom,
  getDirectRoom,
  leaveDirectRoom,
  leaveAllDirectRooms,
  listDirectRooms,
  activePartners,
  pushDirectMessage,
  readDirectMessages,
  removeGuestRooms,
  getActorRooms,
  dropDirectRoom,
  transferDirectRoom,
};
