import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';

type TabRoute = '/(tabs)' | '/(tabs)/visitas' | '/(tabs)/equipos' | '/(tabs)/entregas' | '/(tabs)/perfil';

type BottomNavigationItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  match: string;
  route: TabRoute;
};

const items: BottomNavigationItem[] = [
  { icon: 'home-outline', label: 'Inicio', match: '/', route: '/(tabs)' },
  { icon: 'clipboard-outline', label: 'Visitas', match: '/visitas', route: '/(tabs)/visitas' },
  { icon: 'hardware-chip-outline', label: 'Equipos', match: '/equipos', route: '/(tabs)/equipos' },
  { icon: 'cube-outline', label: 'PickUP', match: '/entregas', route: '/(tabs)/entregas' },
  { icon: 'person-circle-outline', label: 'Perfil', match: '/perfil', route: '/(tabs)/perfil' },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 0);

  return (
    <View style={[styles.container, { height: 64 + bottomInset, paddingBottom: bottomInset }]}>
      {items.map((item) => {
        const active = item.match === '/' ? pathname === '/' || pathname === '/(tabs)' : pathname.startsWith(item.match);

        return (
          <Pressable
            accessibilityRole="button"
            key={item.route}
            onPress={() => router.replace(item.route)}
            style={styles.item}>
            <Ionicons color={active ? colors.brand : '#8A96A8'} name={item.icon} size={24} />
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    color: '#8A96A8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  labelActive: {
    color: colors.brand,
  },
});
