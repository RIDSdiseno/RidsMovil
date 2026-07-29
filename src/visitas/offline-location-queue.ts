import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '@/src/api/config';
import { getStoredToken, refreshAccessToken } from '@/src/api/client';

export const OFFLINE_LOCATION_QUEUE_KEY = 'rids.offline.location.queue.v1';

const QUEUE_VERSION = 1;
const MAX_PENDING_POINTS = 2_000;
const MAX_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_PERMANENT_ATTEMPTS = 3;

export type OfflineLocationEstado = 'EN_RUTA' | 'INICIADA';

export type OfflineLocationPoint = {
  localId: string;
  agendaId: number | null;
  tecnicoId: number | null;
  latitud: number;
  longitud: number;
  precision: number | null;
  velocidad: number | null;
  estadoTracking: OfflineLocationEstado;
  capturedAt: string;
  queuedAt: string;
  attempts: number;
  lastAttemptAt?: string | null;
  lastErrorType?: LocationErrorType | null;
};

export type EnqueueLocationInput = Omit<
  OfflineLocationPoint,
  'attempts' | 'lastAttemptAt' | 'lastErrorType' | 'localId' | 'queuedAt'
> & {
  localId?: string;
  queuedAt?: string;
};

export type LocationErrorType =
  | 'authentication'
  | 'permanent'
  | 'recoverable'
  | 'storage';

type QueueState = {
  version: 1;
  points: OfflineLocationPoint[];
  discardedCount: number;
  permanentFailureCount: number;
  invalidStateResetCount: number;
  lastError: LocationErrorType | null;
  updatedAt: string;
};

export type FlushPendingLocationOptions = {
  maxPoints?: number;
  timeoutMs?: number;
  tecnicoId: number;
  token: string;
};

export type FlushPendingLocationResult = {
  attempted: number;
  discardedPermanent: number;
  lastError: LocationErrorType | null;
  lastSentCapturedAt: string | null;
  pendingCount: number;
  sent: number;
  status: 'auth-required' | 'completed' | 'paused' | 'timeout';
};

export type OfflineLocationQueueHealth = {
  discardedCount: number;
  flushInProgress: boolean;
  inconsistentOwnerCount: number;
  invalidStateResetCount: number;
  lastError: LocationErrorType | null;
  oldestCapturedAt: string | null;
  pendingCount: number;
  permanentFailureCount: number;
};

class LocationTransportError extends Error {
  constructor(
    readonly type: Exclude<LocationErrorType, 'storage'>,
    readonly status?: number,
  ) {
    super(type);
    this.name = 'LocationTransportError';
  }
}

let storageTail: Promise<void> = Promise.resolve();
let flushOperation: {
  promise: Promise<FlushPendingLocationResult>;
  tecnicoId: number;
} | null = null;
let localIdCounter = 0;

function withStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageTail.then(operation, operation);
  storageTail = result.then(() => undefined, () => undefined);
  return result;
}

