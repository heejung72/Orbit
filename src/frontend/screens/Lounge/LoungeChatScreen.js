import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { api } from '../../services/api';

export default function LoungeChatScreen({ route, navigation }) {
  const { loungeId } = route.params;
  const [lounge, setLounge] = useState(null);

  useEffect(() => {
    api.getLounge(loungeId).then(data => {
      setLounge(data);
      navigation.setOptions({ title: data.name });
    }).catch(() => {});
  }, [loungeId]);

  const handleJoin = async () => {
    try {
      await api.joinLounge(loungeId);
      Alert.alert('참여 완료', '라운지에 참여했어요!');
      api.getLounge(loungeId).then(setLounge);
    } catch (err) {
      Alert.alert('오류', err.message);
    }
  };

  if (!lounge) return <Text style={styles.loading}>로딩 중...</Text>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{lounge.name}</Text>
        <Text style={styles.category}>{lounge.category_name} · {lounge.member_count}명</Text>
        <Text style={styles.description}>{lounge.description}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.joinButton} onPress={handleJoin} disabled={lounge.is_member}>
          <Text style={styles.joinText}>{lounge.is_member ? '참여 중' : '참여하기'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate('ChatRoom', { roomId: lounge.chat_room_id, title: lounge.name })}
        >
          <Text style={styles.chatText}>그룹 채팅</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>멤버 ({lounge.members?.length || 0})</Text>
      <FlatList
        data={lounge.members || []}
        keyExtractor={(item, index) => `${index}-${item.joined_at}`}
        renderItem={({ item }) => (
          <View style={styles.member}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{item.nickname[0]}</Text>
            </View>
            <Text style={styles.memberName}>{item.nickname}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loading: { textAlign: 'center', marginTop: 40, color: '#888' },
  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  category: { fontSize: 14, color: '#6C5CE7', marginTop: 4 },
  description: { fontSize: 15, color: '#666', marginTop: 10, lineHeight: 22 },
  owner: { fontSize: 13, color: '#888', marginTop: 8 },
  actions: { flexDirection: 'row', padding: 16, gap: 10 },
  joinButton: { flex: 1, backgroundColor: '#6C5CE7', borderRadius: 12, padding: 14, alignItems: 'center' },
  joinText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  chatButton: { flex: 1, backgroundColor: '#E8E5FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  chatText: { color: '#6C5CE7', fontWeight: 'bold', fontSize: 15 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginLeft: 16, marginTop: 8, marginBottom: 8, color: '#333' },
  member: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#fff', fontWeight: 'bold' },
  memberName: { fontSize: 15, marginLeft: 10, flex: 1, color: '#333' },
  badge: { backgroundColor: '#FFD93D', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 12, fontWeight: 'bold' },
});
