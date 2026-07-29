import { VisitaAsignada } from '@/src/types/api';

import { getRouteEligibility } from './route-eligibility';

export type AgendaCardPrimaryAction =
  | 'START_ROUTE'
  | 'START_VISIT'
  | 'CONTINUE_VISIT'
  | 'NONE';

export type AgendaCardAction = {
  primary: AgendaCardPrimaryAction;
  reason: string | null;
  status: string;
};

export function getAgendaCardAction(visita: VisitaAsignada, now = new Date()): AgendaCardAction {
  const status = String(visita.estado ?? '').toUpperCase();
  const visitaStatus = String(visita.visitaStatus ?? '').toUpperCase();

  if (visitaStatus === 'COMPLETADA') {
    return {
      primary: 'NONE',
      reason: status === 'COMPLETADA' ? null : 'El formulario está completado y el cierre de agenda está pendiente.',
      status,
    };
  }

  if (status === 'PROGRAMADA' || status === 'NOTIFICADA') {
    const eligibility = getRouteEligibility(visita, now);
    return {
      primary: eligibility.canStart ? 'START_ROUTE' : 'NONE',
      reason: eligibility.reason,
      status,
    };
  }

  if (status === 'EN_RUTA') {
    return { primary: 'START_VISIT', reason: null, status };
  }

  if (status === 'INICIADA') {
    return { primary: 'CONTINUE_VISIT', reason: null, status };
  }

  return { primary: 'NONE', reason: null, status };
}