function createEmptyState(): QueueState {
  return {
    version: QUEUE_VERSION,
    points: [],
    discardedCount: 0,
    permanentFailureCount: 0,
    invalidStateResetCount: 0,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizePoint(value: unknown): OfflineLocationPoint | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<OfflineLocationPoint>;
  const capturedAt = normalizeIsoDate(raw.capturedAt);
  const queuedAt = normalizeIsoDate(raw.queuedAt);

  if (
    typeof raw.localId !== 'string'
    || !raw.localId
    || (raw.agendaId !== null && !isPositiveInteger(raw.agendaId))
    || !isFiniteNumber(raw.latitud)
    || raw.latitud < -90
    || raw.latitud > 90
    || !isFiniteNumber(raw.longitud)
    || raw.longitud < -180
    || raw.longitud > 180
    || !capturedAt
    || !queuedAt
  ) {
    return null;
  }

  return {
    localId: raw.localId,
    agendaId: raw.agendaId ?? null,
    tecnicoId: raw.tecnicoId === null || raw.tecnicoId === undefined
      ? null
      : isPositiveInteger(raw.tecnicoId) ? raw.tecnicoId : null,
    latitud: raw.latitud,
    longitud: raw.longitud,
    precision: isFiniteNumber(raw.precision) ? raw.precision : null,
    velocidad: isFiniteNumber(raw.velocidad) ? raw.velocidad : null,
    estadoTracking: raw.estadoTracking === 'INICIADA' ? 'INICIADA' : 'EN_RUTA',
    capturedAt,
    queuedAt,
    attempts: typeof raw.attempts === 'number' && raw.attempts >= 0
      ? Math.floor(raw.attempts)
      : 0,
    lastAttemptAt: normalizeIsoDate(raw.lastAttemptAt) ?? null,
    lastErrorType: raw.lastErrorType === 'authentication'
      || raw.lastErrorType === 'permanent'
      || raw.lastErrorType === 'recoverable'
      ? raw.lastErrorType
      : null,
  };
}

function normalizeState(value: unknown): QueueState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<QueueState>;
  if (raw.version !== QUEUE_VERSION || !Array.isArray(raw.points)) return null;

  const points = raw.points.map(normalizePoint);
  if (points.some((point) => point === null)) return null;

  return {
    version: QUEUE_VERSION,
    points: (points as OfflineLocationPoint[]).sort(comparePoints),
    discardedCount: normalizeCounter(raw.discardedCount),
    permanentFailureCount: normalizeCounter(raw.permanentFailureCount),
    invalidStateResetCount: normalizeCounter(raw.invalidStateResetCount),
    lastError: raw.lastError === 'authentication'
      || raw.lastError === 'permanent'
      || raw.lastError === 'recoverable'
      || raw.lastError === 'storage'
      ? raw.lastError
      : null,
    updatedAt: normalizeIsoDate(raw.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeCounter(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function comparePoints(a: OfflineLocationPoint, b: OfflineLocationPoint) {
  return Date.parse(a.capturedAt) - Date.parse(b.capturedAt)
    || Date.parse(a.queuedAt) - Date.parse(b.queuedAt)
    || a.localId.localeCompare(b.localId);
}

async function readStateLocked(): Promise<QueueState> {
  const raw = await AsyncStorage.getItem(OFFLINE_LOCATION_QUEUE_KEY);
  if (!raw) return createEmptyState();

  try {
    const normalized = normalizeState(JSON.parse(raw));
    if (normalized) return normalized;
  } catch {
    // La recuperación controlada se realiza abajo.
  }

  const resetState = createEmptyState();
  resetState.invalidStateResetCount = 1;
  resetState.lastError = 'storage';
  await writeStateLocked(resetState);
  console.warn('[offline-location] La cola local era incompatible y fue reiniciada de forma controlada.');
  return resetState;
}

async function writeStateLocked(state: QueueState) {
  state.updatedAt = new Date().toISOString();
  await AsyncStorage.setItem(OFFLINE_LOCATION_QUEUE_KEY, JSON.stringify(state));
}

function compactState(state: QueueState, now = Date.now()) {
  const retentionCutoff = now - MAX_RETENTION_MS;
  const retained = state.points.filter((point) => Date.parse(point.capturedAt) >= retentionCutoff);
  let discarded = state.points.length - retained.length;

  retained.sort(comparePoints);
  if (retained.length > MAX_PENDING_POINTS) {
    const overflow = retained.length - MAX_PENDING_POINTS;
    retained.splice(0, overflow);
    discarded += overflow;
  }

  if (discarded > 0) {
    state.points = retained;
    state.discardedCount += discarded;
    console.warn(`[offline-location] Se descartaron ${discarded} puntos por retención o límite local.`);
  }

  return discarded > 0;
}

function createLocalId() {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();

  localIdCounter = (localIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${localIdCounter.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function enqueueLocation(input: EnqueueLocationInput) {
  const point = normalizePoint({
    ...input,
    localId: input.localId ?? createLocalId(),
    queuedAt: input.queuedAt ?? new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastErrorType: null,
  });

  if (!point) throw new Error('Punto de ubicación inválido para la cola local.');

  return withStorageLock(async () => {
    const state = await readStateLocked();
    state.points.push(point);
    state.points.sort(comparePoints);
    compactState(state);
    await writeStateLocked(state);
    return point;
  });
}

export async function getPendingLocations() {
  return withStorageLock(async () => {
    const state = await readStateLocked();
    if (compactState(state)) await writeStateLocked(state);
    return state.points.map((point) => ({ ...point }));
  });
}

export async function getPendingLocationCount(tecnicoId?: number) {
  const points = await getPendingLocations();
  return tecnicoId
    ? points.filter((point) => point.tecnicoId === tecnicoId).length
    : points.length;
}

export async function flushPendingLocations(options: FlushPendingLocationOptions) {
  if (flushOperation) {
    if (flushOperation.tecnicoId === options.tecnicoId) return flushOperation.promise;
    await flushOperation.promise.catch(() => undefined);
    return flushPendingLocations(options);
  }

  const operation = {
    promise: Promise.resolve(createEmptyFlushResult('completed')),
    tecnicoId: options.tecnicoId,
  };
  operation.promise = runFlush(options).finally(() => {
    if (flushOperation === operation) flushOperation = null;
  });
  flushOperation = operation;
  return operation.promise;
}

export async function flushPendingLocationsForCurrentSession(
  tecnicoId: number | null | undefined,
  options: Omit<FlushPendingLocationOptions, 'tecnicoId' | 'token'> = {},
) {
  const token = await getStoredToken();
  if (!token || !isPositiveInteger(tecnicoId)) {
    return createEmptyFlushResult('auth-required');
  }

  return flushPendingLocations({ ...options, tecnicoId, token });
}

async function runFlush(options: FlushPendingLocationOptions): Promise<FlushPendingLocationResult> {
  const maxPoints = Math.max(1, Math.min(options.maxPoints ?? 50, 50));
  const deadline = options.timeoutMs && options.timeoutMs > 0
    ? Date.now() + options.timeoutMs
    : null;
  const processedIds = new Set<string>();
  const result = createEmptyFlushResult('completed');

  if (!options.token || !isPositiveInteger(options.tecnicoId)) {
    result.status = 'auth-required';
    return result;
  }

  // El token puede vencer a mitad del flush (la tarea de background corre
  // durante horas). Se renueva como máximo una vez por flush.
  let token = options.token;
  let refreshIntentado = false;

  while (result.attempted < maxPoints) {
    if (deadline && Date.now() >= deadline) {
      result.status = 'timeout';
      break;
    }

    const point = await withStorageLock(async () => {
      const state = await readStateLocked();
      const compacted = compactState(state);
      const oldestForTechnician = state.points.find((item) =>
        item.tecnicoId === options.tecnicoId
        && !processedIds.has(item.localId),
      );
      if (compacted) await writeStateLocked(state);
      return oldestForTechnician && canAttemptPoint(oldestForTechnician)
        ? { ...oldestForTechnician }
        : null;
    });

    if (!point) break;
    processedIds.add(point.localId);
    result.attempted += 1;

    try {
      const remainingMs = deadline ? Math.max(1, deadline - Date.now()) : DEFAULT_REQUEST_TIMEOUT_MS;
      await sendLocationPoint(point, token, Math.min(DEFAULT_REQUEST_TIMEOUT_MS, remainingMs));
      await removeConfirmedPoint(point.localId);
      result.sent += 1;
      result.lastSentCapturedAt = point.capturedAt;
      result.lastError = null;
    } catch (error) {
      const transportError = normalizeTransportError(error);

      // Sesión vencida: el punto es válido, lo que caducó es el token. Se
      // renueva y se reintenta el mismo punto sin contarlo como fallo (si se
      // marcara como fallido, el backoff lo dejaría esperando 30 s de más).
      if (transportError.type === 'authentication' && !refreshIntentado) {
        refreshIntentado = true;
        const nuevoToken = await refreshAccessToken().catch(() => null);
        if (nuevoToken) {
          token = nuevoToken;
          processedIds.delete(point.localId);
          result.attempted -= 1;
          continue;
        }
      }

      result.lastError = transportError.type;
      const update = await markPointFailed(point.localId, transportError.type);

      if (transportError.type === 'permanent') {
        if (update.discarded) result.discardedPermanent += 1;
        continue;
      }

      result.status = transportError.type === 'authentication' ? 'auth-required' : 'paused';
      break;
    }
  }

  result.pendingCount = await getPendingLocationCount(options.tecnicoId);
  return result;
}

function createEmptyFlushResult(status: FlushPendingLocationResult['status']): FlushPendingLocationResult {
  return {
    attempted: 0,
    discardedPermanent: 0,
    lastError: null,
    lastSentCapturedAt: null,
    pendingCount: 0,
    sent: 0,
    status,
  };
}

function getBackoffMs(attempts: number) {
  if (attempts <= 1) return 0;
  if (attempts === 2) return 30_000;
  if (attempts === 3) return 60_000;
  return Math.min(5 * 60_000, 60_000 * 2 ** (attempts - 3));
}

function canAttemptPoint(point: OfflineLocationPoint) {
  if (!point.lastAttemptAt) return true;
  return Date.now() - Date.parse(point.lastAttemptAt) >= getBackoffMs(point.attempts);
}

async function removeConfirmedPoint(localId: string) {
  await withStorageLock(async () => {
    const state = await readStateLocked();
    const next = state.points.filter((point) => point.localId !== localId);
    if (next.length === state.points.length) return;
    state.points = next;
    state.lastError = null;
    await writeStateLocked(state);
  });
}

async function markPointFailed(localId: string, errorType: Exclude<LocationErrorType, 'storage'>) {
  return withStorageLock(async () => {
    const state = await readStateLocked();
    const index = state.points.findIndex((point) => point.localId === localId);
    if (index < 0) return { discarded: false };

    const point = state.points[index];
    const attempts = point.attempts + 1;
    state.lastError = errorType;

    if (errorType === 'permanent' && attempts >= MAX_PERMANENT_ATTEMPTS) {
      state.points.splice(index, 1);
      state.discardedCount += 1;
      state.permanentFailureCount += 1;
      console.warn('[offline-location] Se descartó un punto inválido después de tres intentos.');
      await writeStateLocked(state);
      return { discarded: true };
    }

    state.points[index] = {
      ...point,
      attempts,
      lastAttemptAt: new Date().toISOString(),
      lastErrorType: errorType,
    };
    await writeStateLocked(state);
    return { discarded: false };
  });
}

export async function sendLocationPoint(
  point: OfflineLocationPoint,
  token: string,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

  try {
    const response = await fetch(`${API_URL}/auth/ubicaciones`, {
      body: JSON.stringify({
        agendaId: point.agendaId,
        latitud: point.latitud,
        longitud: point.longitud,
        precision: point.precision,
        velocidad: point.velocidad,
        estadoTracking: point.estadoTracking,
        // Momento real de captura, para que el backlog offline conserve el
        // orden/tiempo correcto en vez de la hora de recepción del servidor.
        capturedAt: point.capturedAt,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });

    if (response.ok) return;
    if (response.status === 401 || response.status === 403) {
      throw new LocationTransportError('authentication', response.status);
    }
    if (response.status === 400 || response.status === 404 || response.status === 422) {
      throw new LocationTransportError('permanent', response.status);
    }
    throw new LocationTransportError('recoverable', response.status);
  } catch (error) {
    if (error instanceof LocationTransportError) throw error;
    throw new LocationTransportError('recoverable');
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTransportError(error: unknown) {
  return error instanceof LocationTransportError
    ? error
    : new LocationTransportError('recoverable');
}

export async function inspectQueueHealth(): Promise<OfflineLocationQueueHealth> {
  return withStorageLock(async () => {
    const state = await readStateLocked();
    if (compactState(state)) await writeStateLocked(state);
    return {
      discardedCount: state.discardedCount,
      flushInProgress: flushOperation !== null,
      inconsistentOwnerCount: state.points.filter((point) => !isPositiveInteger(point.tecnicoId)).length,
      invalidStateResetCount: state.invalidStateResetCount,
      lastError: state.lastError,
      oldestCapturedAt: state.points[0]?.capturedAt ?? null,
      pendingCount: state.points.length,
      permanentFailureCount: state.permanentFailureCount,
    };
  });
}
