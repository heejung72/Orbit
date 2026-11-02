import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, nativeDriver } from '../../theme';

// 화면 뒤에서 반짝이는 별. 별마다 애니메이션을 돌리지 않고 3그룹이 박자를 나눠 깜빡인다.
const GROUPS = 3;
const STARS = Array.from({ length: 42 }, (_, i) => {
  const rand = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1; // 고정 시드
  return { left: `${rand(1) * 100}%`, top: `${rand(2) * 100}%`, size: rand(3) < 0.85 ? 1.5 : 2.5, group: i % GROUPS };
});

export default function StarField() {
  const twinkle = useRef([...Array(GROUPS)].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = twinkle.map((v, g) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(g * 700),
          Animated.timing(v, { toValue: 1, duration: 1400, useNativeDriver: nativeDriver }),
          Animated.timing(v, { toValue: 0.3, duration: 1400, useNativeDriver: nativeDriver }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [twinkle]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((s, i) => (
        <Animated.View
          key={i}
          style={[styles.star, { left: s.left, top: s.top, width: s.size, height: s.size, opacity: twinkle[s.group] }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: { position: 'absolute', borderRadius: 2, backgroundColor: colors.text },
});
