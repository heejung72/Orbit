import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../../theme';

// Guest 만료 5분 전 안내 (서버 guest:warning, #12). 가입 유도 모달은 #14에서 같은 이벤트에 연결
// remainingSec: 이벤트가 알려준 남은 초 (연결 시 이미 5분 이하면 5분보다 적을 수 있음)
export default function GuestWarningBanner({ remainingSec, onClose }) {
  const minutes = Number.isFinite(remainingSec) ? Math.max(Math.round(remainingSec / 60), 1) : null;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.banner, { top: insets.top + spacing.sm }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text style={styles.text}>
        {minutes ? `궤도가 약 ${minutes}분 뒤에 사라져요.` : '궤도가 5분 이내에 사라져요.'} 가입하면 지금 나눈 대화를 이어갈 수 있어요.
      </Text>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="안내 닫기" hitSlop={spacing.sm}>
        <Text style={styles.close}>닫기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', left: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.danger,
  },
  text: { ...typography.caption, color: colors.text, flex: 1 },
  close: { ...typography.body, color: colors.danger, fontWeight: 'bold' },
});
