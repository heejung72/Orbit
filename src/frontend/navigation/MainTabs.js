import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/Home/HomeScreen';
import LoungeListScreen from '../screens/Lounge/LoungeListScreen';
import ChatListScreen from '../screens/Chat/ChatListScreen';
import MyOrbitScreen from '../screens/MyOrbit/MyOrbitScreen';
import { Icon } from '../components/Space';
import { colors, glow, nativeDriver } from '../theme';

const Tab = createBottomTabNavigator();

// 선택된 탭: 빛나는 원 안에서 통통 튀며 커진다
function TabIcon({ name, focused }) {
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: focused ? 1 : 0, bounciness: 10, useNativeDriver: nativeDriver }).start();
  }, [focused, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View style={[styles.icon, focused && styles.iconActive, { transform: [{ scale }] }]}>
      <Icon name={name} size={22} color={focused ? colors.onPrimary : colors.textMuted} />
    </Animated.View>
  );
}

const tab = (title, icon) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ focused }) => <TabIcon name={icon} focused={focused} />,
});

// 하단 탭: Home / Lounge / Chat / My Orbit — 화면 위에 떠 있는 알약 모양
export default function MainTabs({ isGuest, onLogout }) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarShowLabel: false,
        tabBarStyle: [styles.bar, { marginBottom: insets.bottom + 12 }],
        tabBarItemStyle: styles.item,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen name="Home" options={tab('홈', 'home')}>
        {() => <HomeScreen isGuest={isGuest} />}
      </Tab.Screen>
      <Tab.Screen name="Lounge" component={LoungeListScreen} options={tab('라운지', 'lounge')} />
      <Tab.Screen name="Chat" component={ChatListScreen} options={tab('채팅', 'chat')} />
      {/* Guest용 My Orbit(남은 시간 + 가입 유도)은 #17에서 추가 */}
      {!isGuest ? (
        <Tab.Screen name="MyOrbit" options={tab('My Orbit', 'orbit')}>
          {props => <MyOrbitScreen {...props} onLogout={onLogout} />}
        </Tab.Screen>
      ) : null}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 64,
    paddingBottom: 0,
    marginHorizontal: 20,
    borderRadius: 32,
    borderTopWidth: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSolid,
  },
  item: { height: 62, justifyContent: 'center' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconActive: { backgroundColor: colors.primary, ...glow(colors.primary, 12) },
});
