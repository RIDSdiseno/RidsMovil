// app/equipos/gestionar/index.tsx
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
import { TextInput } from '@/src/components/AppTextInput';
import { BottomNavigation } from '@/src/components/BottomNavigation';
import { CalendarModal } from '@/src/components/CalendarModal';
import { RidsFlowHeader } from '@/src/components/RidsFlowHeader';
import { Screen } from '@/src/components/Screen';
import { ESTADO_EQUIPO_OPTIONS, labelDeEstadoEquipo } from '@/src/equipos/equipo-opciones';
import {
  getInitialGestionarEquipoState,
  saveGestionarEquipoState,
} from '@/src/equipos/gestionar-state';
import { colors, shadow } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { Cliente, Equipo } from '@/src/types/api';

export default function GestionarEquipoScreen() {
  const initialClientes = getClientesCache() ?? [];
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>(initialClientes);
  const [total, setTotal] = useState(0);
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
      <RidsFlowHeader
        icon="construct-outline"
        label="INVENTARIO TÉCNICO"
        subtitle="Busca, filtra y actualiza equipos registrados"
        title="Gestionar equipos"
      />

      <View style={styles.searchBox}>
        <Ionicons color={ridsPalette.cyanDark} name="search-outline" size={20} />
        <TextInput
          onChangeText={setSearch}
          placeholder="Buscar equipo"
          placeholderTextColor="#98A2B3"
          style={styles.searchInput}
          value={search}
        />
      </View>

      <View style={styles.filtersPanel}>
        <View style={styles.filterFieldsRow}>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Empresa</Text>
            <Pressable onPress={() => setPickerOpen('empresa')} style={styles.pickerButton}>
              <Text numberOfLines={1} style={styles.pickerButtonText}>
                {empresaId ? (clientes.find((c) => c.id_empresa === empresaId)?.nombre ?? 'Empresa') : 'Todas'}
              </Text>
              <Ionicons color="#98A2B3" name="chevron-down" size={15} />
            </Pressable>
          </View>

          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Estado</Text>
            <Pressable onPress={() => setPickerOpen('estado')} style={styles.pickerButton}>
              <Text numberOfLines={1} style={styles.pickerButtonText}>
                {estadoFiltro ? labelDeEstadoEquipo(estadoFiltro) : 'Todos'}
              </Text>
              <Ionicons color="#98A2B3" name="chevron-down" size={15} />
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => setMostrarFiltrosFecha((v) => !v)} style={styles.toggleFechas}>
          <Ionicons color={ridsPalette.cyanDark} name={mostrarFiltrosFecha ? 'chevron-up' : 'chevron-down'} size={16} />
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
                <Text style={styles.limpiarFechasText}>Limpiar fechas</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
      <View style={styles.countRow}>
        <Text style={styles.countLabel}>Resultados</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{total}</Text></View>
      </View>

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
              <Ionicons color={ridsPalette.cyanDark} name="laptop-outline" size={20} />
            </View>
            <View style={styles.cardCopy}>
              <View style={styles.cardTitleRow}>
                <Text numberOfLines={1} style={styles.cardTitle}>{equipo.serial || 'Equipo sin serial'}</Text>
                {equipo.estado ? <Text style={styles.cardBadge}>{labelDeEstadoEquipo(equipo.estado)}</Text> : null}
              </View>
              <Text numberOfLines={1} style={styles.cardText}>
                {[equipo.marca, equipo.modelo].filter(Boolean).join(' · ') || 'Marca y modelo por completar'}
              </Text>
              <View style={styles.assigneeRow}>
                <Ionicons color={ridsPalette.slate} name="person-outline" size={12} />
                <Text style={styles.assigneeText}>{equipo.nombreSolicitante || 'Sin solicitante asignado'}</Text>
              </View>
              {equipo.tieneAgente || equipo.tieneMantencion || equipo.tieneOneDrive ? (
                <View style={styles.cardMetaRow}>
                {equipo.tieneAgente ? (
                  <View style={styles.cardIndicator}>
                    <Ionicons color={ridsPalette.cyanDark} name="hardware-chip-outline" size={12} />
                  </View>
                ) : null}
                {equipo.tieneMantencion ? (
                  <View style={styles.cardIndicator}>
                    <Ionicons color={ridsPalette.cyanDark} name="build-outline" size={12} />
                  </View>
                ) : null}
                {equipo.tieneOneDrive ? (
                  <View style={styles.cardIndicator}>
                    <Ionicons
                      color={ridsPalette.cyanDark}
                      name="cloud-outline"
                      size={12}
                    />
                  </View>
                ) : null}
                </View>
              ) : null}
            </View>
            <Ionicons color="#B7C0CE" name="chevron-forward" size={17} />
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
  filtersPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    padding: 11,
  },
  filterFieldsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterField: {
    flex: 1,
    minWidth: 0,
  },
  filterLabel: {
    color: ridsPalette.slate,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  pickerButtonText: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
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
    marginTop: 9,
    minHeight: 28,
  },
  toggleFechasText: {
    color: ridsPalette.cyanDark,
    fontSize: 12,
    fontWeight: '800',
  },
  fechasBox: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 7,
    padding: 10,
  },
  fechasGrupoLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  fechasRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  fechaInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
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
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  countText: {
    color: ridsPalette.cyanDark,
    fontSize: 11,
    fontWeight: '900',
  },
  list: {
    gap: 8,
    paddingBottom: 190,
    paddingTop: 10,
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
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  cardText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  assigneeRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  assigneeText: {
    color: ridsPalette.charcoalSoft,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  cardBadge: {
    color: ridsPalette.cyanDark,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 5,
  },
  cardIndicator: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
});
