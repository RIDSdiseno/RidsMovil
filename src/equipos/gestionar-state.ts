import * as SecureStore from 'expo-secure-store';

import {
  Equipo,
  Solicitante,
} from '@/src/types/api';

const GESTIONAR_EQUIPO_STORAGE_KEY =
  'rids.equipo.gestionar.v2';

export type GestionarEquipoState = {
  equipo: Equipo | null;

  nuevaEmpresaId: number | null;

  nuevoSolicitante: Solicitante | null;

  /*
   * Permite distinguir:
   *
   * false:
   * todavía no se modificó la asignación.
   *
   * true:
   * el usuario entró a cambiar asignación
   * y confirmó una nueva empresa/solicitante,
   * incluso si alguno quedó en null.
   */
  asignacionModificada: boolean;
};

export function getInitialGestionarEquipoState():
  GestionarEquipoState {
  return {
    equipo: null,
    nuevaEmpresaId: null,
    nuevoSolicitante: null,
    asignacionModificada: false,
  };
}

export async function loadGestionarEquipoState():
  Promise<GestionarEquipoState> {
  const raw =
    await SecureStore.getItemAsync(
      GESTIONAR_EQUIPO_STORAGE_KEY,
    );

  if (!raw) {
    return getInitialGestionarEquipoState();
  }

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

export async function saveGestionarEquipoState(
  state: GestionarEquipoState,
) {
  await SecureStore.setItemAsync(
    GESTIONAR_EQUIPO_STORAGE_KEY,
    JSON.stringify(state),
  );
}

export async function clearGestionarEquipoState() {
  await SecureStore.deleteItemAsync(
    GESTIONAR_EQUIPO_STORAGE_KEY,
  );
}