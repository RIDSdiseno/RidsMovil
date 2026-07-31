import * as Location from 'expo-location';

import { AGENDA_LOCATION_TASK } from './background-location-task';
import { isWithinDailyTrackingWindow } from './daily-tracking-window';
import { startLocationHeartbeat, stopLocationHeartbeat } from './location-heartbeat';
import { buildQueuePayload, isFreshLocation, isValidLocationSample } from './location-sample';
import { enqueueLocation, flushPendingLocationsForCurrentSession } from './offline-location-queue';
import { appendTrackingEvent } from './tracking-log';
import {
  AgendaTrackingContext,
  clearAgendaTrackingContext,
  getAgendaTrackingContext,
  saveAgendaTrackingContext,
  updateAgendaTrackingContext,
} from './tracking-context';
import { BACKGROUND_LOCATION_SUPPORTED } from './tracking-mode';

let foregroundWatch: Location.LocationSubscription | null = null;

type TrackingState = {
  agendaId: number | null;
  isTracking: boolean;
  lastError: string | null;
  lastSentAt: string | null;
};

// Modo efectivo de captura. Depende del binario Y del permiso concedido: una
// build nativa con permiso "Al usar la app" solo puede capturar en primer
// plano, y eso es mucho mejor que no capturar nada.
export type TrackingMode = 'background' | 'foreground';

export type AgendaLocationPermissionResult =
  | { granted: true; modo: TrackingMode }
  | {
      canAskAgain: boolean;
      granted: false;
      reason: 'foreground-denied' | 'settings-required';
    };

export type AgendaLocationTrackingStatus = {
  active: boolean;
  context: AgendaTrackingContext | null;
  inconsistency: 'active-without-context' | 'context-without-active' | null;
};

type PermissionOptions = {
  beforeRequestBackground?: () => Promise<boolean> | boolean;
};

type TrackingListener = (state: TrackingState) => void;

const state: TrackingState = {
  agendaId: null,
  isTracking: false,
  lastError: null,
  lastSentAt: null,
};

const listeners = new Set<TrackingListener>();
let startOperation: { agendaId: number | null; promise: Promise<TrackingState> } | null = null;
let stopOperation: Promise<void> | null = null;

function notify() {
  listeners.forEach((listener) => listener({ ...state }));
}

