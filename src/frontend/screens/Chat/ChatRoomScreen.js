import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '../../services/api';
import { joinRoom, leaveRoom, sendMessage, sendTyping, subscribe } from '../../services/socket';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, typography } from '../../theme';

// 채팅방 (1:1·라운지 공통): 기록 + 실시간 메시지, 입력 중 표시, 1:1 나가기
// params: { roomId, title, type: 'direct' | 'lounge' }
const TYPING_SEND_MS = 2000; // 입력 중 신호는 2초에 한 번만
const TYPING_SHOW_MS = 3000;
const MAX_LENGTH = 1000;

export default function ChatRoomScreen({ route, navigation }) {
  const { roomId, title, type } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const listRef = useRef(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef(null);

  // 기록 다시 불러오기 + 방 입장 (처음, 그리고 재연결될 때마다 — 서버는 재연결 시 방 정보를 잃는다)
  const enterRoom = useCallback(async () => {
    try {
      setMessages(await api.getMessages(roomId));
    } catch (err) {
      setError(err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message);
    }
    const res = await joinRoom(roomId);
    if (!res.ok) setError(res.message);
  }, [roomId]);

  useEffect(() => {
    navigation.setOptions({
      title,
      headerRight: type === 'direct'
        ? () => (
          <Pressable onPress={() => setConfirmLeave(true)} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.headerAction}>나가기</Text>
          </Pressable>
        )
        : undefined,
    });
  }, [navigation, title, type]);

  useEffect(() => {
    enterRoom();
    const offMessage = subscribe('message:new', (m) => {
      if (m.room_id !== roomId) return;
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
      setTyping(false);
    });
    const offTyping = subscribe('typing', (t) => {
      if (t.roomId !== roomId) return;
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), TYPING_SHOW_MS);
    });
    const offConnect = subscribe('connect', enterRoom);
    return () => {
      leaveRoom(roomId);
      offMessage();
      offTyping();
      offConnect();
      clearTimeout(typingTimer.current);
    };
  }, [roomId, enterRoom]);

  const handleChange = (text) => {
    setInput(text);
    const now = Date.now();
    if (text && now - lastTypingSent.current > TYPING_SEND_MS) {
      lastTypingSent.current = now;
      sendTyping(roomId);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    const res = await sendMessage(roomId, text);
    setSending(false);
    if (res.ok) setInput(''); // 실패하면 입력 내용을 남겨 다시 보낼 수 있게
    else setError(res.message);
  };

  const handleLeave = async () => {
    try {
      await api.leaveChatRoom(roomId);
      navigation.goBack();
    } catch (err) {
      setConfirmLeave(false);
      setError(err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.row, item.is_mine && styles.rowMine]}>
      {!item.is_mine && <Avatar emoji={item.sender_avatar_emoji} size={32} label={`${item.sender_nickname}의 캐릭터`} />}
      <View style={[styles.body, item.is_mine && styles.bodyMine]}>
        {!item.is_mine && (
          <View style={styles.sender}>
            <Text style={styles.senderName}>{item.sender_nickname}</Text>
            {item.is_guest && <Text style={styles.guestBadge}>Guest</Text>}
          </View>
        )}
        <View style={[styles.bubble, item.is_mine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.text, item.is_mine && styles.textMine]}>{item.content}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {confirmLeave && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>대화방을 나가면 다시 들어올 수 없어요</Text>
          <Pressable onPress={handleLeave} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.bannerAction}>나가기</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmLeave(false)} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.bannerCancel}>취소</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        ListEmptyComponent={<Text style={styles.empty}>첫 메시지를 보내보세요</Text>}
      />

      {typing && <Text style={styles.typing}>누군가 입력 중...</Text>}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="메시지를 입력하세요"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={handleChange}
          onSubmitEditing={handleSend}
          maxLength={MAX_LENGTH}
          accessibilityLabel="메시지 입력"
        />
        <Pressable
          style={[styles.send, (!input.trim() || sending) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          accessibilityRole="button"
        >
          <Text style={styles.sendText}>전송</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: spacing.sm, flexGrow: 1 },
  empty: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  headerAction: { ...typography.body, color: colors.onPrimary, marginRight: spacing.md },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  rowMine: { justifyContent: 'flex-end' },
  body: { maxWidth: '75%', alignItems: 'flex-start' },
  bodyMine: { alignItems: 'flex-end' },
  sender: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  senderName: { ...typography.caption, color: colors.textMuted },
  guestBadge: {
    ...typography.caption, color: colors.primary, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.sm, paddingHorizontal: spacing.xs,
  },
  bubble: { borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  text: { ...typography.body, color: colors.text },
  textMine: { color: colors.onPrimary },

  typing: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.md },
  error: { ...typography.caption, color: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bannerText: { ...typography.caption, color: colors.text, flex: 1 },
  bannerAction: { ...typography.body, color: colors.primary, fontWeight: 'bold' },
  bannerCancel: { ...typography.body, color: colors.textMuted },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    ...typography.body, flex: 1, color: colors.text, backgroundColor: colors.background,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  send: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendDisabled: { opacity: 0.4 },
  sendText: { ...typography.body, color: colors.onPrimary, fontWeight: 'bold' },
});
