import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 오늘의 질문: 답변 → 다른 답변 → 답변자와 대화
// 구현: #15
export default function TodayQuestionScreen() {
  return (
    <View style={styles.container}>
      <Text>TodayQuestionScreen (준비 중 · #15)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
