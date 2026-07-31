import { Alert, Linking } from 'react-native';

import { VisitaAsignada } from '@/src/types/api';

import {
  ensureAgendaLocationPermissions,
  isAgendaLocationTrackingActive,
  startAgendaLocationTracking,
} from './location-tracking';
import {
  AgendaTrackingReconciliation,
  reconcileAgendaTracking,
} from './reconcile-agenda-tracking';
import { flushPendingLocationsForCurrentSession } from './offline-location-queue';
import { AgendaTrackingEstado } from './tracking-context';

type TrackingReadiness =
  | { ready: true }
  | { message: string; ready: false; settingsRequired?: boolean };

let lastWarning: { key: string; shownAt: number } | null = null;

function getEmpresaNombre(visita: VisitaAsignada) {
  return visita.empresa?.nombre ?? visita.empresa?.razonSocial ?? 'Empresa no registrada';
}

function confirmBackgroundPermissionExplanation() {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      'Ubicación en segundo plano',
      'RIDS necesita acceder a tu ubicación durante una ruta activa, incluso cuando la aplicación esté minimizada o la pantalla esté bloqueada.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', onPress: () => resolve(true) },
      ],
    );
  });
}

function showSettingsRequired(message: string) {
  Alert.alert('Permiso requerido', message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Abrir configuración', onPress: () => Linking.openSettings() },
  ]);
}

export async function ensureAgendaTrackingReady(): Promise<TrackingReadiness> {
  const permissions = await ensureAgendaLocationPermissions({
    beforeRequestBackground: confirmBackgroundPermissionExplanation,
  });

  if (permissions.granted) return { ready: true };

  if (permissions.reason === 'settings-required') {
    return {
      message: 'Para iniciar la ruta debes permitir la ubicación en segundo plano desde la configuración del teléfono.',
      ready: false,
      settingsRequired: true,
    };
  }

  // Falta el permiso de segundo plano ya no bloquea: ensureAgendaLocationPermissions
  // devuelve `granted` con modo 'foreground' y el seguimiento arranca igual.
  // Solo se llega acá si el técnico negó la ubicación por completo.
  return {
    message: 'Para iniciar la ruta debes permitir el acceso a tu ubicación.',
    ready: false,
  };
}

export async function assertAgendaTrackingCanUse(agendaId: number) {
  const tracking = await isAgendaLocationTrackingActive();

  if (tracking.active && tracking.context?.agendaId === agendaId) return tracking;
  if (!tracking.active && tracking.context?.agendaId === agendaId) return tracking;

  if ((tracking.active || tracking.context) && tracking.context?.agendaId !== agendaId) {
    throw new Error('Ya existe una ruta activa para otra visita. Finalízala o cancélala antes de iniciar una nueva.');
  }

  return tracking;
}

export async function startTrackingForAgendaVisit(
  visita: VisitaAsignada,
  estadoTracking: AgendaTrackingEstado = 'EN_RUTA',
  tecnicoId?: number | null,
) {
  await assertAgendaTrackingCanUse(visita.agendaId);
  await startAgendaLocationTracking({
    agendaId: visita.agendaId,
    tecnicoId: tecnicoId ?? null,
    empresaId: visita.empresa?.id_empresa ?? null,
    empresaNombre: getEmpresaNombre(visita),
    estadoTracking,
    startedAt: visita.fechaInicioRuta ?? new Date().toISOString(),
    fechaInicioRuta: visita.fechaInicioRuta ?? null,
    fechaInicioVisita: visita.fechaInicioVisita ?? null,
  });
}

export async function reconcileTrackingForAssignedAgendas(
  visitas: readonly VisitaAsignada[],
  tecnicoId?: number | null,
) {
  const result = await reconcileAgendaTracking(visitas, { tecnicoId });
  notifyReconciliationIssue(result);
  void flushPendingLocationsForCurrentSession(tecnicoId, { maxPoints: 50 }).catch(() => undefined);
  return result;
}

export function handleTrackingReadinessFailure(readiness: Exclude<TrackingReadiness, { ready: true }>) {
  if (readiness.settingsRequired) {
    showSettingsRequired(readiness.message);
    return;
  }

  Alert.alert('Ubicación', readiness.message);
}

function notifyReconciliationIssue(result: AgendaTrackingReconciliation) {
  if (result.status !== 'permission-required' && result.status !== 'inconsistent') return;

  const key = `${result.status}:${result.message}`;
  const now = Date.now();
  if (lastWarning?.key === key && now - lastWarning.shownAt < 30_000) return;
  lastWarning = { key, shownAt: now };

  if (result.status === 'permission-required') {
    Alert.alert('Ubicación desactivada', result.message, [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Abrir configuración', onPress: () => Linking.openSettings() },
    ]);
    return;
  }

  Alert.alert('Agendas activas', result.message);
}
