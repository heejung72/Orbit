import { io } from 'socket.io-client';
import config from '../config';
import { secureStorage } from './storage';

// 실시간 채팅 소켓 (docs/system_design.md §5)
// 로그인·둘러보기 상태가 되면 App이 connectSocket을, 로그아웃되면 disconnectSocket을 호출한다
// 서버 응답은 ack { ok, code?, message? } — request()가 Promise로 바꿔준다

const ACK_TIMEOUT_MS = 5000;
const RETRY_MS = 3000;
let socket = null;
// 화면 구독(subscribe)은 소켓이 새로 만들어져도 유지한다 — 가입 전환(#14) 때 Guest 소켓을 끊고 회원으로 다시 연결해도
// 열려 있던 채팅방이 메시지를 계속 받게
const listeners = new Map(); // event → Set(handler)

// 회원은 JWT, Guest는 guestToken으로 연결
// 세션이 끝나면 onSessionExpired('guest' | 'member'), Guest 만료 5분 전이면 onGuestWarning({ remainingSec })
// 매칭(#13): 대화 요청을 받으면 onMatchRequest(request), 수락되면 onMatchAccepted({ matchId, roomId, title })
// 가입 유도(#14): Guest 메시지 20개째에 onSignupNudge({ reason })
export async function connectSocket({ onSessionExpired, onGuestWarning, onMatchRequest, onMatchAccepted, onSignupNudge } = {}) {
  disconnectSocket();
  const token = await secureStorage.get('token');
  const guestToken = token ? null : await secureStorage.get('guestToken');
  if (!token && !guestToken) return null;

  const s = io(config.SOCKET_URL, { auth: token ? { token } : { guestToken }, transports: ['websocket'] });
  s.on('guest:expired', () => onSessionExpired?.('guest'));
  s.on('guest:warning', (w) => onGuestWarning?.(w));
  s.on('match:request', (r) => onMatchRequest?.(r));
  s.on('match:accepted', (a) => onMatchAccepted?.(a));
  s.on('signup:nudge', (n) => onSignupNudge?.(n));
  for (const [event, handlers] of listeners) for (const handler of handlers) s.on(event, handler);
  s.on('connect_error', (err) => {
    const code = err.data?.code;
    if (code === 'GUEST_EXPIRED') return onSessionExpired?.('guest');
    if (code === 'UNAUTHORIZED') return onSessionExpired?.('member');
    // 서버 미들웨어가 거절하면 자동 재연결이 멈추므로 잠시 뒤 직접 다시 시도
    if (code) setTimeout(() => socket === s && s.connect(), RETRY_MS);
  });
  socket = s;
  return s;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

async function request(event, payload) {
  if (!socket) return { ok: false, code: 'NOT_CONNECTED', message: '연결 중이에요. 잠시 후 다시 시도해주세요' };
  try {
    return await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload);
  } catch {
    return { ok: false, code: 'TIMEOUT', message: '응답이 없어요. 잠시 후 다시 시도해주세요' };
  }
}

export const joinRoom = (roomId) => request('room:join', { roomId });
export const sendMessage = (roomId, content) => request('message:send', { roomId, content });
export const leaveRoom = (roomId) => socket?.emit('room:leave', { roomId });
export const sendTyping = (roomId) => socket?.emit('typing', { roomId });

// 이벤트 구독, 해제 함수를 돌려준다 (message:new, typing, connect …)
export function subscribe(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  socket?.on(event, handler);
  return () => {
    listeners.get(event)?.delete(handler);
    socket?.off(event, handler);
  };
}
