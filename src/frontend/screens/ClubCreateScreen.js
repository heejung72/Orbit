import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { api } from '../services/api';

export default function ClubCreateScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [maxMembers, setMaxMembers] = useState('50');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!name || !categoryId) {
      return Alert.alert('알림', '동호회 이름과 카테고리를 선택해주세요');
    }
    try {
      await api.createClub({
        name,
        description,
        category_id: categoryId,
        max_members: parseInt(maxMembers) || 50,
      });
      Alert.alert('완료', '동호회가 생성되었습니다!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('오류', err.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>동호회 이름</Text>
      <TextInput style={styles.input} placeholder="예: 인디음악 좋아하는 사람들" value={name} onChangeText={setName} />

      <Text style={styles.label}>카테고리</Text>
      <View style={styles.categories}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, categoryId === cat.id && styles.catChipSelected]}
            onPress={() => setCategoryId(cat.id)}
          >
            <Text style={[styles.catText, categoryId === cat.id && styles.catTextSelected]}>
              {cat.icon} {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>소개</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="동호회를 소개해주세요"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>최대 인원</Text>
      <TextInput style={styles.input} value={maxMembers} onChangeText={setMaxMembers} keyboardType="numeric" />

      <TouchableOpacity style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>동호회 만들기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20 },
  label: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDD' },
  catChipSelected: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  catText: { fontSize: 14, color: '#555' },
  catTextSelected: { color: '#fff', fontWeight: 'bold' },
  button: { backgroundColor: '#6C5CE7', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
