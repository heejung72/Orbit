import React, { useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, glow, nativeDriver } from '../../theme';

// 눌렀을 때 살짝 줄어드는 버튼. variant: primary(빛나는 보라) | outline(궤도 테두리) | ghost(글자만)
export default function SpaceButton({ title, onPress, variant = 'primary', disabled, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: nativeDriver }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.96)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Animated.View style={[styles.base, styles[variant], disabled && styles.disabled, { transform: [{ scale }] }, style]}>
        <Text style={[styles.text, variant !== 'primary' && styles.textAlt]}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  primary: { backgroundColor: colors.primary, ...glow(colors.primary, 18) },
  outline: { borderWidth: 1.5, borderColor: colors.primaryLight, backgroundColor: colors.surface },
  ghost: { paddingVertical: spacing.sm },
  disabled: { opacity: 0.5 },
  text: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  textAlt: { color: colors.text },
});
