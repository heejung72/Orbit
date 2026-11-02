import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';
import OrbitVisualization from '../../components/OrbitVisualization';
import TasteTags from '../../components/TasteTags';
import { colors, spacing, radius, typography } from '../../theme';

// Home(궤도 대시보드) — PRD §4-3
// Header → Your Orbit(궤도 + 빠른 실행) → My Taste → Today's Question → Active Lounges
const ACTIVE_LOUNGE_COUNT = 3;

function greeting(hour) {
  if (hour >= 5 && hour < 12) return 'GOOD MORNING';
  if (hour >= 12 && hour < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

// 내 취향 → 카테고리별 행성 [{ categoryId, name, icon, count }]
function toPlanets(tastes) {
  const byCategory = new Map();
  for (const t of tastes) {
    const p = byCategory.get(t.category_id) || { categoryId: t.category_id, name: t.category, icon: t.category_icon, count: 0 };
    p.count += 1;
    byCategory.set(t.category_id, p);
  }
  return [...byCategory.values()];
}

function Section({ title, action, onAction, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {action ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.sectionAction}>{action} →</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [home, setHome] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // 포커스 갱신과 당겨서 새로고침이 겹칠 수 있어, 가장 마지막 요청의 결과만 반영한다
  const latestLoad = useRef(0);
  const load = useCallback(async () => {
    const id = ++latestLoad.current;
    setError('');
    try {
      const data = await api.getHome();
      if (id === latestLoad.current) setHome(data);
    } catch (err) {
      if (id === latestLoad.current) setError(err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message);
    }
  }, []);

  // 취향 편집 등에서 돌아올 때마다 새로고침
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!home) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={load} accessibilityRole="button" style={styles.retry}>
              <Text style={styles.link}>다시 시도</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const { me, tastes, question, lounges } = home;
  const planets = toPlanets(tastes);
  const openCategoryLounge = (planet) => {
    const lounge = lounges.find((l) => l.category_id === planet.categoryId);
    if (lounge) navigation.navigate('LoungeChat', { loungeId: lounge.id });
    else navigation.navigate('Lounge');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greeting(new Date().getHours())}</Text>
          <Text style={styles.nickname} numberOfLines={1}>{me.nickname}</Text>
          {/* Guest 남은 시간 카운트다운(GuestTimer)은 #12. 지금은 종료 시각만 표시 */}
          {me.type === 'guest' && (
            <Text style={styles.guestBadge}>
              둘러보기 중 · {new Date(me.expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}까지
            </Text>
          )}
        </View>
        <Avatar emoji={me.avatar_emoji} size={48} />
      </View>
      {/* 이미 보던 Home이 있을 때 갱신 실패: 기존 화면은 두고 안내 + 다시 시도 */}
      {error ? (
        <View style={styles.errorRow}>
          <Text style={styles.error} accessibilityRole="alert">{error}</Text>
          <Pressable onPress={load} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.link}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Your Orbit + Quick Action */}
      <Section title="Your Orbit">
        <View style={styles.orbit}>
          <OrbitVisualization
            size={Math.min(width - spacing.md * 4, 320)}
            avatarEmoji={me.avatar_emoji}
            planets={planets}
            onPlanetPress={openCategoryLounge}
          />
        </View>
        <View style={styles.quickRow}>
          <Pressable style={styles.quick} onPress={() => navigation.navigate('Lounge')} accessibilityRole="button">
            <Text style={styles.quickText}>라운지 둘러보기</Text>
          </Pressable>
          {/* 매칭 화면은 #13 — 지금은 대화 목록으로 */}
          <Pressable style={styles.quick} onPress={() => navigation.navigate('Chat')} accessibilityRole="button">
            <Text style={styles.quickText}>사람 만나기</Text>
          </Pressable>
        </View>
      </Section>

      {/* My Taste */}
      <Section title="My Taste" action="취향 편집" onAction={() => navigation.navigate('TasteSelect')}>
        {tastes.length > 0 ? (
          <TasteTags tags={tastes.map((t) => ({ id: t.tag_id, name: t.name, weight: t.weight }))} />
        ) : (
          <Text style={styles.muted}>아직 고른 취향이 없어요</Text>
        )}
      </Section>

      {/* Today's Question — 답변은 #15 */}
      {question && (
        <Section title="Today's Question">
          <Text style={styles.question}>{question.content}</Text>
          <Pressable
            style={styles.primary}
            onPress={() => navigation.navigate('TodayQuestion', { questionId: question.id })}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>답변하고 이야기하기</Text>
          </Pressable>
        </Section>
      )}

      {/* Active Lounges */}
      <Section title="Active Lounges" action="전체 보기" onAction={() => navigation.navigate('Lounge')}>
        {lounges.slice(0, ACTIVE_LOUNGE_COUNT).map((l) => (
          <Pressable
            key={l.id}
            style={styles.lounge}
            onPress={() => navigation.navigate('LoungeChat', { loungeId: l.id })}
            accessibilityRole="button"
          >
            <Text style={styles.loungeIcon}>{l.icon || l.category_icon}</Text>
            <Text style={styles.loungeName} numberOfLines={1}>{l.name}</Text>
            <Text style={styles.muted}>{l.member_count}명</Text>
          </Pressable>
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  muted: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.body, color: colors.primary },
  retry: { marginTop: spacing.md, padding: spacing.sm },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  error: { ...typography.caption, color: colors.primary, flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  headerText: { flex: 1, marginRight: spacing.md },
  greeting: { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
  nickname: { ...typography.title, color: colors.text },
  guestBadge: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },

  section: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.body, fontWeight: 'bold', color: colors.text },
  sectionAction: { ...typography.caption, color: colors.primary },

  orbit: { alignItems: 'center', paddingVertical: spacing.sm },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  quick: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary,
  },
  quickText: { ...typography.body, color: colors.primary },

  question: { ...typography.body, color: colors.text, marginBottom: spacing.md },
  primary: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  primaryText: { ...typography.body, color: colors.onPrimary, fontWeight: 'bold' },

  lounge: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  loungeIcon: { ...typography.title },
  loungeName: { ...typography.body, color: colors.text, flex: 1 },
});
