import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { getMisVisitasAsignadasHoy, iniciarRutaVisitaAsignada, iniciarVisitaAsignada } from '@/src/api/rids';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/auth/AuthContext';
import { loadEntregaState } from '@/src/entregas/entrega-state';
import { loadEquipoState } from '@/src/equipos/equipo-state';
import { loadGestionarEquipoState } from '@/src/equipos/gestionar-state';
import { colors, shadow } from '@/src/theme/colors';
import { VisitaAsignada } from '@/src/types/api';
import { reconcileTrackingForAssignedAgendas } from '@/src/visitas/agenda-tracking-flow';
import { reconcileDailyLocationTracking } from '@/src/visitas/daily-location-tracking';
import { getAgendaCardAction } from '@/src/visitas/agenda-card-action';
import { startVisitForEmpresa } from '@/src/visitas/start-visit-flow';
import { formatDistanceMeters, getDistanceFromCurrentLocation } from '@/src/visitas/visit-distance';
import { loadVisitaState } from '@/src/visitas/visita-state';

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
  route: ResumeRoute | '/(tabs)/visitas';
  text: string;
  title: string;
};

const idleStatus: WorkStatus = {
  icon: 'navigate-outline',
  route: '/(tabs)/visitas',
  text: 'Selecciona una empresa, selecciona los solicitantes y completa las actividades.',
  title: 'Listo para iniciar una visita',
};

