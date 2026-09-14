import * as Location from 'expo-location';
import { router } from 'expo-router';

import {
  cancelarVisita,
  crearVisita,
  getSucursalesPorEmpresaCached,
  getVisitaAsignadaPorAgenda,
} from '@/src/api/rids';
import { Coordenadas } from '@/src/types/api';
import {
  getInitialVisitaState,
  loadVisitaState,
  saveVisitaState,
  VisitaEnCursoState,
} from '@/src/visitas/visita-state';

type StartVisitForEmpresaParams = {
  // Visita que ya existe en el servidor y se quiere retomar (por ejemplo, una
  // que quedó abierta). Sin esto el flujo crearía una visita nueva y quedarían
  // dos abiertas para la misma empresa.
  visitaIdExistente?: number | null;
  empresaId: number;
  empresaNombre: string;
  empresaRazonSocial?: string | null;
  tecnicoId?: number | string | null;
  agendaId?: number | null;
  agendaEstado?: string | null;
  agendaHoraInicio?: string | null;
  direccion?: string | null;
  coordenadas?: Coordenadas | null;
  sucursalId?: number | null;
};

type StartVisitResult = {
  route: '/visitas/sucursal' | '/visitas/solicitantes' | '/visitas/formulario';
  state: VisitaEnCursoState;
};

export async function startVisitForEmpresa(params: StartVisitForEmpresaParams): Promise<StartVisitResult> {
  const current = await loadVisitaState();
  const hasAgenda = typeof params.agendaId === 'number';
  const existingRoute = getResumeRoute(current);
  let visitaId = params.visitaIdExistente
    ?? (hasAgenda && current.agendaId === params.agendaId ? current.visitaId : null);
  let inicio = current.agendaId === params.agendaId ? current.inicio : null;

  if (hasAgenda) {
    const existente = await getVisitaAsignadaPorAgenda(params.agendaId!);
    visitaId = existente.visita?.id_visita ?? null;
    inicio = existente.visita?.inicio ?? inicio;
  }

  if (hasAgenda && current.agendaId === params.agendaId && visitaId && existingRoute) {
    const nextState = await persistVisitState(current, params, visitaId, inicio);
    const route = await navigateToNextStep(nextState);
    return { route, state: nextState };
  }

  if (!hasAgenda && existingRoute && current.empresaId === params.empresaId && current.origen !== 'AGENDA') {
    router.push(existingRoute);
    return { route: existingRoute, state: current };
  }

  if (
    !params.visitaIdExistente
    && !hasAgenda
    && current.visitaId
    && current.empresaId
    && current.empresaId !== params.empresaId
    && current.origen !== 'AGENDA'
  ) {
    await cancelarVisita(current.visitaId).catch(() => undefined);
  }

  let locationData: Pick<VisitaEnCursoState, 'coordenadas' | 'direccionVisita'> | null = null;

  if (!visitaId) {
    if (!hasAgenda && !params.tecnicoId) {
      throw new Error('No se encontro el tecnico autenticado. Inicia sesion nuevamente.');
    }

    locationData = hasAgenda
      ? null
      : await getCurrentVisitLocation().catch(() => null);

    const response = await crearVisita({
      empresaId: params.empresaId,
      inicio: inicio ?? new Date().toISOString(),
      latitud: locationData?.coordenadas.lat ?? params.coordenadas?.lat ?? null,
      longitud: locationData?.coordenadas.lon ?? params.coordenadas?.lon ?? null,
      tecnicoId: params.tecnicoId ?? 0,
      sucursalId: params.sucursalId ?? null,
      agendaId: hasAgenda ? params.agendaId : null,
    });

    visitaId = response.visita.id_visita;
    inicio = response.visita.inicio ?? inicio ?? new Date().toISOString();
  }

  const nextState = await persistVisitState(current, params, visitaId, inicio, locationData);
  const route = await navigateToNextStep(nextState);
  return { route, state: nextState };
}

function getResumeRoute(state: VisitaEnCursoState): '/visitas/formulario' | '/visitas/solicitantes' | '/visitas/sucursal' | null {
  if (!state.empresaId) return null;
  if (state.solicitantes.length > 0) return '/visitas/formulario';
  if (state.sucursalId) return '/visitas/solicitantes';
  return '/visitas/sucursal';
}

async function persistVisitState(
  current: VisitaEnCursoState,
  params: StartVisitForEmpresaParams,
  visitaId: number,
  inicio?: string | null,
  locationData?: Pick<VisitaEnCursoState, 'coordenadas' | 'direccionVisita'> | null,
) {
  const hasAgenda = typeof params.agendaId === 'number';
  const sameAgenda = hasAgenda && current.agendaId === params.agendaId;
  const sameManualEmpresa = !hasAgenda && current.empresaId === params.empresaId && current.origen !== 'AGENDA';
  const baseState = sameAgenda || sameManualEmpresa ? current : getInitialVisitaState();
  const coordenadas = locationData?.coordenadas ?? params.coordenadas ?? baseState.coordenadas ?? { lat: null, lon: null };
  const direccionVisita = locationData?.direccionVisita ?? params.direccion ?? baseState.direccionVisita ?? '';

  const nextState: VisitaEnCursoState = {
    ...baseState,
    agendaId: hasAgenda ? params.agendaId! : null,
    agendaEstado: hasAgenda ? params.agendaEstado ?? baseState.agendaEstado ?? null : null,
    agendaEmpresaNombre: hasAgenda ? params.empresaNombre : '',
    agendaHoraInicio: hasAgenda ? params.agendaHoraInicio ?? null : null,
    agendaCierrePendiente: sameAgenda ? baseState.agendaCierrePendiente ?? false : false,
    origen: hasAgenda ? 'AGENDA' : 'MANUAL',
    visitaId,
    empresaId: params.empresaId,
    empresaNombre: params.empresaNombre,
    empresaRazonSocial: params.empresaRazonSocial ?? '',
    sucursalId: params.sucursalId ?? baseState.sucursalId ?? null,
    estado: 'en_curso',
    inicio: inicio ?? baseState.inicio ?? new Date().toISOString(),
    direccionVisita,
    coordenadas,
  };

  await saveVisitaState(nextState);
  return nextState;
}

async function navigateToNextStep(state: VisitaEnCursoState): Promise<'/visitas/sucursal' | '/visitas/solicitantes'> {
  if (state.sucursalId) {
    router.push('/visitas/solicitantes');
    return '/visitas/solicitantes';
  }

  const sucursalesResp = await getSucursalesPorEmpresaCached(state.empresaId!);
  const route = (sucursalesResp.sucursales ?? []).length > 0
    ? '/visitas/sucursal'
    : '/visitas/solicitantes';

  router.push(route);
  return route;
}

async function getCurrentVisitLocation(): Promise<Pick<VisitaEnCursoState, 'coordenadas' | 'direccionVisita'> | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) return null;

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = position.coords;
  const direccionVisita = await getDireccionAproximada(latitude, longitude);

  return {
    coordenadas: { lat: latitude, lon: longitude },
    direccionVisita,
  };
}

async function getDireccionAproximada(lat: number, lon: number) {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const parts = [place?.street, place?.streetNumber, place?.district, place?.city, place?.region]
      .filter(Boolean)
      .join(', ');
    return parts || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
}
