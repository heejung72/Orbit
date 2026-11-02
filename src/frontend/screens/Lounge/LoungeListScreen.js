import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, FlatList, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../services/api';
import { colors, spacing, radius, typography } from '../../theme';

// 라운지 목록: 내 취향 추천(가로) + 카테고리 필터 + 검색 + 인원순 목록 (#11)
const SEARCH_DELAY_MS = 300;
const messageOf = (err) => (err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message);

export default function LoungeListScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null); // null = 전체
  const [search, setSearch] = useState('');
  const [lounges, setLounges] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [error, setError] = useState('');
  const latest = useRef(0); // 필터·검색을 빠르게 바꿔도 마지막 요청 결과만 반영

  const loadLounges = useCallback(async () => {
    const id = ++latest.current;
    setError('');
    try {
      const params = {};
      if (categoryId) params.category_id = categoryId;
      if (search.trim()) params.search = search.trim();
      const data = await api.getLounges(params);
      if (id === latest.current) setLounges(data);
    } catch (err) {
      if (id === latest.current) setError(messageOf(err));
    }
  }, [categoryId, search]);

  // 화면에 들어올 때마다 추천·카테고리·목록 새로고침 (취향·참여가 바뀌었을 수 있음)
  // 검색어가 바뀔 때는 아래 effect가 목록만 다시 불러온다
  const loadRef = useRef(loadLounges);
  loadRef.current = loadLounges;
  useFocusEffect(useCallback(() => {
    api.getRecommendedLounges().then(setRecommended).catch(() => setRecommended([]));
    api.getCategories().then(setCategories).catch(() => {});
    loadRef.current();
  }, []));

  useEffect(() => {
    const timer = setTimeout(loadLounges, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loadLounges]);

  const open = (lounge) => navigation.navigate('LoungeChat', { loungeId: lounge.id });
  const showRecommended = recommended.length > 0 && !categoryId && !search.trim();

  const header = (
    <View>
      <TextInput
        style={styles.search}
        placeholder="라운지 검색"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        accessibilityLabel="라운지 검색"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[{ id: null, name: '전체', icon: '' }, ...categories].map((c) => {
          const on = c.id === categoryId;
          return (
            <Pressable
              key={c.id ?? 'all'}
              onPress={() => setCategoryId(c.id)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.icon ? `${c.icon} ` : ''}{c.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {showRecommended && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">내 취향 추천</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recRow}>
            {recommended.map((l) => (
              <Pressable key={l.id} style={styles.recCard} onPress={() => open(l)} accessibilityRole="button">
                <Text style={styles.recIcon}>{l.icon || l.category_icon}</Text>
                <Text style={styles.recName} numberOfLines={2}>{l.name}</Text>
                <Text style={styles.muted}>{l.member_count}명</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={styles.sectionTitle} accessibilityRole="header">{showRecommended ? '모든 라운지' : '라운지'}</Text>
      {error ? (
        <View style={styles.errorRow}>
          <Text style={styles.error} accessibilityRole="alert">{error}</Text>
          <Pressable onPress={loadLounges} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.link}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={lounges}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={!error ? <Text style={styles.empty}>조건에 맞는 라운지가 없어요</Text> : null}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => open(item)} accessibilityRole="button">
          <View style={styles.cardHeader}>
            <Text style={styles.icon}>{item.icon || item.category_icon}</Text>
            <View style={styles.cardInfo}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.muted}>{item.category_name}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.count}>{item.member_count}명</Text>
              {item.is_member && <Text style={styles.joined}>참여 중</Text>}
            </View>
          </View>
          {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  muted: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.body, color: colors.primary },
  search: {
    ...typography.body, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  chips: { gap: spacing.sm, paddingVertical: spacing.md },
  chip: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text },
  chipTextOn: { color: colors.onPrimary, fontWeight: 'bold' },

  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.body, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
  recRow: { gap: spacing.sm },
  recCard: {
    width: 140, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.primary, gap: spacing.xs,
  },
  recIcon: { ...typography.title },
  recName: { ...typography.body, fontWeight: 'bold', color: colors.text },

  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  error: { ...typography.caption, color: colors.primary, flex: 1 },
  empty: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { ...typography.title },
  cardInfo: { flex: 1 },
  name: { ...typography.body, fontWeight: 'bold', color: colors.text },
  right: { alignItems: 'flex-end' },
  count: { ...typography.body, color: colors.primary, fontWeight: 'bold' },
  joined: { ...typography.caption, color: colors.textMuted },
  desc: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
