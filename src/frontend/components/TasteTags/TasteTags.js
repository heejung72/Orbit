import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

// 취향 태그 칩 목록 (TasteSelect 요약, 이후 Home·My Orbit에서 재사용)
// tags: [{ id, name, weight(1~3) }] — 중요도는 점 개수로 표시
export const WEIGHT_LABELS = { 3: '매우 좋아함', 2: '좋아함', 1: '관심 있음' };

export default function TasteTags({ tags }) {
  return (
    <View style={styles.wrap}>
      {tags.map((tag) => (
        <View key={tag.id} style={styles.chip} accessibilityLabel={`${tag.name}, ${WEIGHT_LABELS[tag.weight]}`}>
          <Text style={[styles.text, tag.weight === 3 && styles.strong]}>
            {tag.name} {'●'.repeat(tag.weight)}{'○'.repeat(3 - tag.weight)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, backgroundColor: colors.surface,
  },
  text: { ...typography.caption, color: colors.primary },
  strong: { fontWeight: 'bold' },
});
