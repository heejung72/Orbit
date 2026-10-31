import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';
import { joinRoom, leaveRoom, sendMessage, onNewMessage, offNewMessage } from '../../services/socket';

export default function ChatRoomScreen({ route, navigation }) {
  const { roomId, title } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [myId, setMyId] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showSignupBanner, setShowSignupBanner] = useState(false);
  const flatListRef = useRef(null);
  const messageCountRef = useRef(0);

  useEffect(() => {
    navigation.setOptions({ title });

    AsyncStorage.multiGet(['user', 'isGuest']).then(([[, u], [, g]]) => {
      if (u) setMyId(JSON.parse(u).id);
      const guest = g === 'true';
      setIsGuest(guest);
      if (guest) setShowSignupBanner(true);
    });

    api.getMessages(roomId).then(setMessages).catch(() => {});
    joinRoom(roomId);

    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
      messageCountRef.current += 1;
      // 게스트가 5개 메시지 보낼 때마다 가입 유도
      if (messageCountRef.current % 5 === 0) {
        setShowSignupBanner(true);
      }
    };
    onNewMessage(handleMessage);

    return () => {
      leaveRoom(roomId);
      offNewMessage(handleMessage);
    };
  }, [roomId]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(roomId, input.trim());
    setInput('');
  };

  const renderItem = ({ item }) => {
    const isMine = item.sender_id === myId;
    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        {!isMine && (
          <View style={styles.senderRow}>
            <Text style={styles.senderName}>{item.sender_nickname}</Text>
            {item.is_guest && (
              <View style={styles.guestBadge}>
                <Text style={styles.guestBadgeText}>게스트</Text>
              </View>
            )}
          </View>
        )}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* 게스트 가입 유도 배너 */}
      {isGuest && showSignupBanner && (
        <View style={styles.signupBanner}>
          <View style={styles.signupBannerContent}>
            <Text style={styles.signupBannerText}>가입하면 대화 기록이 보존됩니다</Text>
            <TouchableOpacity style={styles.signupBannerBtn} onPress={() => setShowSignupBanner(false)}>
              <Text style={styles.signupBannerBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="메시지를 입력하세요..."
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0EDFF' },
  messageList: { padding: 16, paddingBottom: 8 },

  // 메시지
  msgRow: { marginBottom: 8, alignItems: 'flex-start' },
  msgRowMine: { alignItems: 'flex-end' },
  senderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, marginLeft: 4 },
  senderName: { fontSize: 12, color: '#888' },
  guestBadge: {
    backgroundColor: '#FFE0B2', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
    marginLeft: 6,
  },
  guestBadgeText: { fontSize: 10, color: '#E65100', fontWeight: 'bold' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleMine: { backgroundColor: '#6C5CE7', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, color: '#333' },
  msgTextMine: { color: '#fff' },

  // 가입 유도 배너
  signupBanner: {
    backgroundColor: '#E8EAF6', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#C5CAE9',
  },
  signupBannerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  signupBannerText: { fontSize: 13, color: '#3949AB', fontWeight: '600', flex: 1 },
  signupBannerBtn: { marginLeft: 12 },
  signupBannerBtnText: { fontSize: 13, color: '#7986CB' },

  // 입력 바
  inputBar: {
    flexDirection: 'row', padding: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#EEE', alignItems: 'center',
  },
  input: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendButton: { backgroundColor: '#6C5CE7', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginLeft: 8 },
  sendText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
