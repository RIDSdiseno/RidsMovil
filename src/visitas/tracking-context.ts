import * as SecureStore from 'expo-secure-store';

const AGENDA_TRACKING_CONTEXT_KEY = 'rids.tracking.context.v1';

export type AgendaTrackingEstado = 'EN_RUTA' | 'INICIADA';

export type AgendaTrackingContext = {
  agendaId: number | null;
  tecnicoId?: number | null;
  empresaId?: number | null;
  estadoTracking: AgendaTrackingEstado;
  startedAt: string;
  fechaInicioRuta?: string | null;
  fechaInicioVisita?: string | null;
  empresaNombre?: string | null;
  lastSentAt?: string | null;
  lastError?: string | null;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function normalizeEstadoTracking(value: unknown): AgendaTrackingEstado {
  return value === 'INICIADA' ? 'INICIADA' : 'EN_RUTA';
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function normalizeNullablePositiveInteger(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return isPositiveInteger(value) ? value : undefined;
}

function normalizeContext(value: unknown): AgendaTrackingContext | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Partial<AgendaTrackingContext>;
  if (raw.agendaId !== null && !isPositiveInteger(raw.agendaId)) return null;

  const startedAt = typeof raw.startedAt === 'string' && raw.startedAt.trim()
    ? raw.startedAt
    : new Date().toISOString();

  return {
    agendaId: raw.agendaId ?? null,
    tecnicoId: normalizeNullablePositiveInteger(raw.tecnicoId),
    empresaId: normalizeNullablePositiveInteger(raw.empresaId),
    estadoTracking: normalizeEstadoTracking(raw.estadoTracking),
    startedAt,
    fechaInicioRuta: normalizeNullableString(raw.fechaInicioRuta),
    fechaInicioVisita: normalizeNullableString(raw.fechaInicioVisita),
    empresaNombre: normalizeNullableString(raw.empresaNombre),
    lastSentAt: normalizeNullableString(raw.lastSentAt),
    lastError: normalizeNullableString(raw.lastError),
  };
}

export async function getAgendaTrackingContext(): Promise<AgendaTrackingContext | null> {
  const raw = await SecureStore.getItemAsync(AGENDA_TRACKING_CONTEXT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const context = normalizeContext(parsed);

    if (!context) {
      await clearAgendaTrackingContext();
      return null;
    }

    return context;
  } catch {
    await clearAgendaTrackingContext();
    return null;
  }
}

export async function saveAgendaTrackingContext(context: AgendaTrackingContext) {
  const normalized = normalizeContext(context);
  if (!normalized) {
    throw new Error('Contexto de tracking inválido.');
  }

  await SecureStore.setItemAsync(AGENDA_TRACKING_CONTEXT_KEY, JSON.stringify(normalized));
}

export async function updateAgendaTrackingContext(partial: Partial<AgendaTrackingContext>) {
  const current = await getAgendaTrackingContext();
  if (!current) return null;

  const next = normalizeContext({
    ...current,
    ...partial,
    agendaId: current.agendaId,
  });

  if (!next) {
    await clearAgendaTrackingContext();
    return null;
  }

  await saveAgendaTrackingContext(next);
  return next;
}

export async function clearAgendaTrackingContext() {
  await SecureStore.deleteItemAsync(AGENDA_TRACKING_CONTEXT_KEY);
}
