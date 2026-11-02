import React from 'react';
import { Image } from 'react-native';

// 익명 캐릭터 이미지 (DB의 이모지 대신 사용, 커스터마이징은 #17)
// id는 seeds/data.js avatars 순서(SERIAL 1~6). db:setup으로 만든 DB 기준.
const IMAGES = {
  1: require('../../assets/avatars/comet.png'),
  2: require('../../assets/avatars/moon.png'),
  3: require('../../assets/avatars/planet.png'),
  4: require('../../assets/avatars/star.png'),
  5: require('../../assets/avatars/alien.png'),
  6: require('../../assets/avatars/rocket.png'),
};

export default function Avatar({ id, size = 48, style }) {
  return (
    <Image
      source={IMAGES[id] ?? IMAGES[3]}
      style={[{ width: size, height: size }, style]}
      accessibilityIgnoresInvertColors
    />
  );
}
