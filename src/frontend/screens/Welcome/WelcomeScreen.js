import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';
import { secureStorage } from '../../services/storage';
import { colors, spacing, radius, typography } from '../../theme';

// 로그아웃 상태의 첫 화면: [회원가입] [로그인] [가입 없이 둘러보기]
export default function WelcomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      navigation.navigate('GuestEntry', { nickname: data.nickname, avatarEmoji: data.avatarEmoji, expiresAt: data.expiresAt });
    } catch (err) {
      // Alert는 웹(react-native-web)에서 동작하지 않아 화면 안에 표시한다
      setError(err.code ? err.message : '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.planet} accessibilityElementsHidden>🪐</Text>
        <Text style={styles.logo} accessibilityRole="header">Orbit</Text>
        <Text style={styles.tagline}>Find your people in the same orbit.</Text>
        <Text style={styles.subtitle}>취향으로 연결되고, 익명으로 대화하는 곳</Text>
      </View>

      <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('Register')} accessibilityRole="button">
        <Text style={styles.primaryText}>회원가입</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => navigation.navigate('Login')} accessibilityRole="button">
        <Text style={styles.secondaryText}>로그인</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.guest} onPress={handleGuest} disabled={loading} accessibilityRole="button">
        <Text style={styles.guestText}>{loading ? '궤도를 만드는 중...' : '가입 없이 둘러보기'}</Text>
        <Text style={styles.guestSub}>30분 동안 머물 수 있어요</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', padding: spacing.xl, backgroundColor: colors.background },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  planet: { fontSize: 72, marginBottom: spacing.md },
  logo: { ...typography.title, fontSize: 40, color: colors.primary },
  tagline: { ...typography.body, color: colors.text, marginTop: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  primary: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: 'bold' },
  secondary: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: 'center',
    marginBottom: spacing.sm, borderWidth: 1.5, borderColor: colors.primary,
  },
  secondaryText: { color: colors.primary, fontSize: 17, fontWeight: 'bold' },
  guest: { alignItems: 'center', paddingVertical: spacing.md },
  guestText: { color: colors.text, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  guestSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  error: { ...typography.caption, color: colors.primary, textAlign: 'center' },
});
