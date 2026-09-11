import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';

export function RidsFlowHeader({
  icon,
  label,
  subtitle,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string | null;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.icon}>
        <Ionicons color={ridsPalette.cyanDark} name={icon} size={24} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text numberOfLines={2} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: ridsPalette.charcoal,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 13,
    marginBottom: 18,
    padding: 15,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyan,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  copy: {
    flex: 1,
  },
  label: {
    color: '#A9E4EA',
    fontSize: 10,
    fontWeight: '900',
  },
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    marginTop: 3,
  },
  subtitle: {
    color: '#C5CED8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
});
