import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';

export default function LoginScreen({ navigation, onLogin, onGuestLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('알림', '이메일과 비밀번호를 입력해주세요');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('isGuest', 'false');
      onLogin();
    } catch (err) {
      Alert.alert('로그인 실패', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const data = await api.guestLogin();
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('isGuest', 'true');
      onGuestLogin();
    } catch (err) {
      Alert.alert('오류', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Orbit</Text>
      <Text style={styles.subtitle}>취향으로 만나는 새로운 친구</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? '로그인 중...' : '로그인'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.guestButton} onPress={handleGuestLogin} disabled={loading}>
        <Text style={styles.guestButtonText}>둘러보기</Text>
        <Text style={styles.guestSubtext}>로그인 없이 구경하기</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>계정이 없으신가요? 회원가입</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#F8F9FA' },
  logo: { fontSize: 36, fontWeight: 'bold', color: '#6C5CE7', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#E0E0E0',
  },
  button: {
    backgroundColor: '#6C5CE7', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  guestButton: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1.5, borderColor: '#6C5CE7',
  },
  guestButtonText: { color: '#6C5CE7', fontSize: 16, fontWeight: 'bold' },
  guestSubtext: { color: '#999', fontSize: 12, marginTop: 2 },
  link: { color: '#6C5CE7', textAlign: 'center', fontSize: 15 },
});
