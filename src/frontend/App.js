import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RootNavigator from './navigation/RootNavigator';
import { secureStorage, clearSession } from './services/storage';
import { api, setOnSessionExpired } from './services/api';
import { colors, spacing, typography } from './theme';

export default function App() {
  // authState: 'loading' | 'offline' | 'loggedOut' | 'guest' | 'member'
  const [authState, setAuthState] = useState('loading');
  const [needsTaste, setNeedsTaste] = useState(false);

  // 서버에서 현재 사용자를 확인해 들어갈 곳을 정한다 (앱 시작·로그인·가입·둘러보기 직후)
  // 401이면 request()가 세션을 지우고 onSessionExpired로 loggedOut 처리.
  // 그 밖의 오류(네트워크 등)는 취향 여부를 알 수 없으니 진입을 보류하고 '다시 시도' 화면을 보여준다
  const entering = useRef(false);
  const enter = async () => {
    if (entering.current) return; // 재시도 연타 등으로 /auth/me가 겹쳐 늦게 온 실패가 상태를 덮어쓰지 않게
    entering.current = true;
    try {
      const me = await api.me();
      setNeedsTaste(me.type === 'member' && !me.has_tastes); // Guest 취향 온보딩은 #7
      setAuthState(me.type);
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'GUEST_EXPIRED') {
        // 토큰 없이 보낸 요청의 401은 api.js가 세션을 정리하지 않으므로 여기서 로그아웃 처리
        await clearSession();
        return setAuthState('loggedOut');
      }
      setAuthState('offline');
    } finally {
      entering.current = false;
    }
  };

  useEffect(() => {
    setOnSessionExpired(() => setAuthState('loggedOut'));
    (async () => {
      try {
        const isMember = !!(await secureStorage.get('token'));
        const guestToken = await secureStorage.get('guestToken');
        const expiresAt = Date.parse(await AsyncStorage.getItem('guestExpiresAt'));
        if (!isMember && !(guestToken && expiresAt > Date.now())) {
          await clearSession(); // 만료됐거나 반쯤 남은 세션 정리
          return setAuthState('loggedOut');
        }
      } catch (err) {
        console.warn('세션 확인 실패:', err.message); // 저장소 오류여도 로그인 화면은 보여준다
        return setAuthState('loggedOut');
      }
      await enter(); // DB 초기화·Redis 정리로 사라진 계정·세션도 여기서 걸러짐
    })();
  }, []);

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
    <NavigationContainer>
      <RootNavigator
        isLoggedIn={isLoggedIn}
        isGuest={isGuest}
        needsTaste={needsTaste}
        onLogin={enter}
        onGuestLogin={enter}
        onLogout={() => setAuthState('loggedOut')}
      />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  offline: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  offlineText: { ...typography.body, color: colors.text },
  retry: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { ...typography.body, color: colors.primary },
});
