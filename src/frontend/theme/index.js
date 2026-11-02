import { Platform } from 'react-native';

// Orbit 디자인 토큰 — 검은 우주 + 보라 네온 궤도 (docs/design.md)

export const colors = {
  background: '#05030D', // 우주 (거의 검정)
  surface: 'rgba(139,92,246,0.08)', // 유리 카드
  surfaceSolid: '#120C24', // 모달·입력창처럼 뒤가 비치면 안 되는 면
  border: 'rgba(167,139,250,0.24)',
  primary: '#8B5CF6', // 궤도 링
  primaryLight: '#A78BFA', // 링 위의 점, 강조 텍스트
  glow: '#C084FC', // 행성 빛
  onPrimary: '#FFFFFF',
  text: '#F5F3FF',
  textMuted: '#9C95B8',
  danger: '#FB7185',
  warning: '#FBBF24',
  overlay: 'rgba(5,3,13,0.7)',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const typography = {
  hero: { fontSize: 44, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
};

// 보라 빛 번짐 (iOS shadow / Android elevation은 색을 못 바꿔서 iOS·웹 위주)
export const glow = (color = colors.primary, r = 16) => ({
  shadowColor: color,
  shadowOpacity: 0.7,
  shadowRadius: r,
  shadowOffset: { width: 0, height: 0 },
});

// 웹은 네이티브 애니메이션 드라이버가 없어 JS 드라이버로 대체
export const nativeDriver = Platform.OS !== 'web';

export default { colors, spacing, radius, typography, glow, nativeDriver };
