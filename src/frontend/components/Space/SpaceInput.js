import React, { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { colors, radius, spacing, glow } from '../../theme';

// 포커스되면 궤도색으로 빛나는 입력창
export default function SpaceInput({ style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primaryLight}
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={[styles.input, focused && styles.focused, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  focused: { borderColor: colors.primaryLight, ...glow(colors.primary, 10) },
});
