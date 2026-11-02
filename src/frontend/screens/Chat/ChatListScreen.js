import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { api } from '../../services/api';
import { colors } from '../../theme';
import { Icon } from '../../components/Space';

export default function ChatListScreen({ navigation }) {
  const [rooms, setRooms] = useState({ direct: [], lounges: [] });
  const [tab, setTab] = useState('direct');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      api.getChatRooms().then(setRooms).catch(() => {});
    });
    return unsubscribe;
  }, [navigation]);

  const data = tab === 'direct' ? rooms.direct : rooms.lounges;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.room}
      onPress={() => navigation.navigate('ChatRoom', {
        roomId: item.id,
        title: tab === 'direct' ? item.partner_nickname : item.lounge_name,
      })}
    >
      <View style={styles.avatar}>
        {tab === 'direct'
          ? <Text style={styles.avatarText}>{item.partner_nickname?.[0]}</Text>
          : <Icon name="lounge" size={22} color={colors.onPrimary} />}
      </View>
      <View style={styles.roomInfo}>
        <Text style={styles.roomName}>
          {tab === 'direct' ? item.partner_nickname : item.lounge_name}
        </Text>
        <Text style={styles.lastMsg} numberOfLines={1}>
          {item.last_message || '아직 메시지가 없습니다'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'direct' && styles.tabActive]} onPress={() => setTab('direct')}>
          <Text style={[styles.tabText, tab === 'direct' && styles.tabTextActive]}>1:1 채팅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'lounges' && styles.tabActive]} onPress={() => setTab('lounges')}>
          <Text style={[styles.tabText, tab === 'lounges' && styles.tabTextActive]}>라운지 채팅</Text>
        </TouchableOpacity>
      </View>

      {data.length === 0 ? (
        <Text style={styles.empty}>채팅방이 없습니다</Text>
      ) : (
        <FlatList data={data} renderItem={renderItem} keyExtractor={item => item.id} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceSolid, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, padding: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: 15, color: colors.textMuted },
  tabTextActive: { color: colors.primaryLight, fontWeight: 'bold' },
  room: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surfaceSolid, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.onPrimary, fontSize: 20, fontWeight: 'bold' },
  roomInfo: { flex: 1, marginLeft: 12 },
  roomName: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  lastMsg: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 60, color: colors.textMuted, fontSize: 15 },
});
