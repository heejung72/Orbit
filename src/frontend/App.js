import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RootNavigator from './navigation/RootNavigator';
import { secureStorage, clearSession } from './services/storage';
import { api, setOnSessionExpired } from './services/api';

export default function App() {
  // authState: 'loading' | 'loggedOut' | 'guest' | 'member'
  const [authState, setAuthState] = useState('loading');

  useEffect(() => {
    setOnSessionExpired(() => setAuthState('loggedOut'));
    (async () => {
      let isMember = false;
      try {
        isMember = !!(await secureStorage.get('token'));
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
      // 서버에서 계정·세션이 사라졌는지 확인 (DB 초기화, Redis 정리 등)
      // 401이면 request()가 세션을 지우고 onSessionExpired로 loggedOut 처리, 네트워크 오류면 그대로 진행
      try {
        await api.me();
      } catch (err) {
        if (err.code === 'UNAUTHORIZED' || err.code === 'GUEST_EXPIRED') return;
      }
      setAuthState(isMember ? 'member' : 'guest');
    })();
  }, []);

  if (authState === 'loading') return null;

  const isGuest = authState === 'guest';
  const isLoggedIn = authState === 'member' || authState === 'guest';

  return (
    <NavigationContainer>
      <RootNavigator
        isLoggedIn={isLoggedIn}
        isGuest={isGuest}
        onLogin={() => setAuthState('member')}
        onGuestLogin={() => setAuthState('guest')}
        onLogout={() => setAuthState('loggedOut')}
      />
    </NavigationContainer>
  );
}