export default function DashboardScreen() {
  const { isLoading, tecnico } = useAuth();
  const [agendaToday, setAgendaToday] = useState<VisitaAsignada[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [startingRouteId, setStartingRouteId] = useState<number | null>(null);
  const [startingVisitId, setStartingVisitId] = useState<number | null>(null);
  const [workStatus, setWorkStatus] = useState<WorkStatus>(idleStatus);
  const firstName = tecnico?.nombre?.split(' ')[0] || 'Tecnico';
  const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;

  const syncTrackingStatus = useCallback(async (currentAgenda: readonly VisitaAsignada[]) => {
    await reconcileTrackingForAssignedAgendas(currentAgenda, tecnicoId);
    await reconcileDailyLocationTracking(currentAgenda, tecnicoId).catch((error) => {
      console.warn('[daily-tracking] Error al reconciliar tracking de jornada:', error);
    });
  }, [tecnicoId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadWorkStatus() {
        const [visitaState, entregaState, equipoState, gestionarEquipoState] = await Promise.all([
          loadVisitaState(),
          loadEntregaState(),
          loadEquipoState(),
          loadGestionarEquipoState(),
        ]);

        if (!mounted) return;

        if (visitaState.empresaId) {
          setWorkStatus({
            icon: 'clipboard-outline',
            route: visitaState.solicitantes.length
              ? '/visitas/formulario'
              : visitaState.sucursalId
                ? '/visitas/solicitantes'
                : '/visitas/sucursal',
            text: visitaState.empresaNombre || 'Continua la visita pendiente.',
            title: 'Visita en curso',
          });
          return;
        }

        if (entregaState.empresa) {
          const hasReceptor =
            Boolean(entregaState.receptor) ||
            Boolean(entregaState.receptorManual.nombre.trim() || entregaState.receptorManual.apellidos.trim());

          setWorkStatus({
            icon: 'cube-outline',
            route: hasReceptor ? '/entregas/formulario' : '/entregas/receptor',
            text: entregaState.empresa.nombre || 'Continua la entrega pendiente.',
            title: 'Entrega en curso',
          });
          return;
        }

        if (equipoState.empresa) {
          setWorkStatus({
            icon: 'hardware-chip-outline',
            route: equipoState.solicitante ? '/equipos/agregar/formulario' : '/equipos/agregar/solicitante',
            text: equipoState.empresa.nombre || 'Continua el registro de equipo.',
            title: 'Registro de equipo en curso',
          });
          return;
        }

        if (gestionarEquipoState.equipo) {
          setWorkStatus({
            icon: 'hardware-chip-outline',
            route: '/equipos/gestionar/detalle',
            text: gestionarEquipoState.equipo.serial || 'Continua la gestion del equipo.',
            title: 'Gestion de equipo en curso',
          });
          return;
        }

        setWorkStatus(idleStatus);
      }

      loadWorkStatus();

      return () => {
        mounted = false;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadTodayAgenda() {
        try {
          setLoadingAgenda(true);
          const response = await getMisVisitasAsignadasHoy();

          if (!mounted) return;
          const nextAgenda = [...(response.visitas ?? [])].sort((a, b) =>
              `${a.horaInicio ?? a.horaProgramada ?? ''}`.localeCompare(`${b.horaInicio ?? b.horaProgramada ?? ''}`),
          );
          setAgendaToday(nextAgenda);
          await syncTrackingStatus(nextAgenda);
        } catch {
          // Conserva la ultima respuesta valida mientras se recupera la conexion.
        } finally {
          if (mounted) setLoadingAgenda(false);
        }
      }

      loadTodayAgenda();

      return () => {
        mounted = false;
      };
    }, [syncTrackingStatus]),
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
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {firstName}</Text>
          <Text style={styles.subtitle}>Panel de trabajo en terreno</Text>
        </View>
        <View style={styles.avatar}>
          <Ionicons color={colors.brand} name="person" size={24} />
        </View>
      </View>

      <Pressable
        onPress={() => router.push(workStatus.route)}
        style={({ pressed }) => [styles.statusCard, pressed && styles.statusCardPressed]}>
        <View style={styles.statusCopy}>
          <Text style={styles.statusLabel}>Estado actual</Text>
          <Text style={styles.statusTitle}>{workStatus.title}</Text>
          <Text style={styles.statusText}>{workStatus.text}</Text>
        </View>
        <View style={styles.pulse}>
          <Ionicons color={colors.white} name={workStatus.icon} size={30} />
        </View>
      </Pressable>

      <Text style={styles.sectionTitle}>Visitas programadas</Text>
      <View style={styles.agendaBlock}>
        {loadingAgenda ? <ActivityIndicator color={colors.brand} style={styles.agendaLoader} /> : null}

        {!loadingAgenda && agendaToday.length === 0 ? (
          <Pressable onPress={() => router.push('/agenda')} style={styles.emptyAgendaCard}>
            <View style={styles.agendaIcon}>
              <Ionicons color={colors.brand} name="calendar-outline" size={22} />
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
        <Ionicons color={colors.brand} name="briefcase-outline" size={22} />
      </View>
      <View style={styles.agendaCopy}>
        <Text style={styles.agendaTitle}>{empresa}</Text>
        <Text style={styles.agendaText}>{hora || 'Sin horario'} · {item.estado}</Text>
        {isStarted ? (
          <View style={styles.startedVisitBadge}>
            <Ionicons color="#047857" name="checkmark-circle-outline" size={14} />
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
            {loadingVisit ? <ActivityIndicator color={colors.brand} size="small" /> : null}
            <Ionicons color={colors.brand} name="checkmark-circle-outline" size={16} />
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  greeting: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 4,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 22,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  statusCard: {
    backgroundColor: colors.navy,
    borderRadius: 26,
    flexDirection: 'row',
    gap: 18,
    marginBottom: 28,
    padding: 22,
    ...shadow,
  },
  statusCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  statusCopy: {
    flex: 1,
  },
  statusLabel: {
    color: '#89B8E9',
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
    color: '#C9D8EA',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  pulse: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    borderRadius: 22,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 14,
  },
  agendaBlock: {
    gap: 12,
  },
  agendaLoader: {
    marginVertical: 8,
  },
  agendaCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    ...shadow,
  },
  emptyAgendaCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    ...shadow,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  agendaIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  agendaCopy: {
    flex: 1,
  },
  agendaTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  agendaText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  agendaNotes: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
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
    backgroundColor: colors.brand,
    borderRadius: 999,
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
    backgroundColor: colors.brandSoft,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  visitButtonText: {
    color: colors.brand,
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
