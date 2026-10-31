import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { api } from '../../services/api';
import { saveMemberSession } from '../../services/storage';
import { colors, spacing, radius, typography } from '../../theme';

// 서버(routes/auth.js)와 같은 가입 규칙
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatars, setAvatars] = useState([]);
  const [avatarId, setAvatarId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getAvatars()
      .then((list) => {
        setAvatars(list);
        setAvatarId(list[0]?.id ?? null);
      })
      .catch(() => {}); // 목록을 못 받아도 서버 기본 캐릭터로 가입 가능
  }, []);

  const handleRegister = async () => {
    const nick = nickname.trim();
    if (!EMAIL_RE.test(email.trim())) return Alert.alert('알림', '이메일 형식을 확인해주세요');
    if (password.length < 8) return Alert.alert('알림', '비밀번호는 8자 이상이어야 해요');
    if (nick.length < 2 || nick.length > 12) return Alert.alert('알림', '닉네임은 2~12자로 입력해주세요');

    setLoading(true);
    try {
      const data = await api.register(email.trim(), password, nick, avatarId ?? undefined);
      await saveMemberSession(data.token, data.user);
      onLogin(); // 가입 후 바로 입장
    } catch (err) {
      Alert.alert('가입 실패', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>회원가입</Text>

      {avatars.length > 0 && (
        <>
          <Text style={styles.label}>나의 캐릭터</Text>
          <View style={styles.avatarRow}>
            {avatars.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => setAvatarId(a.id)}
                style={[styles.avatar, avatarId === a.id && { borderColor: a.color, backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel={`${a.name} 캐릭터`}
                accessibilityState={{ selected: avatarId === a.id }}
              >
                <Text style={styles.avatarEmoji}>{a.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TextInput style={styles.input} placeholder="닉네임 (2~12자)" value={nickname} onChangeText={setNickname} maxLength={12} />
      <TextInput style={styles.input} placeholder="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="비밀번호 (8자 이상)" value={password} onChangeText={setPassword} secureTextEntry />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading} accessibilityRole="button">
        <Text style={styles.buttonText}>{loading ? '가입 중...' : '가입하고 시작하기'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, backgroundColor: colors.background, justifyContent: 'center' },
  title: { ...typography.title, fontSize: 28, color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  avatar: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm, marginBottom: spacing.sm, borderWidth: 2, borderColor: 'transparent',
    backgroundColor: colors.border,
  },
  avatarEmoji: { fontSize: 26 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, fontSize: 16,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: colors.onPrimary, fontSize: 18, fontWeight: 'bold' },
});
