import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/Screen';
import { clearEquipoState } from '@/src/equipos/equipo-state';
import { clearGestionarEquipoState } from '@/src/equipos/gestionar-state';
import { colors, shadow } from '@/src/theme/colors';

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
    <Screen scroll={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Equipos</Text>
          <Text style={styles.subtitle}>Agrega nuevos equipos o administra equipos existentes.</Text>
        </View>

        <View style={styles.actions}>
          <ActionCard
            icon="add-circle-outline"
            onPress={goAgregarEquipo}
            subtitle="Registrar un equipo asociado a una empresa y solicitante."
            title="Agregar equipos"
          />
          <ActionCard
            icon="construct-outline"
            onPress={goGestionarEquipo}
            subtitle="Buscar, editar datos de hardware y cambiar asignacion."
            title="Gestionar equipo"
          />
        </View>
      </View>
    </Screen>
  );
}

function ActionCard({
  disabled,
  icon,
  onPress,
  subtitle,
  title,
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
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
      <View style={styles.actionIcon}>
        <Ionicons color={disabled ? colors.muted : colors.brand} name={icon} size={34} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
      <View style={styles.actionFooter}>
        <Text style={[styles.actionFooterText, disabled && styles.actionFooterTextDisabled]}>
          {disabled ? 'Pendiente' : 'Comenzar'}
        </Text>
        <Ionicons color={disabled ? colors.muted : colors.brand} name="chevron-forward" size={20} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 28,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
  },
  actions: {
    gap: 18,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 190,
    padding: 22,
    ...shadow,
  },
  actionCardDisabled: {
    opacity: 0.62,
  },
  actionCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 18,
    height: 58,
    justifyContent: 'center',
    marginBottom: 18,
    width: 58,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  actionFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  actionFooterText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '900',
  },
  actionFooterTextDisabled: {
    color: colors.muted,
  },
});
