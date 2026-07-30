import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { isWithinDailyTrackingWindow } from './daily-tracking-window';
import { buildQueuePayload } from './location-sample';
import { enqueueLocation, flushPendingLocationsForCurrentSession } from './offline-location-queue';
import { getAgendaTrackingContext, updateAgendaTrackingContext } from './tracking-context';
import { appendTrackingEvent } from './tracking-log';

// Latido de presencia.
//
// iOS solo entrega ubicaciones cuando se supera el `distanceFilter`: un técnico
// detenido (almorzando, en una reunión, resolviendo un ticket en sitio) no
// genera ni un punto, aunque la app esté abierta y todo funcione. El panel de
// la intranet, en cambio, mide vitalidad por tiempo y marca "sin señal" a los
// 15 minutos, así que un técnico quieto terminaba apareciendo como caído.
//
// Este latido reenvía la última posición conocida cada pocos minutos mientras
// el seguimiento está activo, para que el panel distinga "no se movió" de
// "dejó de reportar".
//
// Limitación conocida: los timers de JS quedan suspendidos cuando iOS manda la
// app a segundo plano, así que el latido cubre el caso de app en pantalla. En
// segundo plano el reporte sigue dependiendo del movimiento.

// Cada 3 minutos, no cada 4: la intranet marca ACTIVO hasta los 5 minutos, y
// con 4 el margen quedaba demasiado justo ante cualquier demora de red.
const HEARTBEAT_MS = 3 * 60 * 1000;
// Si ya se envió un punto hace poco no hace falta latir: evita duplicar
// posiciones cuando el técnico viene moviéndose.
const MIN_SILENCIO_MS = 2 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;

export function startLocationHeartbeat() {
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, HEARTBEAT_MS);
}

export function stopLocationHeartbeat() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

async function tick() {
  try {
    if (AppState.currentState !== 'active') return;

    const context = await getAgendaTrackingContext();
    if (!context?.tecnicoId) return;

    // Tracking de jornada fuera de horario: el servidor lo rechazaría con 422.
    if (context.agendaId === null && !isWithinDailyTrackingWindow()) return;

    if (context.lastSentAt) {
      const desde = Date.now() - Date.parse(context.lastSentAt);
      if (Number.isFinite(desde) && desde < MIN_SILENCIO_MS) return;
    }

    const location = await resolvePosition();
    if (!location) return;

    await enqueueLocation(buildQueuePayload(location, context));

    const result = await flushPendingLocationsForCurrentSession(context.tecnicoId, { maxPoints: 10 });
    void appendTrackingEvent(
      'heartbeat',
      context.agendaId,
      `enviados=${result.sent} pendientes=${result.pendingCount} ${result.status}`,
    );

    await updateAgendaTrackingContext({
      lastError: result.lastError ? `Cola de ubicación pausada: ${result.lastError}.` : null,
      lastSentAt: result.lastSentCapturedAt ?? context.lastSentAt ?? null,
    });
  } catch {
    // El latido es best-effort: nunca debe romper el seguimiento principal.
  }
}

async function resolvePosition() {
  // Primero la última posición del sistema, que no enciende el GPS. Si no hay
  // ninguna suficientemente reciente, se pide una lectura nueva.
  const conocida = await Location.getLastKnownPositionAsync({
    maxAge: HEARTBEAT_MS,
  }).catch(() => null);

  if (conocida) return conocida;

  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  }).catch(() => null);
}
