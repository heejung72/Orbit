import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

// Guest 가입 유도 모달 (#14) — 열리는 때: 채팅방 "대화 저장하기", 만료 5분 전(guest:warning), 메시지 20개(signup:nudge)
// "나중에"를 눌러도 남은 시간 동안 계속 둘러볼 수 있다
// nudge: { reason: 'save' | 'warning' | 'messages', remainingSec? }
function headline({ reason, remainingSec }) {
  if (reason === 'warning') {
    const minutes = Number.isFinite(remainingSec) ? Math.max(Math.round(remainingSec / 60), 1) : null;
    return minutes ? `궤도가 약 ${minutes}분 뒤에 사라져요` : '궤도가 5분 이내에 사라져요';
  }
  if (reason === 'messages') return '대화가 즐거우신가요?';
  return '이 대화를 저장할까요?';
}

export default function SignupNudgeModal({ nudge, onSignup, onLater }) {
  return (
    <Modal visible={!!nudge} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          {nudge && (
            <>
              <Text style={styles.title}>{headline(nudge)}</Text>
              <Text style={styles.body}>대화를 이어가고 싶나요? 가입하면 취향·라운지·지금 나눈 대화가 그대로 옮겨져요.</Text>
              <Pressable style={[styles.button, styles.primary]} onPress={onSignup} accessibilityRole="button">
                <Text style={[styles.buttonText, styles.primaryText]}>지금 가입하기</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={onLater} accessibilityRole="button">
                <Text style={[styles.buttonText, styles.laterText]}>나중에</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.overlay },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  button: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  primary: { backgroundColor: colors.primary },
  buttonText: { ...typography.body, fontWeight: 'bold' },
  primaryText: { color: colors.onPrimary },
  laterText: { color: colors.textMuted },
});
