import {
  isAgendaLocationTrackingActive,
  startAgendaLocationTracking,
  stopAgendaLocationTracking,
} from './location-tracking';
import { VisitaAsignada } from '@/src/types/api';
import {
  AgendaTrackingContext,
  saveAgendaTrackingContext,
} from './tracking-context';
import { loadVisitaState } from './visita-state';
import { appendTrackingEvent } from './tracking-log';
import { finalizarVisitaAsignada } from '@/src/api/rids';

export type AgendaTrackingReconciliation =
  | { status: 'active'; agendaId: number }
  | { status: 'recovered'; agendaId: number }
  | { status: 'permission-required'; agendaId: number; message: string }
  | { status: 'inconsistent'; message: string }
  | { status: 'stopped-terminal'; agendaId: number }
  | { status: 'idle' };

type ReconciliationOptions = {
  tecnicoId?: number | null;
};

const ACTIVE_STATES = new Set(['EN_RUTA', 'INICIADA']);
let reconciliationOperation: Promise<AgendaTrackingReconciliation> | null = null;

export function reconcileAgendaTracking(
  visitas?: readonly VisitaAsignada[],
  options: ReconciliationOptions = {},
): Promise<AgendaTrackingReconciliation> {
  if (reconciliationOperation) return reconciliationOperation;

  const promise = runReconciliation(visitas, options).then((resultado) => {
    void appendTrackingEvent(
      'reconcile-agenda',
      'agendaId' in resultado ? resultado.agendaId : null,
      'message' in resultado ? `${resultado.status}:${resultado.message}` : resultado.status,
    );
    return resultado;
  });
  reconciliationOperation = promise;
  return promise.finally(() => {
    if (reconciliationOperation === promise) reconciliationOperation = null;
  });
}

async function runReconciliation(
  visitas?: readonly VisitaAsignada[],
  options: ReconciliationOptions = {},
): Promise<AgendaTrackingReconciliation> {
  let agendaSnapshot = visitas ? [...visitas] : [];
  const tracking = await isAgendaLocationTrackingActive();

  const cierresPendientes = agendaSnapshot.filter((visita) =>
    normalizeStatus(visita.visitaStatus) === 'COMPLETADA'
    && normalizeStatus(visita.estado) !== 'COMPLETADA'
    && normalizeStatus(visita.estado) !== 'CANCELADA',
  );

  if (cierresPendientes.length > 1) {
    const message = 'Se detectó más de una agenda con cierre pendiente. No se repararon automáticamente.';
    console.warn('[agenda] Más de una agenda tiene formulario COMPLETADA sin agenda COMPLETADA.');
    return { status: 'inconsistent', message };
  }

  if (cierresPendientes.length === 1) {
    const cierrePendiente = cierresPendientes[0]!;
    try {
      const response = await finalizarVisitaAsignada(cierrePendiente.agendaId);
      agendaSnapshot = agendaSnapshot.map((visita) =>
        visita.agendaId === cierrePendiente.agendaId ? response.visita : visita,
      );
    } catch {
      const message = 'El formulario está completado, pero no se pudo cerrar la agenda. RIDS volverá a intentarlo.';
      console.warn('[agenda] No fue posible reparar automáticamente el cierre pendiente.');
      return { status: 'inconsistent', message };
    }
  }

  if (tracking.context && tracking.context.agendaId === null) {
    // Contexto de tracking de jornada diaria (sin agenda especifica).
    // Esta reconciliacion solo gestiona el tracking atado a una agenda puntual.
    return { status: 'idle' };
  }

  const contextVisit = tracking.context
    ? agendaSnapshot.find((visita) => visita.agendaId === tracking.context?.agendaId)
    : undefined;
  const contextStatus = normalizeStatus(contextVisit?.estado);

  if (tracking.context && contextStatus === 'CANCELADA') {
    const agendaId = tracking.context.agendaId!;
    await stopAgendaLocationTracking();
    return { status: 'stopped-terminal', agendaId };
  }

  if (tracking.context && isFullyCompleted(contextVisit)) {
    const agendaId = tracking.context.agendaId!;
    await stopAgendaLocationTracking();
    return { status: 'stopped-terminal', agendaId };
  }

  const activeVisits = getActiveVisits(agendaSnapshot);
  if (activeVisits.length > 1) {
    const contextVisitActive = tracking.context
      ? activeVisits.find((visita) => visita.agendaId === tracking.context?.agendaId)
      : undefined;

    if (tracking.active && contextVisitActive && tracking.context) {
      await updateContextFromAgenda(contextVisitActive, tracking.context, options.tecnicoId);
    }

    const message = 'Se detectó más de una agenda activa. No se iniciará otro seguimiento hasta resolver la inconsistencia.';
    console.warn('[tracking] Más de una agenda EN_RUTA o INICIADA para el técnico autenticado.');
    return { status: 'inconsistent', message };
  }

  let activeVisit = activeVisits[0] ?? null;

  if (!activeVisit && tracking.context && !visitas) {
    return tracking.active
      ? { status: 'active', agendaId: tracking.context.agendaId! }
      : { status: 'idle' };
  }

  if (!activeVisit && tracking.active && !tracking.context && visitas) {
    const localVisitState = await loadVisitaState();
    const localAgenda = typeof localVisitState.agendaId === 'number'
      ? agendaSnapshot.find((visita) => visita.agendaId === localVisitState.agendaId)
      : undefined;

    if (localAgenda && normalizeStatus(localAgenda.estado) === 'CANCELADA') {
      await stopAgendaLocationTracking();
      return { status: 'stopped-terminal', agendaId: localAgenda.agendaId };
    }

    if (localAgenda && isFullyCompleted(localAgenda)) {
      await stopAgendaLocationTracking();
      return { status: 'stopped-terminal', agendaId: localAgenda.agendaId };
    }
  }

  if (!activeVisit) return { status: 'idle' };

  if (tracking.context && tracking.context.agendaId !== activeVisit.agendaId) {
    const message = 'El seguimiento guardado pertenece a otra agenda. No se reemplazó el contexto.';
    console.warn('[tracking] Contexto local y agenda activa no coinciden.');
    return { status: 'inconsistent', message };
  }

  const context = buildTrackingContext(activeVisit, options.tecnicoId, tracking.context);

  if (tracking.active) {
    await saveAgendaTrackingContext(context);
    return { status: 'active', agendaId: context.agendaId! };
  }

  // No se pre-chequea el permiso aqui: startAgendaLocationTracking ya llama a
  // ensureAgendaLocationPermissions() internamente, que SI pide el permiso al
  // sistema operativo si aun no fue solicitado (undetermined). Ver mismo
  // comentario en daily-location-tracking.ts.
  try {
    await startAgendaLocationTracking(context);
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : 'RIDS no puede compartir tu ubicación.';
    return { status: 'permission-required', agendaId: activeVisit.agendaId, message };
  }

  return { status: 'recovered', agendaId: activeVisit.agendaId };
}

