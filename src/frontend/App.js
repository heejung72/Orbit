import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RootNavigator from './navigation/RootNavigator';
import { secureStorage, clearSession } from './services/storage';
import { api, setOnSessionExpired } from './services/api';
import { connectSocket, disconnectSocket } from './services/socket';
import GuestWarningBanner from './components/GuestWarningBanner';
import { colors, spacing, typography } from './theme';

export default function App() {
  // authState: 'loading' | 'offline' | 'loggedOut' | 'guest' | 'member'
  const [authState, setAuthState] = useState('loading');
  const [needsTaste, setNeedsTaste] = useState(false);
  const [guestExpiresAt, setGuestExpiresAt] = useState(null); // Guest 세션 만료 시각(ms)
  const [orbitExpired, setOrbitExpired] = useState(false); // true면 로그아웃 화면 첫 장이 "궤도가 사라졌어요"
  const [warning, setWarning] = useState(null); // 만료 5분 전 배너 { remainingSec }

  // 세션 종료 공통. Guest 만료면 안내 화면, 회원 토큰 무효·로그아웃이면 Welcome
  // 경로: 소켓 guest:expired·인증 거절 / HTTP GUEST_EXPIRED·UNAUTHORIZED / 만료 시각 도달 / 앱 복귀 시 확인
  const endSession = useCallback(async (reason) => {
    await clearSession();
    setWarning(null);
    setOrbitExpired(reason === 'guest');
    setAuthState('loggedOut');
  }, []);

  // 서버에서 현재 사용자를 확인해 들어갈 곳을 정한다 (앱 시작·로그인·가입·둘러보기 직후)
  // 401이면 request()가 세션을 지우고 onSessionExpired로 loggedOut 처리.
  // 그 밖의 오류(네트워크 등)는 취향 여부를 알 수 없으니 진입을 보류하고 '다시 시도' 화면을 보여준다
  const entering = useRef(false);
  const enter = async () => {
    if (entering.current) return; // 재시도 연타 등으로 /auth/me가 겹쳐 늦게 온 실패가 상태를 덮어쓰지 않게
    entering.current = true;
    try {
      const me = await api.me();
      setNeedsTaste(!me.has_tastes); // 회원·Guest 모두 취향 0개면 TasteSelect부터
      setGuestExpiresAt(me.type === 'guest' ? Date.parse(me.expires_at) : null);
      setOrbitExpired(false);
      setAuthState(me.type);
    } catch (err) {
      // 토큰 없이 보낸 요청의 401은 api.js가 세션을 정리하지 않으므로 여기서 종료 처리
      if (err.code === 'GUEST_EXPIRED') return endSession('guest');
      if (err.code === 'UNAUTHORIZED') return endSession('member');
      setAuthState('offline');
    } finally {
      entering.current = false;
    }
  };

  useEffect(() => {
    setOnSessionExpired((code) => endSession(code === 'GUEST_EXPIRED' ? 'guest' : 'member'));
    (async () => {
      try {
        const isMember = !!(await secureStorage.get('token'));
        const guestToken = await secureStorage.get('guestToken');
        const expiresAt = Date.parse(await AsyncStorage.getItem('guestExpiresAt'));
        if (!isMember && guestToken && !(expiresAt > Date.now())) return endSession('guest'); // 둘러보기 중 앱을 닫았다가 시간이 지난 뒤 다시 연 경우
        if (!isMember && !guestToken) {
          await clearSession(); // 반쯤 남은 세션 정리
          return setAuthState('loggedOut');
        }
      } catch (err) {
        console.warn('세션 확인 실패:', err.message); // 저장소 오류여도 로그인 화면은 보여준다
        return setAuthState('loggedOut');
      }
      await enter(); // DB 초기화·Redis 정리로 사라진 계정·세션도 여기서 걸러짐
    })();
  }, []);

  // 로그인·둘러보기 중에만 실시간 소켓 연결. Guest 만료(guest:expired)·인증 거절이면 세션 정리 후 Welcome
  useEffect(() => {
    if (authState === 'member' || authState === 'guest') {
      connectSocket({ onSessionExpired: endSession, onGuestWarning: (w) => setWarning(w || {}) });
    } else if (authState === 'loggedOut') {
      disconnectSocket();
    }
  }, [authState, endSession]);

  // Guest: 서버 연락이 없어도 만료 시각이 되면 종료, 앱이 백그라운드였다 돌아왔을 때도 확인
  // (백그라운드에서는 JS 타이머가 멈출 수 있어 AppState로 한 번 더 본다)
  useEffect(() => {
    if (authState !== 'guest' || !guestExpiresAt) return undefined;
    const check = () => {
      if (Date.now() >= guestExpiresAt) endSession('guest');
    };
    const timer = setTimeout(check, Math.max(guestExpiresAt - Date.now(), 0));
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [authState, guestExpiresAt, endSession]);

  if (authState === 'loading') return null;
  if (authState === 'offline') {
    return (
      <View style={styles.offline}>
        <Text style={styles.offlineText}>서버에 연결할 수 없어요</Text>
        <Pressable onPress={enter} accessibilityRole="button" style={styles.retry}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const isGuest = authState === 'guest';
  const isLoggedIn = authState === 'member' || authState === 'guest';

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator
          isLoggedIn={isLoggedIn}
          isGuest={isGuest}
          needsTaste={needsTaste}
          orbitExpired={orbitExpired}
          onLogin={enter}
          onGuestLogin={enter}
          onLogout={() => endSession('member')}
        />
      </NavigationContainer>
      {isGuest && warning && <GuestWarningBanner remainingSec={warning.remainingSec} onClose={() => setWarning(null)} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  offline: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  offlineText: { ...typography.body, color: colors.text },
  retry: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { ...typography.body, color: colors.primary },
});
