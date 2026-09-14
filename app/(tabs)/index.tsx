// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  cancelarVisita,
  getMisVisitasAsignadasHoyCache,
  getMisVisitasAsignadasHoyCached,
  iniciarRutaVisitaAsignada,
  iniciarVisitaAsignada,
  setMisVisitasAsignadasHoyCache,
} from '@/src/api/rids';
import { useAuth } from '@/src/auth/AuthContext';
import { RidsModuleBanner } from '@/src/components/RidsModuleBanner';
import { Screen } from '@/src/components/Screen';
import { SwipeToCancelCard } from '@/src/components/SwipeToCancelCard';
import { clearEntregaState, loadEntregaState } from '@/src/entregas/entrega-state';
import { clearEquipoState, loadEquipoState } from '@/src/equipos/equipo-state';
import { clearGestionarEquipoState, loadGestionarEquipoState } from '@/src/equipos/gestionar-state';
import { colors, shadow } from '@/src/theme/colors';
import { ridsPalette } from '@/src/theme/rids-palette';
import { VisitaAsignada } from '@/src/types/api';
import { getAgendaCardAction } from '@/src/visitas/agenda-card-action';
import { reconcileTrackingForAssignedAgendas } from '@/src/visitas/agenda-tracking-flow';
import { reconcileDailyLocationTracking } from '@/src/visitas/daily-location-tracking';
import { startVisitForEmpresa } from '@/src/visitas/start-visit-flow';
import { formatDistanceMeters, getDistanceFromCurrentLocation } from '@/src/visitas/visit-distance';
import { clearVisitaState, loadVisitaState } from '@/src/visitas/visita-state';

type ResumeRoute =
  | '/visitas/formulario'
  | '/visitas/solicitantes'
  | '/visitas/sucursal'
  | '/entregas/formulario'
  | '/entregas/receptor'
  | '/equipos/agregar/formulario'
  | '/equipos/agregar/solicitante'
  | '/equipos/gestionar/detalle';

type WorkStatus = {
  icon: keyof typeof Ionicons.glyphMap;
  kind: 'IDLE' | 'VISITA_MANUAL' | 'VISITA_AGENDA' | 'ENTREGA' | 'EQUIPO_NUEVO' | 'EQUIPO_GESTION';
  route: ResumeRoute | '/(tabs)/visitas';
  text: string;
  title: string;
};

const idleStatus: WorkStatus = {
  icon: 'navigate-outline',
  kind: 'IDLE',
  route: '/(tabs)/visitas',
  text: 'Selecciona una empresa, selecciona los solicitantes y completa las actividades.',
  title: 'Listo para iniciar una visita',
};

