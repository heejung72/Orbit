import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, typography } from '../../theme';

// 채팅 목록: 1:1(회원끼리 PG 방 + Guest가 낀 Redis 방, #13) / 참여한 라운지
export default function ChatListScreen({ navigation }) {
  const [rooms, setRooms] = useState({ direct: [], lounges: [] });
  const [tab, setTab] = useState('direct');
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api
        .getChatRooms()
        .then((r) => {
          if (!alive) return;
          setRooms(r);
          setError('');
        })
        .catch((err) => alive && setError(err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message));
      return () => {
        alive = false;
      };
    }, [])
  );

  const isDirect = tab === 'direct';
  const data = isDirect ? rooms.direct : rooms.lounges;

  const renderItem = ({ item }) => {
    const title = isDirect ? item.partner_nickname : item.lounge_name;
    return (
      <Pressable
        style={styles.room}
        accessibilityRole="button"
        onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, title, type: isDirect ? 'direct' : 'lounge' })}
      >
        <Avatar emoji={isDirect ? item.partner_avatar_emoji : '👥'} size={48} label={isDirect ? `${title}의 캐릭터` : '라운지'} />
        <View style={styles.roomInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.roomName} numberOfLines={1}>{title}</Text>
            {isDirect && item.partner_is_guest && <Text style={styles.guestBadge}>Guest</Text>}
          </View>
          <Text style={styles.lastMsg} numberOfLines={1}>{item.last_message || '아직 메시지가 없어요'}</Text>
        </View>
      </Pressable>
    );
  };

  const renderTab = (value, label) => (
    <Pressable
      key={value}
      style={[styles.tab, tab === value && styles.tabActive]}
      onPress={() => setTab(value)}
      accessibilityRole="tab"
      accessibilityState={{ selected: tab === value }}
    >
      <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {renderTab('direct', '1:1 채팅')}
        {renderTab('lounges', '라운지 채팅')}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{isDirect ? '아직 1:1 대화가 없어요' : '참여한 라운지가 없어요'}</Text>
          <Pressable
            style={styles.emptyButton}
            accessibilityRole="button"
            onPress={() => (isDirect ? navigation.navigate('Matching') : navigation.navigate('Lounge'))}
          >
            <Text style={styles.emptyButtonText}>{isDirect ? '취향 비슷한 사람 만나기' : '라운지 둘러보기'}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList data={data} renderItem={renderItem} keyExtractor={(item) => item.id} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, padding: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.body, color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: 'bold' },
  error: { ...typography.caption, color: colors.danger, padding: spacing.md },

  room: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  roomInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  roomName: { ...typography.body, fontWeight: 'bold', color: colors.text, flexShrink: 1 },
  guestBadge: {
    ...typography.caption, color: colors.primary, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.sm, paddingHorizontal: spacing.xs,
  },
  lastMsg: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  empty: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl * 2 },
  emptyText: { ...typography.body, color: colors.textMuted },
  emptyButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  emptyButtonText: { ...typography.body, color: colors.primary, fontWeight: 'bold' },
});
