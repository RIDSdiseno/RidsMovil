import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {
  Equipo,
  Solicitante,
} from '@/src/types/api';

// Se guarda en AsyncStorage y no en SecureStore: no hay nada secreto (es el
// equipo que se está editando) y SecureStore avisa a partir de 2048 bytes en
// Android, límite que este estado supera porque incluye el equipo completo
// -unos cuarenta campos- más su lista de adicionales. Al superarlo la escritura
// falla y se pierde la edición en curso.

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

async function leerCrudo() {
  const raw = await AsyncStorage.getItem(GESTIONAR_EQUIPO_STORAGE_KEY).catch(() => null);
  if (raw) return raw;

  // Migración puntual desde SecureStore, para no perder una edición en curso
  // al actualizar la aplicación.
  const heredado = await SecureStore.getItemAsync(GESTIONAR_EQUIPO_STORAGE_KEY).catch(() => null);
  if (!heredado) return null;

  try {
    await AsyncStorage.setItem(GESTIONAR_EQUIPO_STORAGE_KEY, heredado);
    await SecureStore.deleteItemAsync(GESTIONAR_EQUIPO_STORAGE_KEY).catch(() => undefined);
  } catch {
    // Si la migración falla se usa igual el valor leído: no se pierde nada.
  }

  return heredado;
}

export async function loadGestionarEquipoState():
  Promise<GestionarEquipoState> {
  const raw = await leerCrudo();

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
  try {
    await AsyncStorage.setItem(
      GESTIONAR_EQUIPO_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch (error) {
    console.error('[equipos] No se pudo guardar el equipo en edición:', error);
    throw new Error('No se pudo guardar el avance de la edición en este dispositivo.');
  }
}

export async function clearGestionarEquipoState() {
  await AsyncStorage.removeItem(GESTIONAR_EQUIPO_STORAGE_KEY).catch(() => undefined);
  // Se limpia también el origen antiguo por si quedó algo sin migrar.
  await SecureStore.deleteItemAsync(GESTIONAR_EQUIPO_STORAGE_KEY).catch(() => undefined);
}