import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet } from 'react-native';
import { api } from '../../services/api';

export default function LoungeListScreen({ navigation }) {
  const [lounges, setLounges] = useState([]);
  const [search, setSearch] = useState('');

  const loadLounges = () => {
    const params = search ? { search } : {};
    api.getLounges(params).then(setLounges).catch(() => {});
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadLounges);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const timer = setTimeout(loadLounges, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('LoungeChat', { loungeId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.icon}>{item.category_icon}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.loungeName}>{item.name}</Text>
          <Text style={styles.loungeCategory}>{item.category_name}</Text>
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
        placeholder="라운지 검색..."
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={lounges}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>아직 열린 라운지가 없어요.</Text>}
      />

      {/* 라운지 생성은 V2 (src/frontend/_legacy/screens/ClubCreateScreen.js 참고) */}
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
  loungeName: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  loungeCategory: { fontSize: 13, color: '#888' },
  memberCount: { fontSize: 14, color: '#6C5CE7', fontWeight: 'bold' },
  description: { fontSize: 14, color: '#666', lineHeight: 20 },
  empty: { textAlign: 'center', marginTop: 60, color: '#888', fontSize: 15 },
});
