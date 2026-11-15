import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { api } from '../../services/api';
import { saveMemberSession } from '../../services/storage';
import { colors, spacing, radius, typography } from '../../theme';

// 서버(routes/auth.js)와 같은 가입 규칙
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICK_MAX = 12;

// 회원가입. upgrade(#14): 둘러보던 Guest가 가입 — 닉네임·캐릭터를 미리 채우고(수정 가능),
// api.register가 Guest 토큰을 함께 보내 서버가 취향·라운지·대화를 새 계정으로 옮긴다
// 가입 후 세션을 회원으로 바꾸고(onLogin → 소켓 재연결), 채팅방에서 왔으면 그 방으로 돌아간다
export default function RegisterScreen({ navigation, route, onLogin, upgrade = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatars, setAvatars] = useState([]);
  const [avatarId, setAvatarId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([api.getAvatars(), upgrade ? api.me().catch(() => null) : null])
      .then(([list, me]) => {
        if (!alive) return;
        setAvatars(list);
        setAvatarId(me?.avatar_id ?? list[0]?.id ?? null);
        if (me?.nickname) setNickname(me.nickname.slice(0, NICK_MAX)); // Guest 닉네임이 12자를 넘으면 잘라서 제안
      })
      .catch(() => {}); // 목록을 못 받아도 서버 기본 캐릭터로 가입 가능
    return () => {
      alive = false;
    };
  }, [upgrade]);

  const handleRegister = async () => {
    const nick = nickname.trim();
    if (!EMAIL_RE.test(email.trim())) return setError('이메일 형식을 확인해주세요');
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 해요');
    if (nick.length < 2 || nick.length > NICK_MAX) return setError('닉네임은 2~12자로 입력해주세요');

    setLoading(true);
    setError('');
    try {
      const data = await api.register(email.trim(), password, nick, avatarId ?? undefined);
      await saveMemberSession(data.token, data.user); // Guest 토큰도 여기서 지워진다
      await onLogin(); // 회원으로 다시 확인 → App이 소켓을 회원 토큰으로 다시 연결
      if (upgrade) {
        const returnTo = route?.params?.returnTo;
        navigation.reset({ index: returnTo ? 1 : 0, routes: [{ name: 'Main' }, ...(returnTo ? [returnTo] : [])] });
      }
    } catch (err) {
      setError(err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message);
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{upgrade ? '궤도를 이어가요' : '회원가입'}</Text>
      {upgrade && <Text style={styles.subtitle}>취향·라운지·지금까지 나눈 대화가 새 계정으로 옮겨져요</Text>}

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

      <TextInput style={styles.input} placeholder="닉네임 (2~12자)" value={nickname} onChangeText={setNickname} maxLength={NICK_MAX} accessibilityLabel="닉네임" />
      <TextInput style={styles.input} placeholder="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="이메일" />
      <TextInput style={styles.input} placeholder="비밀번호 (8자 이상)" value={password} onChangeText={setPassword} secureTextEntry accessibilityLabel="비밀번호" />

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={handleRegister} disabled={loading} accessibilityRole="button">
        <Text style={styles.buttonText}>{loading ? '가입 중...' : upgrade ? '가입하고 이어가기' : '가입하고 시작하기'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, backgroundColor: colors.background, justifyContent: 'center' },
  title: { ...typography.title, fontSize: 28, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
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
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.onPrimary, fontSize: 18, fontWeight: 'bold' },
});
