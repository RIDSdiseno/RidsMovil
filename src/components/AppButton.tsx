import { ActivityIndicator, Pressable, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';

type AppButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function AppButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
  textStyle,
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : ridsPalette.cyanDark} />
      ) : (
        <Text style={[styles.label, variant !== 'primary' && styles.altLabel, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: ridsPalette.cyanDark,
  },
  secondary: {
    backgroundColor: ridsPalette.cyanSoft,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  altLabel: {
    color: ridsPalette.cyanDark,
  },
});
