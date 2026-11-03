import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/Welcome/WelcomeScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import GuestEntryScreen from '../screens/GuestEntry/GuestEntryScreen';
import TasteSelectScreen from '../screens/TasteSelect/TasteSelectScreen';
import ChatRoomScreen from '../screens/Chat/ChatRoomScreen';
import LoungeChatScreen from '../screens/Lounge/LoungeChatScreen';
import TodayQuestionScreen from '../screens/TodayQuestion/TodayQuestionScreen';
import OrbitExpiredScreen from '../screens/Expired/OrbitExpiredScreen';
import MainTabs from './MainTabs';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

// 로그아웃 상태 첫 화면 = Welcome / 로그인 상태 첫 화면 = Main (취향 0개면 회원·Guest 모두 TasteSelect)
// 그룹이 바뀔 때 목록의 첫 화면부터 시작하므로 순서로 진입 화면을 정한다
// Guest 시간이 끝나 로그아웃된 직후엔 OrbitExpired("궤도가 사라졌어요")부터 (#12)
export default function RootNavigator({ isLoggedIn, isGuest, needsTaste, orbitExpired, onLogin, onGuestLogin, onLogout }) {
  const main = (
    <Stack.Screen key="Main" name="Main" options={{ headerShown: false }}>
      {() => <MainTabs isGuest={isGuest} onLogout={onLogout} />}
    </Stack.Screen>
  );
  const taste = (
    <Stack.Screen key="TasteSelect" name="TasteSelect" component={TasteSelectScreen} options={{ title: '취향 선택' }} />
  );

  return (
    <Stack.Navigator
      screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: colors.onPrimary }}
    >
      {!isLoggedIn ? (
        <>
          {orbitExpired && <Stack.Screen name="OrbitExpired" component={OrbitExpiredScreen} options={{ headerShown: false }} />}
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" options={{ title: '로그인' }}>
            {props => <LoginScreen {...props} onLogin={onLogin} />}
          </Stack.Screen>
          <Stack.Screen name="GuestEntry" options={{ headerShown: false }}>
            {props => <GuestEntryScreen {...props} onStart={onGuestLogin} />}
          </Stack.Screen>
          <Stack.Screen name="Register" options={{ title: '회원가입' }}>
            {props => <RegisterScreen {...props} onLogin={onLogin} />}
          </Stack.Screen>
        </>
      ) : (
        <>
          {needsTaste ? [taste, main] : [main, taste]}
          <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: '채팅' }} />
          <Stack.Screen name="LoungeChat" component={LoungeChatScreen} options={{ title: '라운지' }} />
          <Stack.Screen name="TodayQuestion" component={TodayQuestionScreen} options={{ title: '오늘의 질문' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
