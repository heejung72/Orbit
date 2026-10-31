import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { api } from '../../services/api';

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
        <Text style={styles.avatarText}>
          {tab === 'direct' ? item.partner_nickname?.[0] : '👥'}
        </Text>
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  tab: { flex: 1, padding: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6C5CE7' },
  tabText: { fontSize: 15, color: '#888' },
  tabTextActive: { color: '#6C5CE7', fontWeight: 'bold' },
  room: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  roomInfo: { flex: 1, marginLeft: 12 },
  roomName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  lastMsg: { fontSize: 14, color: '#888', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 60, color: '#888', fontSize: 15 },
});
