import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

// Guest 30분이 끝났을 때 (#12, PRD §2-3): 안내 + 가입 유도. 임시 닉네임·취향·대화는 이미 정리됨
export default function OrbitExpiredScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">궤도가 사라졌어요</Text>
      <Text style={styles.body}>
        30분 둘러보기가 끝나 임시 닉네임과 대화가 정리됐어요.{'\n'}가입하면 다음에도 대화를 이어갈 수 있어요.
      </Text>
      <Pressable style={styles.primary} onPress={() => navigation.navigate('Register')} accessibilityRole="button">
        <Text style={styles.primaryText}>회원가입</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => navigation.replace('Welcome')} accessibilityRole="button">
        <Text style={styles.secondaryText}>처음으로</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xl },
  primary: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  primaryText: { ...typography.body, color: colors.onPrimary, fontWeight: 'bold' },
  secondary: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  secondaryText: { ...typography.body, color: colors.primary },
});
