// Estado de gestión de equipo en curso (no es secreto). Se usa AsyncStorage en
// vez de SecureStore para evitar el límite de ~2 KB de SecureStore en Android.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Equipo, Solicitante } from '@/src/types/api';

const GESTIONAR_EQUIPO_STORAGE_KEY = 'rids.equipo.gestionar.v1';

export type GestionarEquipoState = {
  equipo: Equipo | null;
  nuevoSolicitante: Solicitante | null;
};

export function getInitialGestionarEquipoState(): GestionarEquipoState {
  return {
    equipo: null,
    nuevoSolicitante: null,
  };
}

export async function loadGestionarEquipoState() {
  const raw = await AsyncStorage.getItem(GESTIONAR_EQUIPO_STORAGE_KEY);
  if (!raw) return getInitialGestionarEquipoState();

  try {
    return {
      ...getInitialGestionarEquipoState(),
      ...(JSON.parse(raw) as Partial<GestionarEquipoState>),
    };
  } catch {
    await clearGestionarEquipoState();
    return getInitialGestionarEquipoState();
  }
}

export async function saveGestionarEquipoState(state: GestionarEquipoState) {
  await AsyncStorage.setItem(GESTIONAR_EQUIPO_STORAGE_KEY, JSON.stringify(state));
}

export async function clearGestionarEquipoState() {
  await AsyncStorage.removeItem(GESTIONAR_EQUIPO_STORAGE_KEY);
}
