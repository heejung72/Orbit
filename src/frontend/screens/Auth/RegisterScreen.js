import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, Alert, ScrollView } from 'react-native';
import { api } from '../../services/api';
import { saveMemberSession } from '../../services/storage';
import Avatar from '../../components/Avatar';
import { SpaceScreen, SpaceButton, SpaceInput, FadeUp } from '../../components/Space';
import { colors, spacing, typography, glow, nativeDriver } from '../../theme';

// 서버(routes/auth.js)와 같은 가입 규칙
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 고르면 커지면서 빛나는 캐릭터
function AvatarOption({ avatar, selected, onPress }) {
  const scale = useRef(new Animated.Value(selected ? 1.15 : 1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: selected ? 1.15 : 1, bounciness: 12, useNativeDriver: nativeDriver }).start();
  }, [selected, scale]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${avatar.name} 캐릭터`}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.avatar, selected && styles.avatarSelected, { transform: [{ scale }] }]}>
        <Avatar id={avatar.id} size={44} />
      </Animated.View>
    </Pressable>
  );
}

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
    <SpaceScreen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <FadeUp>
          <Text style={styles.title}>나의 궤도 만들기</Text>

          {avatars.length > 0 && (
            <>
              <Text style={styles.label}>나의 캐릭터</Text>
              <View style={styles.avatarRow}>
                {avatars.map((a) => (
                  <AvatarOption key={a.id} avatar={a} selected={avatarId === a.id} onPress={() => setAvatarId(a.id)} />
                ))}
              </View>
            </>
          )}

          <SpaceInput placeholder="닉네임 (2~12자)" value={nickname} onChangeText={setNickname} maxLength={12} />
          <SpaceInput placeholder="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <SpaceInput placeholder="비밀번호 (8자 이상)" value={password} onChangeText={setPassword} secureTextEntry />

          <SpaceButton title={loading ? '가입 중...' : '가입하고 시작하기'} onPress={handleRegister} disabled={loading} style={styles.button} />
        </FadeUp>
      </ScrollView>
    </SpaceScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
  title: { ...typography.title, fontSize: 28, color: colors.text, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.lg },
  avatar: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.surface,
  },
  avatarSelected: { borderColor: colors.primaryLight, ...glow(colors.primary, 12) },
  button: { marginTop: spacing.sm },
});
