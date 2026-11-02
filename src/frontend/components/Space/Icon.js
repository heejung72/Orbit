import React from 'react';
import Svg, { Path, Circle, Ellipse, Rect } from 'react-native-svg';

// 선 아이콘 (24x24, Feather 스타일). 이모지 대신 사용.
const ICONS = {
  home: <><Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><Path d="M9 22V12h6v10" /></>,
  lounge: <><Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><Circle cx="9" cy="7" r="4" /><Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  chat: <Path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />,
  orbit: <><Circle cx="12" cy="12" r="3.5" /><Ellipse cx="12" cy="12" rx="10.5" ry="4.5" transform="rotate(-30 12 12)" /></>,
  check: <Path d="M20 6L9 17l-5-5" />,
  // 취향 카테고리
  music: <><Path d="M9 18V5l12-2v13" /><Circle cx="6" cy="18" r="3" /><Circle cx="18" cy="16" r="3" /></>,
  movie: <><Rect x="2" y="2" width="20" height="20" rx="2.2" /><Path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" /></>,
  book: <><Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  food: <><Path d="M18 8h1a4 4 0 0 1 0 8h-1" /><Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" /><Path d="M6 1v3M10 1v3M14 1v3" /></>,
  travel: <><Path d="M22 2L11 13" /><Path d="M22 2l-7 20-4-9-9-4z" /></>,
  sports: <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  hobby: <Path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
};

export default function Icon({ name, size = 24, color = '#fff', strokeWidth = 1.8 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name] ?? ICONS.orbit}
    </Svg>
  );
}
