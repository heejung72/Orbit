import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RootNavigator from './navigation/RootNavigator';
import { secureStorage, clearSession } from './services/storage';
import { api, setOnSessionExpired } from './services/api';

export default function App() {
  // authState: 'loading' | 'loggedOut' | 'guest' | 'member'
  const [authState, setAuthState] = useState('loading');
  const [needsTaste, setNeedsTaste] = useState(false);

  // 서버에서 현재 사용자를 확인해 들어갈 곳을 정한다 (앱 시작·로그인·가입·둘러보기 직후)
  // 401이면 request()가 세션을 지우고 onSessionExpired로 loggedOut 처리, 네트워크 오류면 저장된 상태(fallback)로 진행
  const enter = async (fallback) => {
    try {
      const me = await api.me();
      setNeedsTaste(me.type === 'member' && !me.has_tastes); // Guest 취향 온보딩은 #7
      setAuthState(me.type);
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'GUEST_EXPIRED') return;
      setAuthState(fallback);
    }
  };

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
      await enter(isMember ? 'member' : 'guest'); // DB 초기화·Redis 정리로 사라진 계정·세션도 여기서 걸러짐
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
        needsTaste={needsTaste}
        onLogin={() => enter('member')}
        onGuestLogin={() => enter('guest')}
        onLogout={() => setAuthState('loggedOut')}
      />
    </NavigationContainer>
  );
}
