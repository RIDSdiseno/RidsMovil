import AsyncStorage from '@react-native-async-storage/async-storage';

import { BACKGROUND_LOCATION_ENABLED } from './tracking-mode';

// Bitácora local de las transiciones del tracking. Existe para diagnosticar el
// comportamiento en segundo plano: ahí el técnico no está mirando la app y no
// puede contar qué pasó, así que sin esto un "no llegó mi ubicación entre las
// 10 y las 12" es irreproducible.
//
// Es un buffer circular pequeño en AsyncStorage (no SecureStore: no hay nada
// secreto y supera de sobra el límite de ~2 KB de Android). Ninguna función de
// este módulo lanza: si el log falla, el tracking debe seguir funcionando.

const TRACKING_LOG_KEY = 'rids.tracking.log.v1';
const MAX_EVENTS = 80;

export type TrackingEventType =
  | 'start'
  | 'start-error'
  | 'stop'
  | 'reconcile-agenda'
  | 'reconcile-daily'
  | 'flush'
  | 'heartbeat'
  | 'permiso';

export type TrackingEvent = {
  at: string;
  evento: TrackingEventType;
  agendaId: number | null;
  detalle?: string;
  modo: 'background' | 'foreground';
};

let writeTail: Promise<void> = Promise.resolve();

function serialize(events: TrackingEvent[]) {
  return JSON.stringify(events.slice(-MAX_EVENTS));
}

function parse(raw: string | null): TrackingEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TrackingEvent =>
        Boolean(item)
        && typeof item === 'object'
        && typeof item.at === 'string'
        && typeof item.evento === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Registra una transición del tracking. No lanza nunca y no se debe esperar:
 * llamarla con `void` desde los orquestadores.
 */
export function appendTrackingEvent(
  evento: TrackingEventType,
  agendaId: number | null,
  detalle?: string,
) {
  const entry: TrackingEvent = {
    at: new Date().toISOString(),
    evento,
    agendaId,
    detalle: detalle ? detalle.slice(0, 200) : undefined,
    modo: BACKGROUND_LOCATION_ENABLED ? 'background' : 'foreground',
  };

  writeTail = writeTail
    .then(async () => {
      const previos = parse(await AsyncStorage.getItem(TRACKING_LOG_KEY));
      previos.push(entry);
      await AsyncStorage.setItem(TRACKING_LOG_KEY, serialize(previos));
    })
    .catch(() => undefined);

  return writeTail;
}

export async function getTrackingLog(): Promise<TrackingEvent[]> {
  try {
    return parse(await AsyncStorage.getItem(TRACKING_LOG_KEY)).reverse();
  } catch {
    return [];
  }
}

export async function clearTrackingLog() {
  try {
    await AsyncStorage.removeItem(TRACKING_LOG_KEY);
  } catch {
    // Sin efecto: el log es diagnóstico, no puede romper nada.
  }
}

/** Texto plano para compartir por correo/WhatsApp desde la pantalla de perfil. */
export function formatTrackingLog(events: readonly TrackingEvent[]) {
  if (!events.length) return 'Sin eventos registrados.';

  return events
    .map((event) => {
      const hora = new Date(event.at).toLocaleString('es-CL', { timeZone: 'America/Santiago' });
      const agenda = event.agendaId === null ? 'jornada' : `agenda ${event.agendaId}`;
      const detalle = event.detalle ? ` — ${event.detalle}` : '';
      return `[${hora}] ${event.evento} (${agenda}, ${event.modo})${detalle}`;
    })
    .join('\n');
}
