import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { nativeDriver } from '../../theme';

// 화면 진입: 아래에서 떠오르며 나타남 (delay로 순서를 준다)
export function FadeUp({ delay = 0, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

// 무중력처럼 위아래로 천천히 떠 있음
export function Floating({ distance = 8, duration = 3200, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration / 2, easing: ease, useNativeDriver: nativeDriver }),
        Animated.timing(v, { toValue: 0, duration: duration / 2, easing: ease, useNativeDriver: nativeDriver }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });
  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}
