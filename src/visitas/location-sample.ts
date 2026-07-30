import * as Location from 'expo-location';

import { EnqueueLocationInput } from './offline-location-queue';
import { AgendaTrackingContext } from './tracking-context';

// Antigüedad máxima aceptada para una lectura. Android e iOS pueden devolver
// una posición en caché cuando no hay señal fresca (dentro de un edificio, por
// ejemplo); sin este filtro esa lectura vieja se enviaba como si fuera la
// posición actual del técnico.
export const MAX_LOCATION_AGE_MS = 3 * 60 * 1000;

export function isValidLocationSample(location: Location.LocationObject) {
  const { latitude, longitude } = location.coords;
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

export function isFreshLocation(location: Location.LocationObject) {
  if (!Number.isFinite(location.timestamp)) return true;
  return Date.now() - location.timestamp <= MAX_LOCATION_AGE_MS;
}

// iOS usa -1 como centinela de "no determinable" tanto en velocidad como en
// precisión. Si se envía tal cual, el panel de la intranet termina mostrando
// cosas como "-3.6 km/h". Cualquier valor negativo se guarda como nulo.
function normalizeMedicion(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function buildQueuePayload(
  location: Location.LocationObject,
  context: Pick<AgendaTrackingContext, 'agendaId' | 'tecnicoId' | 'estadoTracking'>,
): EnqueueLocationInput {
  const { latitude, longitude, accuracy, speed } = location.coords;

  return {
    agendaId: context.agendaId,
    tecnicoId: context.tecnicoId ?? null,
    latitud: latitude,
    longitud: longitude,
    precision: normalizeMedicion(accuracy),
    velocidad: normalizeMedicion(speed),
    estadoTracking: context.estadoTracking,
    capturedAt: new Date(location.timestamp || Date.now()).toISOString(),
  };
}
