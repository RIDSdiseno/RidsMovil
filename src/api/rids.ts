// src/api/rids.ts
import {
  ActualizarEquipoPayload,
  Cliente,
  CompletarVisitaPayload,
  ConfirmarEvidenciaPayload,
  CrearClienteEconnetPayload,
  CrearEntregaPayload,
  CrearEquipoPayload,
  CrearUsuarioPayload,
  CrearVisitaPayload,
  EmpresaFavorita,
  Entrega,
  EnviarPdfEntregaPayload,
  Equipo,
  EquipoDetalle,
  EvidenciaEntrega,
  HistorialVisita,
  LoginResponse,
  RegistrarUbicacionPayload,
  Solicitante,
  SolicitarFirmaPayload,
  Sucursal,
  UbicacionTecnico,
  UploadSignatureResponse,
  Visita,
  VisitaAsignada,
  VisitaPendiente,
} from '@/src/types/api';

import {
  File,
} from 'expo-file-system';

import {
  fetch as expoFetch,
} from 'expo/fetch';

import { cachedRequest, getCachedData, invalidateCache, setCachedData } from './cache';
import { apiRequest, getStoredToken } from './client';
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

export function getEmpresasFavoritas() {
  return apiRequest<{ favoritos: EmpresaFavorita[] }>('/auth/empresas-favoritas');
}

export function agregarEmpresaFavorita(favorito: EmpresaFavorita) {
  return apiRequest<{ favorito: EmpresaFavorita }>(
    `/auth/empresas-favoritas/${encodeURIComponent(favorito.origen)}/${favorito.empresaId}`,
    { method: 'PUT' },
  );
}

