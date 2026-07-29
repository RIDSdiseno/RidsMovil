import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getClientesCache, getClientesCached, searchEquipos } from '@/src/api/rids';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { CalendarModal } from '@/src/components/CalendarModal';
import { Screen } from '@/src/components/Screen';
import { TextInput } from '@/src/components/AppTextInput';
import {
  getInitialGestionarEquipoState,
  saveGestionarEquipoState,
} from '@/src/equipos/gestionar-state';
import { ESTADO_EQUIPO_OPTIONS, labelDeEstadoEquipo } from '@/src/equipos/equipo-opciones';
import { colors, shadow } from '@/src/theme/colors';
import { Cliente, Equipo } from '@/src/types/api';

export default function GestionarEquipoScreen() {
  const initialClientes = getClientesCache() ?? [];
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>(initialClientes);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null);
  const [ingresoDesde, setIngresoDesde] = useState('');
  const [ingresoHasta, setIngresoHasta] = useState('');
  const [edicionDesde, setEdicionDesde] = useState('');
  const [edicionHasta, setEdicionHasta] = useState('');
  const [mostrarFiltrosFecha, setMostrarFiltrosFecha] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<'empresa' | 'estado' | null>(null);
  const [calendarTarget, setCalendarTarget] = useState<
    'ingresoDesde' | 'ingresoHasta' | 'edicionDesde' | 'edicionHasta' | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const loadingRef = useRef(false);

  const hayFiltrosFechaActivos = Boolean(ingresoDesde || ingresoHasta || edicionDesde || edicionHasta);

  // Consulta al servidor (búsqueda/filtros/paginación). reset=true vuelve a la
  // página 1 y reemplaza; reset=false agrega la siguiente página (scroll infinito).
  const runQuery = useCallback(async (reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const nextPage = reset ? 1 : pageRef.current + 1;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const resp = await searchEquipos({
        search,
        empresaId,
        estado: estadoFiltro,
        ingresoDesde,
        ingresoHasta,
        edicionDesde,
        edicionHasta,
        page: nextPage,
        limit: 30,
      });
      pageRef.current = resp.page;
      hasMoreRef.current = resp.hasMore;
      setHasMore(resp.hasMore);
      setTotal(resp.total);
      setEquipos((prev) => (reset ? resp.equipos : [...prev, ...resp.equipos]));
    } catch (error) {
      Alert.alert('Equipos', error instanceof Error ? error.message : 'No se pudieron cargar los equipos.');
    } finally {
      loadingRef.current = false;
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  }, [search, empresaId, estadoFiltro, ingresoDesde, ingresoHasta, edicionDesde, edicionHasta]);

  // Empresas para el filtro (una vez).
  useEffect(() => {
    getClientesCached().then(setClientes).catch(() => undefined);
  }, []);

  // Cualquier cambio de búsqueda/filtro reinicia la consulta (con debounce).
  useEffect(() => {
    const t = setTimeout(() => {
      runQuery(true);
    }, 350);
    return () => clearTimeout(t);
  }, [runQuery]);

  function loadMore() {
    if (hasMoreRef.current && !loadingRef.current) runQuery(false);
  }

  async function refreshScreen() {
    setRefreshing(true);
    try {
      await Promise.all([
        getClientesCached(true).then(setClientes).catch(() => undefined),
        runQuery(true),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function selectEquipo(equipo: Equipo) {
    await saveGestionarEquipoState({
      ...getInitialGestionarEquipoState(),
      equipo,
    });
    router.push('/equipos/gestionar/detalle');
  }

  return (
    <Screen bottomNavigation={<BottomNavigation />} scroll={false}>
      <Text style={styles.title}>Gestionar equipo</Text>
      <Text style={styles.subtitle}>Busca por serial, marca, modelo o personal asignado, y filtra por empresa, estado o fecha.</Text>

      <View style={styles.searchBox}>
        <Ionicons color={colors.muted} name="search-outline" size={20} />
        <TextInput
          onChangeText={setSearch}
          placeholder="Buscar equipo"
          placeholderTextColor="#98A2B3"
          style={styles.searchInput}
          value={search}
        />
      </View>

      <Text style={styles.filterLabel}>Empresa</Text>
      <Pressable onPress={() => setPickerOpen('empresa')} style={styles.pickerButton}>
        <Text style={styles.pickerButtonText}>
          {empresaId ? (clientes.find((c) => c.id_empresa === empresaId)?.nombre ?? 'Empresa') : 'Todas las empresas'}
        </Text>
        <Ionicons color="#98A2B3" name="chevron-down" size={18} />
      </Pressable>

      <Text style={styles.filterLabel}>Estado del equipo</Text>
      <Pressable onPress={() => setPickerOpen('estado')} style={styles.pickerButton}>
        <Text style={styles.pickerButtonText}>
          {estadoFiltro ? labelDeEstadoEquipo(estadoFiltro) : 'Todos los estados'}
        </Text>
        <Ionicons color="#98A2B3" name="chevron-down" size={18} />
      </Pressable>

      <Pressable onPress={() => setMostrarFiltrosFecha((v) => !v)} style={styles.toggleFechas}>
        <Ionicons color={colors.brand} name={mostrarFiltrosFecha ? 'chevron-up' : 'chevron-down'} size={16} />
        <Text style={styles.toggleFechasText}>
          Filtrar por fecha {hayFiltrosFechaActivos ? '(activo)' : ''}
        </Text>
      </Pressable>

      {mostrarFiltrosFecha && (
        <View style={styles.fechasBox}>
          <Text style={styles.fechasGrupoLabel}>Fecha de ingreso</Text>
          <View style={styles.fechasRow}>
            <DateFieldButton onPress={() => setCalendarTarget('ingresoDesde')} placeholder="Desde" value={ingresoDesde} />
            <DateFieldButton onPress={() => setCalendarTarget('ingresoHasta')} placeholder="Hasta" value={ingresoHasta} />
          </View>

          <Text style={styles.fechasGrupoLabel}>Fecha de edición</Text>
          <View style={styles.fechasRow}>
            <DateFieldButton onPress={() => setCalendarTarget('edicionDesde')} placeholder="Desde" value={edicionDesde} />
            <DateFieldButton onPress={() => setCalendarTarget('edicionHasta')} placeholder="Hasta" value={edicionHasta} />
          </View>

          {hayFiltrosFechaActivos && (
            <Pressable
              onPress={() => {
                setIngresoDesde('');
                setIngresoHasta('');
                setEdicionDesde('');
                setEdicionHasta('');
              }}
              style={styles.limpiarFechas}>
              <Text style={styles.limpiarFechasText}>Limpiar filtros de fecha</Text>
            </Pressable>
          )}
        </View>
      )}

      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
      <Text style={styles.countText}>{total} equipo(s)</Text>

      <FlatList
        contentContainerStyle={styles.list}
        data={equipos}
        keyExtractor={(equipo) => String(equipo.id_equipo)}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
        refreshControl={
          <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
        }
        renderItem={({ item: equipo }) => (
          <Pressable
            onPress={() => selectEquipo(equipo)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <View style={styles.cardIcon}>
              <Ionicons color={colors.brand} name="laptop-outline" size={24} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{equipo.serial || 'Equipo sin serial'}</Text>
              <Text style={styles.cardText}>
                {[equipo.marca, equipo.modelo, equipo.nombreSolicitante].filter(Boolean).join(' · ') || 'Datos por completar'}
              </Text>
              <View style={styles.cardMetaRow}>
                {equipo.estado ? <Text style={styles.cardBadge}>{labelDeEstadoEquipo(equipo.estado)}</Text> : null}
                {equipo.tieneAgente ? (
                  <View style={styles.cardIndicator}>
                    <Ionicons color={colors.brand} name="hardware-chip-outline" size={14} />
                  </View>
                ) : null}
                {equipo.tieneMantencion ? (
                  <View style={styles.cardIndicator}>
                    <Ionicons color={colors.brand} name="build-outline" size={14} />
                  </View>
                ) : null}
              </View>
            </View>
            <Ionicons color="#B7C0CE" name="chevron-forward" size={20} />
          </Pressable>
        )}
        scrollIndicatorInsets={{ bottom: 150 }}
        style={styles.listScroll}
        showsVerticalScrollIndicator={false}
      />

      <CalendarModal
        onClose={() => setCalendarTarget(null)}
        onSelect={(iso) => {
          if (calendarTarget === 'ingresoDesde') setIngresoDesde(iso);
          if (calendarTarget === 'ingresoHasta') setIngresoHasta(iso);
          if (calendarTarget === 'edicionDesde') setEdicionDesde(iso);
          if (calendarTarget === 'edicionHasta') setEdicionHasta(iso);
        }}
        title={
          calendarTarget === 'ingresoDesde' || calendarTarget === 'ingresoHasta'
            ? 'Fecha de ingreso'
            : 'Fecha de edición'
        }
        value={
          calendarTarget === 'ingresoDesde'
            ? ingresoDesde
            : calendarTarget === 'ingresoHasta'
              ? ingresoHasta
              : calendarTarget === 'edicionDesde'
                ? edicionDesde
                : edicionHasta
        }
        visible={calendarTarget !== null}
      />

      <Modal animationType="slide" onRequestClose={() => setPickerOpen(null)} transparent visible={pickerOpen !== null}>
        <Pressable onPress={() => setPickerOpen(null)} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {pickerOpen === 'empresa' ? 'Selecciona la empresa' : 'Selecciona el estado'}
            </Text>
            <FlatList
              data={
                pickerOpen === 'empresa'
                  ? [{ value: null as string | null, label: 'Todas las empresas' }, ...clientes.map((c) => ({ value: String(c.id_empresa), label: c.nombre }))]
                  : [{ value: null as string | null, label: 'Todos los estados' }, ...ESTADO_EQUIPO_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]
              }
              keyExtractor={(item) => item.value ?? 'TODOS'}
              renderItem={({ item }) => {
                const activo =
                  pickerOpen === 'empresa'
                    ? (item.value ? empresaId === Number(item.value) : empresaId === null)
                    : (item.value ? estadoFiltro === item.value : estadoFiltro === null);
                return (
                  <Pressable
                    onPress={() => {
                      if (pickerOpen === 'empresa') setEmpresaId(item.value ? Number(item.value) : null);
                      if (pickerOpen === 'estado') setEstadoFiltro(item.value);
                      setPickerOpen(null);
                    }}
                    style={styles.modalOption}>
                    <Text style={[styles.modalOptionText, activo && styles.modalOptionTextActive]}>{item.label}</Text>
                    {activo ? <Ionicons color={colors.brand} name="checkmark" size={18} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function DateFieldButton({
  onPress,
  placeholder,
  value,
}: {
  onPress: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.fechaInput}>
      <Text style={value ? styles.fechaInputText : styles.fechaInputPlaceholder}>
        {value || placeholder}
      </Text>
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
    marginBottom: 18,
    marginTop: 6,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    ...shadow,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 14,
    textTransform: 'uppercase',
  },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  pickerButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 24,
    paddingTop: 16,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  modalOption: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalOptionText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  modalOptionTextActive: {
    color: colors.brand,
    fontWeight: '800',
  },
  toggleFechas: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  toggleFechasText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '800',
  },
  fechasBox: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  fechasGrupoLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  fechasRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  fechaInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fechaInputText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  fechaInputPlaceholder: {
    color: '#98A2B3',
    fontSize: 13,
  },
  limpiarFechas: {
    alignItems: 'center',
  },
  limpiarFechasText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
  },
  loader: {
    marginTop: 18,
  },
  countText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
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
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 15,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  cardBadge: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cardIndicator: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
});
