import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

// Guest 남은 시간 카운트다운 (#12, PRD §2-3)
// 항상 서버가 준 expiresAt 기준으로 1초마다 다시 계산 → 앱이 백그라운드였다 돌아와도 정확하다
// 만료 처리(세션 정리·안내 화면)는 App이 맡고, 이 컴포넌트는 표시만 한다
const WARNING_MS = 5 * 60 * 1000; // 서버 GUEST_WARNING_MINUTES 기본값과 같게

const pad = (n) => String(n).padStart(2, '0');

export default function GuestTimer({ expiresAt, style }) {
  const end = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(end - now, 0);
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  return (
    <Text
      style={[styles.text, left <= WARNING_MS && styles.urgent, style]}
      accessibilityLabel={`궤도가 사라지기까지 ${Math.ceil(left / 60000)}분`} // 스크린리더는 분 단위로만
    >
      궤도가 사라지기까지 {pad(minutes)}:{pad(seconds)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { ...typography.caption, color: colors.primary, fontVariant: ['tabular-nums'] },
  urgent: { color: colors.danger, fontWeight: 'bold' },
});