export default function DashboardScreen() {
  const { isLoading, tecnico } = useAuth();
  const firstName = tecnico?.nombre?.split(' ')[0] || 'Tecnico';
  const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;
  const todayDateKey = formatDateKey(new Date());
  const cachedAgenda = tecnicoId ? getMisVisitasAsignadasHoyCache(tecnicoId, todayDateKey) : null;
  const [agendaToday, setAgendaToday] = useState<VisitaAsignada[]>(() => sortAgenda(cachedAgenda?.visitas ?? []));
  const [loadingAgenda, setLoadingAgenda] = useState(!cachedAgenda);
  const [startingRouteId, setStartingRouteId] = useState<number | null>(null);
  const [startingVisitId, setStartingVisitId] = useState<number | null>(null);
  const [cancellingProcess, setCancellingProcess] = useState(false);
  const [workStatus, setWorkStatus] = useState<WorkStatus>(idleStatus);

  const syncTrackingStatus = useCallback(async (currentAgenda: readonly VisitaAsignada[]) => {
    await reconcileTrackingForAssignedAgendas(currentAgenda, tecnicoId);
    await reconcileDailyLocationTracking(currentAgenda, tecnicoId).catch((error) => {
      console.warn('[daily-tracking] Error al reconciliar tracking de jornada:', error);
    });
  }, [tecnicoId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void readWorkStatus().then((nextStatus) => {
        if (mounted) setWorkStatus(nextStatus);
      });

      return () => {
        mounted = false;
      };
    }, []),
  );

  const cancelCurrentProcess = useCallback(async (kind: WorkStatus['kind']) => {
    try {
      setCancellingProcess(true);

      if (kind === 'VISITA_MANUAL') {
        const visitaState = await loadVisitaState();
        if (visitaState.origen === 'AGENDA' || visitaState.agendaId) {
          throw new Error('La visita está vinculada a una agenda y no puede cancelarse desde Inicio.');
        }
        if (visitaState.visitaId) await cancelarVisita(visitaState.visitaId);
        await clearVisitaState();
      } else if (kind === 'ENTREGA') {
        await clearEntregaState();
      } else if (kind === 'EQUIPO_NUEVO') {
        await clearEquipoState();
      } else if (kind === 'EQUIPO_GESTION') {
        await clearGestionarEquipoState();
      }

      setWorkStatus(await readWorkStatus());
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'No se pudo cancelar',
        error instanceof Error ? error.message : 'No se pudo eliminar el proceso pendiente.',
      );
    } finally {
      setCancellingProcess(false);
    }
  }, []);

  const requestCancelCurrentProcess = useCallback(() => {
    if (workStatus.kind === 'IDLE' || cancellingProcess) return;

    if (workStatus.kind === 'VISITA_AGENDA') {
      Alert.alert(
        'Visita agendada activa',
        'Esta visita debe completarse desde el formulario o cancelarse formalmente desde la agenda. El seguimiento de ubicación continuará activo.',
      );
      return;
    }

    Alert.alert(
      `Cancelar ${getWorkStatusLabel(workStatus.kind)}`,
      'Se eliminará el progreso pendiente de este proceso. Esta acción no se puede deshacer.',
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Cancelar proceso',
          style: 'destructive',
          onPress: () => {
            void cancelCurrentProcess(workStatus.kind);
          },
        },
      ],
    );
  }, [cancelCurrentProcess, cancellingProcess, workStatus]);

  const loadTodayAgenda = useCallback(async (force = false) => {
    if (!tecnicoId) {
      setLoadingAgenda(false);
      return;
    }

    const cached = getMisVisitasAsignadasHoyCache(tecnicoId, todayDateKey);
    if (!force && cached) {
      const nextAgenda = sortAgenda(cached.visitas ?? []);
      setAgendaToday(nextAgenda);
      setLoadingAgenda(false);
      await syncTrackingStatus(nextAgenda);
      return;
    }

    try {
      setLoadingAgenda(true);
      const response = await getMisVisitasAsignadasHoyCached(tecnicoId, todayDateKey, force);
      const nextAgenda = sortAgenda(response.visitas ?? []);
      setAgendaToday(nextAgenda);
      await syncTrackingStatus(nextAgenda);
    } catch {
      // Conserva la ultima respuesta valida mientras se recupera la conexion.
    } finally {
      setLoadingAgenda(false);
    }
  }, [syncTrackingStatus, tecnicoId, todayDateKey]);

  // Se recarga al recuperar el foco y no solo al montar: la pantalla de inicio
  // es una pestaña que permanece montada, así que al volver desde el formulario
  // de visita el efecto de montaje ya no se ejecuta y la tarjeta conservaba el
  // estado anterior. Lee primero de la caché, de modo que el retorno es
  // inmediato y solo consulta al servidor cuando esa copia fue invalidada.
  useFocusEffect(
    useCallback(() => {
      if (isLoading) return;
      void loadTodayAgenda(false);
    }, [isLoading, loadTodayAgenda]),
  );

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
      const nextAgenda = agendaToday.map((item) =>
        item.agendaId === visita.agendaId ? response.visita : item,
      );
      setAgendaToday(nextAgenda);
      if (tecnicoId) {
        setMisVisitasAsignadasHoyCache(tecnicoId, todayDateKey, { fecha: todayDateKey, visitas: nextAgenda });
      }
      await syncTrackingStatus(nextAgenda);
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
      const nextAgenda = agendaToday.map((item) =>
        item.agendaId === visita.agendaId ? response.visita : item,
      );
      setAgendaToday(nextAgenda);
      if (tecnicoId) {
        setMisVisitasAsignadasHoyCache(tecnicoId, todayDateKey, { fecha: todayDateKey, visitas: nextAgenda });
      }
      try {
        await syncTrackingStatus(nextAgenda);
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

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={ridsPalette.cyanDark} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => loadTodayAgenda(true)} refreshing={loadingAgenda}>
      <RidsModuleBanner
        icon="home-outline"
        label="RESUMEN DE TU JORNADA"
        title={`Hola, ${firstName}`}
      />

      <SwipeToCancelCard
        disabled={workStatus.kind === 'IDLE' || cancellingProcess}
        onCancelRequest={requestCancelCurrentProcess}
        onPress={() => router.push(workStatus.route)}
        style={styles.statusCardContainer}>
        <View style={styles.statusCard}>
          <View style={styles.statusAccent} />
          <View style={styles.statusCopy}>
            <View style={styles.statusLabelRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusLabel}>Estado actual</Text>
            </View>
            <Text style={styles.statusTitle}>{workStatus.title}</Text>
            <Text style={styles.statusText}>{workStatus.text}</Text>
          </View>
          <View style={styles.pulse}>
            {cancellingProcess ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons color={colors.white} name={workStatus.icon} size={30} />
            )}
          </View>
        </View>
      </SwipeToCancelCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Visitas programadas</Text>
        <View style={styles.todayBadge}>
          <Ionicons color={ridsPalette.cyanDark} name="calendar-clear-outline" size={13} />
          <Text style={styles.todayText}>HOY</Text>
        </View>
      </View>
      <View style={styles.agendaBlock}>
        {loadingAgenda ? <ActivityIndicator color={ridsPalette.cyanDark} style={styles.agendaLoader} /> : null}

        {!loadingAgenda && agendaToday.length === 0 ? (
          <Pressable onPress={() => router.push('/agenda')} style={styles.emptyAgendaCard}>
            <View style={styles.agendaIcon}>
              <Ionicons color={ridsPalette.cyanDark} name="calendar-outline" size={22} />
            </View>
            <View style={styles.agendaCopy}>
              <Text style={styles.agendaTitle}>Sin visitas para hoy</Text>
              <Text style={styles.agendaText}>Revisa tu agenda completa para otras fechas.</Text>
            </View>
          </Pressable>
        ) : null}

        {agendaToday.map((item) => (
          <AgendaTodayCard
            item={item}
            key={item.agendaId}
            loadingRoute={startingRouteId === item.agendaId}
            loadingVisit={startingVisitId === item.agendaId}
            onContinueVisit={() => continuarVisita(item)}
            onStartRoute={() => iniciarRuta(item)}
            onStartVisit={() => iniciarVisita(item)}
          />
        ))}
      </View>
    </Screen>
  );
}

