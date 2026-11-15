import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../services/api';
import { colors, spacing, radius, typography } from '../../theme';

// 오늘의 질문 화면 (#15) — 질문 보기, 답변 등록, 다른 사람 답변 목록, 대화 요청
export default function TodayQuestionScreen() {
  const [question, setQuestion] = useState(null);
  const [myAnswer, setMyAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [chatSent, setChatSent] = useState({}); // answerId → true
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const id = ++latestLoad.current;
    setLoading(true);
    setErrorText('');
    try {
      const data = await api.getTodayQuestion();
      if (id !== latestLoad.current) return;
      setQuestion(data.question);
      setMyAnswer(data.my_answer);
      if (data.question) {
        const adata = await api.getAnswers(data.question.id);
        if (id !== latestLoad.current) return;
        setAnswers(adata.answers || []);
        setNextBefore(adata.next_before || null);
      }
    } catch (err) {
      if (id !== latestLoad.current) return;
      setErrorText(err.message || '불러오는 중 오류가 발생했어요');
    } finally {
      if (id === latestLoad.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function loadMore() {
    if (!nextBefore || answersLoading || !question) return;
    setAnswersLoading(true);
    try {
      const data = await api.getAnswers(question.id, nextBefore);
      setAnswers((prev) => [...prev, ...(data.answers || [])]);
      setNextBefore(data.next_before || null);
    } catch (err) {
      setErrorText(err.message || '더 불러오는 중 오류가 발생했어요');
    } finally {
      setAnswersLoading(false);
    }
  }

  async function handleSubmit() {
    if (!answerText.trim() || submitting || !question) return;
    setSubmitting(true);
    setErrorText('');
    try {
      await api.submitAnswer(question.id, answerText.trim());
      setMyAnswer({ answer: answerText.trim(), created_at: new Date().toISOString() });
      setAnswerText('');
      const data = await api.getAnswers(question.id);
      setAnswers(data.answers || []);
      setNextBefore(data.next_before || null);
    } catch (err) {
      setErrorText(err.code === 'ALREADY_ANSWERED' ? '이미 답변했어요' : err.message || '답변 등록에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChat(answerId) {
    if (!question || chatSent[answerId]) return;
    setErrorText('');
    try {
      await api.chatWithAnswerer(question.id, answerId);
      setChatSent((prev) => ({ ...prev, [answerId]: true }));
    } catch (err) {
      setErrorText(err.message || '대화 요청에 실패했어요');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={answers}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

            {question ? (
              <View style={styles.questionCard}>
                <Text style={styles.questionLabel}>오늘의 질문</Text>
                <Text style={styles.questionText}>{question.content}</Text>
              </View>
            ) : (
              <View style={styles.questionCard}>
                <Text style={styles.questionText}>오늘은 질문이 없어요</Text>
              </View>
            )}

            {question && !myAnswer && (
              <View style={styles.inputArea}>
                <TextInput
                  style={styles.input}
                  placeholder="답변을 입력해주세요 (최대 300자)"
                  placeholderTextColor={colors.textMuted}
                  value={answerText}
                  onChangeText={setAnswerText}
                  multiline
                  maxLength={300}
                  accessibilityLabel="답변 입력"
                />
                <Text style={styles.charCount}>{answerText.length}/300</Text>
                <Pressable
                  style={[styles.button, (!answerText.trim() || submitting) && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={!answerText.trim() || submitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>{submitting ? '등록 중...' : '답변하기'}</Text>
                </Pressable>
              </View>
            )}

            {question && myAnswer && (
              <View style={styles.myAnswerCard}>
                <Text style={styles.myAnswerLabel}>내 답변</Text>
                <Text style={styles.myAnswerText}>{myAnswer.answer}</Text>
              </View>
            )}

            {answers.length > 0 && (
              <Text style={styles.sectionTitle}>다른 사람들의 답변</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.answerCard}>
            <View style={styles.answerHeader}>
              <Text style={styles.avatarEmoji}>{item.avatar_emoji}</Text>
              <Text style={styles.nickname}>{item.nickname}</Text>
            </View>
            <Text style={styles.answerText}>{item.answer}</Text>
            {item.ref && (
              <Pressable
                style={[styles.chatButton, chatSent[item.id] && styles.chatButtonSent]}
                onPress={() => handleChat(item.id)}
                disabled={chatSent[item.id]}
                accessibilityRole="button"
              >
                <Text style={styles.chatButtonText}>
                  {chatSent[item.id] ? '대화를 요청했어요' : '대화 시작'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        ListFooterComponent={
          nextBefore ? (
            <Pressable style={styles.moreButton} onPress={loadMore} disabled={answersLoading}>
              <Text style={styles.moreButtonText}>{answersLoading ? '불러오는 중...' : '더 보기'}</Text>
            </Pressable>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  questionCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  questionLabel: { ...typography.caption, color: colors.onPrimary, opacity: 0.8, marginBottom: spacing.xs },
  questionText: { ...typography.title, color: colors.onPrimary },
  inputArea: { marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: spacing.xs },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...typography.body, color: colors.onPrimary, fontWeight: 'bold' },
  myAnswerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: spacing.md,
  },
  myAnswerLabel: { ...typography.caption, color: colors.primary, marginBottom: spacing.xs },
  myAnswerText: { ...typography.body, color: colors.text },
  sectionTitle: { ...typography.body, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
  answerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  answerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  avatarEmoji: { fontSize: 20, marginRight: spacing.xs },
  nickname: { ...typography.caption, color: colors.textMuted },
  answerText: { ...typography.body, color: colors.text },
  chatButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  chatButtonSent: { backgroundColor: colors.textMuted },
  chatButtonText: { ...typography.caption, color: colors.onPrimary },
  moreButton: { padding: spacing.md, alignItems: 'center' },
  moreButtonText: { ...typography.body, color: colors.primary },
});
