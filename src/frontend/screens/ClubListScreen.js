import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet } from 'react-native';
import { api } from '../services/api';

export default function ClubListScreen({ navigation }) {
  const [clubs, setClubs] = useState([]);
  const [search, setSearch] = useState('');

  const loadClubs = () => {
    const params = search ? { search } : {};
    api.getClubs(params).then(setClubs).catch(() => {});
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadClubs);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const timer = setTimeout(loadClubs, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ClubDetail', { clubId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.icon}>{item.category_icon}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.clubName}>{item.name}</Text>
          <Text style={styles.clubCategory}>{item.category_name}</Text>
        </View>
        <Text style={styles.memberCount}>{item.member_count}명</Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="동호회 검색..."
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={clubs}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={<Text style={styles.empty}>동호회가 없습니다. 첫 동호회를 만들어보세요!</Text>}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ClubCreate')}
      >
        <Text style={styles.fabText}>+ 동호회 만들기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  searchInput: {
    margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  icon: { fontSize: 28 },
  cardInfo: { flex: 1, marginLeft: 10 },
  clubName: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  clubCategory: { fontSize: 13, color: '#888' },
  memberCount: { fontSize: 14, color: '#6C5CE7', fontWeight: 'bold' },
  description: { fontSize: 14, color: '#666', lineHeight: 20 },
  empty: { textAlign: 'center', marginTop: 60, color: '#888', fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: '#6C5CE7', borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#6C5CE7', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
