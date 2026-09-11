import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RidsModuleBanner } from '@/src/components/RidsModuleBanner';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/auth/AuthContext';
import { loadEntregaState } from '@/src/entregas/entrega-state';
import { loadEquipoState } from '@/src/equipos/equipo-state';
import { loadGestionarEquipoState } from '@/src/equipos/gestionar-state';
import { colors, shadow } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { loadVisitaState } from '@/src/visitas/visita-state';

export default function PerfilScreen() {
  const { tecnico, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const initials = getInitials(tecnico?.nombre);
  const role = formatRole(tecnico?.rol);
  const technicianId = tecnico?.id_tecnico ?? tecnico?.id;

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
    <Screen scroll={false}>
      <RidsModuleBanner
        icon="person-outline"
        label="CUENTA TÉCNICA"
        title="Tus accesos y actividad"
      />

      <View style={styles.card}>
        <View style={styles.cardAccent} />
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityText}>
            <Text numberOfLines={2} style={styles.name}>{tecnico?.nombre || 'Técnico RIDS'}</Text>
            <View style={styles.roleRow}>
              <Ionicons color={ridsPalette.cyanDark} name="shield-checkmark" size={15} />
              <Text style={styles.role}>{role}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />
        <View style={styles.accountRow}>
          <View style={styles.accountIcon}>
            <Ionicons color={ridsPalette.cyanDark} name="mail-outline" size={18} />
          </View>
          <View style={styles.accountText}>
            <Text style={styles.accountLabel}>CORREO</Text>
            <Text numberOfLines={1} style={styles.email}>{tecnico?.email || 'Cuenta técnica'}</Text>
          </View>
        </View>
        {technicianId ? (
          <View style={styles.technicianId}>
            <Ionicons color={ridsPalette.cyanDark} name="id-card-outline" size={16} />
            <Text style={styles.technicianIdText}>Técnico #{technicianId}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.historyActions}
        showsVerticalScrollIndicator={false}
        style={styles.historyScroll}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Accesos rápidos</Text>
          <View style={styles.sectionLine} />
        </View>
        <HistoryButton
          backgroundColor={ridsPalette.cyanSoft}
          color={ridsPalette.cyanDark}
          icon="calendar-outline"
          onPress={() => router.push('/agenda')}
          title="Mi agenda"
        />
        <HistoryButton
          backgroundColor={ridsPalette.cyanSoft}
          color={ridsPalette.cyanDark}
          icon="clipboard-outline"
          onPress={() => router.push('/perfil/historial-visitas')}
          title="Historial de visitas"
        />
        <HistoryButton
          backgroundColor={ridsPalette.cyanSoft}
          color={ridsPalette.cyanDark}
          icon="cube-outline"
          onPress={() => router.push('/perfil/historial-entregas')}
          title="Historial de entregas"
        />
        <HistoryButton
          backgroundColor={ridsPalette.cyanSoft}
          color={ridsPalette.cyanDark}
          icon="pulse-outline"
          onPress={() => router.push('/perfil/diagnostico')}
          title="Diagnóstico de ubicación"
        />

        <Pressable
          accessibilityRole="button"
          disabled={signingOut}
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && !signingOut && styles.historyPressed,
            signingOut && styles.signOutDisabled,
          ]}>
          <View style={styles.signOutIcon}>
            <Ionicons color={colors.danger} name="log-out-outline" size={22} />
          </View>
          <Text style={styles.signOutText}>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
          <Ionicons color={colors.danger} name="chevron-forward" size={19} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function HistoryButton({
  backgroundColor,
  color,
  icon,
  onPress,
  title,
}: {
  backgroundColor: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.historyButton, pressed && styles.historyPressed]}>
      <View style={[styles.historyIcon, { backgroundColor }]}>
        <Ionicons color={color} name={icon} size={23} />
      </View>
      <Text style={styles.historyTitle}>{title}</Text>
      <View style={styles.chevron}>
        <Ionicons color={ridsPalette.cyanDark} name="chevron-forward" size={18} />
      </View>
    </Pressable>
  );
}

function getInitials(name?: string) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return 'RT';
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''}`.toUpperCase();
}

function formatRole(role?: string) {
  if (!role) return 'Técnico';
  return role
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ridsPalette.charcoal,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 15,
    ...shadow,
  },
  cardAccent: {
    backgroundColor: ridsPalette.cyan,
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyan,
    borderColor: '#71D5DE',
    borderRadius: 25,
    borderWidth: 2,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  avatarText: {
    color: ridsPalette.charcoal,
    fontSize: 17,
    fontWeight: '900',
  },
  identityText: {
    flex: 1,
  },
  name: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
  },
  roleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  role: {
    color: '#B7EAF0',
    fontSize: 13,
    fontWeight: '700',
  },
  email: {
    color: '#E8EDF2',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    backgroundColor: '#2A3440',
    height: 1,
    marginVertical: 12,
    width: '100%',
  },
  accountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  accountIcon: {
    alignItems: 'center',
    backgroundColor: '#20313A',
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  accountText: {
    flex: 1,
  },
  accountLabel: {
    color: '#7F8C9A',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 3,
  },
  technicianId: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#202A35',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 6,
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  technicianIdText: {
    color: '#AAB4C0',
    fontSize: 11,
    fontWeight: '700',
  },
  historyScroll: {
    flex: 1,
    marginTop: 17,
  },
  historyActions: {
    gap: 7,
    paddingBottom: 28,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 2,
  },
  sectionTitle: {
    color: ridsPalette.charcoal,
    fontSize: 15,
    fontWeight: '900',
  },
  sectionLine: {
    backgroundColor: colors.line,
    flex: 1,
    height: 1,
  },
  historyButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  historyPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  historyIcon: {
    alignItems: 'center',
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  historyTitle: {
    color: ridsPalette.charcoal,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  chevron: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  signOutButton: {
    alignItems: 'center',
    borderColor: '#F4CACA',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
    minHeight: 52,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  signOutIcon: {
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: 13,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  signOutText: {
    color: colors.danger,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  signOutDisabled: {
    opacity: 0.55,
  },
});
