import React from 'react';
import { View, StyleSheet } from 'react-native';
import StarField from './StarField';
import { colors } from '../../theme';

// 별이 반짝이는 우주 배경 위에 화면 내용을 올린다
export default function SpaceScreen({ children, style }) {
  return (
    <View style={styles.root}>
      <StarField />
      <View style={[styles.root, styles.clear, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  clear: { backgroundColor: 'transparent' },
});
