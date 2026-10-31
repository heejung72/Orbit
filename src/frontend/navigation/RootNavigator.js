import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import TasteSelectScreen from '../screens/TasteSelect/TasteSelectScreen';
import ChatRoomScreen from '../screens/Chat/ChatRoomScreen';
import LoungeChatScreen from '../screens/Lounge/LoungeChatScreen';
import MainTabs from './MainTabs';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

// 진입 분기(Welcome / Guest / Member)는 #6에서 Welcome 화면과 함께 정리합니다.
export default function RootNavigator({ isLoggedIn, isGuest, onLogin, onGuestLogin, onLogout }) {
  return (
    <Stack.Navigator
      screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: colors.onPrimary }}
    >
      {!isLoggedIn ? (
        <>
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {props => <LoginScreen {...props} onLogin={onLogin} onGuestLogin={onGuestLogin} />}
          </Stack.Screen>
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '회원가입' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" options={{ headerShown: false }}>
            {() => <MainTabs isGuest={isGuest} onLogout={onLogout} />}
          </Stack.Screen>
          <Stack.Screen name="TasteSelect" component={TasteSelectScreen} options={{ title: '취향 선택' }} />
          <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: '채팅' }} />
          <Stack.Screen name="LoungeChat" component={LoungeChatScreen} options={{ title: '라운지' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
