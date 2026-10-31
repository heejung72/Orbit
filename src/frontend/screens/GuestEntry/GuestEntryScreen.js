import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

// Guest 발급 직후 안내: 랜덤 닉네임·캐릭터·30분 (만료 시각 기준 카운트다운은 #12)
export default function GuestEntryScreen({ route, onStart }) {
  const { nickname, avatarEmoji, expiresAt } = route.params;
  const until = new Date(expiresAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <Text style={styles.avatar}>{avatarEmoji}</Text>
      <Text style={styles.caption}>오늘 당신의 이름은</Text>
      <Text style={styles.nickname}>{nickname}</Text>
      <Text style={styles.body}>
        30분 동안 Orbit에 머물 수 있어요.{'\n'}
        {until}이 되면 이 궤도는 사라지고, 나눈 대화도 남지 않아요.
      </Text>
      <TouchableOpacity style={styles.button} onPress={onStart} accessibilityRole="button">
        <Text style={styles.buttonText}>둘러보기 시작</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  avatar: { fontSize: 64, marginBottom: spacing.md },
  caption: { ...typography.caption, color: colors.textMuted },
  nickname: { ...typography.title, color: colors.text, marginTop: spacing.xs, marginBottom: spacing.lg },
  body: { ...typography.body, color: colors.text, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  buttonText: { ...typography.body, color: colors.onPrimary, fontWeight: 'bold' },
});
