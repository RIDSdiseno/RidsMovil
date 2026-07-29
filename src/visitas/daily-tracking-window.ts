// Ventana horaria de la jornada laboral (hora de Chile) durante la cual se
// comparte la ubicación del técnico, independiente de si tiene una visita
// EN_RUTA/INICIADA puntual. Se usa tanto para decidir cuándo arrancar el
// tracking como para cortarlo automáticamente desde la tarea en segundo plano.
//
// Horario:
//   Lunes a viernes: 08:00 - 18:30
//   Sábado:          08:30 - 14:00
//   Domingo:         sin jornada
export const CHILE_TIME_ZONE = 'America/Santiago';

const VENTANA_LUN_VIE_INICIO = 8 * 60; // 08:00
const VENTANA_LUN_VIE_FIN = 18 * 60 + 30; // 18:30
const VENTANA_SABADO_INICIO = 8 * 60 + 30; // 08:30
const VENTANA_SABADO_FIN = 14 * 60; // 14:00

function getChileParts(date: Date): { weekday: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hourRaw = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const hour = hourRaw === 24 ? 0 : hourRaw; // algunos entornos devuelven "24" a medianoche
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { weekday, minutes: hour * 60 + minute };
}

export function isWithinDailyTrackingWindow(date: Date = new Date()): boolean {
  const { weekday, minutes } = getChileParts(date);
  if (weekday === 'Sun') return false;
  if (weekday === 'Sat') return minutes >= VENTANA_SABADO_INICIO && minutes <= VENTANA_SABADO_FIN;
  return minutes >= VENTANA_LUN_VIE_INICIO && minutes <= VENTANA_LUN_VIE_FIN;
}
