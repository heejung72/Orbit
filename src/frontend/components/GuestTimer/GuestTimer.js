import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Guest 남은 시간 카운트다운 (expiresAt 기준)
// 구현: #12
export default function GuestTimer() {
  return (
    <View style={styles.container}>
      <Text>GuestTimer (준비 중 · #12)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
