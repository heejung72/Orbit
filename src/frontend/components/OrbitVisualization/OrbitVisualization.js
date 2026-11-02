import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, Platform, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Avatar from '../Avatar';
import { colors, spacing, typography } from '../../theme';

// 궤도 시각화: 중앙 내 캐릭터 + 내 취향의 카테고리 행성이 천천히 돈다 (PRD §4-3, 성능 우선으로 애니메이션 1개)
// planets: [{ categoryId, name, icon, count }] — count(그 카테고리 취향 수)가 많을수록 행성이 크다
// 바깥 궤도의 "비슷한 사람들"은 #13에서 추가
const ROTATION_MS = 60000;
const useNativeDriver = Platform.OS !== 'web';

export default function OrbitVisualization({ size, avatarEmoji, planets, onPlanetPress }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: ROTATION_MS, easing: Easing.linear, useNativeDriver })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }); // 행성 아이콘은 똑바로
  const center = size / 2;
  const orbitRadius = size * 0.36;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={orbitRadius} stroke={colors.primary} strokeOpacity={0.35} strokeWidth={1.5} fill="none" />
        <Circle cx={center} cy={center} r={size * 0.47} stroke={colors.border} strokeWidth={1} strokeDasharray="4 6" fill="none" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        {planets.map((p, i) => {
          const angle = (2 * Math.PI * i) / planets.length - Math.PI / 2;
          const d = 36 + Math.min(p.count - 1, 4) * 6; // 36 ~ 60
          return (
            <Animated.View
              key={p.categoryId}
              style={{
                position: 'absolute',
                left: center + orbitRadius * Math.cos(angle) - d / 2,
                top: center + orbitRadius * Math.sin(angle) - d / 2,
                transform: [{ rotate: counterRotate }],
              }}
            >
              <Pressable
                onPress={() => onPlanetPress(p)}
                style={[styles.planet, { width: d, height: d, borderRadius: d / 2 }]}
                accessibilityRole="button"
                accessibilityLabel={`${p.name} 취향 ${p.count}개, 라운지로 이동`}
              >
                <Text style={{ fontSize: d * 0.45 }}>{p.icon}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>

      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <Avatar emoji={avatarEmoji} size={size * 0.22} />
        {planets.length === 0 && <Text style={styles.empty}>취향을 고르면 행성이 생겨요</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  planet: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
