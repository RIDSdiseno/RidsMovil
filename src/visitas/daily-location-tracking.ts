import { VisitaAsignada } from '@/src/types/api';
import {
  isAgendaLocationTrackingActive,
  startAgendaLocationTracking,
  stopAgendaLocationTracking,
} from './location-tracking';
import { isWithinDailyTrackingWindow } from './daily-tracking-window';
import { startLocationHeartbeat } from './location-heartbeat';
import { appendTrackingEvent } from './tracking-log';

export type DailyTrackingReconciliation =
  | { status: 'active' }
  | { status: 'started' }
  | { status: 'stopped'; reason: 'outside-window' | 'no-agenda-today' }
  | { status: 'not-started'; reason: 'outside-window' | 'no-agenda-today' | 'conflict' | 'sin-tecnico' }
  | { status: 'permission-required'; message: string };

let reconciliationOperation: Promise<DailyTrackingReconciliation> | null = null;

// Comparte la ubicacion del tecnico durante su jornada laboral (08:00-18:30
// hora Chile), siempre que tenga al menos una visita agendada hoy -- ya no
// depende de que presione "iniciar ruta" ni de que guarde el formulario de
// una visita puntual. Se debe llamar cada vez que la app carga las visitas
// del dia (al abrir la app, al volver a primer plano, al refrescar agenda).
export function reconcileDailyLocationTracking(
  visitasHoy: readonly VisitaAsignada[],
  tecnicoId?: number | null,
): Promise<DailyTrackingReconciliation> {
  if (reconciliationOperation) return reconciliationOperation;

  const promise = runReconciliation(visitasHoy, tecnicoId)
    .then((resultado) => {
      void appendTrackingEvent('reconcile-daily', null, describeResultado(resultado));
      return resultado;
    })
    .finally(() => {
      if (reconciliationOperation === promise) reconciliationOperation = null;
    });
  reconciliationOperation = promise;
  return promise;
}

function describeResultado(resultado: DailyTrackingReconciliation) {
  if ('reason' in resultado) return `${resultado.status}:${resultado.reason}`;
  if ('message' in resultado) return `${resultado.status}:${resultado.message}`;
  return resultado.status;
}

async function runReconciliation(
  visitasHoy: readonly VisitaAsignada[],
  tecnicoId?: number | null,
): Promise<DailyTrackingReconciliation> {
  const tracking = await isAgendaLocationTrackingActive();
  const isDailyContext = tracking.context?.agendaId == null;

  // Si hay un tracking activo atado a una agenda especifica (flujo legado),
  // esta reconciliacion no lo toca -- lo gestiona reconcileAgendaTracking.
  if (tracking.active && tracking.context && !isDailyContext) {
    return { status: 'active' };
  }

  const hasAgendaToday = visitasHoy.length > 0;
  const withinWindow = isWithinDailyTrackingWindow();

  if (!withinWindow || !hasAgendaToday) {
    if (tracking.active && isDailyContext) {
      await stopAgendaLocationTracking();
    }
    return {
      status: tracking.active && isDailyContext ? 'stopped' : 'not-started',
      reason: !withinWindow ? 'outside-window' : 'no-agenda-today',
    } as DailyTrackingReconciliation;
  }

  if (tracking.active && isDailyContext) {
    // Reapertura de la app con el seguimiento ya corriendo: el latido vive en
    // memoria del proceso, así que se relanza (es idempotente).
    startLocationHeartbeat();
    return { status: 'active' };
  }

  // Sin un tecnicoId válido, los puntos se encolarían con tecnicoId nulo y el
  // flush nunca los enviaría (se perderían a los 7 días). No iniciamos hasta
  // tener el técnico resuelto; el reconcile se reintenta y se auto-corrige.
  if (!Number.isInteger(tecnicoId) || (tecnicoId ?? 0) <= 0) {
    return { status: 'not-started', reason: 'sin-tecnico' };
  }

  // No se pre-chequea el permiso aqui: startAgendaLocationTracking ya llama a
  // ensureAgendaLocationPermissions() internamente, que SI pide el permiso al
  // sistema operativo si aun no fue solicitado (undetermined). Si solo se
  // "chequeaba" sin pedir, un tecnico nuevo (que nunca vio el dialogo nativo)
  // quedaba atascado viendo "permiso desactivado" sin que la app se lo
  // pidiera nunca, y en Ajustes del telefono no aparecia nada para activar.
  try {
    await startAgendaLocationTracking({
      agendaId: null,
      tecnicoId: tecnicoId ?? null,
      empresaId: null,
      empresaNombre: 'Jornada laboral',
      estadoTracking: 'EN_RUTA',
      startedAt: new Date().toISOString(),
      fechaInicioRuta: null,
      fechaInicioVisita: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('permiso')) {
      return { status: 'permission-required', message };
    }
    // Puede fallar si queda un contexto de tracking de agenda puntual sin
    // limpiar todavia; reconcileAgendaTracking se encarga de esos casos en
    // el mismo ciclo de reconciliacion. Se reintenta en la proxima llamada.
    console.warn('[daily-tracking] No se pudo iniciar el tracking de jornada:', error);
    return { status: 'not-started', reason: 'conflict' };
  }

  return { status: 'started' };
}
