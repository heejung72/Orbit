import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/Home/HomeScreen';
import LoungeListScreen from '../screens/Lounge/LoungeListScreen';
import ChatListScreen from '../screens/Chat/ChatListScreen';
import MyOrbitScreen from '../screens/MyOrbit/MyOrbitScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

// 하단 탭: Home / Lounge / Chat / My Orbit
// 아이콘·스타일 정리는 #9(하단 탭 네비게이션)에서 진행합니다.
export default function MainTabs({ isGuest, onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarStyle: { paddingBottom: 5, height: 60 },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
      }}
    >
      <Tab.Screen name="Home" options={{ title: '홈', tabBarIcon: () => <Text>🪐</Text> }}>
        {() => <HomeScreen />}
      </Tab.Screen>
      <Tab.Screen
        name="Lounge"
        component={LoungeListScreen}
        options={{ title: '라운지', tabBarIcon: () => <Text>👥</Text> }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatListScreen}
        options={{ title: '채팅', tabBarIcon: () => <Text>💬</Text> }}
      />
      {/* Guest용 My Orbit(남은 시간 + 가입 유도)은 #17에서 추가 */}
      {!isGuest ? (
        <Tab.Screen
          name="MyOrbit"
          options={{ title: 'My Orbit', tabBarIcon: () => <Text>👤</Text> }}
        >
          {props => <MyOrbitScreen {...props} onLogout={onLogout} />}
        </Tab.Screen>
      ) : null}
    </Tab.Navigator>
  );
}
