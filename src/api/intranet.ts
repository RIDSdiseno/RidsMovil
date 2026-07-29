import { INTRANET_API_URL } from './config';
import { cachedRequest } from './cache';

export type AgendaTecnico = {
  tecnico: {
    id_tecnico: number;
    nombre: string;
    email?: string | null;
  };
};

export type AgendaEmpresa = {
  id_empresa: number;
  nombre: string;
};

export type AgendaVisita = {
  id: number;
  fecha: string;
  tipo: string;
  estado: string;
  empresa: AgendaEmpresa | null;
  empresaExternaNombre?: string | null;
  tecnicos: AgendaTecnico[];
  horaInicio?: string | null;
  horaFin?: string | null;
  notas?: string | null;
  mensaje?: string | null;
};

type AgendaParams = {
  year: number;
  month: number;
  tecnico?: string | null;
};

function assertIntranetApiUrl() {
  if (!INTRANET_API_URL) {
    throw new Error('EXPO_PUBLIC_INTRANET_API_URL no esta configurada.');
  }
  return INTRANET_API_URL.replace(/\/+$/, '');
}

export async function getAgendaMensual({ year, month, tecnico }: AgendaParams) {
  const baseUrl = assertIntranetApiUrl();
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });

  if (tecnico?.trim()) {
    params.set('tecnico', tecnico.trim());
  }

  const response = await fetch(`${baseUrl}/agenda?${params.toString()}`);
  if (!response.ok) {
    throw new Error('No se pudo cargar la agenda interna.');
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as AgendaVisita[]) : [];
}

export function getAgendaMensualCached(params: AgendaParams, force = false) {
  return cachedRequest(
    `agenda:${params.year}:${params.month}:${params.tecnico ?? ''}`,
    () => getAgendaMensual(params),
    { force },
  );
}
