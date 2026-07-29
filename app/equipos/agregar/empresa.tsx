import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';

import { getClientesCached } from '@/src/api/rids';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { Screen } from '@/src/components/Screen';
import { EquipoNuevoState, getInitialEquipoState, loadEquipoState, saveEquipoState } from '@/src/equipos/equipo-state';
import { colors, shadow } from '@/src/theme/colors';
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
      <Text style={styles.title}>Empresa</Text>
      <Text style={styles.subtitle}>Selecciona la empresa propietaria del equipo.</Text>

      <TextInput
        onChangeText={setSearch}
        placeholder="Buscar empresa o RUT"
        placeholderTextColor="#98A2B3"
        style={styles.input}
        value={search}
      />

      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}

      <Text style={styles.countText}>
        {filteredClientes.length} empresa{filteredClientes.length === 1 ? '' : 's'} disponible
        {filteredClientes.length === 1 ? '' : 's'}
      </Text>

      <ScrollView
        contentContainerStyle={styles.companyList}
        refreshControl={
          <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
        }
        scrollIndicatorInsets={{ bottom: 150 }}
        style={styles.companyScroll}
        showsVerticalScrollIndicator={false}>
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
          <Ionicons color={colors.brand} name="business-outline" size={21} />
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
  loader: {
    marginVertical: 14,
  },
  countText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  companyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 190,
    paddingTop: 14,
  },
  companyScroll: {
    flex: 1,
  },
  companyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 142,
    padding: 13,
    width: '48%',
    ...shadow,
  },
  companyCardSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  companyPressed: {
    transform: [{ scale: 0.99 }],
  },
  companyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  companyIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  companyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  companySubtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  companyCheck: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
});
