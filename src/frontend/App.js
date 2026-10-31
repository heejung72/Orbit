import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import RootNavigator from './navigation/RootNavigator';

// TODO(#4, #5): 인증 상태는 context/AuthContext.js로 옮기고 토큰은 SecureStore(앱)로 저장
export default function App() {
  // authState: 'loading' | 'loggedOut' | 'guest' | 'member'
  const [authState, setAuthState] = useState('loading');

  useEffect(() => {
    AsyncStorage.multiGet(['token', 'isGuest']).then(([[, token], [, isGuest]]) => {
      if (token) {
        setAuthState(isGuest === 'true' ? 'guest' : 'member');
      } else {
        setAuthState('loggedOut');
      }
    });
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
      />
    </NavigationContainer>
  );
}
