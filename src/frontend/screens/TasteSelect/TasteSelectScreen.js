import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  StyleSheet, Alert, Animated, Dimensions,
} from 'react-native';
import { api } from '../../services/api';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48 - 12) / 3; // 3열 그리드

function TasteOptionCard({ option, isSelected, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 0.95 : 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected]);

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        {option.image_url ? (
          <Image source={{ uri: option.image_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardPlaceholder]} />
        )}

        {/* 선택 오버레이 */}
        <Animated.View style={[styles.selectedOverlay, { opacity: opacityAnim }]}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        </Animated.View>

        {/* 이름 라벨 */}
        <View style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
          <Text style={[styles.cardLabelText, isSelected && styles.cardLabelTextSelected]}>
            {option.name}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TasteSelectScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  const toggle = (optionId) => {
    const next = new Set(selected);
    if (next.has(optionId)) next.delete(optionId);
    else next.add(optionId);
    setSelected(next);
  };

  const handleSave = async () => {
    if (selected.size < 3) {
      return Alert.alert('알림', '최소 3개의 취향을 선택해주세요');
    }
    try {
      await api.updateTastes([...selected]);
      Alert.alert('완료', '취향이 저장되었습니다');
      // 가입 직후 온보딩으로 들어온 경우엔 돌아갈 화면이 없으므로 Home으로 교체
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Main');
    } catch (err) {
      Alert.alert('오류', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>나의 취향을 선택해주세요</Text>
      <Text style={styles.subtitle}>최소 3개 이상 선택</Text>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {categories.map(cat => (
          <View key={cat.id} style={styles.category}>
            <Text style={styles.categoryName}>{cat.icon} {cat.name}</Text>
            <View style={styles.grid}>
              {cat.options.map(opt => (
                <TasteOptionCard
                  key={opt.id}
                  option={opt}
                  isSelected={selected.has(opt.id)}
                  onPress={() => toggle(opt.id)}
                />
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>저장하기 ({selected.size}개 선택)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 20, color: '#333' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 10 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  category: { marginBottom: 24 },
  categoryName: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // 이미지 카드
  card: {
    width: CARD_SIZE, height: CARD_SIZE * 1.2, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#E0E0E0', marginBottom: 6,
  },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { backgroundColor: '#D0D0D0' },

  // 선택 오버레이
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(108, 92, 231, 0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  checkCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center',
  },
  checkMark: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  // 이름 라벨
  cardLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, paddingHorizontal: 8,
  },
  cardLabelSelected: { backgroundColor: 'rgba(108, 92, 231, 0.85)' },
  cardLabelText: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cardLabelTextSelected: { fontWeight: 'bold' },

  // 저장 버튼
  button: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#6C5CE7', margin: 16, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
