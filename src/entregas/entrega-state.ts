// Estado de entrega en curso (no es secreto: datos de formulario). Se usa
// AsyncStorage en vez de SecureStore para no toparse con el límite de ~2 KB de
// SecureStore en Android cuando hay varios equipos/productos seleccionados.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Cliente, Equipo, Solicitante } from '@/src/types/api';

const ENTREGA_STORAGE_KEY = 'rids.entrega.enCurso.v1';

export type EntregaPhoto = {
  bytes: number;
  formato: string;
  mimeType: string;
  name: string;
  uri: string;
};

export type EntregaBrand = 'rids' | 'econnet';
export type PickUpOperation = 'entrega' | 'retiro';

export type EntregaReceptorManual = {
  nombre: string;
  apellidos: string;
  email: string;
  rut: string;
};

export type RetiroProductoManual = {
  id: string;
  nombre: string;
  descripcion: string;
  cantidad: string;
  serial: string;
};

export type EntregaEnCursoState = {
  brand: EntregaBrand | null;
  empresa: Cliente | null;
  operation: PickUpOperation;
  receptor: Solicitante | null;
  receptorManual: EntregaReceptorManual;
  retiroProductos: RetiroProductoManual[];
  selectedEquipos: Equipo[];
  usarReceptorManual: boolean;
  photo: EntregaPhoto | null;
};

export function getInitialEntregaState(): EntregaEnCursoState {
  return {
    brand: null,
    empresa: null,
    operation: 'entrega',
    receptor: null,
    receptorManual: {
      nombre: '',
      apellidos: '',
      email: '',
      rut: '',
    },
    retiroProductos: [],
    selectedEquipos: [],
    usarReceptorManual: false,
    photo: null,
  };
}

export async function loadEntregaState() {
  const raw = await AsyncStorage.getItem(ENTREGA_STORAGE_KEY);
  if (!raw) return getInitialEntregaState();

  try {
    const parsed = JSON.parse(raw) as Partial<EntregaEnCursoState>;
    const initial = getInitialEntregaState();
    return {
      ...initial,
      ...parsed,
      receptorManual: {
        ...initial.receptorManual,
        ...parsed.receptorManual,
      },
      retiroProductos: Array.isArray(parsed.retiroProductos) ? parsed.retiroProductos : [],
      selectedEquipos: Array.isArray(parsed.selectedEquipos) ? parsed.selectedEquipos : [],
    };
  } catch {
    await clearEntregaState();
    return getInitialEntregaState();
  }
}

export async function saveEntregaState(state: EntregaEnCursoState) {
  await AsyncStorage.setItem(ENTREGA_STORAGE_KEY, JSON.stringify(state));
}

export async function clearEntregaState() {
  await AsyncStorage.removeItem(ENTREGA_STORAGE_KEY);
}

export function getEntregaReceptorNombre(state: EntregaEnCursoState) {
  if (state.usarReceptorManual) {
    return [state.receptorManual.nombre, state.receptorManual.apellidos]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' ');
  }

  return state.receptor?.nombre?.trim() ?? '';
}

export function getEntregaReceptorEmail(state: EntregaEnCursoState) {
  return state.usarReceptorManual ? state.receptorManual.email.trim() : state.receptor?.email?.trim() ?? '';
}

export function getEntregaReceptorRut(state: EntregaEnCursoState) {
  return state.usarReceptorManual ? state.receptorManual.rut.trim() : state.receptor?.rut?.trim() ?? '';
}
