import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, AccessibilityInfo, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';
import { secureStorage } from '../../services/storage';
import { SpaceScreen, OrbitRings, SpaceButton, FadeUp, Floating } from '../../components/Space';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors, spacing, typography } from '../../theme';

// 로그아웃 상태의 첫 화면: 아래에서 떠오르는 행성과 궤도 + [회원가입] [로그인] [가입 없이 둘러보기]
export default function WelcomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();
  const ring = Math.min(width * 1.7, 760);

  // 가입 없이 둘러보기: Guest 발급 → 안내 화면(GuestEntry)
  const handleGuest = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.createGuestSession();
      await secureStorage.set('guestToken', data.guestToken);
      await AsyncStorage.multiSet([
        ['user', JSON.stringify({ nickname: data.nickname, avatar_id: data.avatarId })],
        ['isGuest', 'true'],
        ['guestExpiresAt', data.expiresAt],
      ]);
      navigation.navigate('GuestEntry', { nickname: data.nickname, avatarId: data.avatarId, expiresAt: data.expiresAt });
    } catch (err) {
      // Alert는 웹(react-native-web)에서 동작하지 않아 화면 안에 표시한다
      const msg = err.code ? err.message : '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요';
      setError(msg);
      // 네이티브 스크린리더가 새 오류를 바로 읽도록 (웹은 accessibilityRole="alert"로 읽힘)
      if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SpaceScreen>
      <View style={styles.hero}>
        {/* 궤도 중심을 화면 아래에 두어 행성이 떠오르는 것처럼 보이게 한다 */}
        <OrbitRings size={ring} style={[styles.rings, { bottom: -ring / 2, marginLeft: -ring / 2 }]}>
          <Floating distance={6}>
            <Image source={require('../../assets/planet-hero.png')} style={{ width: ring * 0.46, height: ring * 0.46 }} />
          </Floating>
        </OrbitRings>
        {/* 행성 아래쪽을 우주색으로 부드럽게 덮어 버튼 영역과 이어지게 */}
        <Svg width={width} height={48} style={styles.fade}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fade)" />
        </Svg>

        <FadeUp style={styles.titleBlock}>
          <Text style={styles.logo} accessibilityRole="header">Orbit</Text>
          <Text style={styles.tagline}>Find your people in the same orbit.</Text>
          <Text style={styles.subtitle}>취향으로 연결되고, 익명으로 대화하는 곳</Text>
        </FadeUp>
      </View>

      <FadeUp delay={250} style={styles.actions}>
        <SpaceButton title="회원가입" onPress={() => navigation.navigate('Register')} />
        <SpaceButton title="로그인" variant="outline" onPress={() => navigation.navigate('Login')} style={styles.gap} />
        <SpaceButton
          title={loading ? '궤도를 만드는 중...' : '가입 없이 둘러보기'}
          variant="ghost"
          onPress={handleGuest}
          disabled={loading}
          style={styles.gap}
        />
        <Text style={styles.guestSub}>30분 동안 머물 수 있어요</Text>
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      </FadeUp>
    </SpaceScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, overflow: 'hidden' },
  rings: { position: 'absolute', left: '50%' },
  fade: { position: 'absolute', bottom: 0 },
  titleBlock: { alignItems: 'center', paddingTop: 96, paddingHorizontal: spacing.xl },
  logo: { ...typography.hero, color: colors.text, textShadowColor: colors.glow, textShadowRadius: 24 },
  tagline: { ...typography.body, color: colors.primaryLight, marginTop: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  actions: { padding: spacing.xl, paddingTop: spacing.lg },
  gap: { marginTop: spacing.sm },
  guestSub: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
});
