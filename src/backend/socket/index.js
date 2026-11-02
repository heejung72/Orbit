const { verifyMemberToken } = require('../middleware/memberAuth');
const { findGuestSession } = require('../services/guestSession');
const { getRoomForActor } = require('../services/chatAccess');
const { normalizeContent, saveMessage, toClient } = require('../services/chat');

// Socket.io — docs/system_design.md §5
// C→S: room:join · room:leave · message:send · typing  /  S→C: message:new · typing · guest:expired · room:presence
// 결과·오류는 ack 콜백 { ok, code?, message? } 로 돌려준다
// 메시지 본문은 어떤 로그에도 남기지 않는다 (오류 로그는 err.message만)
// TODO(#12): 소켓별 만료 타이머·5분 전 알림 / TODO(#16): message:send Rate Limit

const authError = (code) => Object.assign(new Error(code), { data: { code } });
const fail = (code, message) => ({ ok: false, code, message });
const isExpiredGuest = (actor) => actor.type === 'guest' && !(actor.expiresAt > Date.now());

// guest:expired를 먼저 보낸 뒤 연결을 끊는다 (끊은 뒤에는 이벤트를 받을 수 없음)
function expire(socket) {
  socket.emit('guest:expired', {});
  socket.disconnect(true);
}

// 라운지 방에 지금 접속 중인 사람 수(같은 사람의 여러 기기는 1명)를 방 전체에 알린다 (#11)
// 인원 표시는 부가 정보라 실패해도 원래 요청(입장·퇴장)의 결과에는 영향을 주지 않는다
function broadcastPresence(io, roomId) {
  io.in(roomId)
    .fetchSockets()
    .then((sockets) => {
      const count = new Set(sockets.map((s) => `${s.data.actor.type}:${s.data.actor.id}`)).size;
      io.to(roomId).emit('room:presence', { roomId, count });
    })
    .catch((err) => console.error('presence 갱신 실패:', err.message));
}

// 이벤트 핸들러 공통: payload 기본값, ack가 없어도 동작, 예외는 SERVER_ERROR
const handle = (fn) => async (payload, ack) => {
  const reply = typeof ack === 'function' ? ack : () => {};
  try {
    await fn(payload && typeof payload === 'object' ? payload : {}, reply);
  } catch (err) {
    console.error('socket 이벤트 처리 실패:', err.message);
    reply(fail(err.code === 'REDIS_UNAVAILABLE' ? 'UNAVAILABLE' : 'SERVER_ERROR', '잠시 후 다시 시도해주세요'));
  }
};

function setupSocket(io) {
  // 연결 인증: 회원 JWT(auth.token) 또는 Guest 토큰(auth.guestToken)
  io.use(async (socket, next) => {
    const { token, guestToken } = socket.handshake.auth || {};
    try {
      if (token) {
        const userId = verifyMemberToken(token);
        if (!userId) return next(authError('UNAUTHORIZED'));
        socket.data.actor = { type: 'member', id: userId };
        return next();
      }
      if (guestToken) {
        const s = await findGuestSession(guestToken);
        if (!s) return next(authError('GUEST_EXPIRED'));
        socket.data.guestToken = guestToken;
        socket.data.actor = { type: 'guest', id: s.guestId, nickname: s.nickname, avatarEmoji: s.avatarEmoji, expiresAt: s.expiresAt };
        return next();
      }
      next(authError('UNAUTHORIZED'));
    } catch (err) {
      next(authError(err.code === 'REDIS_UNAVAILABLE' ? 'UNAVAILABLE' : 'SERVER_ERROR'));
    }
  });

  io.on('connection', (socket) => {
    const { actor } = socket.data;
    const loungeRooms = new Set(); // 이 소켓이 들어가 있는 라운지 방 (퇴장·끊김 때 인원 갱신용)

    // 연결이 끊기면(방에서 이미 빠진 뒤) 들어가 있던 라운지 방 인원 갱신
    socket.on('disconnect', () => {
      for (const roomId of loungeRooms) broadcastPresence(io, roomId);
    });

    // 모든 이벤트 처리 전 Guest 세션 재확인 (시간 만료·직접 종료·Redis 정리 모두 여기서 걸림)
    socket.use(async (packet, next) => {
      if (actor.type !== 'guest') return next();
      const ack = typeof packet[packet.length - 1] === 'function' ? packet[packet.length - 1] : null;
      try {
        if (isExpiredGuest(actor) || !(await findGuestSession(socket.data.guestToken))) return expire(socket);
        next();
      } catch (err) {
        ack?.(fail('UNAVAILABLE', '잠시 후 다시 시도해주세요'));
      }
    });

    socket.on('room:join', handle(async ({ roomId }, reply) => {
      const room = await getRoomForActor(roomId, actor);
      if (!room) return reply(fail('ROOM_NOT_FOUND', '채팅방에 들어갈 수 없어요'));
      socket.join(room.id);
      reply({ ok: true });
      if (room.type === 'lounge') {
        loungeRooms.add(room.id);
        broadcastPresence(io, room.id);
      }
    }));

    socket.on('room:leave', handle(async ({ roomId }, reply) => {
      if (typeof roomId === 'string') socket.leave(roomId);
      reply({ ok: true });
      if (loungeRooms.delete(roomId)) broadcastPresence(io, roomId);
    }));

    socket.on('message:send', handle(async ({ roomId, content }, reply) => {
      const text = normalizeContent(content);
      if (!text) return reply(fail('INVALID_MESSAGE', '메시지는 1~1000자로 입력해주세요'));
      const room = await getRoomForActor(roomId, actor);
      if (!room) return reply(fail('ROOM_NOT_FOUND', '메시지를 보낼 수 없는 방이에요'));
      if (room.closed_at) return reply(fail('ROOM_CLOSED', '종료된 대화예요'));

      const message = await saveMessage(room, actor, text);
      // 받는 소켓마다 is_mine 계산, 만료된 Guest 수신자는 받지 않고 종료
      for (const s of await io.in(room.id).fetchSockets()) {
        if (isExpiredGuest(s.data.actor)) {
          s.emit('guest:expired', {});
          s.disconnect(true);
          continue;
        }
        s.emit('message:new', toClient(message, s.data.actor));
      }
      reply({ ok: true, id: message.id });
    }));

    socket.on('typing', handle(async ({ roomId }) => {
      if (typeof roomId === 'string' && socket.rooms.has(roomId)) socket.to(roomId).emit('typing', { roomId });
    }));
  });
}

module.exports = { setupSocket };
