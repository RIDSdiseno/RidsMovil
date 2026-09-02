import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RidsModuleBanner } from '@/src/components/RidsModuleBanner';
import { Screen } from '@/src/components/Screen';
import { clearEquipoState } from '@/src/equipos/equipo-state';
import { clearGestionarEquipoState } from '@/src/equipos/gestionar-state';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';

export default function EquiposScreen() {
  async function goAgregarEquipo() {
    await clearEquipoState();
    router.push('/equipos/agregar/empresa');
  }

  async function goGestionarEquipo() {
    await clearGestionarEquipoState();
    router.push('/equipos/gestionar');
  }

  return (
    <Screen>
      <RidsModuleBanner
        icon="hardware-chip"
        label="INVENTARIO RIDS"
        title="¿Qué necesitas hacer?"
      />

      <View style={styles.actions}>
        <ActionCard
          color={ridsPalette.cyanDark}
          icon="add-outline"
          iconBackground={ridsPalette.cyanSoft}
          label="NUEVO REGISTRO"
          onPress={goAgregarEquipo}
          subtitle="Asocia un nuevo equipo a su empresa y solicitante."
          title="Agregar equipo"
        />
        <ActionCard
          color={ridsPalette.cyanDark}
          icon="construct-outline"
          iconBackground={ridsPalette.cyanSoft}
          label="GESTIÓN TÉCNICA"
          onPress={goGestionarEquipo}
          subtitle="Busca equipos, actualiza hardware o cambia su asignación."
          title="Gestionar equipo"
        />
      </View>
    </Screen>
  );
}

function ActionCard({
  color,
  disabled,
  icon,
  iconBackground,
  label,
  onPress,
  subtitle,
  title,
}: {
  color: string;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconBackground: string;
  label: string;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        disabled && styles.actionCardDisabled,
        pressed && !disabled && styles.actionCardPressed,
      ]}>
      <View style={styles.actionTopRow}>
        <View style={[styles.actionIcon, { backgroundColor: iconBackground }]}>
          <Ionicons color={disabled ? colors.muted : color} name={icon} size={28} />
        </View>
        <View style={styles.actionArrow}>
          <Ionicons color={disabled ? colors.muted : color} name="arrow-forward" size={20} />
        </View>
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 148,
    padding: 13,
  },
  actionCardDisabled: {
    opacity: 0.62,
  },
  actionCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  actionTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  actionArrow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 11,
  },
  actionTitle: {
    color: ridsPalette.charcoal,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 5,
  },
  actionSubtitle: {
    color: ridsPalette.slate,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 5,
  },
});
