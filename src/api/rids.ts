import {
  ActualizarEquipoPayload,
  Cliente,
  CompletarVisitaPayload,
  ConfirmarEvidenciaPayload,
  CrearEntregaPayload,
  CrearEquipoPayload,
  CrearClienteEconnetPayload,
  CrearUsuarioPayload,
  CrearVisitaPayload,
  Entrega,
  EnviarPdfEntregaPayload,
  Equipo,
  EquipoDetalle,
  EvidenciaEntrega,
  HistorialVisita,
  LoginResponse,
  Solicitante,
  SolicitarFirmaPayload,
  Sucursal,
  RegistrarUbicacionPayload,
  UploadSignatureResponse,
  UbicacionTecnico,
  VisitaAsignada,
  Visita,
} from '@/src/types/api';

import { apiRequest, getStoredToken } from './client';
import { cachedRequest, getCachedData, invalidateCache } from './cache';
import { API_URL } from './config';

export function loginTecnico(email: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  });
}

export function loginMicrosoft(idToken: string) {
  return apiRequest<LoginResponse>('/auth/microsoft', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ idToken }),
  });
}

export function getClientes() {
  return apiRequest<Cliente[]>('/auth/clientes');
}

export function getClientesCached(force = false) {
  return cachedRequest('clientes', getClientes, { force });
}

export function getClientesEconnet() {
  return apiRequest<Cliente[]>('/auth/clientes/econnet');
}

export function getClientesEconnetCached(force = false) {
  return cachedRequest('clientes:econnet', getClientesEconnet, { force });
}

export async function getClientesPickupEconnetCached(force = false) {
  const [clientesEconnet, empresasRids] = await Promise.all([
    getClientesEconnetCached(force),
    getClientesCached(force),
  ]);

  return [
    ...clientesEconnet.map((cliente) => ({ ...cliente, origen: cliente.origen ?? 'ECONNET' })),
    ...empresasRids.map((empresa) => ({ ...empresa, origen: empresa.origen ?? 'RIDS' })),
  ];
}

