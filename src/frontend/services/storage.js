import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 토큰(회원 JWT, Guest 토큰)은 iOS·Android에서 SecureStore에 저장
// shortcut: 웹은 localStorage(XSS에 노출), 웹 회원 로그인을 정식 지원할 때 HttpOnly 쿠키로 전환
const isWeb = Platform.OS === 'web';

export const secureStorage = {
  get: async (key) => (isWeb ? localStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: async (key, value) => (isWeb ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value)),
  remove: async (key) => (isWeb ? localStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
};

// 로그아웃·Guest 만료 시 세션 흔적을 모두 지움
export async function clearSession() {
  await Promise.all([secureStorage.remove('token'), secureStorage.remove('guestToken')]);
  await AsyncStorage.multiRemove(['user', 'isGuest', 'guestExpiresAt']);
}
