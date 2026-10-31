import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';

const API_URL = config.API_URL;

async function request(path, options = {}) {
  const token = await AsyncStorage.getItem('token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export const api = {
  // 인증
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password, nickname) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, nickname }) }),
  guestLogin: () =>
    request('/auth/guest', { method: 'POST' }),

  // 공개 API (비로그인)
  getPublicHome: () =>
    fetch(`${API_URL}/public/home`).then(r => r.json()),
  getPublicClubs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/public/clubs${qs ? `?${qs}` : ''}`).then(r => r.json());
  },
  getPublicClub: (id) =>
    fetch(`${API_URL}/public/clubs/${id}`).then(r => r.json()),
  getPublicTastes: () =>
    fetch(`${API_URL}/public/tastes`).then(r => r.json()),

  // 프로필
  getProfile: () => request('/users/me'),
  updateProfile: (data) => request('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  updateTastes: (taste_option_ids) =>
    request('/users/me/tastes', { method: 'PUT', body: JSON.stringify({ taste_option_ids }) }),

  // 취향
  getCategories: () => request('/tastes/categories'),

  // 매칭
  findMatches: () => request('/matching/find', { method: 'POST' }),
  requestMatch: (targetId, score) =>
    request(`/matching/request/${targetId}`, { method: 'POST', body: JSON.stringify({ similarity_score: score }) }),
  acceptMatch: (matchId) => request(`/matching/${matchId}/accept`, { method: 'POST' }),
  rejectMatch: (matchId) => request(`/matching/${matchId}/reject`, { method: 'POST' }),
  getMyMatches: () => request('/matching/my'),

  // 채팅
  getChatRooms: () => request('/chat/rooms'),
  getMessages: (roomId, before) =>
    request(`/chat/rooms/${roomId}/messages${before ? `?before=${before}` : ''}`),

  // 동호회
  getClubs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/clubs${qs ? `?${qs}` : ''}`);
  },
  getClub: (id) => request(`/clubs/${id}`),
  createClub: (data) => request('/clubs', { method: 'POST', body: JSON.stringify(data) }),
  joinClub: (id) => request(`/clubs/${id}/join`, { method: 'POST' }),
  leaveClub: (id) => request(`/clubs/${id}/leave`, { method: 'DELETE' }),

  // 신고/차단
  report: (reported_id, reason, description) =>
    request('/reports', { method: 'POST', body: JSON.stringify({ reported_id, reason, description }) }),
  block: (blocked_id) =>
    request('/reports/block', { method: 'POST', body: JSON.stringify({ blocked_id }) }),
  unblock: (userId) => request(`/reports/block/${userId}`, { method: 'DELETE' }),
};
