import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';

import { getClientesCached } from '@/src/api/rids';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { Screen } from '@/src/components/Screen';
import { EquipoNuevoState, getInitialEquipoState, loadEquipoState, saveEquipoState } from '@/src/equipos/equipo-state';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { Cliente } from '@/src/types/api';

export default function AgregarEquipoEmpresaScreen() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipoState, setEquipoState] = useState<EquipoNuevoState>(getInitialEquipoState());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredClientes = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? clientes.filter((cliente) =>
          [cliente.nombre, cliente.detalleEmpresa?.rut].filter(Boolean).join(' ').toLowerCase().includes(term),
        )
      : clientes;

    return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, search]);

  useEffect(() => {
    async function boot() {
      const [saved] = await Promise.all([loadEquipoState(), loadEmpresas()]);
      setEquipoState(saved);
    }

    boot();
  }, []);

  async function loadEmpresas(force = false) {
    try {
      setLoading(true);
      setClientes(await getClientesCached(force));
    } catch (error) {
      setClientes([]);
      Alert.alert('Empresas', error instanceof Error ? error.message : 'No se pudieron cargar las empresas.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await loadEmpresas(true);
      setEquipoState(await loadEquipoState());
    } finally {
      setRefreshing(false);
    }
  }

  async function selectEmpresa(cliente: Cliente) {
    const nextState = {
      ...getInitialEquipoState(),
      empresa: cliente,
    };
    setEquipoState(nextState);
    await saveEquipoState(nextState);
    setSearch('');
    router.push('/equipos/agregar/solicitante');
  }

  return (
    <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
      <RidsFlowHeader
        icon="business-outline"
        label="NUEVO EQUIPO · PASO 1 DE 3"
        subtitle="Define quién será el propietario"
        title="Selecciona la empresa"
      />

      <View style={styles.searchBox}>
        <Ionicons color={ridsPalette.cyanDark} name="search-outline" size={20} />
        <TextInput
          onChangeText={setSearch}
          placeholder="Buscar empresa o RUT"
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

      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}

      <View style={styles.countRow}>
        <Text style={styles.countLabel}>Empresas disponibles</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filteredClientes.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.companyList}
        refreshControl={
          <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
        }
        scrollIndicatorInsets={{ bottom: 150 }}
        style={styles.companyScroll}
        showsVerticalScrollIndicator={false}>
        {!loading && filteredClientes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons color={ridsPalette.cyanDark} name="business-outline" size={25} />
            <Text style={styles.emptyTitle}>Sin empresas</Text>
            <Text style={styles.emptyText}>No encontramos resultados para esa búsqueda.</Text>
          </View>
        ) : null}
        {filteredClientes.map((cliente) => (
          <EmpresaCard
            cliente={cliente}
            key={cliente.id_empresa}
            onPress={() => selectEmpresa(cliente)}
            selected={cliente.id_empresa === equipoState.empresa?.id_empresa}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function EmpresaCard({ cliente, onPress, selected }: { cliente: Cliente; onPress: () => void; selected: boolean }) {
  const rutText = cliente.detalleEmpresa?.rut ? `RUT ${cliente.detalleEmpresa.rut}` : 'RUT no registrado';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.companyCard, selected && styles.companyCardSelected, pressed && styles.companyPressed]}>
      <View style={styles.companyHeader}>
        <View style={styles.companyIcon}>
          <Ionicons color={ridsPalette.cyanDark} name="business-outline" size={21} />
        </View>
        {selected ? (
          <View style={styles.companyCheck}>
            <Ionicons color={colors.white} name="checkmark" size={14} />
          </View>
        ) : (
          <Ionicons color="#B7C0CE" name="chevron-forward" size={18} />
        )}
      </View>
      <Text style={styles.companyTitle}>{cliente.nombre}</Text>
      <Text style={styles.companySubtitle}>{rutText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  loader: {
    marginVertical: 14,
  },
  countRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  countLabel: {
    color: ridsPalette.charcoal,
    fontSize: 13,
    fontWeight: '800',
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    minWidth: 30,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  countText: {
    color: ridsPalette.cyanDark,
    fontSize: 11,
    fontWeight: '900',
  },
  companyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 190,
    paddingTop: 14,
  },
  companyScroll: {
    flex: 1,
  },
  companyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 120,
    padding: 10,
    width: '48.7%',
  },
  companyCardSelected: {
    backgroundColor: ridsPalette.cyanSoft,
    borderColor: ridsPalette.cyanDark,
  },
  companyPressed: {
    transform: [{ scale: 0.99 }],
  },
  companyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  companyIcon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 11,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  companyTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  companySubtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  companyCheck: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanDark,
    borderRadius: 12,
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
    width: '100%',
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
