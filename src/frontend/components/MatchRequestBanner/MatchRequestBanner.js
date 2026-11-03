import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../Avatar';
import { colors, spacing, radius, typography } from '../../theme';

// 대화 요청 알림 (소켓 match:request, #13) — 어느 화면에서든 하단 탭 위에 표시
// request: { nickname, avatar_emoji, common_tags }
const TAB_BAR_HEIGHT = 60;

export default function MatchRequestBanner({ request, onOpen, onClose }) {
  const insets = useSafeAreaInsets();
  const common = request.common_tags?.length ? `공통 취향: ${request.common_tags.join(', ')}` : null;
  return (
    <View
      style={[styles.banner, { bottom: insets.bottom + TAB_BAR_HEIGHT + spacing.sm }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Avatar emoji={request.avatar_emoji} size={36} label={`${request.nickname}의 캐릭터`} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{request.nickname}님이 대화를 요청했어요</Text>
        {common && <Text style={styles.sub} numberOfLines={1}>{common}</Text>}
      </View>
      <Pressable onPress={onOpen} accessibilityRole="button" hitSlop={spacing.sm}>
        <Text style={styles.open}>보기</Text>
      </Pressable>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="알림 닫기" hitSlop={spacing.sm}>
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
    borderWidth: 1, borderColor: colors.primary,
  },
  body: { flex: 1 },
  title: { ...typography.body, color: colors.text, fontWeight: 'bold' },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  open: { ...typography.body, color: colors.primary, fontWeight: 'bold' },
  close: { ...typography.body, color: colors.textMuted },
});