function setState(updates: Partial<TrackingState>) {
  Object.assign(state, updates);
  notify();
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidAgendaId(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

function permissionDeniedResult(canAskAgain: boolean): AgendaLocationPermissionResult {
  return {
    canAskAgain,
    granted: false,
    reason: canAskAgain ? 'foreground-denied' : 'settings-required',
  };
}

async function hasNativeTaskStarted() {
  if (foregroundWatch !== null) return true;
  if (!BACKGROUND_LOCATION_SUPPORTED) return false;
  return Location.hasStartedLocationUpdatesAsync(AGENDA_LOCATION_TASK).catch(() => false);
}

async function handleForegroundLocationSample(location: Location.LocationObject) {
  const context = await getAgendaTrackingContext();
  if (!context) return;

  if (context.agendaId === null && !isWithinDailyTrackingWindow()) {
    await stopAgendaLocationTracking();
    return;
  }

  if (!isValidLocationSample(location) || !isFreshLocation(location)) return;

  try {
    await enqueueLocation(buildQueuePayload(location, context));
  } catch (queueError) {
    await updateAgendaTrackingContext({
      lastError: queueError instanceof Error
        ? queueError.message
        : 'No se pudo guardar la ubicación pendiente.',
    });
  }

  try {
    const result = await flushPendingLocationsForCurrentSession(context.tecnicoId, { maxPoints: 20 });
    await updateAgendaTrackingContext({
      lastError: result.lastError ? `Cola de ubicación pausada: ${result.lastError}.` : null,
      lastSentAt: result.lastSentCapturedAt ?? context.lastSentAt ?? null,
    });
  } catch {
    await updateAgendaTrackingContext({
      lastError: 'No se pudo procesar la cola local de ubicaciones.',
    });
  }
}

export function getTrackingState() {
  return { ...state };
}

export function subscribeTrackingState(listener: TrackingListener) {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

export async function ensureAgendaLocationPermissions(
  options: PermissionOptions = {},
): Promise<AgendaLocationPermissionResult> {
  let foreground = await Location.getForegroundPermissionsAsync();

  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    foreground = await Location.requestForegroundPermissionsAsync();
  }

  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    return permissionDeniedResult(foreground.canAskAgain);
  }

  if (!BACKGROUND_LOCATION_SUPPORTED) {
    return { granted: true, modo: 'foreground' };
  }

  let background = await Location.getBackgroundPermissionsAsync();

  if (background.status !== Location.PermissionStatus.GRANTED && background.canAskAgain) {
    const shouldRequest = options.beforeRequestBackground
      ? await options.beforeRequestBackground()
      : true;

    if (shouldRequest) {
      background = await Location.requestBackgroundPermissionsAsync();
    }
  }

  // Sin permiso "Siempre" NO se aborta: iOS ofrece "Al usar la app" como
  // primera opción y muchos técnicos se quedan ahí. Antes eso dejaba al
  // técnico sin reportar absolutamente nada; ahora se captura en primer plano,
  // que con el latido cada 3 minutos cubre la jornada mientras usa la app.
  return {
    granted: true,
    modo: background.status === Location.PermissionStatus.GRANTED ? 'background' : 'foreground',
  };
}

export async function checkAgendaLocationPermissions(): Promise<AgendaLocationPermissionResult> {
  if (!BACKGROUND_LOCATION_SUPPORTED) {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      return permissionDeniedResult(foreground.canAskAgain);
    }
    return { granted: true, modo: 'foreground' };
  }

  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);

  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    return permissionDeniedResult(foreground.canAskAgain);
  }

  return {
    granted: true,
    modo: background.status === Location.PermissionStatus.GRANTED ? 'background' : 'foreground',
  };
}

export async function isAgendaLocationTrackingActive(): Promise<AgendaLocationTrackingStatus> {
  const [active, context] = await Promise.all([
    hasNativeTaskStarted(),
    getAgendaTrackingContext(),
  ]);

  const inconsistency = active && !context
    ? 'active-without-context'
    : !active && context
      ? 'context-without-active'
      : null;

  setState({
    agendaId: context?.agendaId ?? null,
    isTracking: active,
    lastError: context?.lastError ?? null,
    lastSentAt: context?.lastSentAt ?? null,
  });

  return { active, context, inconsistency };
}

export async function startAgendaLocationTracking(context: AgendaTrackingContext) {
  if (!isValidAgendaId(context.agendaId)) {
    throw new Error('Agenda inválida para iniciar tracking.');
  }

  if (startOperation) {
    if (startOperation.agendaId === context.agendaId) return startOperation.promise;
    await startOperation.promise;
  }

  const promise = startAgendaLocationTrackingInternal(context);
  startOperation = { agendaId: context.agendaId, promise };

  try {
    return await promise;
  } finally {
    if (startOperation?.promise === promise) startOperation = null;
  }
}

