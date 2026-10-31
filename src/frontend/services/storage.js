import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 토큰(회원 JWT, Guest 토큰)은 iOS·Android에서 SecureStore에 저장
// shortcut: 웹은 localStorage(XSS에 노출), 웹 회원 로그인을 정식 지원할 때 HttpOnly 쿠키로 전환
const isWeb = Platform.OS === 'web';

// 읽기·삭제 실패(웹 저장소 차단, 키체인 오류)는 경고 후 null — 앱 전체가 멈추지 않게.
// 쓰기 실패는 호출한 화면이 알 수 있도록 그대로 던진다.
const orNull = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    console.warn('저장소 접근 실패:', err.message);
    return null;
  }
};

export const secureStorage = {
  get: (key) => orNull(async () => (isWeb ? localStorage.getItem(key) : SecureStore.getItemAsync(key))),
  set: async (key, value) => (isWeb ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value)),
  remove: (key) => orNull(async () => (isWeb ? localStorage.removeItem(key) : SecureStore.deleteItemAsync(key))),
};

// 회원 로그인·가입 성공 시: 회원 토큰 저장 + 남아 있던 Guest 흔적 정리
export async function saveMemberSession(token, user) {
  await secureStorage.set('token', token);
  await secureStorage.remove('guestToken');
  await AsyncStorage.multiSet([['user', JSON.stringify(user)], ['isGuest', 'false']]);
  await AsyncStorage.removeItem('guestExpiresAt');
}

// 로그아웃·Guest 만료 시 세션 흔적을 모두 지움
export async function clearSession() {
  await Promise.all([secureStorage.remove('token'), secureStorage.remove('guestToken')]);
  await AsyncStorage.multiRemove(['user', 'isGuest', 'guestExpiresAt']);
}
