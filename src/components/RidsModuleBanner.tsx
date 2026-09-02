import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';

export function RidsModuleBanner({
  icon,
  label,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  title: string;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.icon}>
        <Ionicons color={ridsPalette.charcoal} name={icon} size={28} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: ridsPalette.charcoal,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    padding: 16,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyan,
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    width: 50,
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
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
});
