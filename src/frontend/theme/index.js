// Orbit 디자인 토큰
// 현재 값은 기존 뼈대의 색상을 옮겨온 임시값입니다. 실제 토큰은 #8(Orbit Dashboard)에서 정의하고 docs/design.md에 정리합니다.

export const colors = {
  primary: '#6C5CE7',
  onPrimary: '#FFFFFF',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#333333',
  textMuted: '#888888',
  border: '#E0E0E0',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 12, lg: 16 };

export const typography = {
  title: { fontSize: 20, fontWeight: 'bold' },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
};

export default { colors, spacing, radius, typography };
