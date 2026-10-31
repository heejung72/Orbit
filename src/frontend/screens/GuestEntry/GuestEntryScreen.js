import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Guest 발급 결과: 랜덤 닉네임·기본 캐릭터·30분 안내
// 구현: #5
export default function GuestEntryScreen() {
  return (
    <View style={styles.container}>
      <Text>GuestEntryScreen (준비 중 · #5)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
