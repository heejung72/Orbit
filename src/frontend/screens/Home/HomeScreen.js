import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ScrollView, Image,
  StyleSheet, Alert, Dimensions, Animated, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import VennDiagram from '../../_legacy/components/VennDiagram';
import RadarChart from '../../_legacy/components/RadarChart';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const CARD_MARGIN = 10;

export default function HomeScreen({ isGuest }) {
  const navigation = useNavigation();
  const [matches, setMatches] = useState([]);
  const [popularLounges, setPopularLounges] = useState([]);
  const [tastes, setTastes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [myTasteNames, setMyTasteNames] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 공개 홈 데이터 (모든 사용자)
      const homeData = await api.getPublicHome();
      setPopularLounges(homeData.popularLounges || []);
      setTastes(homeData.tastes || []);

      // 매칭 추천은 회원만
      if (!isGuest) {
        try {
          const matchData = await api.findMatches();
          setMatches(matchData.matches || []);
          // 내 취향 이름 목록 가져오기
          const profile = await api.getProfile();
          setMyTasteNames((profile.tastes || []).map(t => t.taste));
        } catch {}
      }
    } catch (err) {
      // 공개 API 실패 시 무시
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (targetId, score) => {
    if (isGuest) {
      return Alert.alert('회원 전용', '매칭 요청은 회원가입 후 이용할 수 있어요!');
    }
    try {
      await api.requestMatch(targetId, score);
      Alert.alert('전송 완료', '매칭 요청을 보냈습니다!');
      setMatches(prev => prev.filter(m => m.id !== targetId));
    } catch (err) {
      Alert.alert('오류', err.message);
    }
  };

  // 오늘의 매칭 카드 슬라이더
  const renderMatchCard = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedMatch(item)}>
    <View style={styles.matchCard}>
      <View style={styles.matchCardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.nickname[0]}</Text>
        </View>
        <View style={styles.matchCardInfo}>
          <Text style={styles.matchNickname}>{item.nickname}</Text>
          <Text style={styles.matchBio} numberOfLines={2}>{item.common_tags?.length ? `공통 취향: ${item.common_tags.join(' · ')}` : ''}</Text>
        </View>
      </View>
      <View style={styles.matchScoreRow}>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{item.similarity_score}%</Text>
        </View>
        <Text style={styles.scoreLabel}>취향 일치</Text>
      </View>
      <TouchableOpacity style={styles.matchButton} onPress={() => handleRequest(item.id, item.similarity_score)}>
        <Text style={styles.matchButtonText}>친구 요청 보내기</Text>
      </TouchableOpacity>
    </View>
    </TouchableOpacity>
  );

  // 매칭 상세 모달 (벤다이어그램)
  const renderMatchModal = () => {
    if (!selectedMatch) return null;
    // 상대의 전체 취향은 익명성을 위해 받지 않고, 서버가 계산한 공통 취향만 사용 (#13에서 화면 재구성)
    const shared = selectedMatch.common_tags || [];
    const myOnly = myTasteNames.filter(t => !shared.includes(t));
    const otherOnly = [];

    // 레이더 차트 데이터: 카테고리별 취향 수 비교
    const categories = [...new Set([
      ...(selectedMatch.tastes || []).map(t => t.category || '기타'),
      ...(myTasteNames.length > 0 ? ['나의 취향'] : []),
    ])];

    return (
      <Modal visible={!!selectedMatch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedMatch.nickname}님과의 취향 비교
            </Text>
            <Text style={styles.modalScore}>
              {selectedMatch.similarity_score}% 일치
            </Text>

            <VennDiagram
              myName="나"
              otherName={selectedMatch.nickname}
              myOnly={myOnly.slice(0, 4)}
              otherOnly={otherOnly.slice(0, 4)}
              shared={shared}
            />

            <TouchableOpacity
              style={styles.modalMatchBtn}
              onPress={() => {
                handleRequest(selectedMatch.id, selectedMatch.similarity_score);
                setSelectedMatch(null);
              }}
            >
              <Text style={styles.matchButtonText}>친구 요청 보내기</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedMatch(null)}>
              <Text style={styles.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // 취향 이미지 카드
  const renderTasteCard = ({ item: option }) => (
    <TouchableOpacity style={styles.tasteCard} activeOpacity={0.8}>
      {option.image_url ? (
        <Image source={{ uri: option.image_url }} style={styles.tasteImage} />
      ) : (
        <View style={[styles.tasteImage, styles.tastePlaceholder]} />
      )}
      <View style={styles.tasteOverlay}>
        <Text style={styles.tasteName}>{option.name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 게스트 배너 */}
      {isGuest && (
        <View style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>게스트로 둘러보는 중이에요</Text>
          <Text style={styles.guestBannerSub}>가입하면 매칭·채팅 기록이 보존됩니다</Text>
        </View>
      )}

      {/* 취향 설정 버튼 (회원만) */}
      {!isGuest && (
        <TouchableOpacity style={styles.tasteButton} onPress={() => navigation.navigate('TasteSelect')}>
          <Text style={styles.tasteButtonText}>내 취향 설정하기</Text>
        </TouchableOpacity>
      )}

      {/* 오늘의 매칭 카드 슬라이더 (회원만) */}
      {!isGuest && matches.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오늘의 매칭</Text>
          <FlatList
            data={matches}
            renderItem={renderMatchCard}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 8 }}
          />
        </View>
      )}

      {!isGuest && matches.length === 0 && !loading && (
        <View style={styles.emptyMatch}>
          <Text style={styles.emptyText}>아직 매칭 가능한 사용자가 없습니다</Text>
          <Text style={styles.emptySubText}>취향을 먼저 설정해보세요!</Text>
        </View>
      )}

      {/* 인기 취향 (모든 사용자) */}
      {tastes.map(cat => (
        cat.options.length > 0 && (
          <View key={cat.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{cat.icon} {cat.name}</Text>
            <FlatList
              data={cat.options}
              renderItem={renderTasteCard}
              keyExtractor={item => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8 }}
            />
          </View>
        )
      ))}

      {/* 인기 라운지 (모든 사용자) */}
      {popularLounges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>인기 라운지</Text>
          {popularLounges.slice(0, 5).map(lounge => (
            <TouchableOpacity
              key={lounge.id}
              style={styles.loungeCard}
              onPress={() => navigation.navigate('LoungeChat', { loungeId: lounge.id })}
            >
              <View style={styles.loungeIcon}>
                <Text style={styles.loungeIconText}>{lounge.category_icon}</Text>
              </View>
              <View style={styles.loungeInfo}>
                <Text style={styles.loungeName}>{lounge.name}</Text>
                <Text style={styles.loungeMeta}>{lounge.category_name} · {lounge.member_count}명</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 30 }} />

      {/* 매칭 상세 모달 */}
      {renderMatchModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  // 게스트 배너
  guestBanner: {
    backgroundColor: '#FFF3E0', padding: 14, margin: 16, marginBottom: 8,
    borderRadius: 12, alignItems: 'center',
  },
  guestBannerText: { fontSize: 14, fontWeight: 'bold', color: '#E65100' },
  guestBannerSub: { fontSize: 12, color: '#BF360C', marginTop: 2 },

  // 취향 설정 버튼
  tasteButton: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, margin: 16, marginBottom: 8,
    borderWidth: 2, borderColor: '#6C5CE7', borderStyle: 'dashed', alignItems: 'center',
  },
  tasteButtonText: { color: '#6C5CE7', fontSize: 15, fontWeight: 'bold' },

  // 섹션
  section: { marginTop: 16, paddingHorizontal: 8 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginLeft: 8, color: '#333' },

  // 매칭 카드 슬라이더
  matchCard: {
    width: CARD_WIDTH, backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginHorizontal: CARD_MARGIN,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  matchCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#6C5CE7',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  matchCardInfo: { flex: 1, marginLeft: 12 },
  matchNickname: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  matchBio: { fontSize: 13, color: '#888', marginTop: 2 },
  matchScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  scoreBadge: { backgroundColor: '#F0EDFF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { fontSize: 20, fontWeight: 'bold', color: '#6C5CE7' },
  scoreLabel: { fontSize: 13, color: '#888', marginLeft: 8 },
  matchButton: { backgroundColor: '#6C5CE7', borderRadius: 10, padding: 12, alignItems: 'center' },
  matchButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  // 빈 매칭
  emptyMatch: { alignItems: 'center', marginTop: 20, marginBottom: 10 },
  emptyText: { fontSize: 15, color: '#888' },
  emptySubText: { fontSize: 13, color: '#AAA', marginTop: 4 },

  // 취향 이미지 카드
  tasteCard: {
    width: 130, height: 160, borderRadius: 14, marginHorizontal: 6, overflow: 'hidden',
  },
  tasteImage: { width: '100%', height: '100%' },
  tastePlaceholder: { backgroundColor: '#6C5CE7' }, // 이미지 없는 태그 (#8에서 디자인 토큰으로 교체)
  tasteOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 8, paddingHorizontal: 10,
  },
  tasteName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // 라운지 카드
  loungeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8, marginHorizontal: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  loungeIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0EDFF',
    justifyContent: 'center', alignItems: 'center',
  },
  loungeIconText: { fontSize: 22 },
  loungeInfo: { marginLeft: 12, flex: 1 },
  loungeName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  loungeMeta: { fontSize: 13, color: '#888', marginTop: 2 },

  // 모달
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    width: '88%', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  modalScore: { fontSize: 28, fontWeight: 'bold', color: '#6C5CE7', marginBottom: 12 },
  modalMatchBtn: {
    backgroundColor: '#6C5CE7', borderRadius: 10, padding: 14,
    alignItems: 'center', width: '100%', marginTop: 12,
  },
  modalCloseBtn: { marginTop: 12, padding: 8 },
  modalCloseText: { color: '#888', fontSize: 15 },
});
