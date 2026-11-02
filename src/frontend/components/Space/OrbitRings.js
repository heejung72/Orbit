import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, nativeDriver } from '../../theme';

// 동심원 궤도 + 궤도 위를 도는 점. 안쪽 궤도일수록 빠르게 돈다.
// size: 가장 바깥 궤도 지름, children: 가운데(행성 등)
export default function OrbitRings({ size, rings = 6, children, style }) {
  const half = size / 2;
  const inner = size * 0.32;
  const radii = Array.from({ length: rings }, (_, i) => inner / 2 + ((half - inner / 2 - 2) * i) / (rings - 1));
  const planets = [
    { ring: 1, angle: 10, dot: 9 },
    { ring: 2, angle: 200, dot: 7 },
    { ring: 3, angle: 60, dot: 12 },
    { ring: 4, angle: 290, dot: 8 },
    { ring: 5, angle: 140, dot: 10 },
  ].filter((p) => p.ring < rings);

  const spins = useRef(planets.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = spins.map((v, i) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: 14000 + planets[i].ring * 7000,
          easing: Easing.linear,
          useNativeDriver: nativeDriver,
        })
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [spins]); // planets는 상수 배열이라 spins만 의존

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {radii.map((r) => (
          <React.Fragment key={r}>
            <Circle cx={half} cy={half} r={r} stroke={colors.primary} strokeOpacity={0.18} strokeWidth={6} fill="none" />
            <Circle cx={half} cy={half} r={r} stroke={colors.primary} strokeOpacity={0.85} strokeWidth={1.5} fill="none" />
          </React.Fragment>
        ))}
      </Svg>

      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}

      {planets.map((p, i) => {
        const r = radii[p.ring];
        const rotate = spins[i].interpolate({ inputRange: [0, 1], outputRange: [`${p.angle}deg`, `${p.angle + 360}deg`] });
        return (
          <Animated.View
            key={p.ring}
            style={[styles.track, { width: r * 2, height: r * 2, left: half - r, top: half - r, transform: [{ rotate }] }]}
          >
            <View style={[styles.dot, { width: p.dot, height: p.dot, borderRadius: p.dot / 2, top: -p.dot / 2 }]} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', alignItems: 'center' },
  dot: {
    position: 'absolute',
    backgroundColor: colors.primaryLight,
    shadowColor: colors.glow,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