function AgendaTodayCard({
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
  const hora = [item.horaInicio ?? item.horaProgramada, item.horaFin].filter(Boolean).join(' - ');
  const action = getAgendaCardAction(item);
  const isStarted = action.status === 'INICIADA';

  return (
    <Pressable
      disabled={loadingRoute}
      onPress={() => {
        if (action.primary === 'START_ROUTE') onStartRoute();
      }}
      style={({ pressed }) => [
        styles.agendaCard,
        pressed && action.primary === 'START_ROUTE' && styles.cardPressed,
      ]}>
      <View style={styles.agendaIcon}>
        <Ionicons color={ridsPalette.cyanDark} name="briefcase-outline" size={21} />
      </View>
      <View style={styles.agendaCopy}>
        <Text style={styles.agendaTitle}>{empresa}</Text>
        <View style={styles.agendaMetaRow}>
          <Ionicons color={ridsPalette.cyanDark} name="time-outline" size={14} />
          <Text style={styles.agendaText}>{hora || 'Sin horario'}</Text>
          <View style={styles.metaDivider} />
          <Text style={styles.agendaState}>{formatAgendaState(item.estado)}</Text>
        </View>
        {isStarted ? (
          <View style={styles.startedVisitBadge}>
            <Ionicons color={ridsPalette.cyanDark} name="checkmark-circle-outline" size={14} />
            <Text style={styles.startedVisitText}>Visita iniciada</Text>
          </View>
        ) : null}
        {item.observacion ? <Text style={styles.agendaNotes}>{item.observacion}</Text> : null}
        {action.primary === 'NONE' && action.reason ? (
          <Text style={styles.routeHint}>{action.reason}</Text>
        ) : null}
        {action.primary === 'START_ROUTE' ? (
          <Pressable
            disabled={loadingRoute}
            onPress={onStartRoute}
            style={({ pressed }) => [
              styles.routeButton,
              loadingRoute && styles.routeButtonDisabled,
              pressed && styles.routeButtonPressed,
            ]}>
            {loadingRoute ? <ActivityIndicator color={colors.white} size="small" /> : null}
            <Ionicons color={colors.white} name="navigate-outline" size={16} />
            <Text style={styles.routeButtonText}>Iniciar ruta</Text>
          </Pressable>
        ) : null}
        {action.primary === 'START_VISIT' ? (
          <Pressable
            disabled={loadingVisit}
            onPress={onStartVisit}
            style={({ pressed }) => [
              styles.visitButton,
              loadingVisit && styles.routeButtonDisabled,
              pressed && styles.routeButtonPressed,
            ]}>
            {loadingVisit ? <ActivityIndicator color={ridsPalette.cyanDark} size="small" /> : null}
            <Ionicons color={ridsPalette.cyanDark} name="checkmark-circle-outline" size={16} />
            <Text style={styles.visitButtonText}>Llegué al cliente</Text>
          </Pressable>
        ) : null}
        {action.primary === 'CONTINUE_VISIT' ? (
          <Pressable
            disabled={loadingVisit}
            onPress={onContinueVisit}
            style={({ pressed }) => [
              styles.routeButton,
              loadingVisit && styles.routeButtonDisabled,
              pressed && styles.routeButtonPressed,
            ]}>
            {loadingVisit ? <ActivityIndicator color={colors.white} size="small" /> : null}
            <Ionicons color={colors.white} name="clipboard-outline" size={16} />
            <Text style={styles.routeButtonText}>Continuar visita</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatAgendaState(state: string) {
  return state
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

async function readWorkStatus(): Promise<WorkStatus> {
  const [visitaState, entregaState, equipoState, gestionarEquipoState] = await Promise.all([
    loadVisitaState(),
    loadEntregaState(),
    loadEquipoState(),
    loadGestionarEquipoState(),
  ]);

  if (visitaState.empresaId) {
    const isAgendaVisit = visitaState.origen === 'AGENDA' || typeof visitaState.agendaId === 'number';
    return {
      icon: 'clipboard-outline',
      kind: isAgendaVisit ? 'VISITA_AGENDA' : 'VISITA_MANUAL',
      route: visitaState.solicitantes.length
        ? '/visitas/formulario'
        : visitaState.sucursalId
          ? '/visitas/solicitantes'
          : '/visitas/sucursal',
      text: visitaState.empresaNombre || 'Continua la visita pendiente.',
      title: isAgendaVisit ? 'Visita agendada en curso' : 'Visita en curso',
    };
  }

  if (entregaState.empresa) {
    const hasReceptor =
      Boolean(entregaState.receptor) ||
      Boolean(entregaState.receptorManual.nombre.trim() || entregaState.receptorManual.apellidos.trim());

    return {
      icon: 'cube-outline',
      kind: 'ENTREGA',
      route: hasReceptor ? '/entregas/formulario' : '/entregas/receptor',
      text: entregaState.empresa.nombre || 'Continua la entrega pendiente.',
      title: entregaState.operation === 'retiro' ? 'Retiro en curso' : 'Entrega en curso',
    };
  }

  if (equipoState.empresa) {
    return {
      icon: 'hardware-chip-outline',
      kind: 'EQUIPO_NUEVO',
      route: equipoState.solicitante ? '/equipos/agregar/formulario' : '/equipos/agregar/solicitante',
      text: equipoState.empresa.nombre || 'Continua el registro de equipo.',
      title: 'Registro de equipo en curso',
    };
  }

  if (gestionarEquipoState.equipo) {
    return {
      icon: 'hardware-chip-outline',
      kind: 'EQUIPO_GESTION',
      route: '/equipos/gestionar/detalle',
      text: gestionarEquipoState.equipo.serial || 'Continua la gestion del equipo.',
      title: 'Gestion de equipo en curso',
    };
  }

  return idleStatus;
}

function getWorkStatusLabel(kind: WorkStatus['kind']) {
  if (kind === 'VISITA_MANUAL') return 'visita';
  if (kind === 'ENTREGA') return 'entrega o retiro';
  if (kind === 'EQUIPO_NUEVO') return 'registro de equipo';
  if (kind === 'EQUIPO_GESTION') return 'gestión de equipo';
  return 'proceso';
}

function sortAgenda(visitas: readonly VisitaAsignada[]) {
  return [...visitas].sort((a, b) =>
    `${a.horaInicio ?? a.horaProgramada ?? ''}`.localeCompare(`${b.horaInicio ?? b.horaProgramada ?? ''}`),
  );
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  statusCardContainer: {
    marginBottom: 24,
    ...shadow,
  },
  statusCard: {
    backgroundColor: ridsPalette.cyanDark,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 18,
    overflow: 'hidden',
    padding: 20,
  },
  statusAccent: {
    backgroundColor: colors.brandDark,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  statusCopy: {
    flex: 1,
  },
  statusLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  statusDot: {
    backgroundColor: colors.white,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  statusLabel: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
    marginTop: 10,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  pulse: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.brandDark,
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: ridsPalette.charcoal,
    fontSize: 18,
    fontWeight: '900',
  },
  todayBadge: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  todayText: {
    color: ridsPalette.cyanDark,
    fontSize: 10,
    fontWeight: '900',
  },
  agendaBlock: {
    gap: 8,
  },
  agendaLoader: {
    marginVertical: 8,
  },
  agendaCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 10,
  },
  emptyAgendaCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 10,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  agendaIcon: {
    alignItems: 'center',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 13,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  agendaCopy: {
    flex: 1,
  },
  agendaTitle: {
    color: ridsPalette.charcoal,
    fontSize: 14,
    fontWeight: '900',
  },
  agendaMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
  },
  agendaText: {
    color: ridsPalette.slate,
    fontSize: 12,
  },
  metaDivider: {
    backgroundColor: colors.line,
    height: 12,
    marginHorizontal: 2,
    width: 1,
  },
  agendaState: {
    color: ridsPalette.cyanDark,
    fontSize: 11,
    fontWeight: '800',
  },
  agendaNotes: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  routeHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 8,
  },
  routeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ridsPalette.cyanDark,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  routeButtonDisabled: {
    opacity: 0.55,
  },
  routeButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  routeButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  visitButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: ridsPalette.cyanSoft,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  visitButtonText: {
    color: ridsPalette.cyanDark,
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
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  startedVisitText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '900',
  },
});
