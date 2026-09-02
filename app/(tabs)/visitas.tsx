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
import { RidsModuleBanner } from '@/src/components/RidsModuleBanner';
import { Screen } from '@/src/components/Screen';
import { colors } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
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
      <RidsModuleBanner
        icon="briefcase-outline"
        label="VISITAS TÉCNICAS"
        title="¿A qué empresa visitarás?"
      />

      <View style={styles.searchBox}>
        <Ionicons color={ridsPalette.cyanDark} name="search-outline" size={20} />
        <TextInput
          onChangeText={setSearchEmpresa}
          placeholder="Buscar empresa"
          placeholderTextColor="#98A2B3"
          style={styles.input}
          value={searchEmpresa}
        />
        {searchEmpresa ? (
          <Pressable hitSlop={10} onPress={() => setSearchEmpresa('')}>
            <Ionicons color={ridsPalette.slate} name="close-circle" size={19} />
          </Pressable>
        ) : null}
      </View>

      {loadingEmpresas ? <ActivityIndicator color={ridsPalette.cyanDark} style={styles.loader} /> : null}

      <View style={styles.countRow}>
        <Text style={styles.countTitle}>Empresas</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filteredClientes.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.companyList}
        refreshControl={
          <RefreshControl
            colors={[ridsPalette.cyanDark]}
            onRefresh={refreshScreen}
            refreshing={refreshing}
            tintColor={ridsPalette.cyanDark}
          />
        }
        scrollIndicatorInsets={{ bottom: 150 }}
        style={styles.companyScroll}
        showsVerticalScrollIndicator={false}>
        {!loadingEmpresas && filteredClientes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons color={ridsPalette.cyanDark} name="business-outline" size={26} />
            </View>
            <Text style={styles.emptyTitle}>No encontramos empresas</Text>
            <Text style={styles.emptyText}>Prueba con otro nombre.</Text>
          </View>
        ) : null}
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
          <Ionicons color={ridsPalette.cyanDark} name="business-outline" size={21} />
        </View>
        {loading ? (
          <ActivityIndicator color={ridsPalette.cyanDark} />
        ) : selected ? (
          <View style={styles.companyCheck}>
            <Ionicons color={colors.white} name="checkmark" size={14} />
          </View>
        ) : (
          <View style={styles.companyChevron}>
            <Ionicons color={ridsPalette.slate} name="chevron-forward" size={17} />
          </View>
        )}
      </View>
      <View style={styles.companyCopy}>
        <Text numberOfLines={2} style={styles.companyTitle}>{cliente.nombre}</Text>
        <Text style={styles.companySubtitle}>{rutText}</Text>
      </View>
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
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  input: {
    color: ridsPalette.charcoal,
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingVertical: 10,
  },
  loader: {
    marginVertical: 14,
  },
  countRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  countTitle: {
    color: ridsPalette.charcoal,
    fontSize: 15,
    fontWeight: '900',
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 13,
    minWidth: 32,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  countText: {
    color: ridsPalette.cyanDark,
    fontSize: 12,
    fontWeight: '900',
  },
  companyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 190,
    paddingTop: 12,
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
    borderColor: ridsPalette.cyan,
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
  companyCopy: {
    flex: 1,
  },
  companyTitle: {
    color: ridsPalette.charcoal,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  companySubtitle: {
    color: ridsPalette.slate,
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
  companyChevron: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 11,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 42,
    width: '100%',
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 20,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  emptyTitle: {
    color: ridsPalette.charcoal,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 14,
  },
  emptyText: {
    color: ridsPalette.slate,
    fontSize: 13,
    marginTop: 5,
  },
});
