import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';
import { disconnectSocket } from '../../services/socket';
import RadarChart from '../../_legacy/components/RadarChart';

export default function MyOrbitScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    api.getProfile().then(data => {
      setProfile(data);
      setNickname(data.nickname);
      setBio(data.bio || '');
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await api.updateProfile({ nickname, bio });
      setProfile(prev => ({ ...prev, nickname, bio }));
      setEditing(false);
      Alert.alert('완료', '프로필이 수정되었습니다');
    } catch (err) {
      Alert.alert('오류', err.message);
    }
  };

  const handleLogout = async () => {
    disconnectSocket();
    await AsyncStorage.multiRemove(['token', 'user']);
    // 앱을 다시 시작하면 로그인 화면으로 이동
    Alert.alert('로그아웃', '앱을 다시 시작해주세요');
  };

  if (!profile) return <Text style={styles.loading}>로딩 중...</Text>;

  // 취향을 카테고리별로 그룹핑
  const tastesByCategory = {};
  (profile.tastes || []).forEach(t => {
    if (!tastesByCategory[t.category]) tastesByCategory[t.category] = [];
    tastesByCategory[t.category].push(t.taste);
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.nickname[0]}</Text>
        </View>
        {editing ? (
          <>
            <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="닉네임" />
            <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} placeholder="자기소개" multiline />
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveText}>저장</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.nickname}>{profile.nickname}</Text>
            <Text style={styles.bio}>{profile.bio || '자기소개를 입력해보세요'}</Text>
            <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
              <Text style={styles.editText}>프로필 수정</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 레이더 차트 */}
      {Object.keys(tastesByCategory).length >= 3 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>취향 분포</Text>
          <RadarChart
            data={Object.entries(tastesByCategory).map(([label, items]) => ({
              label,
              value: Math.min(items.length * 25, 100),
            }))}
          />
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>나의 취향</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TasteSelect')}>
            <Text style={styles.editLink}>수정</Text>
          </TouchableOpacity>
        </View>
        {Object.keys(tastesByCategory).length === 0 ? (
          <Text style={styles.emptyTaste}>아직 취향을 선택하지 않았습니다</Text>
        ) : (
          Object.entries(tastesByCategory).map(([category, tastes]) => (
            <View key={category} style={styles.tasteGroup}>
              <Text style={styles.tasteCategoryName}>{category}</Text>
              <View style={styles.tasteChips}>
                {tastes.map(t => (
                  <View key={t} style={styles.tasteChip}>
                    <Text style={styles.tasteChipText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loading: { textAlign: 'center', marginTop: 40, color: '#888' },
  header: { backgroundColor: '#fff', padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  nickname: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  bio: { fontSize: 15, color: '#888', marginTop: 4, textAlign: 'center' },
  input: { backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12, fontSize: 15, width: '100%', marginTop: 8 },
  bioInput: { height: 60, textAlignVertical: 'top' },
  editButton: { marginTop: 12, backgroundColor: '#E8E5FF', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  editText: { color: '#6C5CE7', fontWeight: 'bold' },
  saveButton: { marginTop: 12, backgroundColor: '#6C5CE7', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  saveText: { color: '#fff', fontWeight: 'bold' },
  section: { backgroundColor: '#fff', marginTop: 12, padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  editLink: { color: '#6C5CE7', fontWeight: 'bold' },
  emptyTaste: { color: '#888', fontSize: 14 },
  tasteGroup: { marginBottom: 12 },
  tasteCategoryName: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 6 },
  tasteChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tasteChip: { backgroundColor: '#F0EDFF', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  tasteChipText: { color: '#6C5CE7', fontSize: 13 },
  logoutButton: { margin: 20, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E74C3C', alignItems: 'center' },
  logoutText: { color: '#E74C3C', fontWeight: 'bold', fontSize: 15 },
});
