import config from '../config';
import { secureStorage, clearSession } from './storage';

const API_URL = config.API_URL;

// Guest 시간이 끝났거나 회원 토큰이 만료됐을 때 App이 로그인 화면으로 돌아가도록 등록하는 콜백
let onSessionExpired = null;
export const setOnSessionExpired = (fn) => { onSessionExpired = fn; };

async function request(path, options = {}) {
  const token = await secureStorage.get('token');
  const guestToken = token ? null : await secureStorage.get('guestToken');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(guestToken ? { 'X-Guest-Token': guestToken } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    // 로그인 실패(코드 없음)와 구분: 미들웨어가 준 UNAUTHORIZED이고 회원 토큰을 보냈을 때만
    if (data.code === 'GUEST_EXPIRED' || (res.status === 401 && data.code === 'UNAUTHORIZED' && token)) {
      await clearSession();
      onSessionExpired?.(data.code);
    }
    const err = new Error(data.error || '요청 실패');
    err.code = data.code;
    throw err;
  }
  return data;
}

export const api = {
  // 인증
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password, nickname, avatar_id) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, nickname, avatar_id }) }),
  getAvatars: () => request('/public/avatars'),
  me: () => request('/auth/me'),

  // Home 대시보드 묶음 { me, tastes, question, lounges }
  getHome: () => request('/home'),

  // Guest (30분 둘러보기)
  createGuestSession: () => request('/guest/session', { method: 'POST' }),
  endGuestSession: () => request('/guest/session', { method: 'DELETE' }),

  // 공개 API (비로그인)
  getPublicLounges: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/public/lounges${qs ? `?${qs}` : ''}`).then(r => r.json());
  },
  getPublicLounge: (id) =>
    fetch(`${API_URL}/public/lounges/${id}`).then(r => r.json()),
  getPublicTastes: () =>
    fetch(`${API_URL}/public/tastes`).then(r => r.json()),

  // 프로필
  getProfile: () => request('/users/me'),
  updateProfile: (data) => request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }), // { nickname?, avatar_id? }
  deleteAccount: (password) => request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),

  // 취향 (회원·Guest 공통)
  getCategories: () => request('/tastes/categories'),
  getMyTastes: () => request('/tastes/me'),
  // tags: [{ tagId, weight(1~3) }], 3~20개 → 저장된 목록
  updateTastes: (tags) => request('/tastes/me', { method: 'PUT', body: JSON.stringify({ tags }) }),

  // 1:1 매칭 (회원·Guest, #13) — 후보는 ref로만 요청
  getCandidates: () => request('/matching/candidates'), // { candidates: [{ ref, nickname, avatar_emoji, is_guest, similarity, common_tags }], message? }
  getMatchRequests: () => request('/matching/requests'), // { received, sent }
  requestMatch: (ref) => request('/matching/requests', { method: 'POST', body: JSON.stringify({ ref }) }),
  acceptMatch: (id) => request(`/matching/requests/${id}/accept`, { method: 'POST' }), // { roomId, title }
  rejectMatch: (id) => request(`/matching/requests/${id}/reject`, { method: 'POST' }),

  // 채팅
  getChatRooms: () => request('/chat/rooms'),
  leaveChatRoom: (roomId) => request(`/chat/rooms/${roomId}/leave`, { method: 'POST' }),
  getTopics: (roomId) => request(`/chat/rooms/${roomId}/topics`), // { topics: [문장] } — 1:1만
  getMessages: (roomId, before) =>
    request(`/chat/rooms/${roomId}/messages${before ? `?before=${before}` : ''}`),

  // 라운지
  getLounges: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/lounges${qs ? `?${qs}` : ''}`);
  },
  getRecommendedLounges: () => request('/lounges/recommended'), // 내 취향 기반 (최대 5개)
  getLounge: (id) => request(`/lounges/${id}`),
  createLounge: (data) => request('/lounges', { method: 'POST', body: JSON.stringify(data) }), // V2
  joinLounge: (id) => request(`/lounges/${id}/join`, { method: 'POST' }),
  leaveLounge: (id) => request(`/lounges/${id}/leave`, { method: 'DELETE' }),

  // 신고/차단
  report: (reported_id, reason, description) =>
    request('/reports', { method: 'POST', body: JSON.stringify({ reported_id, reason, description }) }),
  block: (blocked_id) =>
    request('/reports/block', { method: 'POST', body: JSON.stringify({ blocked_id }) }),
  unblock: (userId) => request(`/reports/block/${userId}`, { method: 'DELETE' }),
};