function getActiveVisits(visitas: readonly VisitaAsignada[]) {
  return visitas.filter((visita) => ACTIVE_STATES.has(normalizeStatus(visita.estado)));
}

function buildTrackingContext(
  visita: VisitaAsignada,
  tecnicoId?: number | null,
  current?: AgendaTrackingContext | null,
): AgendaTrackingContext {
  return {
    agendaId: visita.agendaId,
    tecnicoId: tecnicoId ?? current?.tecnicoId ?? null,
    empresaId: visita.empresa?.id_empresa ?? current?.empresaId ?? null,
    empresaNombre: visita.empresa?.nombre ?? visita.empresa?.razonSocial ?? 'Empresa no registrada',
    estadoTracking: normalizeStatus(visita.estado) === 'INICIADA' ? 'INICIADA' : 'EN_RUTA',
    startedAt: current?.startedAt ?? visita.fechaInicioRuta ?? visita.fechaInicioVisita ?? new Date().toISOString(),
    fechaInicioRuta: visita.fechaInicioRuta ?? current?.fechaInicioRuta ?? null,
    fechaInicioVisita: visita.fechaInicioVisita ?? current?.fechaInicioVisita ?? null,
    lastSentAt: current?.lastSentAt ?? null,
    lastError: current?.lastError ?? null,
  };
}

async function updateContextFromAgenda(
  visita: VisitaAsignada,
  current: AgendaTrackingContext,
  tecnicoId?: number | null,
) {
  await saveAgendaTrackingContext(buildTrackingContext(visita, tecnicoId, current));
}

function isFullyCompleted(visita?: VisitaAsignada) {
  return normalizeStatus(visita?.estado) === 'COMPLETADA'
    && normalizeStatus(visita?.visitaStatus) === 'COMPLETADA';
}

function normalizeStatus(value: unknown) {
  return String(value ?? '').toUpperCase();
}
