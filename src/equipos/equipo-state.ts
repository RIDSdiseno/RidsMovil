import * as SecureStore from 'expo-secure-store';

import { Cliente, Solicitante } from '@/src/types/api';

const EQUIPO_STORAGE_KEY = 'rids.equipo.agregar.v1';

export type EquipoNuevoState = {
  empresa: Cliente | null;
  solicitante: Solicitante | null;
};

export function getInitialEquipoState(): EquipoNuevoState {
  return {
    empresa: null,
    solicitante: null,
  };
}

export async function loadEquipoState() {
  const raw = await SecureStore.getItemAsync(EQUIPO_STORAGE_KEY);
  if (!raw) return getInitialEquipoState();

  try {
    return {
      ...getInitialEquipoState(),
      ...(JSON.parse(raw) as Partial<EquipoNuevoState>),
    };
  } catch {
    await clearEquipoState();
    return getInitialEquipoState();
  }
}

export async function saveEquipoState(state: EquipoNuevoState) {
  await SecureStore.setItemAsync(EQUIPO_STORAGE_KEY, JSON.stringify(state));
}

export async function clearEquipoState() {
  await SecureStore.deleteItemAsync(EQUIPO_STORAGE_KEY);
}
