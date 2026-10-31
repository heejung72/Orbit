import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RootNavigator from './navigation/RootNavigator';
import { secureStorage, clearSession } from './services/storage';
import { setOnSessionExpired } from './services/api';

// TODO(#4): 인증 상태를 context/AuthContext.js로 옮기기
export default function App() {
  // authState: 'loading' | 'loggedOut' | 'guest' | 'member'
  const [authState, setAuthState] = useState('loading');

  useEffect(() => {
    setOnSessionExpired(() => setAuthState('loggedOut'));
    (async () => {
      if (await secureStorage.get('token')) return setAuthState('member');
      const guestToken = await secureStorage.get('guestToken');
      const expiresAt = Date.parse(await AsyncStorage.getItem('guestExpiresAt'));
      if (guestToken && expiresAt > Date.now()) return setAuthState('guest');
      await clearSession(); // 만료됐거나 반쯤 남은 세션 정리
      setAuthState('loggedOut');
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
