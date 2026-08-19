import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/AppButton';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/auth/AuthContext';
import { loadEntregaState } from '@/src/entregas/entrega-state';
import { loadEquipoState } from '@/src/equipos/equipo-state';
import { loadGestionarEquipoState } from '@/src/equipos/gestionar-state';
import { colors, shadow } from '@/src/theme/colors';
import { loadVisitaState } from '@/src/visitas/visita-state';

export default function PerfilScreen() {
  const { tecnico, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    const [visitaState, entregaState, equipoState, gestionarEquipoState] = await Promise.all([
      loadVisitaState(),
      loadEntregaState(),
      loadEquipoState(),
      loadGestionarEquipoState(),
    ]);
    const hasActiveState = Boolean(
      visitaState.empresaId || entregaState.empresa || equipoState.empresa || gestionarEquipoState.equipo,
    );

    if (!hasActiveState) {
      await closeSession();
      return;
    }

    Alert.alert(
      'Cerrar sesion',
      'Tienes un estado actual en curso. Si continuas, se eliminara todo el progreso pendiente.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, cerrar sesion',
          style: 'destructive',
          onPress: closeSession,
        },
      ],
    );
  }

  async function closeSession() {
    try {
      setSigningOut(true);
      await signOut();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    // scroll={false}: la cabecera y la tarjeta del técnico quedan fijas y solo
    // se desplaza la lista de accesos de abajo.
    <Screen scroll={false}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.subtitle}>Sesion activa del tecnico.</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons color={colors.brand} name="person" size={34} />
        </View>
        <Text style={styles.name}>{tecnico?.nombre || 'Tecnico RIDS'}</Text>
        <Text style={styles.email}>{tecnico?.email || 'Cuenta tecnica'}</Text>
        <View style={styles.divider} />
        <AppButton loading={signingOut} onPress={handleSignOut} title="Cerrar sesion" variant="secondary" />
      </View>

      <ScrollView
        contentContainerStyle={styles.historyActions}
        showsVerticalScrollIndicator={false}
        style={styles.historyScroll}>
        <HistoryButton
          icon="calendar-outline"
          onPress={() => router.push('/agenda')}
          title="Mi agenda"
        />
        <HistoryButton
          icon="clipboard-outline"
          onPress={() => router.push('/perfil/historial-visitas')}
          title="Historial de visitas"
        />
        <HistoryButton
          icon="cube-outline"
          onPress={() => router.push('/perfil/historial-entregas')}
          title="Historial de entregas"
        />
        <HistoryButton
          icon="pulse-outline"
          onPress={() => router.push('/perfil/diagnostico')}
          title="Diagnostico de ubicacion"
        />
      </ScrollView>
    </Screen>
  );
}

function HistoryButton({
  icon,
  onPress,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.historyButton, pressed && styles.historyPressed]}>
      <View style={styles.historyIcon}>
        <Ionicons color={colors.brand} name={icon} size={24} />
      </View>
      <Text style={styles.historyTitle}>{title}</Text>
      <Ionicons color={colors.muted} name="chevron-forward" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginBottom: 22,
    marginTop: 6,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 22,
    ...shadow,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 34,
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  name: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 14,
  },
  email: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 22,
    width: '100%',
  },
  historyScroll: {
    // Ocupa el alto restante bajo la tarjeta fija; es la única zona que scrollea.
    flex: 1,
    marginTop: 20,
  },
  historyActions: {
    gap: 12,
    paddingBottom: 24,
  },
  historyButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    padding: 16,
    ...shadow,
  },
  historyPressed: {
    transform: [{ scale: 0.99 }],
  },
  historyIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 15,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  historyTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
});
