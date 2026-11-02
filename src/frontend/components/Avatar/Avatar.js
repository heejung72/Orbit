import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

// 익명 캐릭터 (캐릭터 이모지를 원 안에 표시). 캐릭터 선택·꾸미기는 #17, 이미지 캐릭터는 #24
export default function Avatar({ emoji, size = 48 }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]} accessibilityLabel="내 캐릭터">
      <Text style={{ fontSize: size * 0.55 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary,
  },
});
