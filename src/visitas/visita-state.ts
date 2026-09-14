import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { ActividadesVisita, Coordenadas, Solicitante, VisitaAsignada } from '@/src/types/api';

// La visita en curso se guarda en AsyncStorage y no en SecureStore: no hay nada
// secreto (son datos de formulario) y SecureStore tiene un límite de ~2 KB en
// Android que este estado supera con varios solicitantes. Al superarlo la
// escritura fallaba y la visita desaparecía a mitad de camino, dejándola
// abierta en el servidor sin forma de retomarla. Los módulos de entregas y
// equipos ya habían migrado por el mismo motivo.
const VISITA_STORAGE_KEY = 'rids.visita.enCurso.v1';

export type VisitaEnCursoState = {
  agendaId?: number | null;
  agendaEstado?: string | null;
  agendaEmpresaNombre?: string;
  agendaHoraInicio?: string | null;
  agendaCierrePendiente?: boolean;
  origen?: 'MANUAL' | 'AGENDA';
  visitaId: number | null;
  empresaId: number | null;
  empresaNombre: string;
  empresaRazonSocial: string;
  sucursalId: number | null;
  solicitantes: Solicitante[];
  actividades: ActividadesVisita;
  otrosDetalle: string;
  realizado: string;
  inicio: string | null;
  estado: 'sin_iniciar' | 'en_curso';
  direccionVisita: string;
  coordenadas: Coordenadas;
};

export const defaultActividades: Required<ActividadesVisita> = {
  impresoras: false,
  telefonos: false,
  pie: false,
  otros: true,
  ccleaner: true,
  actualizaciones: true,
  antivirus: true,
  estadoDisco: true,
  licenciaWindows: true,
  licenciaOffice: true,
  rendimientoEquipo: true,
  mantenimientoReloj: false,
  ecografo: false,
};

export function getInitialVisitaState(): VisitaEnCursoState {
  return {
    agendaId: null,
    agendaEstado: null,
    agendaEmpresaNombre: '',
    agendaHoraInicio: null,
    agendaCierrePendiente: false,
    origen: 'MANUAL',
    visitaId: null,
    empresaId: null,
    empresaNombre: '',
    empresaRazonSocial: '',
    sucursalId: null,
    solicitantes: [],
    actividades: defaultActividades,
    otrosDetalle: '',
    realizado: '',
    inicio: null,
    estado: 'sin_iniciar',
    direccionVisita: '',
    coordenadas: { lat: null, lon: null },
  };
}

export async function prepareAgendaVisitaState(visita: VisitaAsignada) {
  const current = await loadVisitaState();
  const empresaId = typeof visita.empresa?.id_empresa === 'number' ? visita.empresa.id_empresa : null;

  if (!empresaId) {
    throw new Error('Esta visita no tiene una empresa registrada para abrir el formulario.');
  }

  const empresaNombre = visita.empresa?.nombre ?? visita.empresa?.razonSocial ?? 'Empresa no registrada';
  const coordenadas =
    typeof visita.latitud === 'number' && typeof visita.longitud === 'number'
      ? { lat: visita.latitud, lon: visita.longitud }
      : current.agendaId === visita.agendaId
        ? current.coordenadas
        : { lat: null, lon: null };

  const baseState = current.agendaId === visita.agendaId
    ? current
    : {
        ...getInitialVisitaState(),
        solicitantes: [],
        sucursalId: visita.sucursal?.id_sucursal ?? null,
      };

  const nextState: VisitaEnCursoState = {
    ...baseState,
    agendaId: visita.agendaId,
    agendaEstado: visita.estado,
    agendaEmpresaNombre: empresaNombre,
    agendaHoraInicio: visita.horaInicio ?? visita.horaProgramada ?? null,
    agendaCierrePendiente: baseState.agendaCierrePendiente ?? false,
    origen: 'AGENDA',
    visitaId: visita.visitaId ?? baseState.visitaId ?? null,
    empresaId,
    empresaNombre,
    empresaRazonSocial: visita.empresa?.razonSocial ?? baseState.empresaRazonSocial ?? '',
    estado: 'en_curso',
    inicio: baseState.inicio ?? visita.fechaInicioVisita ?? new Date().toISOString(),
    direccionVisita: baseState.direccionVisita || visita.direccion || visita.sucursal?.direccion || '',
    coordenadas,
  };

  await saveVisitaState(nextState);
  return nextState;
}

async function readRaw() {
  const raw = await AsyncStorage.getItem(VISITA_STORAGE_KEY).catch(() => null);
  if (raw) return raw;

  // Migración puntual desde SecureStore: sin esto, una visita en curso al
  // momento de actualizar la app se perdería, que es justo lo que se quiere
  // evitar. Se traslada y se borra el origen para no volver a leerlo.
  const heredado = await SecureStore.getItemAsync(VISITA_STORAGE_KEY).catch(() => null);
  if (!heredado) return null;

  try {
    await AsyncStorage.setItem(VISITA_STORAGE_KEY, heredado);
    await SecureStore.deleteItemAsync(VISITA_STORAGE_KEY).catch(() => undefined);
  } catch {
    // Si la migración falla se sigue usando el valor leído: no se pierde nada.
  }

  return heredado;
}

export async function loadVisitaState() {
  const raw = await readRaw();
  if (!raw) return getInitialVisitaState();

  try {
    const parsed = JSON.parse(raw) as Partial<VisitaEnCursoState>;

    return {
      ...getInitialVisitaState(),
      ...parsed,
      actividades: {
        ...defaultActividades,
        ...(parsed.actividades ?? {}),
      },
      coordenadas: parsed.coordenadas ?? { lat: null, lon: null },
      solicitantes: Array.isArray(parsed.solicitantes) ? parsed.solicitantes : [],
    };
  } catch {
    await clearVisitaState();
    return getInitialVisitaState();
  }
}

export async function saveVisitaState(state: VisitaEnCursoState) {
  try {
    await AsyncStorage.setItem(VISITA_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Antes este fallo pasaba inadvertido y la visita quedaba abierta en el
    // servidor sin rastro local. Se propaga para que la pantalla lo informe.
    console.error('[visita] No se pudo guardar la visita en curso:', error);
    throw new Error('No se pudo guardar el avance de la visita en este dispositivo.');
  }
}

export async function clearVisitaState() {
  await AsyncStorage.removeItem(VISITA_STORAGE_KEY).catch(() => undefined);
  // Se limpia también el origen antiguo por si quedó algo sin migrar.
  await SecureStore.deleteItemAsync(VISITA_STORAGE_KEY).catch(() => undefined);
}
