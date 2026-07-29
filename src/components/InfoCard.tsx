import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shadow } from '@/src/theme/colors';

type InfoCardProps = {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  tone?: 'brand' | 'success' | 'warning';
  onPress?: () => void;
};

export function InfoCard({ title, subtitle, icon, tone = 'brand', onPress }: InfoCardProps) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.card}>
      <View style={[styles.icon, styles[tone]]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    ...shadow,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brand: {
    backgroundColor: colors.brandSoft,
  },
  success: {
    backgroundColor: '#E9F8F1',
  },
  warning: {
    backgroundColor: '#FFF5E4',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
});