async function startAgendaLocationTrackingInternal(context: AgendaTrackingContext): Promise<TrackingState> {

  const permissions = await ensureAgendaLocationPermissions();
  if (!permissions.granted) {
    const message = permissions.reason === 'settings-required'
      ? 'Activa los permisos de ubicación desde Configuración para compartir tu ruta.'
      : 'Activa el permiso de ubicación para compartir tu ruta.';

    setState({
      agendaId: null,
      isTracking: false,
      lastError: message,
    });
    throw new Error(message);
  }

  const current = await isAgendaLocationTrackingActive();
  if (current.active && current.context?.agendaId === context.agendaId) {
    const nextContext: AgendaTrackingContext = {
      ...current.context,
      ...context,
      agendaId: context.agendaId,
      startedAt: current.context.startedAt || context.startedAt,
    };
    await saveAgendaTrackingContext(nextContext);
    // El tracking ya estaba corriendo (reinicio de la app): el latido no pasa
    // por el camino de arranque, así que hay que asegurarlo aquí.
    startLocationHeartbeat();
    setState({
      agendaId: nextContext.agendaId,
      isTracking: true,
      lastError: nextContext.lastError ?? null,
      lastSentAt: nextContext.lastSentAt ?? null,
    });
    return { ...state };
  }

  if (current.active) {
    throw new Error('Ya existe un tracking activo para otra agenda. Deténlo antes de iniciar una nueva ruta.');
  }

  if (current.context && current.context.agendaId !== context.agendaId) {
    throw new Error('Existe un contexto de tracking pendiente para otra agenda. Revisa el estado antes de iniciar una nueva ruta.');
  }

  const nextContext: AgendaTrackingContext = {
    ...context,
    startedAt: context.startedAt || new Date().toISOString(),
  };

  await saveAgendaTrackingContext(nextContext);

  try {
    if (permissions.modo === 'background') {
      await Location.startLocationUpdatesAsync(AGENDA_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        activityType: Location.ActivityType.AutomotiveNavigation,
        // Sin `deferredUpdates`: en iOS acumulaban los puntos hasta los 100 m
        // antes de entregarlos y además están obsoletos desde iOS 13.
        // `timeInterval` solo aplica en Android; en iOS el único filtro real es
        // la distancia, por eso se baja de 75 a 25 m. La vitalidad del técnico
        // detenido la cubre el latido (location-heartbeat), no este filtro.
        distanceInterval: 25,
        foregroundService: {
          killServiceOnDestroy: false,
          notificationBody: 'Tu ubicación se está enviando mientras realizas la ruta.',
          notificationTitle: 'RIDS compartiendo ubicación',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        timeInterval: 60_000,
      });
    } else {
      foregroundWatch?.remove();
      foregroundWatch = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 75,
          timeInterval: 60_000,
        },
        (location) => {
          void handleForegroundLocationSample(location);
        },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo iniciar el tracking.';
    void appendTrackingEvent('start-error', nextContext.agendaId, message);
    await saveAgendaTrackingContext({
      ...nextContext,
      lastError: message,
    });
    setState({
      agendaId: nextContext.agendaId,
      isTracking: false,
      lastError: message,
    });
    throw error;
  }

  startLocationHeartbeat();
  void appendTrackingEvent('start', nextContext.agendaId, nextContext.estadoTracking);

  setState({
    agendaId: nextContext.agendaId,
    isTracking: true,
    lastError: null,
    lastSentAt: nextContext.lastSentAt ?? null,
  });

  return { ...state };
}

export async function stopAgendaLocationTracking() {
  if (stopOperation) return stopOperation;

  const promise = stopAgendaLocationTrackingInternal();
  stopOperation = promise;

  try {
    await promise;
  } finally {
    if (stopOperation === promise) stopOperation = null;
  }
}

async function stopAgendaLocationTrackingInternal() {
  if (startOperation) await startOperation.promise.catch(() => undefined);

  stopLocationHeartbeat();

  const contextoPrevio = await getAgendaTrackingContext().catch(() => null);
  void appendTrackingEvent('stop', contextoPrevio?.agendaId ?? null);

  // Se detienen los dos caminos: el técnico pudo haber arrancado en segundo
  // plano y luego bajar el permiso a "Al usar la app" (o al revés), así que no
  // se puede asumir cuál está corriendo.
  foregroundWatch?.remove();
  foregroundWatch = null;

  if (BACKGROUND_LOCATION_SUPPORTED) {
    const tareaActiva = await Location
      .hasStartedLocationUpdatesAsync(AGENDA_LOCATION_TASK)
      .catch(() => false);
    if (tareaActiva) {
      await Location.stopLocationUpdatesAsync(AGENDA_LOCATION_TASK).catch(() => undefined);
    }
  }

  await clearAgendaTrackingContext();
  setState({
    agendaId: null,
    isTracking: false,
  });
}
