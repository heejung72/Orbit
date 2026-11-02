import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Avatar from '../../components/Avatar';
import { SpaceScreen, OrbitRings, SpaceButton, FadeUp, Floating } from '../../components/Space';
import { colors, spacing, typography } from '../../theme';

// Guest 발급 직후 안내: 랜덤 닉네임·캐릭터·30분 (만료 시각 기준 카운트다운은 #12)
export default function GuestEntryScreen({ route, onStart }) {
  const { nickname, avatarId, expiresAt } = route.params;
  const until = new Date(expiresAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <SpaceScreen style={styles.container}>
      <OrbitRings size={260} rings={4}>
        <Floating>
          <Avatar id={avatarId} size={96} />
        </Floating>
      </OrbitRings>

      <FadeUp delay={150} style={styles.center}>
        <Text style={styles.caption}>오늘 당신의 이름은</Text>
        <Text style={styles.nickname}>{nickname}</Text>
        <Text style={styles.body}>
          30분 동안 Orbit에 머물 수 있어요.{'\n'}
          {until}이 되면 이 궤도는 사라지고, 나눈 대화도 남지 않아요.
        </Text>
      </FadeUp>

      <FadeUp delay={300} style={styles.full}>
        <SpaceButton title="둘러보기 시작" onPress={onStart} />
      </FadeUp>
    </SpaceScreen>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  center: { alignItems: 'center' },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: spacing.lg },
  nickname: { ...typography.title, color: colors.text, marginTop: spacing.xs, marginBottom: spacing.lg },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  full: { alignSelf: 'stretch' },
});
