import * as Location from 'expo-location';

import { AGENDA_LOCATION_TASK } from './background-location-task';
import { isWithinDailyTrackingWindow } from './daily-tracking-window';
import { enqueueLocation, flushPendingLocationsForCurrentSession } from './offline-location-queue';
import { appendTrackingEvent } from './tracking-log';
import {
  AgendaTrackingContext,
  clearAgendaTrackingContext,
  getAgendaTrackingContext,
  saveAgendaTrackingContext,
  updateAgendaTrackingContext,
} from './tracking-context';
import { BACKGROUND_LOCATION_ENABLED } from './tracking-mode';

const MAX_LOCATION_AGE_MS = 3 * 60 * 1000;

let foregroundWatch: Location.LocationSubscription | null = null;

type TrackingState = {
  agendaId: number | null;
  isTracking: boolean;
  lastError: string | null;
  lastSentAt: string | null;
};

export type AgendaLocationPermissionResult =
  | { granted: true }
  | {
      canAskAgain: boolean;
      granted: false;
      reason: 'foreground-denied' | 'background-denied' | 'settings-required';
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

function permissionDeniedResult(
  reason: 'foreground-denied' | 'background-denied',
  canAskAgain: boolean,
): AgendaLocationPermissionResult {
  return {
    canAskAgain,
    granted: false,
    reason: canAskAgain ? reason : 'settings-required',
  };
}

async function hasNativeTaskStarted() {
  if (!BACKGROUND_LOCATION_ENABLED) return foregroundWatch !== null;
  return Location.hasStartedLocationUpdatesAsync(AGENDA_LOCATION_TASK).catch(() => false);
}

function isFreshLocation(location: Location.LocationObject) {
  if (!Number.isFinite(location.timestamp)) return true;
  return Date.now() - location.timestamp <= MAX_LOCATION_AGE_MS;
}

function isValidLocationSample(location: Location.LocationObject) {
  const { latitude, longitude } = location.coords;
  return Number.isFinite(latitude) && Number.isFinite(longitude);
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
    const { latitude, longitude, accuracy, speed } = location.coords;
    await enqueueLocation({
      agendaId: context.agendaId,
      tecnicoId: context.tecnicoId ?? null,
      latitud: latitude,
      longitud: longitude,
      precision: typeof accuracy === 'number' ? accuracy : null,
      velocidad: typeof speed === 'number' ? speed : null,
      estadoTracking: context.estadoTracking,
      capturedAt: new Date(location.timestamp || Date.now()).toISOString(),
    });
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
    return permissionDeniedResult('foreground-denied', foreground.canAskAgain);
  }

  if (!BACKGROUND_LOCATION_ENABLED) {
    return { granted: true };
  }

  let background = await Location.getBackgroundPermissionsAsync();

  if (background.status !== Location.PermissionStatus.GRANTED) {
    if (!background.canAskAgain) {
      return permissionDeniedResult('background-denied', false);
    }

    const shouldRequest = options.beforeRequestBackground
      ? await options.beforeRequestBackground()
      : true;

    if (!shouldRequest) {
      return permissionDeniedResult('background-denied', true);
    }

    background = await Location.requestBackgroundPermissionsAsync();
  }

  if (background.status !== Location.PermissionStatus.GRANTED) {
    return permissionDeniedResult('background-denied', background.canAskAgain);
  }

  return { granted: true };
}

export async function checkAgendaLocationPermissions(): Promise<AgendaLocationPermissionResult> {
  if (!BACKGROUND_LOCATION_ENABLED) {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      return permissionDeniedResult('foreground-denied', foreground.canAskAgain);
    }
    return { granted: true };
  }

  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);

  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    return permissionDeniedResult('foreground-denied', foreground.canAskAgain);
  }

  if (background.status !== Location.PermissionStatus.GRANTED) {
    return permissionDeniedResult('background-denied', background.canAskAgain);
  }

  return { granted: true };
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
      : permissions.reason === 'foreground-denied'
        ? 'Activa el permiso de ubicación para compartir tu ruta.'
        : 'Activa el permiso de ubicación en segundo plano para compartir tu ruta.';

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
    if (BACKGROUND_LOCATION_ENABLED) {
      await Location.startLocationUpdatesAsync(AGENDA_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        activityType: Location.ActivityType.AutomotiveNavigation,
        deferredUpdatesDistance: 100,
        deferredUpdatesInterval: 60_000,
        distanceInterval: 75,
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

  const contextoPrevio = await getAgendaTrackingContext().catch(() => null);
  void appendTrackingEvent('stop', contextoPrevio?.agendaId ?? null);

  if (!BACKGROUND_LOCATION_ENABLED) {
    foregroundWatch?.remove();
    foregroundWatch = null;
  } else {
    const active = await hasNativeTaskStarted();
    if (active) {
      await Location.stopLocationUpdatesAsync(AGENDA_LOCATION_TASK);
    }
  }

  await clearAgendaTrackingContext();
  setState({
    agendaId: null,
    isTracking: false,
  });
}
