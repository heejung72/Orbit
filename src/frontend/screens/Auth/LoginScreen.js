import React, { useState } from 'react';
import { Text, StyleSheet, Alert } from 'react-native';
import { api } from '../../services/api';
import { saveMemberSession } from '../../services/storage';
import { SpaceScreen, SpaceButton, SpaceInput, FadeUp } from '../../components/Space';
import { colors, spacing, typography } from '../../theme';

export default function LoginScreen({ navigation, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('알림', '이메일과 비밀번호를 입력해주세요');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      await saveMemberSession(data.token, data.user);
      onLogin();
    } catch (err) {
      Alert.alert('로그인 실패', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SpaceScreen style={styles.container}>
      <FadeUp>
        <Text style={styles.title}>다시 궤도로</Text>
        <Text style={styles.subtitle}>같은 궤도의 사람들이 기다리고 있어요</Text>

        <SpaceInput placeholder="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <SpaceInput placeholder="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />

        <SpaceButton title={loading ? '로그인 중...' : '로그인'} onPress={handleLogin} disabled={loading} style={styles.button} />
        <SpaceButton title="계정이 없으신가요? 회원가입" variant="ghost" onPress={() => navigation.navigate('Register')} />
      </FadeUp>
    </SpaceScreen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.title, fontSize: 28, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl },
  button: { marginTop: spacing.sm, marginBottom: spacing.xs },
});
