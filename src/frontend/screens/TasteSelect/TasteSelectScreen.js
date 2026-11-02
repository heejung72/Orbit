import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../../services/api';
import TasteTags, { WEIGHT_LABELS } from '../../components/TasteTags';
import { colors, spacing, radius, typography } from '../../theme';

// 서버(services/tastes.js)와 같은 규칙
const MIN_TAGS = 3;
const MAX_TAGS = 20;
const WEIGHTS = [1, 2, 3];

// 네트워크 오류(fetch TypeError)는 영어 메시지라 안내 문구로 바꾼다
const messageOf = (err, fallback) => (err instanceof TypeError ? fallback : err.message);

// 카테고리 탭 → 태그 선택 → 고른 태그마다 중요도(3/2/1) → 저장
// 온보딩(취향 0개)과 My Orbit "취향 편집"에서 함께 쓴다. 저장된 취향이 있으면 불러와서 편집한다.
export default function TasteSelectScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState([]); // [{ id, name, categoryId, weight }] 고른 순서
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cats, mine] = await Promise.all([api.getCategories(), api.getMyTastes()]);
      setCategories(cats);
      setActiveId(cats[0]?.id ?? null);
      setSelected(mine.map((t) => ({ id: t.tag_id, name: t.name, categoryId: t.category_id, weight: t.weight })));
    } catch (err) {
      setError(messageOf(err, '취향 목록을 불러오지 못했어요'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isSelected = (tagId) => selected.some((t) => t.id === tagId);

  const toggle = (tag, categoryId) => {
    setError('');
    if (isSelected(tag.id)) return setSelected(selected.filter((t) => t.id !== tag.id));
    if (selected.length >= MAX_TAGS) return setError(`취향은 최대 ${MAX_TAGS}개까지 고를 수 있어요`);
    setSelected([...selected, { id: tag.id, name: tag.name, categoryId, weight: 2 }]);
  };

  const setWeight = (tagId, weight) => setSelected(selected.map((t) => (t.id === tagId ? { ...t, weight } : t)));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateTastes(selected.map((t) => ({ tagId: t.id, weight: t.weight })));
      // 온보딩으로 들어온 경우엔 돌아갈 화면이 없으므로 Home으로 교체
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Main');
    } catch (err) {
      setError(messageOf(err, '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요'));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (categories.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error || '취향 목록이 비어 있어요'}</Text>
        <Pressable onPress={load} accessibilityRole="button" style={styles.retry}>
          <Text style={styles.retryText}>다시 불러오기</Text>
        </Pressable>
      </View>
    );
  }

  const active = categories.find((c) => c.id === activeId) || categories[0];
  const canSave = selected.length >= MIN_TAGS && !saving;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">나의 취향을 골라주세요</Text>
        <Text style={styles.muted}>{MIN_TAGS}~{MAX_TAGS}개를 고르고, 고른 취향마다 중요도를 정해주세요</Text>

        {/* 카테고리 탭 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {categories.map((cat) => {
            const on = cat.id === active.id;
            const count = selected.filter((t) => t.categoryId === cat.id).length;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setActiveId(cat.id)}
                style={[styles.tab, on && styles.tabOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {cat.icon} {cat.name}{count ? ` ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 태그 칩 */}
        <View style={styles.tags}>
          {active.tags.map((tag) => {
            const on = isSelected(tag.id);
            return (
              <Pressable
                key={tag.id}
                onPress={() => toggle(tag, active.id)}
                style={[styles.tag, on && styles.tagOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 선택 요약 + 고른 태그별 중요도 */}
        {selected.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>선택한 취향 {selected.length}/{MAX_TAGS}</Text>
            <TasteTags tags={selected} />
            <Text style={[styles.sectionTitle, styles.weightTitle]}>중요도</Text>
            {selected.map((t) => (
              <View key={t.id} style={styles.weightRow}>
                <Text style={styles.weightName} numberOfLines={1}>{t.name}</Text>
                <View style={styles.weightButtons} accessibilityRole="radiogroup">
                  {WEIGHTS.map((w) => {
                    const on = t.weight === w;
                    return (
                      <Pressable
                        key={w}
                        onPress={() => setWeight(t.id, w)}
                        style={[styles.weightButton, on && styles.weightButtonOn]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${t.name} ${WEIGHT_LABELS[w]}`}
                      >
                        <Text style={[styles.weightText, on && styles.weightTextOn]}>{WEIGHT_LABELS[w]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.save, !canSave && styles.saveDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          <Text style={styles.saveText}>
            {saving ? '저장하는 중...' : selected.length < MIN_TAGS ? `${MIN_TAGS - selected.length}개 더 골라주세요` : `저장하기 (${selected.length}개)`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  muted: { ...typography.caption, color: colors.textMuted },

  tabs: { gap: spacing.sm, paddingVertical: spacing.md },
  tab: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.body, color: colors.text },
  tabTextOn: { color: colors.onPrimary, fontWeight: 'bold' },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  tagOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  tagText: { ...typography.body, color: colors.text },
  tagTextOn: { color: colors.onPrimary },

  section: { marginTop: spacing.lg },
  sectionTitle: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  weightTitle: { marginTop: spacing.lg },
  weightRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  weightName: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  weightButtons: { flexDirection: 'row', gap: spacing.xs },
  weightButton: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  weightButtonOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  weightText: { ...typography.caption, color: colors.textMuted },
  weightTextOn: { color: colors.onPrimary, fontWeight: 'bold' },

  footer: {
    padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  error: { ...typography.caption, color: colors.primary },
  save: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  saveDisabled: { opacity: 0.4 },
  saveText: { ...typography.body, color: colors.onPrimary, fontWeight: 'bold' },
  retry: { marginTop: spacing.md, padding: spacing.sm },
  retryText: { ...typography.body, color: colors.primary },
});
