import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from './Icon';
import { colors } from '../../theme';

// 취향 카테고리 아이콘 (DB의 이모지 icon 대신 사용)
// id는 seeds/data.js categories 순서(SERIAL 1~7). db:setup으로 만든 DB 기준.
const BY_ID = { 1: 'music', 2: 'movie', 3: 'book', 4: 'food', 5: 'travel', 6: 'sports', 7: 'hobby' };

export default function CategoryBadge({ categoryId, code, size = 40 }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon name={code ?? BY_ID[categoryId]} size={size * 0.5} color={colors.primaryLight} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
