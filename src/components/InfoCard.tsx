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
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
    ...shadow,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
});
