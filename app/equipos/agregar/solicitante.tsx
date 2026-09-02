import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';

import { getSolicitantesListCached } from '@/src/api/rids';
import { AppButton } from '@/src/components/AppButton';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { Screen } from '@/src/components/Screen';
import { EquipoNuevoState, loadEquipoState, saveEquipoState } from '@/src/equipos/equipo-state';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { Solicitante } from '@/src/types/api';
import { getSolicitanteId } from '@/src/visitas/visita-utils';

export default function AgregarEquipoSolicitanteScreen() {
  const [equipoState, setEquipoState] = useState<EquipoNuevoState | null>(null);
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredSolicitantes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return solicitantes;
    return solicitantes.filter((solicitante) =>
      [solicitante.nombre, solicitante.email].filter(Boolean).join(' ').toLowerCase().includes(term),
    );
  }, [search, solicitantes]);

  useEffect(() => {
    async function boot() {
      await loadScreen();
    }

    boot();
  }, []);

  async function loadScreen(force = false) {
    const saved = await loadEquipoState();
    if (!saved.empresa) {
      router.replace('/equipos/agregar/empresa');
      return;
    }

    const freshSolicitantes = await getSolicitantesListCached(saved.empresa.id_empresa, force).catch(() => []);
    const selectedStillExists = saved.solicitante
      ? freshSolicitantes.some((item) => getSolicitanteId(item) === getSolicitanteId(saved.solicitante!))
      : true;
    const nextState = selectedStillExists ? saved : { ...saved, solicitante: null };

    if (!selectedStillExists) await saveEquipoState(nextState);
    setEquipoState(nextState);
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

  async function selectSolicitante(solicitante: Solicitante) {
    if (!equipoState) return;

    const id = getSolicitanteId(solicitante);
    const selected = equipoState.solicitante && getSolicitanteId(equipoState.solicitante) === id;
    const nextState = {
      ...equipoState,
      solicitante: selected ? null : solicitante,
    };
    setEquipoState(nextState);
    await saveEquipoState(nextState);
  }

  function continuar() {
    if (!equipoState?.solicitante) {
      Alert.alert('Solicitante', 'Selecciona un solicitante para continuar.');
      return;
    }

    router.push('/equipos/agregar/formulario');
  }

  if (loading || !equipoState) {
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
      <RidsFlowHeader
        icon="person-outline"
        label="NUEVO EQUIPO · PASO 2 DE 3"
        subtitle={equipoState.empresa?.nombre}
        title="Selecciona solicitante"
      />

      <View style={styles.actions}>
        <AppButton disabled={!equipoState.solicitante} onPress={continuar} title="Continuar" />
        <AppButton onPress={() => router.back()} title="Volver" variant="ghost" />
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
            <Ionicons color={ridsPalette.slate} name="close-circle" size={19} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.selectionRow}>
        <Text style={styles.helperText}>Solicitante asignado</Text>
        <Text numberOfLines={1} style={styles.selectedName}>
          {equipoState.solicitante ? equipoState.solicitante.nombre : 'Ninguno'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
        }
        scrollIndicatorInsets={{ bottom: 150 }}
        style={styles.listScroll}
        showsVerticalScrollIndicator={false}>
        {filteredSolicitantes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons color={ridsPalette.cyanDark} name="person-outline" size={25} />
            <Text style={styles.emptyTitle}>Sin solicitantes</Text>
            <Text style={styles.emptyText}>No encontramos personas con esa búsqueda.</Text>
          </View>
        ) : null}
        {filteredSolicitantes.map((solicitante) => {
          const id = getSolicitanteId(solicitante);
          const selected = equipoState.solicitante && getSolicitanteId(equipoState.solicitante) === id;

          return (
            <Pressable
              key={id}
              onPress={() => selectSolicitante(solicitante)}
              style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}>
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
  actions: {
    gap: 10,
    marginBottom: 18,
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
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 11,
  },
  helperText: {
    color: ridsPalette.charcoal,
    fontSize: 13,
    fontWeight: '800',
  },
  selectedName: {
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    color: ridsPalette.cyanDark,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    maxWidth: '58%',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  list: {
    gap: 8,
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
