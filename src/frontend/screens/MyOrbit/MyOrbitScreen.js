import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { clearSession } from '../../services/storage';
import { api } from '../../services/api';
import { colors } from '../../theme';
import Avatar from '../../components/Avatar';
import { disconnectSocket } from '../../services/socket';
import RadarChart from '../../_legacy/components/RadarChart';

export default function MyOrbitScreen({ navigation, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    api.getProfile().then(data => {
      setProfile(data);
      setNickname(data.nickname);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await api.updateProfile({ nickname });
      setProfile(prev => ({ ...prev, nickname }));
      setEditing(false);
      Alert.alert('완료', '프로필이 수정되었습니다');
    } catch (err) {
      Alert.alert('오류', err.message);
    }
  };

  const handleLogout = async () => {
    disconnectSocket();
    await clearSession();
    onLogout?.();
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
        <Avatar id={profile.avatar_id} size={88} style={styles.avatar} />
        {editing ? (
          <>
            <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="닉네임" />
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveText}>저장</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.nickname}>{profile.nickname}</Text>
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
  container: { flex: 1, backgroundColor: colors.background },
  loading: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  header: { backgroundColor: colors.surfaceSolid, padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { marginBottom: 12 },
  nickname: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  bio: { fontSize: 15, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  input: { color: colors.text, backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, width: '100%', marginTop: 8 },
  bioInput: { color: colors.text, height: 60, textAlignVertical: 'top' },
  editButton: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  editText: { color: colors.primaryLight, fontWeight: 'bold' },
  saveButton: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  saveText: { color: colors.onPrimary, fontWeight: 'bold' },
  section: { backgroundColor: colors.surfaceSolid, marginTop: 12, padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  editLink: { color: colors.primaryLight, fontWeight: 'bold' },
  emptyTaste: { color: colors.textMuted, fontSize: 14 },
  tasteGroup: { marginBottom: 12 },
  tasteCategoryName: { fontSize: 14, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 },
  tasteChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tasteChip: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  tasteChipText: { color: colors.primaryLight, fontSize: 13 },
  logoutButton: { margin: 20, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.danger, alignItems: 'center' },
  logoutText: { color: colors.danger, fontWeight: 'bold', fontSize: 15 },
});
