import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getSolicitantesListCached } from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { TextInput } from '@/src/components/AppTextInput';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { Screen } from '@/src/components/Screen';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { Solicitante } from '@/src/types/api';
import { loadVisitaState, saveVisitaState, VisitaEnCursoState } from '@/src/visitas/visita-state';
import { getSolicitanteId } from '@/src/visitas/visita-utils';

export default function SolicitantesScreen() {
  const [visitaState, setVisitaState] = useState<VisitaEnCursoState | null>(null);
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredSolicitantes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return solicitantes;
    return solicitantes.filter((solicitante) => solicitante.nombre.toLowerCase().includes(term));
  }, [search, solicitantes]);

  useEffect(() => {
    async function boot() {
      await loadScreen();
    }

    boot();
  }, []);

  async function loadScreen(force = false) {
    const saved = await loadVisitaState();
    if (!saved.empresaId) {
      router.replace('/(tabs)/visitas');
      return;
    }

    const freshSolicitantes = await getSolicitantesListCached(saved.empresaId, force).catch(() => []);
    const freshIds = new Set(freshSolicitantes.map((solicitante) => getSolicitanteId(solicitante)));
    const nextState = {
      ...saved,
      solicitantes: saved.solicitantes.filter((solicitante) => freshIds.has(getSolicitanteId(solicitante))),
    };

    if (nextState.solicitantes.length !== saved.solicitantes.length) {
      await saveVisitaState(nextState);
    }

    setVisitaState(nextState);
    setSolicitantes(freshSolicitantes);
    setLoading(false);
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await loadScreen(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleSolicitante(solicitante: Solicitante) {
    if (!visitaState) return;

    const id = getSolicitanteId(solicitante);
    const exists = visitaState.solicitantes.some((item) => getSolicitanteId(item) === id);
    const nextState = {
      ...visitaState,
      solicitantes: exists
        ? visitaState.solicitantes.filter((item) => getSolicitanteId(item) !== id)
        : [...visitaState.solicitantes, solicitante],
    };

    setVisitaState(nextState);
    await saveVisitaState(nextState);
  }

  function continuar() {
    if (!visitaState?.solicitantes.length) {
      Alert.alert('Solicitantes', 'Selecciona al menos un solicitante.');
      return;
    }

    router.push('/visitas/formulario');
  }

  function volver() {
    router.replace(visitaState?.sucursalId ? '/visitas/sucursal' : '/(tabs)/visitas');
  }

  if (loading || !visitaState) {
    return (
      <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomNavigation={<BottomNavigation />} extendUnderNavigation scroll={false}>
      <RidsFlowHeader
        icon="people-outline"
        label="VISITA TÉCNICA"
        subtitle={visitaState.empresaNombre}
        title="Selecciona solicitantes"
      />

      <View style={styles.actions}>
        <AppButton
          disabled={!visitaState.solicitantes.length}
          onPress={continuar}
          title={`Continuar${visitaState.solicitantes.length ? ` (${visitaState.solicitantes.length})` : ''}`}
        />
        <AppButton onPress={volver} title="Volver" variant="ghost" />
      </View>

      <View style={styles.searchBox}>
        <Ionicons color={ridsPalette.cyanDark} name="search-outline" size={20} />
        <TextInput
          onChangeText={setSearch}
          placeholder="Buscar solicitante"
          placeholderTextColor="#98A2B3"
          style={styles.input}
          value={search}
        />
        {search ? (
          <Pressable hitSlop={10} onPress={() => setSearch('')}>
            <Ionicons color={ridsPalette.cyanDark} name="close-circle" size={19} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.selectionRow}>
        <Text style={styles.helperText}>Personas disponibles</Text>
        <View style={styles.selectionBadge}>
          <Text style={styles.selectionBadgeText}>{visitaState.solicitantes.length} seleccionados</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            colors={[colors.brand]}
            onRefresh={refreshScreen}
            refreshing={refreshing}
            tintColor={colors.brand}
          />
        }
        scrollIndicatorInsets={{ bottom: 84 }}
      style={styles.listScroll}
      showsVerticalScrollIndicator={false}>
        {filteredSolicitantes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons color={ridsPalette.cyanDark} name="people-outline" size={25} />
            <Text style={styles.emptyTitle}>Sin solicitantes</Text>
            <Text style={styles.emptyText}>No encontramos personas con esa búsqueda.</Text>
          </View>
        ) : null}
        {filteredSolicitantes.map((solicitante) => {
          const id = getSolicitanteId(solicitante);
          const selected = visitaState.solicitantes.some((item) => getSolicitanteId(item) === id);

          return (
            <Pressable
              key={id}
              onPress={() => toggleSolicitante(solicitante)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}>
              <View style={styles.icon}>
                <Ionicons color={ridsPalette.cyanDark} name="person-outline" size={23} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{solicitante.nombre}</Text>
                <Text style={styles.cardText}>{solicitante.email || 'Solicitante'}</Text>
              </View>
              {selected ? (
                <View style={styles.check}>
                  <Ionicons color={colors.white} name="checkmark" size={16} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    paddingVertical: 11,
  },
  selectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  helperText: {
    color: ridsPalette.charcoal,
    fontSize: 13,
    fontWeight: '800',
  },
  selectionBadge: {
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  selectionBadgeText: {
    color: ridsPalette.cyanDark,
    fontSize: 11,
    fontWeight: '900',
  },
  list: {
    gap: 8,
    paddingBottom: 110,
    paddingTop: 14,
  },
  listScroll: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  cardSelected: {
    backgroundColor: ridsPalette.cyanSoft,
    borderColor: ridsPalette.cyanDark,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  icon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  copy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  cardText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  check: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanDark,
    borderRadius: 13,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  actions: {
    gap: 10,
    marginBottom: 18,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  emptyTitle: {
    color: ridsPalette.charcoal,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
  },
  emptyText: {
    color: ridsPalette.slate,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
