import { StyleSheet, Text, View } from 'react-native';

import { ridsPalette } from '@/src/theme/rids-palette';

export function RidsSectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.marker} />
      <Text style={styles.title}>{title}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginBottom: 13,
  },
  marker: {
    backgroundColor: ridsPalette.cyanDark,
    borderRadius: 3,
    height: 18,
    width: 4,
  },
  title: {
    color: ridsPalette.charcoal,
    fontSize: 16,
    fontWeight: '900',
  },
  line: {
    backgroundColor: '#DCE3E9',
    flex: 1,
    height: 1,
  },
});
