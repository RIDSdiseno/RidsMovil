import { Ionicons } from '@expo/vector-icons';
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

import { getClientesCached } from '@/src/api/rids';
import { useAuth } from '@/src/auth/AuthContext';
import { TextInput } from '@/src/components/AppTextInput';
import { Screen } from '@/src/components/Screen';
import { colors, shadow } from '@/src/theme/colors';
import { Cliente } from '@/src/types/api';
import {
  getInitialVisitaState,
  loadVisitaState,
  VisitaEnCursoState,
} from '@/src/visitas/visita-state';
import { startVisitForEmpresa } from '@/src/visitas/start-visit-flow';

export default function VisitasScreen() {
  const { tecnico } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchEmpresa, setSearchEmpresa] = useState('');
  const [visitaState, setVisitaState] = useState<VisitaEnCursoState>(getInitialVisitaState());
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingEmpresaId, setSelectingEmpresaId] = useState<number | null>(null);

  const filteredClientes = useMemo(() => {
    const term = searchEmpresa.trim().toLowerCase();
    const base = term
      ? clientes.filter((cliente) =>
          [cliente.nombre, cliente.razonSocial].filter(Boolean).join(' ').toLowerCase().includes(term),
        )
      : clientes;

    return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, searchEmpresa]);

  useEffect(() => {
    async function boot() {
      await Promise.all([loadEmpresas(), hydrateVisita()]);
    }

    boot();
  }, []);

  async function hydrateVisita() {
    const saved = await loadVisitaState();
    setVisitaState(saved);
  }

  async function loadEmpresas(force = false) {
    try {
      setLoadingEmpresas(true);
      setClientes(await getClientesCached(force));
    } catch (error) {
      setClientes([]);
      Alert.alert('Empresas', error instanceof Error ? error.message : 'No se pudieron cargar las empresas.');
    } finally {
      setLoadingEmpresas(false);
    }
  }

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await Promise.all([
        loadEmpresas(true),
        hydrateVisita(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSelectEmpresa(cliente: Cliente) {
    try {
      setSelectingEmpresaId(cliente.id_empresa);
      const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id;
      if (!tecnicoId) {
        Alert.alert('Sesion', 'No se encontro el tecnico autenticado. Inicia sesion nuevamente.');
        return;
      }

      const result = await startVisitForEmpresa({
        empresaId: cliente.id_empresa,
        empresaNombre: cliente.nombre,
        empresaRazonSocial: cliente.razonSocial ?? '',
        tecnicoId,
      });
      setVisitaState(result.state);
      setSearchEmpresa('');
    } catch (error) {
      Alert.alert('Visitas', error instanceof Error ? error.message : 'No se pudo iniciar la visita.');
    } finally {
      setSelectingEmpresaId(null);
    }
  }

  const selectedEmpresaId = visitaState.empresaId;

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Visitas</Text>
      <Text style={styles.subtitle}>Selecciona una empresa para comenzar una visita tecnica.</Text>

      <TextInput
        onChangeText={setSearchEmpresa}
        placeholder="Buscar empresa"
        placeholderTextColor="#98A2B3"
        style={styles.input}
        value={searchEmpresa}
      />

      {loadingEmpresas ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}

      <Text style={styles.countText}>
        {filteredClientes.length} empresa{filteredClientes.length === 1 ? '' : 's'} disponible
        {filteredClientes.length === 1 ? '' : 's'}
      </Text>

      <ScrollView
        contentContainerStyle={styles.companyList}
        refreshControl={
          <RefreshControl
            colors={[colors.brand]}
            onRefresh={refreshScreen}
            refreshing={refreshing}
            tintColor={colors.brand}
          />
        }
        scrollIndicatorInsets={{ bottom: 150 }}
        style={styles.companyScroll}
        showsVerticalScrollIndicator={false}>
        {filteredClientes.map((cliente) => (
          <EmpresaCard
            cliente={cliente}
            key={cliente.id_empresa}
            loading={selectingEmpresaId === cliente.id_empresa}
            onPress={() => handleSelectEmpresa(cliente)}
            selected={cliente.id_empresa === selectedEmpresaId}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function EmpresaCard({
  cliente,
  loading,
  onPress,
  selected,
}: {
  cliente: Cliente;
  loading: boolean;
  onPress: () => void;
  selected: boolean;
}) {
  const rutText = cliente.detalleEmpresa?.rut ? `RUT ${cliente.detalleEmpresa.rut}` : 'RUT no registrado';

  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.companyCard,
        selected && styles.companyCardSelected,
        pressed && styles.companyPressed,
      ]}>
      <View style={styles.companyHeader}>
        <View style={styles.companyIcon}>
          <Ionicons color={colors.brand} name="business-outline" size={21} />
        </View>
        {loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : selected ? (
          <View style={styles.companyCheck}>
            <Ionicons color={colors.white} name="checkmark" size={14} />
          </View>
        ) : (
          <Ionicons color="#B7C0CE" name="chevron-forward" size={18} />
        )}
      </View>
      <View style={styles.companyCopy}>
        <Text style={styles.companyTitle}>{cliente.nombre}</Text>
        <Text style={styles.companySubtitle}>{rutText}</Text>
      </View>
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
  companyCopy: {
    flex: 1,
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
