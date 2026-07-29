import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getMisVisitasAsignadasHoy, iniciarRutaVisitaAsignada, iniciarVisitaAsignada } from '@/src/api/rids';
import { AgendaVisita, getAgendaMensualCached } from '@/src/api/intranet';
import { useAuth } from '@/src/auth/AuthContext';
import { AppButton } from '@/src/components/AppButton';
import { Screen } from '@/src/components/Screen';
import { colors, shadow } from '@/src/theme/colors';
import { VisitaAsignada } from '@/src/types/api';
import { reconcileTrackingForAssignedAgendas } from '@/src/visitas/agenda-tracking-flow';
import { reconcileDailyLocationTracking } from '@/src/visitas/daily-location-tracking';
import { getAgendaCardAction } from '@/src/visitas/agenda-card-action';
import { startVisitForEmpresa } from '@/src/visitas/start-visit-flow';
import { formatDistanceMeters, getDistanceFromCurrentLocation } from '@/src/visitas/visit-distance';

export default function AgendaScreen() {
  const { tecnico } = useAuth();
  const [fecha, setFecha] = useState('');
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [agendaMensual, setAgendaMensual] = useState<AgendaVisita[]>([]);
  const [visitas, setVisitas] = useState<VisitaAsignada[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingRouteId, setStartingRouteId] = useState<number | null>(null);
  const [startingVisitId, setStartingVisitId] = useState<number | null>(null);
  const selectedMonthKey = selectedDate.slice(0, 7);
  const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;

  const syncTrackingStatus = useCallback(async (currentVisitas: readonly VisitaAsignada[]) => {
    await reconcileTrackingForAssignedAgendas(currentVisitas, tecnicoId);
    await reconcileDailyLocationTracking(currentVisitas, tecnicoId).catch((error) => {
      console.warn('[daily-tracking] Error al reconciliar tracking de jornada:', error);
    });
  }, [tecnicoId]);

  const loadAgendaMes = useCallback(async (force = false) => {
    if (!tecnico?.nombre?.trim()) {
      setAgendaMensual([]);
      return;
    }

    const date = parseDateKey(selectedDate);
    try {
      const agenda = await getAgendaMensualCached({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        tecnico: tecnico.nombre,
      }, force);
      setAgendaMensual(agenda);
    } catch {
      setAgendaMensual([]);
    }
  }, [selectedDate, tecnico?.nombre]);

  const loadVisitas = useCallback(async (dateKey = selectedDate) => {
    try {
      setLoading(true);
      const response = await getMisVisitasAsignadasHoy(dateKey);
      const nextVisitas = response.visitas ?? [];
      setFecha(response.fecha);
      setVisitas(nextVisitas);
      await syncTrackingStatus(nextVisitas);
    } catch (error) {
      Alert.alert('Mi agenda', error instanceof Error ? error.message : 'No se pudieron cargar tus visitas.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, syncTrackingStatus]);

  useEffect(() => {
    loadAgendaMes();
  }, [loadAgendaMes, selectedMonthKey]);

  useEffect(() => {
    loadVisitas(selectedDate);
  }, [loadVisitas, selectedDate]);

  useEffect(() => {
    syncTrackingStatus(visitas);
  }, [syncTrackingStatus, visitas]);

  async function refreshScreen() {
    try {
      setRefreshing(true);
      await Promise.all([loadAgendaMes(true), loadVisitas(selectedDate)]);
    } finally {
      setRefreshing(false);
    }
  }

  async function iniciarRuta(visita: VisitaAsignada) {
    if (startingRouteId) return;

    const action = getAgendaCardAction(visita);
    if (action.primary !== 'START_ROUTE') {
      Alert.alert('Ruta', action.reason ?? 'Esta ruta aun no esta disponible.');
      return;
    }

    const destino = getDestino(visita);
    if (!destino) {
      Alert.alert('Ruta', 'Esta visita no tiene direccion ni coordenadas para abrir una ruta.');
      return;
    }

    try {
      setStartingRouteId(visita.agendaId);
      const response = await iniciarRutaVisitaAsignada(visita.agendaId);
      const nextVisitas = visitas.map((item) =>
        item.agendaId === visita.agendaId ? response.visita : item,
      );
      setVisitas(nextVisitas);
      await syncTrackingStatus(nextVisitas);
      mostrarOpcionesMapa(response.visita);
    } catch (error) {
      Alert.alert('Ruta', error instanceof Error ? error.message : 'No se pudo iniciar la ruta.');
    } finally {
      setStartingRouteId(null);
    }
  }

  async function iniciarVisita(visita: VisitaAsignada) {
    if (String(visita.estado).toUpperCase() !== 'EN_RUTA') {
      Alert.alert('Visita', 'Debes iniciar ruta antes de iniciar la visita.');
      return;
    }

    try {
      setStartingVisitId(visita.agendaId);

      const distance = await getDistanceFromCurrentLocation(visita);
      if (typeof distance === 'number' && distance > 200) {
        const confirmed = await confirmarInicioFueraDeRango(distance);
        if (!confirmed) return;
      }

      const response = await iniciarVisitaAsignada(visita.agendaId);
      const nextVisitas = visitas.map((item) =>
        item.agendaId === visita.agendaId ? response.visita : item,
      );
      setVisitas(nextVisitas);
      try {
        await syncTrackingStatus(nextVisitas);
      } catch (error) {
        console.warn('No se pudo actualizar el contexto de tracking:', error);
      }
      await startAgendaVisitFlow(response.visita);
    } catch (error) {
      Alert.alert('Visita', error instanceof Error ? error.message : 'No se pudo iniciar la visita.');
    } finally {
      setStartingVisitId(null);
    }
  }

  async function continuarVisita(visita: VisitaAsignada) {
    if (String(visita.estado).toUpperCase() !== 'INICIADA') return;

    try {
      setStartingVisitId(visita.agendaId);
      await startAgendaVisitFlow(visita);
    } catch (error) {
      Alert.alert('Visita', error instanceof Error ? error.message : 'No se pudo recuperar la visita iniciada.');
    } finally {
      setStartingVisitId(null);
    }
  }

  async function startAgendaVisitFlow(visita: VisitaAsignada) {
    const empresaId = typeof visita.empresa?.id_empresa === 'number' ? visita.empresa.id_empresa : null;
    if (!empresaId) {
      throw new Error('Esta visita no tiene una empresa registrada para abrir el formulario.');
    }

    await startVisitForEmpresa({
      empresaId,
      empresaNombre: visita.empresa?.nombre ?? visita.empresa?.razonSocial ?? 'Empresa no registrada',
      empresaRazonSocial: visita.empresa?.razonSocial ?? '',
      agendaId: visita.agendaId,
      agendaEstado: visita.estado,
      agendaHoraInicio: visita.horaInicio ?? visita.horaProgramada ?? null,
      direccion: visita.direccion ?? visita.sucursal?.direccion ?? null,
      coordenadas:
        typeof visita.latitud === 'number' && typeof visita.longitud === 'number'
          ? { lat: visita.latitud, lon: visita.longitud }
          : null,
      sucursalId: visita.sucursal?.id_sucursal ?? null,
    });
  }

  async function openUrl(url: string) {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Ruta', 'No se pudo abrir la aplicacion de mapas.');
      return;
    }
    await Linking.openURL(url);
  }

  function mostrarOpcionesMapa(visita: VisitaAsignada) {
    const destino = getDestino(visita);
    if (!destino) return;

    const encoded = encodeURIComponent(destino.query);
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    const wazeUrl = destino.coords
      ? `https://waze.com/ul?ll=${destino.coords.lat},${destino.coords.lon}&navigate=yes`
      : `https://waze.com/ul?q=${encoded}&navigate=yes`;
    const appleUrl = `http://maps.apple.com/?daddr=${encoded}`;

    Alert.alert('Abrir ruta', visita.empresa?.nombre ?? 'Visita asignada', [
      { text: 'Google Maps', onPress: () => openUrl(googleUrl) },
      { text: 'Waze', onPress: () => openUrl(wazeUrl) },
      ...(Platform.OS === 'ios' ? [{ text: 'Apple Maps', onPress: () => openUrl(appleUrl) }] : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const weekDays = useMemo(() => getWeekDays(parseDateKey(selectedDate)), [selectedDate]);
  const agendaCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    agendaMensual.forEach((item) => {
      counts.set(item.fecha, (counts.get(item.fecha) ?? 0) + 1);
    });
    return counts;
  }, [agendaMensual]);
  const selectedAgendaItems = useMemo(
    () => agendaMensual.filter((item) => item.fecha === selectedDate),
    [agendaMensual, selectedDate],
  );
  const selectedDateIsPast = isBeforeToday(selectedDate);

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Mi agenda</Text>
      <Text style={styles.subtitle}>
        {tecnico?.nombre ? `${tecnico.nombre} · ` : ''}Agenda semanal
      </Text>

      <View style={styles.weekCard}>
        {weekDays.map((day) => {
          const dateKey = formatDateKey(day);
          const selected = dateKey === selectedDate;
          const count = agendaCountByDate.get(dateKey) ?? 0;

          return (
            <Pressable
              key={dateKey}
              onPress={() => setSelectedDate(dateKey)}
              style={({ pressed }) => [
                styles.dayButton,
                selected && styles.dayButtonSelected,
                pressed && styles.dayButtonPressed,
              ]}>
              <Text style={[styles.dayName, selected && styles.dayNameSelected]}>
                {day.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '')}
              </Text>
              <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                {String(day.getDate()).padStart(2, '0')}
              </Text>
              <View style={[styles.dayDot, count > 0 && styles.dayDotActive, selected && styles.dayDotSelected]} />
              <Text style={[styles.dayCount, selected && styles.dayCountSelected]}>
                {count > 0 ? `${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.todayCard}>
        <View style={styles.todayIcon}>
          <Ionicons color={colors.brand} name="calendar-outline" size={22} />
        </View>
        <View>
          <Text style={styles.todayLabel}>Fecha programada</Text>
          <Text style={styles.todayValue}>{formatDateTitle(selectedDate || fecha)}</Text>
        </View>
      </View>

      {!loading && !selectedDateIsPast && visitas.length === 0 && selectedAgendaItems.length > 0 ? (
        <View style={styles.noticeCard}>
          <Ionicons color={colors.warning} name="information-circle-outline" size={20} />
          <Text style={styles.noticeText}>
            Hay visitas en la agenda interna para este dia, pero no hay una visita asignada disponible para iniciar ruta desde la app.
          </Text>
        </View>
      ) : null}

      <AppButton onPress={() => router.back()} title="Volver" variant="ghost" />

      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl colors={[colors.brand]} onRefresh={refreshScreen} refreshing={refreshing} tintColor={colors.brand} />
        }
        showsVerticalScrollIndicator={false}>
        {visitas.map((visita) => (
          <AgendaCard
            item={visita}
            key={visita.agendaId}
            loadingRoute={startingRouteId === visita.agendaId}
            loadingVisit={startingVisitId === visita.agendaId}
            onContinueVisit={() => continuarVisita(visita)}
            onStartRoute={() => iniciarRuta(visita)}
            onStartVisit={() => iniciarVisita(visita)}
          />
        ))}

        {!loading && visitas.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons color={colors.brand} name="calendar-outline" size={30} />
            <Text style={styles.emptyTitle}>Sin visitas asignadas</Text>
            <Text style={styles.emptyText}>No tienes visitas asignadas para el dia seleccionado.</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function AgendaCard({
  item,
  loadingRoute,
  loadingVisit,
  onContinueVisit,
  onStartRoute,
  onStartVisit,
}: {
  item: VisitaAsignada;
  loadingRoute: boolean;
  loadingVisit: boolean;
  onContinueVisit: () => void;
  onStartRoute: () => void;
  onStartVisit: () => void;
}) {
  const empresa = item.empresa?.nombre || 'Empresa no registrada';
  const horario = [item.horaInicio ?? item.horaProgramada, item.horaFin].filter(Boolean).join(' - ');
  const direccion = item.sucursal?.direccion || item.direccion || 'Sin direccion registrada';
  const action = getAgendaCardAction(item);
  const isPastVisit = isBeforeToday(item.fechaProgramada);
  const isStarted = action.status === 'INICIADA';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons color={colors.brand} name="business-outline" size={22} />
        </View>
        {!isPastVisit ? <StatusBadge status={item.estado} /> : null}
      </View>

      <Text style={styles.cardTitle}>{empresa}</Text>
      <Text style={styles.cardText}>{horario || 'Sin horario programado'}</Text>

      {isStarted ? (
        <View style={styles.startedVisitBadge}>
          <Ionicons color="#047857" name="checkmark-circle-outline" size={16} />
          <Text style={styles.startedVisitText}>Visita iniciada</Text>
        </View>
      ) : null}

      <View style={styles.infoRow}>
        <Ionicons color={colors.muted} name="location-outline" size={18} />
        <Text style={styles.infoText}>{direccion}</Text>
      </View>

      {!isPastVisit && item.observacion ? (
        <View style={styles.infoRow}>
          <Ionicons color={colors.muted} name="document-text-outline" size={18} />
          <Text style={styles.infoText}>{item.observacion}</Text>
        </View>
      ) : null}

      {!isPastVisit && action.primary === 'START_ROUTE' ? (
        <AppButton
          loading={loadingRoute}
          onPress={onStartRoute}
          title="Iniciar ruta"
        />
      ) : null}
      {!isPastVisit && action.primary === 'START_VISIT' ? (
        <AppButton
          loading={loadingVisit}
          onPress={onStartVisit}
          title="Llegué al cliente"
          variant="secondary"
        />
      ) : null}
      {!isPastVisit && action.primary === 'CONTINUE_VISIT' ? (
        <AppButton
          loading={loadingVisit}
          onPress={onContinueVisit}
          title="Continuar visita"
        />
      ) : null}
      {!isPastVisit && action.primary === 'NONE' && action.reason ? (
        <Text style={styles.routeHint}>{action.reason}</Text>
      ) : null}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const stylesByStatus: Record<string, { label: string; bg: string; fg: string }> = {
    PROGRAMADA: { label: 'Programada', bg: '#EFF6FF', fg: '#1D4ED8' },
    NOTIFICADA: { label: 'Notificada', bg: '#F0FDFA', fg: '#0F766E' },
    EN_RUTA: { label: 'En ruta', bg: '#FEF3C7', fg: '#B45309' },
    INICIADA: { label: 'Iniciada', bg: '#ECFDF5', fg: '#047857' },
    COMPLETADA: { label: 'Completada', bg: '#DCFCE7', fg: '#047857' },
    CANCELADA: { label: 'Cancelada', bg: '#FEE2E2', fg: '#B91C1C' },
  };
  const config = stylesByStatus[status] ?? { label: status || 'Sin estado', bg: '#F1F5F9', fg: '#475569' };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

function getDestino(visita: VisitaAsignada) {
  if (typeof visita.latitud === 'number' && typeof visita.longitud === 'number') {
    return {
      query: `${visita.latitud},${visita.longitud}`,
      coords: { lat: visita.latitud, lon: visita.longitud },
    };
  }

  const direccion = visita.sucursal?.direccion || visita.direccion;
  if (!direccion?.trim()) return null;

  return { query: direccion.trim(), coords: null };
}

function formatDateTitle(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' });
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isBeforeToday(value: string) {
  const date = parseDateKey(value);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function getWeekDays(date: Date) {
  const base = new Date(date);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(base);
    item.setDate(base.getDate() + index);
    return item;
  });
}

function confirmarInicioFueraDeRango(distance: number) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Iniciar visita',
      `Estás aproximadamente a ${formatDistanceMeters(distance)} del cliente. ¿Deseas iniciar la visita igualmente?`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Iniciar visita', onPress: () => resolve(true) },
      ],
    );
  });
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
  todayCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    padding: 14,
    ...shadow,
  },
  weekCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    padding: 8,
    ...shadow,
  },
  dayButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    minHeight: 74,
    paddingVertical: 8,
  },
  dayButtonSelected: {
    backgroundColor: colors.brand,
  },
  dayButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  dayName: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  dayNameSelected: {
    color: colors.white,
  },
  dayNumber: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  dayNumberSelected: {
    color: colors.white,
  },
  dayDot: {
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 6,
    marginTop: 5,
    width: 6,
  },
  dayDotActive: {
    backgroundColor: colors.warning,
  },
  dayDotSelected: {
    backgroundColor: colors.white,
  },
  dayCount: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    minHeight: 13,
    marginTop: 2,
  },
  dayCountSelected: {
    color: colors.white,
  },
  todayIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  todayLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  todayValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  loader: {
    marginVertical: 14,
  },
  noticeCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    padding: 12,
  },
  noticeText: {
    color: '#92400E',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  trackingCard: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 12,
  },
  trackingIcon: {
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  trackingCopy: {
    flex: 1,
  },
  trackingTitle: {
    color: '#064E3B',
    fontSize: 14,
    fontWeight: '900',
  },
  trackingText: {
    color: '#047857',
    fontSize: 12,
    marginTop: 2,
  },
  stopButton: {
    borderColor: '#34D399',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stopButtonText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '900',
  },
  list: {
    gap: 14,
    paddingBottom: 150,
    paddingTop: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    ...shadow,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  cardText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  routeHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: -4,
  },
  inlineTracking: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineTrackingText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '900',
  },
  startedVisitBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  startedVisitText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '900',
  },
  infoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  infoText: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 20,
    padding: 24,
    ...shadow,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
});
