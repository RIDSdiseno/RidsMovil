import { VisitaAsignada } from '@/src/types/api';

type RouteEligibility = {
  canStart: boolean;
  reason: string | null;
  availableFromLabel: string | null;
};

const BLOCKED_STATES = new Set(['INICIADA', 'COMPLETADA', 'CANCELADA']);

export function getRouteEligibility(visita: VisitaAsignada, now = new Date()): RouteEligibility {
  if (BLOCKED_STATES.has(String(visita.estado).toUpperCase())) {
    return {
      canStart: false,
      reason: 'La visita ya no permite iniciar ruta.',
      availableFromLabel: null,
    };
  }

  const scheduledDate = parseDateKey(visita.fechaProgramada);
  if (!scheduledDate) {
    return {
      canStart: false,
      reason: 'La visita no tiene fecha programada valida.',
      availableFromLabel: null,
    };
  }

  if (!isSameLocalDay(scheduledDate, now)) {
    return {
      canStart: false,
      reason: scheduledDate < startOfLocalDay(now)
        ? 'Ruta no disponible para visitas de fechas anteriores.'
        : 'Ruta disponible solo el dia de la visita.',
      availableFromLabel: null,
    };
  }

  const startTime = parseTime(visita.horaInicio ?? visita.horaProgramada);
  if (!startTime) {
    return {
      canStart: false,
      reason: 'La visita no tiene hora de inicio programada.',
      availableFromLabel: null,
    };
  }

  const scheduledStart = new Date(
    scheduledDate.getFullYear(),
    scheduledDate.getMonth(),
    scheduledDate.getDate(),
    startTime.hours,
    startTime.minutes,
    0,
    0,
  );
  const availableFrom = new Date(scheduledStart.getTime() - 60 * 60 * 1000);

  if (now < availableFrom) {
    return {
      canStart: false,
      reason: `Ruta disponible desde ${formatTime(availableFrom)}.`,
      availableFromLabel: formatTime(availableFrom),
    };
  }

  return {
    canStart: true,
    reason: null,
    availableFromLabel: formatTime(availableFrom),
  };
}

function parseDateKey(value?: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function parseTime(value?: string | null) {
  const match = String(value ?? '').match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!match) return null;

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
