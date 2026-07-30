import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { getStoredToken } from '@/src/api/client';
import { buildQueuePayload, isFreshLocation, isValidLocationSample } from './location-sample';
import {
  enqueueLocation,
  flushPendingLocations,
} from './offline-location-queue';
import {
  clearAgendaTrackingContext,
  getAgendaTrackingContext,
  updateAgendaTrackingContext,
} from './tracking-context';
import { isWithinDailyTrackingWindow } from './daily-tracking-window';
import { appendTrackingEvent } from './tracking-log';

export const AGENDA_LOCATION_TASK = 'rids-agenda-background-location';

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

TaskManager.defineTask<LocationTaskData>(AGENDA_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    await updateAgendaTrackingContext({ lastError: error.message || 'Error de tarea de ubicación.' });
    return;
  }

  const context = await getAgendaTrackingContext();
  if (!context) {
    return;
  }

  // Tracking de jornada diaria (sin agenda especifica): se corta solo fuera
  // de la ventana horaria 08:00-18:30 Chile, sin depender de que el tecnico
  // vuelva a abrir la app justo a esa hora.
  if (context.agendaId === null && !isWithinDailyTrackingWindow()) {
    await Location.stopLocationUpdatesAsync(AGENDA_LOCATION_TASK).catch(() => undefined);
    await clearAgendaTrackingContext();
    return;
  }

  const locations = Array.isArray(data?.locations) ? data.locations : [];
  if (locations.length === 0) return;

  for (const location of locations) {
    if (!isValidLocationSample(location)) continue;
    if (!isFreshLocation(location)) continue;

    try {
      await enqueueLocation(buildQueuePayload(location, context));
    } catch (queueError) {
      await updateAgendaTrackingContext({
        lastError: queueError instanceof Error
          ? queueError.message
          : 'No se pudo guardar la ubicación pendiente.',
      });
    }
  }

  const token = await getStoredToken();
  if (!token || !context.tecnicoId) {
    await updateAgendaTrackingContext({
      lastError: token
        ? 'No se pudo determinar el técnico propietario de las ubicaciones pendientes.'
        : 'No hay sesión activa para enviar ubicaciones pendientes.',
    });
    return;
  }

  try {
    const result = await flushPendingLocations({
      maxPoints: 20,
      tecnicoId: context.tecnicoId,
      token,
    });
    void appendTrackingEvent(
      'flush',
      context.agendaId,
      `capturados=${locations.length} enviados=${result.sent} pendientes=${result.pendingCount} ${result.status}`,
    );
    await updateAgendaTrackingContext({
      lastError: result.lastError ? `Cola de ubicación pausada: ${result.lastError}.` : null,
      lastSentAt: result.lastSentCapturedAt ?? context.lastSentAt ?? null,
    });
  } catch {
    await updateAgendaTrackingContext({
      lastError: 'No se pudo procesar la cola local de ubicaciones.',
    });
  }
});
