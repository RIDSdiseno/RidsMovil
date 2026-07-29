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
import { Screen } from '@/src/components/Screen';
import { colors, shadow } from '@/src/theme/colors';
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
    <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
      <Text style={styles.title}>Solicitantes</Text>
      <Text style={styles.subtitle}>{visitaState.empresaNombre}</Text>

      <View style={styles.actions}>
        <AppButton
          disabled={!visitaState.solicitantes.length}
          onPress={continuar}
          title={`Continuar${visitaState.solicitantes.length ? ` (${visitaState.solicitantes.length})` : ''}`}
        />
        <AppButton onPress={volver} title="Volver" variant="ghost" />
      </View>

      <TextInput
        onChangeText={setSearch}
        placeholder="Buscar solicitante"
        placeholderTextColor="#98A2B3"
        style={styles.input}
        value={search}
      />
      <Text style={styles.helperText}>Seleccionados: {visitaState.solicitantes.length || 'ninguno'}</Text>

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
        scrollIndicatorInsets={{ bottom: 150 }}
        style={styles.listScroll}
        showsVerticalScrollIndicator={false}>
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
                <Ionicons color={colors.brand} name="person-outline" size={24} />
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
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 22,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  helperText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 10,
  },
  list: {
    gap: 12,
    paddingBottom: 190,
    paddingTop: 14,
  },
  listScroll: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    ...shadow,
  },
  cardSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  copy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  cardText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  check: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 13,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  actions: {
    gap: 10,
    marginBottom: 18,
  },
});
