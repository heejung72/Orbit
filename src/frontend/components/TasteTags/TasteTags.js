import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 취향 태그 칩 목록 (Home·MyOrbit 재사용)
// 구현: #7
export default function TasteTags() {
  return (
    <View style={styles.container}>
      <Text>TasteTags (준비 중 · #7)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