export function eliminarEmpresaFavorita(favorito: EmpresaFavorita) {
  return apiRequest<{ ok: boolean }>(
    `/auth/empresas-favoritas/${encodeURIComponent(favorito.origen)}/${favorito.empresaId}`,
    { method: 'DELETE' },
  );
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

type AgendaAsignadaResponse = Awaited<ReturnType<typeof getMisVisitasAsignadasHoy>>;

const AGENDA_ASIGNADA_CACHE_PREFIX = 'agenda-asignada:';

function getAgendaAsignadaCacheKey(tecnicoId: number, fecha: string) {
  return `${AGENDA_ASIGNADA_CACHE_PREFIX}${tecnicoId}:${fecha}`;
}

export function getMisVisitasAsignadasHoyCached(tecnicoId: number, fecha: string, force = false) {
  return cachedRequest(
    getAgendaAsignadaCacheKey(tecnicoId, fecha),
    () => getMisVisitasAsignadasHoy(fecha),
    { force },
  );
}

export function getMisVisitasAsignadasHoyCache(tecnicoId: number, fecha: string) {
  return getCachedData<AgendaAsignadaResponse>(getAgendaAsignadaCacheKey(tecnicoId, fecha));
}

export function setMisVisitasAsignadasHoyCache(
  tecnicoId: number,
  fecha: string,
  response: AgendaAsignadaResponse,
) {
  setCachedData(getAgendaAsignadaCacheKey(tecnicoId, fecha), response);
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

export async function finalizarVisitaAsignada(agendaId: number) {
  const response = await apiRequest<{ visita: VisitaAsignada }>(
    `/auth/agenda/${agendaId}/finalizar-visita`,
    { method: 'POST' },
  );

  // Cerrar la agenda cambia su estado a COMPLETADA, así que la copia en caché
  // queda obsoleta. Se invalida acá y no en la pantalla que llama para que
  // ningún flujo pueda olvidarlo: al guardar la visita desde el formulario, la
  // pantalla de inicio seguía leyendo el estado anterior y mostraba "continuar
  // visita" hasta que el técnico refrescaba a mano.
  invalidateCache(AGENDA_ASIGNADA_CACHE_PREFIX);

  return response;
}

type VisitasPendientesResponse = {
  visitas: VisitaPendiente[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

const VISITAS_PENDIENTES_CACHE_PREFIX = 'visitas-pendientes:';

function getVisitasPendientesCacheKey(tecnicoId: number, page: number, limit: number) {
  return `${VISITAS_PENDIENTES_CACHE_PREFIX}${tecnicoId}:${page}:${limit}`;
}

export function getVisitasPendientes(page = 1, limit = 20) {
  return apiRequest<VisitasPendientesResponse>(
    `/auth/visitas/pendientes?page=${page}&limit=${limit}`,
  );
}

export function getVisitasPendientesCached(tecnicoId: number, page = 1, limit = 20, force = false) {
  return cachedRequest(
    getVisitasPendientesCacheKey(tecnicoId, page, limit),
    () => getVisitasPendientes(page, limit),
    { force },
  );
}

export function getVisitasPendientesCache(tecnicoId: number, page = 1, limit = 20) {
  return getCachedData<VisitasPendientesResponse>(getVisitasPendientesCacheKey(tecnicoId, page, limit));
}

// Cancelar o retomar una visita cambia el listado completo y corre las páginas,
// así que se descarta todo el prefijo en vez de una sola.
export function invalidarVisitasPendientesCache() {
  invalidateCache(VISITAS_PENDIENTES_CACHE_PREFIX);
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

export function getHistorialPorTecnicoCache(tecnicoId: number, page = 1, limit = 5) {
  return getCachedData<Awaited<ReturnType<typeof getHistorialPorTecnico>>>(
    `historial-visitas:${tecnicoId}:${page}:${limit}`,
  );
}

/* =========================================================
   EQUIPOS
========================================================= */

export function getEquipos() {
  return apiRequest<{ equipos: Equipo[] }>(
    '/auth/getAllEquipos',
  );
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

/**
 * Listado / búsqueda / filtros / paginación de equipos.
 *
 * Backend:
 * GET /api/auth/getAllEquipos
 */
export function searchEquipos(params: EquiposQuery) {
  const qs = new URLSearchParams();

  if (params.search?.trim()) {
    qs.set('search', params.search.trim());
  }

  if (params.empresaId != null) {
    qs.set('empresaId', String(params.empresaId));
  }

  if (params.estado) {
    qs.set('estado', params.estado);
  }

  if (params.ingresoDesde) {
    qs.set('ingresoDesde', params.ingresoDesde);
  }

  if (params.ingresoHasta) {
    qs.set('ingresoHasta', params.ingresoHasta);
  }

  if (params.edicionDesde) {
    qs.set('edicionDesde', params.edicionDesde);
  }

  if (params.edicionHasta) {
    qs.set('edicionHasta', params.edicionHasta);
  }

  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 30));

  return apiRequest<{
    equipos: Equipo[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>(
    `/auth/getAllEquipos?${qs.toString()}`,
  );
}

/**
 * Listado completo con caché.
 */
export function getEquiposCached(force = false) {
  return cachedRequest(
    'equipos',
    getEquipos,
    { force },
  );
}

/**
 * Obtiene solamente lo que exista actualmente
 * en caché.
 */
export function getEquiposCache() {
  return getCachedData<{ equipos: Equipo[] }>(
    'equipos',
  );
}

/**
 * Ficha completa de un equipo.
 *
 * Backend:
 * GET /api/auth/equipos/:id
 */
export function getEquipoDetalle(equipoId: number) {
  return apiRequest<EquipoDetalle>(
    `/auth/equipos/${equipoId}`,
  );
}

/**
 * Actualiza equipo.
 *
 * Backend:
 * PATCH /api/auth/equipos/:id
 */
export async function actualizarEquipo(
  equipoId: number,
  payload: ActualizarEquipoPayload,
) {
  const response = await apiRequest<{
    equipo?: Equipo;
    detalleActualizado?: unknown;
    ok?: boolean;
    message?: string;
  }>(
    `/auth/equipos/${equipoId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );

  invalidateCache('equipos');

  return response;
}

/**
 * Cambia el solicitante asociado al equipo.
 *
 * Backend:
 * PUT /api/auth/equipos/:id/solicitante
 */
export async function cambiarAsignacionEquipo(
  equipoId: number,
  payload: {
    empresaId: number | null;
    solicitanteId: number | null;
  },
) {
  const response = await apiRequest<{
    equipo?: Equipo;
    ok?: boolean;
    message?: string;
  }>(
    `/auth/equipos/${equipoId}/asignacion`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );

  invalidateCache('equipos');

  return response;
}

/**
 * Crea un equipo.
 *
 * Backend:
 * POST /api/auth/createEquipo
 */
export async function crearEquipo(
  payload: CrearEquipoPayload,
) {
  const response = await apiRequest<{
    equipo: Equipo;
    message?: string;
  }>(
    '/auth/createEquipo',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

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

export function getEntregasCache(page = 1, limit = 50) {
  return getCachedData<Awaited<ReturnType<typeof getEntregas>>>(`entregas:${page}:${limit}`);
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

type NativeUploadFile = {
  uri: string;
  name: string;
  type: string;
};

export async function uploadToCloudinary(
  signature: UploadSignatureResponse,
  file: NativeUploadFile,
  fileName: string,
) {

  if (!signature.cloudName) {
    throw new Error(
      'cloudName no recibido',
    );
  }

  if (
    !signature.apiKey ||
    !signature.signature ||
    !signature.timestamp
  ) {
    throw new Error(
      'Faltan datos de firma para Cloudinary',
    );
  }

  const resourceType =
    signature.resourceType ||
    'auto';

  const endpoint =
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/${resourceType}/upload`;

  /*
   * captureRef en iOS devuelve:
   *
   * /private/var/mobile/...
   *
   * Lo normalizamos para expo-file-system.
   */
  const normalizedUri =
    file.uri.startsWith(
      'file://',
    )
      ? file.uri
      : `file://${file.uri}`;

  /*
   * File de expo-file-system implementa
   * un archivo real compatible con expo/fetch.
   */
  const expoFile =
    new File(
      normalizedUri,
    );

  if (
    !expoFile.exists
  ) {
    throw new Error(
      'El archivo temporal de la firma no existe.',
    );
  }

  if (
    !expoFile.size ||
    expoFile.size <= 0
  ) {
    throw new Error(
      'El archivo temporal de la firma está vacío.',
    );
  }

  const formData =
    new FormData();

  /*
   * IMPORTANTE:
   * ya no se manda el objeto
   * { uri, name, type }.
   *
   * Se manda un File real.
   */
  formData.append(
    'file',
    expoFile,
  );

  formData.append(
    'api_key',
    signature.apiKey,
  );

  formData.append(
    'timestamp',
    String(
      signature.timestamp,
    ),
  );

  formData.append(
    'signature',
    signature.signature,
  );

  if (
    signature.folder
  ) {
    formData.append(
      'folder',
      signature.folder,
    );
  }

  if (
    signature.publicId
  ) {
    formData.append(
      'public_id',
      signature.publicId,
    );
  }

  let response: Response;

  try {
    /*
     * IMPORTANTE:
     * expoFetch, NO fetch global.
     */
    response =
      await expoFetch(
        endpoint,
        {
          method:
            'POST',

          body:
            formData,
        },
      );
  } catch (error) {
    console.error(
      '[CLOUDINARY][FETCH ERROR]',
      error,
    );

    throw error;
  }

  const text =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      text ||
      'No se pudo subir la evidencia',
    );
  }

  try {
    return JSON.parse(
      text,
    );
  } catch {
    throw new Error(
      `Cloudinary no respondió JSON: ${text}`,
    );
  }
}