export async function crearClienteEconnet(payload: CrearClienteEconnetPayload) {
  const response = await apiRequest<Cliente>('/auth/clientes/econnet', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateCache('clientes:econnet');
  return response;
}

export function getClientesCache() {
  return getCachedData<Cliente[]>('clientes');
}

export function getSolicitantes(empresaId: number) {
  return apiRequest<{ solicitantes?: Solicitante[] } | Solicitante[]>(
    `/auth/solicitantes?empresaId=${empresaId}`,
  );
}

export async function getSolicitantesList(empresaId: number) {
  const response = await getSolicitantes(empresaId);
  return Array.isArray(response) ? response : response.solicitantes ?? [];
}

export function getSolicitantesListCached(empresaId: number, force = false) {
  return cachedRequest(
    `solicitantes:${empresaId}`,
    () => getSolicitantesList(empresaId),
    { force },
  );
}

export function getSucursalesPorEmpresa(empresaId: number) {
  return apiRequest<{ sucursales: Sucursal[] }>(`/auth/empresas/${empresaId}/sucursales`);
}

export function getSucursalesPorEmpresaCached(empresaId: number, force = false) {
  return cachedRequest(
    `sucursales:${empresaId}`,
    () => getSucursalesPorEmpresa(empresaId),
    { force },
  );
}

export function crearVisita(payload: CrearVisitaPayload) {
  return apiRequest<{ visita: Visita; reutilizada?: boolean }>('/auth/crear_visita', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function completarVisita(visitaId: number, payload: CompletarVisitaPayload) {
  return apiRequest<{ visita?: Visita; ok?: boolean; message?: string }>(
    `/auth/finalizar_visita/${visitaId}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export function cancelarVisita(visitaId: number) {
  return apiRequest<{ visita?: Visita }>(`/auth/cancelar_visita/${visitaId}`, {
    method: 'PUT',
  });
}

export function getMisVisitasAsignadasHoy(fecha?: string) {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  return apiRequest<{ fecha: string; visitas: VisitaAsignada[] }>(
    `/auth/agenda/mis-visitas/hoy${query}`,
  );
}

export function iniciarRutaVisitaAsignada(agendaId: number) {
  return apiRequest<{ visita: VisitaAsignada }>(`/auth/agenda/${agendaId}/iniciar-ruta`, {
    method: 'POST',
  });
}

export function iniciarVisitaAsignada(agendaId: number) {
  return apiRequest<{ visita: VisitaAsignada }>(`/auth/agenda/${agendaId}/iniciar-visita`, {
    method: 'POST',
  });
}

export function getVisitaAsignadaPorAgenda(agendaId: number) {
  return apiRequest<{ visita: Visita | null }>(`/auth/agenda/${agendaId}/visita`);
}

export function finalizarVisitaAsignada(agendaId: number) {
  return apiRequest<{ visita: VisitaAsignada }>(`/auth/agenda/${agendaId}/finalizar-visita`, {
    method: 'POST',
  });
}

export function registrarUbicacionTecnico(payload: RegistrarUbicacionPayload) {
  return apiRequest<{ ubicacion: UbicacionTecnico }>('/auth/ubicaciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getHistorialPorTecnico(tecnicoId: number, page = 1, limit = 5) {
  return apiRequest<{
    historial?: HistorialVisita[];
    data?: HistorialVisita[];
    visitas?: HistorialVisita[];
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  }>(`/auth/historial/${tecnicoId}?page=${page}&limit=${limit}`);
}

export function getHistorialPorTecnicoCached(tecnicoId: number, page = 1, limit = 5, force = false) {
  return cachedRequest(
    `historial-visitas:${tecnicoId}:${page}:${limit}`,
    () => getHistorialPorTecnico(tecnicoId, page, limit),
    { force },
  );
}

export function getEquipos() {
  return apiRequest<{ equipos: Equipo[] }>('/auth/equipos');
}

export type EquiposQuery = {
  search?: string;
  empresaId?: number | null;
  estado?: string | null;
  ingresoDesde?: string;
  ingresoHasta?: string;
  edicionDesde?: string;
  edicionHasta?: string;
  page?: number;
  limit?: number;
};

// Búsqueda/paginación server-side de equipos (para el listado de "Gestionar").
export function searchEquipos(params: EquiposQuery) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.empresaId != null) qs.set('empresaId', String(params.empresaId));
  if (params.estado) qs.set('estado', params.estado);
  if (params.ingresoDesde) qs.set('ingresoDesde', params.ingresoDesde);
  if (params.ingresoHasta) qs.set('ingresoHasta', params.ingresoHasta);
  if (params.edicionDesde) qs.set('edicionDesde', params.edicionDesde);
  if (params.edicionHasta) qs.set('edicionHasta', params.edicionHasta);
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 30));
  return apiRequest<{ equipos: Equipo[]; total: number; page: number; limit: number; hasMore: boolean }>(
    `/auth/equipos?${qs.toString()}`,
  );
}

export function getEquiposCached(force = false) {
  return cachedRequest('equipos', getEquipos, { force });
}

export function getEquiposCache() {
  return getCachedData<{ equipos: Equipo[] }>('equipos');
}

export function getEquipoDetalle(equipoId: number) {
  return apiRequest<EquipoDetalle>(`/auth/equipos/${equipoId}`);
}

export async function actualizarEquipo(equipoId: number, payload: ActualizarEquipoPayload) {
  const response = await apiRequest<{ equipo?: Equipo; ok?: boolean; message?: string }>(`/auth/equipos/${equipoId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  invalidateCache('equipos');
  return response;
}

export async function cambiarSolicitanteEquipo(equipoId: number, solicitanteId: number) {
  const response = await apiRequest<{ equipo?: Equipo; ok?: boolean; message?: string }>(
    `/auth/equipos/${equipoId}/solicitante`,
    {
      method: 'PUT',
      body: JSON.stringify({ solicitanteId }),
    },
  );
  invalidateCache('equipos');
  return response;
}

export async function crearEquipo(payload: CrearEquipoPayload) {
  const response = await apiRequest<{ equipo: Equipo }>('/auth/crearequipo', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateCache('equipos');
  return response;
}

export function crearUsuario(payload: CrearUsuarioPayload) {
  invalidateCache('solicitantes:');
  return apiRequest<{ solicitante?: Solicitante; usuario?: Solicitante }>(
    '/auth/createSolicitante',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function getEntregas(page = 1, limit = 50) {
  return apiRequest<{
    entregas: Entrega[];
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  }>(`/entregas?page=${page}&limit=${limit}&includeEvidencias=false`);
}

export function getEntregasCached(force = false, page = 1, limit = 50) {
  return cachedRequest(
    `entregas:${page}:${limit}`,
    () => getEntregas(page, limit),
    { force },
  );
}

export function crearEntrega(payload: CrearEntregaPayload) {
  const body = {
    ...payload,
    fecha: payload.fecha ? new Date(payload.fecha).toISOString() : undefined,
  };

  invalidateCache('entregas');
  return apiRequest<{ entrega: Entrega }>('/entregas', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getEntregaPorId(entregaId: number) {
  return apiRequest<{ entrega: Entrega }>(`/entregas/${entregaId}`);
}

export function getEvidenciasPorEntrega(entregaId: number) {
  return apiRequest<{ evidencias: EvidenciaEntrega[] }>(`/entregas/${entregaId}/evidencias`);
}

export function getEvidenciasPorEntregaCached(entregaId: number, force = false) {
  return cachedRequest(
    `evidencias-entrega:${entregaId}`,
    () => getEvidenciasPorEntrega(entregaId),
    { force },
  );
}

export function solicitarFirmaSubida(entregaId: number, payload: SolicitarFirmaPayload) {
  return apiRequest<UploadSignatureResponse>(`/entregas/${entregaId}/evidencias/firma`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function confirmarEvidencia(entregaId: number, payload: ConfirmarEvidenciaPayload) {
  invalidateCache('entregas');
  invalidateCache(`evidencias-entrega:${entregaId}`);
  return apiRequest<{ evidencia: EvidenciaEntrega }>(`/entregas/${entregaId}/evidencias/confirmar`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function enviarPdfEntrega(entregaId: number, payload: EnviarPdfEntregaPayload) {
  if (payload.pdfFile) {
    const formData = new FormData();
    if (payload.brand) formData.append('brand', payload.brand);
    if (payload.operation) formData.append('operation', payload.operation);
    formData.append('receptorEmail', payload.receptorEmail);
    formData.append('pdf', {
      name: payload.pdfFile.name,
      type: payload.pdfFile.mimeType,
      uri: payload.pdfFile.uri,
    } as unknown as Blob);

    return getStoredToken().then(async (token) => {
      let response: Response;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      try {
        response = await fetch(`${API_URL}/entregas/${entregaId}/enviar-pdf`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('El servidor tardo demasiado enviando el correo. Intenta nuevamente.');
        }
        throw new Error('No se pudo conectar con la API. Revisa EXPO_PUBLIC_API_URL.');
      } finally {
        clearTimeout(timeout);
      }

      const text = await response.text();
      const contentType = response.headers.get('content-type') ?? '';
      const isJson = contentType.includes('application/json');
      const data = text && isJson ? JSON.parse(text) : null;

      if (text && !isJson) {
        throw new Error(`La API no respondio JSON. Revisa EXPO_PUBLIC_API_URL (${response.status}).`);
      }

      if (!response.ok) {
        const message = data?.message || data?.error || 'No se pudo completar la solicitud.';
        throw new Error(message);
      }

      return data as { ok: boolean };
    });
  }

  return apiRequest<{ ok: boolean }>(`/entregas/${entregaId}/enviar-pdf`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadToCloudinary(
  signature: UploadSignatureResponse,
  file: Blob,
  fileName: string,
) {
  if (!signature.cloudName) throw new Error('cloudName no recibido');
  if (!signature.apiKey || !signature.signature || !signature.timestamp) {
    throw new Error('Faltan datos de firma para Cloudinary');
  }

  const resourceType = signature.resourceType || 'auto';
  const endpoint =
    signature.uploadUrl && resourceType === 'auto'
      ? signature.uploadUrl
      : `https://api.cloudinary.com/v1_1/${signature.cloudName}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('api_key', signature.apiKey);
  formData.append('timestamp', String(signature.timestamp));
  formData.append('signature', signature.signature);
  if (signature.folder) formData.append('folder', signature.folder);
  if (signature.publicId) formData.append('public_id', signature.publicId);

  const response = await fetch(endpoint, { method: 'POST', body: formData });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'No se pudo subir la evidencia');
  }

  return response.json();
}
