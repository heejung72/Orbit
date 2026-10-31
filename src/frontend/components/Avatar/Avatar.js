import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 익명 캐릭터 표시
// 구현: #17
export default function Avatar() {
  return (
    <View style={styles.container}>
      <Text>Avatar (준비 중 · #17)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
