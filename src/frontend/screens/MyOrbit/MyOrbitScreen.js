import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../services/api';
import Avatar from '../../components/Avatar';
import TasteTags from '../../components/TasteTags';
import GuestTimer from '../../components/GuestTimer';
import { colors, spacing, radius, typography } from '../../theme';

// My Orbit (#17)
// 회원: 캐릭터·닉네임 편집, 취향 요약·편집, 계정(이메일, 로그아웃, 탈퇴)
// Guest: 캐릭터·닉네임(변경 불가), 남은 시간, 취향 편집, 둘러보기 끝내기 — 가입 버튼은 #14
const messageOf = (err) => (err instanceof TypeError ? '서버에 연결할 수 없어요' : err.message);

function Section({ title, action, onAction, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {action ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.link}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function MyOrbitScreen({ navigation, isGuest, onLogout }) {
  const [profile, setProfile] = useState(null); // { nickname, avatar_id, avatar_emoji, email?, expires_at? }
  const [tastes, setTastes] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ nickname: '', avatar_id: null });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState('');

  // 취향 편집 등에서 돌아올 때마다 새로고침
  const load = useCallback(async () => {
    setError('');
    try {
      const [me, mine] = await Promise.all([isGuest ? api.me() : api.getProfile(), api.getMyTastes()]);
      setProfile(me);
      setTastes(mine);
    } catch (err) {
      setError(messageOf(err));
    }
  }, [isGuest]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = async () => {
    setDraft({ nickname: profile.nickname, avatar_id: profile.avatar_id });
    setEditing(true);
    if (avatars.length === 0) api.getAvatars().then(setAvatars).catch(() => {});
  };

  const saveProfile = async () => {
    const changes = {};
    if (draft.nickname.trim() !== profile.nickname) changes.nickname = draft.nickname;
    if (draft.avatar_id !== profile.avatar_id) changes.avatar_id = draft.avatar_id;
    if (Object.keys(changes).length === 0) return setEditing(false);
    setBusy(true);
    setError('');
    try {
      setProfile(await api.updateProfile(changes));
      setEditing(false);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError('');
    try {
      await api.deleteAccount(password);
      onLogout?.(); // 세션 정리 → Welcome
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  const endBrowsing = async () => {
    setBusy(true);
    try {
      await api.endGuestSession();
    } catch {
      // 서버에서 이미 끝났어도(만료 등) 앱에서는 정리하고 나간다
    }
    onLogout?.();
  };

  if (!profile) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={load} accessibilityRole="button" style={styles.retry}>
              <Text style={styles.link}>다시 시도</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* 프로필 */}
      <View style={styles.profile}>
        <Avatar emoji={editing ? avatars.find((a) => a.id === draft.avatar_id)?.emoji || profile.avatar_emoji : profile.avatar_emoji} size={80} />
        {editing ? (
          <View style={styles.editBox}>
            <TextInput
              style={styles.input}
              value={draft.nickname}
              onChangeText={(nickname) => setDraft({ ...draft, nickname })}
              maxLength={12}
              placeholder="닉네임 (2~12자)"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="닉네임"
            />
            <View style={styles.avatarRow} accessibilityRole="radiogroup">
              {avatars.map((a) => {
                const on = a.id === draft.avatar_id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setDraft({ ...draft, avatar_id: a.id })}
                    style={[styles.avatarOption, on && styles.avatarOptionOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${a.name} 캐릭터`}
                  >
                    <Text style={styles.avatarEmoji}>{a.emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.button, styles.outline]} onPress={() => setEditing(false)} accessibilityRole="button">
                <Text style={[styles.buttonText, styles.outlineText]}>취소</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.primary, busy && styles.disabled]} onPress={saveProfile} disabled={busy} accessibilityRole="button">
                <Text style={[styles.buttonText, styles.primaryText]}>저장</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.nickname} accessibilityRole="header">{profile.nickname}</Text>
            {isGuest ? (
              <GuestTimer expiresAt={profile.expires_at} style={styles.timer} />
            ) : (
              <Pressable onPress={startEdit} accessibilityRole="button" style={styles.editButton}>
                <Text style={styles.link}>프로필 수정</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      <Section title="나의 취향" action="취향 편집" onAction={() => navigation.navigate('TasteSelect')}>
        {tastes.length > 0 ? (
          <TasteTags tags={tastes.map((t) => ({ id: t.tag_id, name: t.name, weight: t.weight }))} />
        ) : (
          <Text style={styles.muted}>아직 고른 취향이 없어요</Text>
        )}
      </Section>

      {isGuest ? (
        <Section title="둘러보기">
          <Text style={styles.muted}>둘러보기를 끝내면 임시 닉네임·취향·대화가 바로 정리돼요.</Text>
          <Pressable style={[styles.wide, styles.outline, busy && styles.disabled]} onPress={endBrowsing} disabled={busy} accessibilityRole="button">
            <Text style={[styles.buttonText, styles.outlineText]}>둘러보기 끝내기</Text>
          </Pressable>
        </Section>
      ) : (
        <Section title="계정">
          <Text style={styles.muted}>로그인 이메일 · {profile.email}</Text>
          <Pressable style={[styles.wide, styles.outline]} onPress={onLogout} accessibilityRole="button">
            <Text style={[styles.buttonText, styles.outlineText]}>로그아웃</Text>
          </Pressable>
          {confirmDelete ? (
            <View style={styles.deleteBox}>
              <Text style={styles.deleteText}>
                탈퇴하면 취향·라운지 참여·대화방이 모두 사라지고 되돌릴 수 없어요. 보낸 메시지는 "떠난 궤도"로 남아요.
              </Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="비밀번호 확인"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="비밀번호 확인"
              />
              <View style={styles.row}>
                <Pressable style={[styles.button, styles.outline]} onPress={() => { setConfirmDelete(false); setPassword(''); }} accessibilityRole="button">
                  <Text style={[styles.buttonText, styles.outlineText]}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.danger, (busy || !password) && styles.disabled]}
                  onPress={deleteAccount}
                  disabled={busy || !password}
                  accessibilityRole="button"
                >
                  <Text style={[styles.buttonText, styles.primaryText]}>탈퇴하기</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} accessibilityRole="button" style={styles.deleteLink}>
              <Text style={styles.deleteLinkText}>회원 탈퇴</Text>
            </Pressable>
          )}
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  muted: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.body, color: colors.primary },
  retry: { marginTop: spacing.md, padding: spacing.sm },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },

  profile: {
    alignItems: 'center', padding: spacing.lg, marginBottom: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  nickname: { ...typography.title, color: colors.text, marginTop: spacing.md },
  timer: { marginTop: spacing.sm },
  editButton: { marginTop: spacing.sm, padding: spacing.xs },
  editBox: { alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.md },
  input: {
    ...typography.body, color: colors.text, backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  avatarOption: {
    width: spacing.xl + spacing.md, height: spacing.xl + spacing.md, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  avatarOptionOn: { borderColor: colors.primary, borderWidth: 2 },
  avatarEmoji: { ...typography.title },

  section: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...typography.body, fontWeight: 'bold', color: colors.text },

  row: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.primary },
  wide: { borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.primary, marginTop: spacing.xs },
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: colors.surface },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  disabled: { opacity: 0.4 },
  buttonText: { ...typography.body, fontWeight: 'bold' },
  primaryText: { color: colors.onPrimary },
  outlineText: { color: colors.primary },

  deleteLink: { alignSelf: 'center', padding: spacing.sm },
  deleteLinkText: { ...typography.caption, color: colors.textMuted, textDecorationLine: 'underline' },
  deleteBox: { gap: spacing.sm, marginTop: spacing.sm },
  deleteText: { ...typography.caption, color: colors.danger },
});
