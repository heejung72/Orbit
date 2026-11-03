import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../services/api';
import { subscribe } from '../../services/socket';
import { openChatRoom } from '../../navigation/navigationRef';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, typography } from '../../theme';

// 사람 만나기 (1:1 취향 매칭, #13) — PRD §3-2
// 받은 요청(수락·거절) → 추천 후보(지금 접속 중, 취향 비슷한 순) → 보낸 요청
// 수락되면 App이 match:accepted를 받아 양쪽 모두 채팅방으로 이동한다
const errorText = (err) => (err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message);

function Person({ item, children }) {
  return (
    <View style={styles.person}>
      <Avatar emoji={item.avatar_emoji} size={48} label={`${item.nickname}의 캐릭터`} />
      <View style={styles.personBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.nickname}</Text>
          {item.is_guest && <Text style={styles.guestBadge}>Guest</Text>}
        </View>
        <Text style={styles.similarity}>취향 {item.similarity}% 일치</Text>
        {item.common_tags?.length > 0 && (
          <View style={styles.tags}>
            {item.common_tags.map((t) => (
              <Text key={t} style={styles.tag}>{t}</Text>
            ))}
          </View>
        )}
        {children}
      </View>
    </View>
  );
}

function Button({ label, onPress, disabled, variant = 'primary' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.button, variant === 'outline' && styles.buttonOutline, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, variant === 'outline' && styles.buttonTextOutline]}>{label}</Text>
    </Pressable>
  );
}

export default function MatchingScreen({ navigation }) {
  const [candidates, setCandidates] = useState(null); // null = 처음 불러오는 중
  const [requests, setRequests] = useState({ received: [], sent: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null); // 처리 중인 ref·요청 id (연타 방지)
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const latest = useRef(0);

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await api.getMatchRequests());
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  // 포커스·당겨서 새로고침이 겹치면 마지막 요청 결과만 반영
  const load = useCallback(async () => {
    const id = ++latest.current;
    setError('');
    try {
      const [c, r] = await Promise.all([api.getCandidates(), api.getMatchRequests()]);
      if (id !== latest.current) return;
      setCandidates(c.candidates);
      setRequests(r);
    } catch (err) {
      if (id !== latest.current) return;
      setCandidates((prev) => prev || []);
      setError(errorText(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // 이 화면을 보는 중에 요청을 받거나, 보낸 요청이 거절되면 바로 반영
  useEffect(() => {
    const offRequest = subscribe('match:request', () => loadRequests());
    // match:rejected는 요청한 사람에게만 온다
    const offRejected = subscribe('match:rejected', ({ matchId }) => {
      setRequests((prev) => ({ ...prev, sent: prev.sent.filter((m) => m.id !== matchId) }));
      setNotice('보낸 요청이 수락되지 않았어요. 다른 사람과도 이야기해 보세요');
    });
    return () => {
      offRequest();
      offRejected();
    };
  }, [loadRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sendRequest = async (candidate) => {
    setBusy(candidate.ref);
    setError('');
    setNotice('');
    try {
      const sent = await api.requestMatch(candidate.ref);
      setCandidates((prev) => prev.filter((c) => c.ref !== candidate.ref));
      setRequests((prev) => ({ ...prev, sent: [sent, ...prev.sent] }));
      setNotice(`${candidate.nickname}님에게 대화를 요청했어요`);
    } catch (err) {
      setError(errorText(err));
      // 추천 만료(10분)·상대 접속 종료 등은 목록을 새로 받아야 함
      if (['REF_INVALID', 'TARGET_OFFLINE', 'ALREADY_RECEIVED', 'NOT_AVAILABLE', 'ALREADY_REQUESTED'].includes(err.code)) load();
    } finally {
      setBusy(null);
    }
  };

  const respond = async (request, accept) => {
    setBusy(request.id);
    setError('');
    setNotice('');
    try {
      if (accept) {
        const { roomId, title } = await api.acceptMatch(request.id);
        openChatRoom({ roomId, title });
      } else {
        await api.rejectMatch(request.id);
      }
      setRequests((prev) => ({ ...prev, received: prev.received.filter((m) => m.id !== request.id) }));
    } catch (err) {
      setError(errorText(err));
      loadRequests(); // 상대가 만료됐거나 이미 처리된 요청
    } finally {
      setBusy(null);
    }
  };

  if (candidates === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}

      {requests.received.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">받은 요청</Text>
          {requests.received.map((r) => (
            <Person key={r.id} item={r}>
              <View style={styles.actions}>
                <Button label="수락" onPress={() => respond(r, true)} disabled={busy === r.id} />
                <Button label="거절" variant="outline" onPress={() => respond(r, false)} disabled={busy === r.id} />
              </View>
            </Person>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">지금 접속 중인 비슷한 궤도</Text>
          <Pressable onPress={onRefresh} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.sectionAction}>새로고침</Text>
          </Pressable>
        </View>
        {candidates.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>지금은 취향이 비슷한 사람이 없어요</Text>
            <Text style={styles.emptySub}>라운지에서 먼저 이야기를 나눠 보세요</Text>
            <Button label="라운지 둘러보기" variant="outline" onPress={() => navigation.navigate('Main', { screen: 'Lounge' })} />
          </View>
        ) : (
          candidates.map((c) => (
            <Person key={c.ref} item={c}>
              <View style={styles.actions}>
                <Button label="대화 요청" onPress={() => sendRequest(c)} disabled={busy === c.ref} />
              </View>
            </Person>
          ))
        )}
      </View>

      {requests.sent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">보낸 요청</Text>
          {requests.sent.map((r) => (
            <Person key={r.id} item={r}>
              <Text style={styles.waiting}>응답을 기다리고 있어요</Text>
            </Person>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { ...typography.caption, color: colors.danger },
  notice: { ...typography.caption, color: colors.primary },

  section: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...typography.body, fontWeight: 'bold', color: colors.text },
  sectionAction: { ...typography.caption, color: colors.primary },

  person: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  personBody: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.body, fontWeight: 'bold', color: colors.text, flexShrink: 1 },
  guestBadge: {
    ...typography.caption, color: colors.primary, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.sm, paddingHorizontal: spacing.xs,
  },
  similarity: { ...typography.caption, color: colors.primary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: {
    ...typography.caption, color: colors.text, backgroundColor: colors.background,
    borderRadius: radius.lg, paddingVertical: spacing.xs / 2, paddingHorizontal: spacing.sm, overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  waiting: { ...typography.caption, color: colors.textMuted },

  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  buttonOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...typography.body, color: colors.onPrimary, fontWeight: 'bold' },
  buttonTextOutline: { color: colors.primary },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  emptyText: { ...typography.body, color: colors.text },
  emptySub: { ...typography.caption, color: colors.textMuted },
});
