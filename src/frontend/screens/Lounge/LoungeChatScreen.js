import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, typography } from '../../theme';

// 라운지 상세: 소개·대표 태그·참여/나가기(회원·Guest)·그룹 채팅 입장·참여자 (#11)
const messageOf = (err) => (err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message);

export default function LoungeChatScreen({ route, navigation }) {
  const { loungeId } = route.params;
  const [lounge, setLounge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.getLounge(loungeId);
      setLounge(data);
      navigation.setOptions({ title: data.name });
    } catch (err) {
      setError(messageOf(err));
    }
  }, [loungeId, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleJoin = async () => {
    setBusy(true);
    setError('');
    try {
      if (lounge.is_member) await api.leaveLounge(loungeId);
      else await api.joinLounge(loungeId);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  if (!lounge) {
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

  const header = (
    <View>
      <View style={styles.card}>
        <Text style={styles.icon}>{lounge.icon || lounge.category_icon}</Text>
        <Text style={styles.name} accessibilityRole="header">{lounge.name}</Text>
        <Text style={styles.meta}>{lounge.category_name} · {lounge.member_count}명 참여</Text>
        {lounge.description ? <Text style={styles.desc}>{lounge.description}</Text> : null}
        {lounge.tags.length > 0 && (
          <View style={styles.tags}>
            {lounge.tags.map((t) => (
              <Text key={t.id} style={styles.tag}>{t.name}</Text>
            ))}
          </View>
        )}
      </View>

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, lounge.is_member ? styles.outline : styles.primary, busy && styles.disabled]}
          onPress={toggleJoin}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, lounge.is_member ? styles.outlineText : styles.primaryText]}>
            {lounge.is_member ? '나가기' : '참여하기'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.primary, !lounge.chat_room_id && styles.disabled]}
          disabled={!lounge.chat_room_id}
          onPress={() => navigation.navigate('ChatRoom', { roomId: lounge.chat_room_id, title: lounge.name, type: 'lounge' })}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, styles.primaryText]}>{lounge.chat_room_id ? '그룹 채팅' : '채팅 준비 중'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle} accessibilityRole="header">참여자</Text>
      {lounge.guest_count > 0 && <Text style={styles.muted}>둘러보는 Guest {lounge.guest_count}명도 함께하고 있어요</Text>}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={lounge.members}
      keyExtractor={(item, index) => `${index}-${item.joined_at}`}
      ListHeaderComponent={header}
      ListEmptyComponent={lounge.guest_count === 0 ? <Text style={styles.muted}>첫 번째 참여자가 되어보세요</Text> : null}
      renderItem={({ item }) => (
        <View style={styles.member}>
          <Avatar emoji={item.avatar_emoji} size={36} label={`${item.nickname}의 캐릭터`} />
          <Text style={styles.memberName}>{item.nickname}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  muted: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  link: { ...typography.body, color: colors.primary },
  retry: { marginTop: spacing.md, padding: spacing.sm },
  error: { ...typography.caption, color: colors.primary, marginBottom: spacing.sm },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  icon: { ...typography.title, marginBottom: spacing.xs },
  name: { ...typography.title, color: colors.text },
  meta: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  desc: { ...typography.body, color: colors.text, marginTop: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  tag: {
    ...typography.caption, color: colors.primary, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },

  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  button: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.primary },
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: colors.surface },
  disabled: { opacity: 0.4 },
  buttonText: { ...typography.body, fontWeight: 'bold' },
  primaryText: { color: colors.onPrimary },
  outlineText: { color: colors.primary },

  sectionTitle: { ...typography.body, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  memberName: { ...typography.body, color: colors.text },
});
