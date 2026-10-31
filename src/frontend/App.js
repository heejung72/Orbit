import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TasteSelectScreen from './screens/TasteSelectScreen';
import HomeScreen from './screens/HomeScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatRoomScreen from './screens/ChatRoomScreen';
import ClubListScreen from './screens/ClubListScreen';
import ClubDetailScreen from './screens/ClubDetailScreen';
import ClubCreateScreen from './screens/ClubCreateScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ isGuest }) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#6C5CE7',
        tabBarStyle: { paddingBottom: 5, height: 60 },
        headerStyle: { backgroundColor: '#6C5CE7' },
        headerTintColor: '#fff',
      }}
    >
      <Tab.Screen
        name="홈"
        options={{ tabBarIcon: () => <Text>🏠</Text> }}
      >
        {() => <HomeScreen isGuest={isGuest} />}
      </Tab.Screen>
      <Tab.Screen
        name="채팅"
        component={ChatListScreen}
        options={{ tabBarIcon: () => <Text>💬</Text> }}
      />
      <Tab.Screen
        name="동호회"
        component={ClubListScreen}
        options={{ tabBarIcon: () => <Text>👥</Text> }}
      />
      {!isGuest ? (
        <Tab.Screen
          name="프로필"
          component={ProfileScreen}
          options={{ tabBarIcon: () => <Text>👤</Text> }}
        />
      ) : null}
    </Tab.Navigator>
  );
}

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

  const handleLogin = () => setAuthState('member');
  const handleGuestLogin = () => setAuthState('guest');
  const handleLogout = () => {
    AsyncStorage.multiRemove(['token', 'user', 'isGuest']);
    setAuthState('loggedOut');
  };

  const isGuest = authState === 'guest';
  const isLoggedIn = authState === 'member' || authState === 'guest';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#6C5CE7' }, headerTintColor: '#fff' }}>
        {!isLoggedIn ? (
          <>
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {props => <LoginScreen {...props} onLogin={handleLogin} onGuestLogin={handleGuestLogin} />}
            </Stack.Screen>
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '회원가입' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" options={{ headerShown: false }}>
              {() => <MainTabs isGuest={isGuest} />}
            </Stack.Screen>
            <Stack.Screen name="TasteSelect" component={TasteSelectScreen} options={{ title: '취향 선택' }} />
            <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: '채팅' }} />
            <Stack.Screen name="ClubDetail" component={ClubDetailScreen} options={{ title: '동호회' }} />
            <Stack.Screen name="ClubCreate" component={ClubCreateScreen} options={{ title: '동호회 만들기' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
