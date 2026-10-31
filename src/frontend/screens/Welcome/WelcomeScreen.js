import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 첫 진입 화면: [회원가입] [로그인] [가입 없이 둘러보기]
// 구현: #6
export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <Text>WelcomeScreen (준비 중 · #6)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
