import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  agregarEmpresaFavorita,
  eliminarEmpresaFavorita,
  getEmpresasFavoritas,
} from '@/src/api/rids';
import type { Cliente, EmpresaFavorita } from '@/src/types/api';

const LEGACY_KEY = 'rids.visitas.empresasFavoritas';
const STORAGE_PREFIX = 'rids.empresas.favoritas.v2';

export type EmpresaOrigen = EmpresaFavorita['origen'];

export function getEmpresaFavoritaKey(
  empresa: Pick<Cliente, 'id_empresa' | 'origen'>,
  fallbackOrigen: EmpresaOrigen = 'RIDS',
) {
  return `${normalizarOrigen(empresa.origen, fallbackOrigen)}:${empresa.id_empresa}`;
}

export function ordenarEmpresasConFavoritas(
  empresas: Cliente[],
  favoritos: ReadonlySet<string>,
  fallbackOrigen: EmpresaOrigen = 'RIDS',
) {
  return [...empresas].sort((a, b) => {
    const aFavorita = favoritos.has(getEmpresaFavoritaKey(a, fallbackOrigen));
    const bFavorita = favoritos.has(getEmpresaFavoritaKey(b, fallbackOrigen));
    if (aFavorita !== bFavorita) return aFavorita ? -1 : 1;
    return a.nombre.localeCompare(b.nombre);
  });
}

export function useEmpresasFavoritas(tecnicoId: number | null | undefined) {
  const [keys, setKeys] = useState<string[]>([]);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const keysRef = useRef(keys);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(new Set<string>());

  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);

  const sincronizar = useCallback(async () => {
    if (!tecnicoId) {
      setKeys([]);
      return [];
    }

    const { keys: locales, legacyKeys } = await readLocal(tecnicoId);
    setKeys(locales);

    try {
      const response = await getEmpresasFavoritas();
      const remotas = normalizarFavoritos(response.favoritos);
      const finales = legacyKeys.length > 0
        ? Array.from(new Set([...remotas, ...legacyKeys]))
        : remotas;
      const faltantesRemotos = legacyKeys.filter((key) => !remotas.includes(key));

      if (faltantesRemotos.length > 0) {
        await Promise.all(faltantesRemotos.map((key) => agregarEmpresaFavorita(fromKey(key))));
      }

      if (legacyKeys.length > 0) await AsyncStorage.removeItem(LEGACY_KEY);
      await writeLocal(tecnicoId, finales);
      setKeys(finales);
      return finales;
    } catch {
      return locales;
    }
  }, [tecnicoId]);

  useEffect(() => {
    void sincronizar();
  }, [sincronizar]);

  const favoritos = useMemo(() => new Set(keys), [keys]);
  const pendientes = useMemo(() => new Set(pendingKeys), [pendingKeys]);

  const toggleFavorita = useCallback(async (
    empresa: Pick<Cliente, 'id_empresa' | 'origen'>,
    fallbackOrigen: EmpresaOrigen = 'RIDS',
  ) => {
    if (!tecnicoId) throw new Error('No se encontró el técnico autenticado.');

    const key = getEmpresaFavoritaKey(empresa, fallbackOrigen);
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    setPendingKeys((current) => Array.from(new Set([...current, key])));

    const mutation = mutationQueueRef.current.then(async () => {
      const anteriores = keysRef.current;
      const eraFavorita = anteriores.includes(key);
      const siguientes = eraFavorita
        ? anteriores.filter((item) => item !== key)
        : [...anteriores, key];

      keysRef.current = siguientes;
      setKeys(siguientes);
      await writeLocal(tecnicoId, siguientes);

      try {
        const favorito = fromKey(key);
        if (eraFavorita) await eliminarEmpresaFavorita(favorito);
        else await agregarEmpresaFavorita(favorito);
      } catch (error) {
        keysRef.current = anteriores;
        setKeys(anteriores);
        await writeLocal(tecnicoId, anteriores);
        throw error;
      } finally {
        pendingRef.current.delete(key);
        setPendingKeys((current) => current.filter((item) => item !== key));
      }
    });

    mutationQueueRef.current = mutation.catch(() => undefined);
    return mutation;
  }, [tecnicoId]);

  return {
    favoritos,
    isFavorita: (empresa: Pick<Cliente, 'id_empresa' | 'origen'>, fallback: EmpresaOrigen = 'RIDS') =>
      favoritos.has(getEmpresaFavoritaKey(empresa, fallback)),
    isPending: (empresa: Pick<Cliente, 'id_empresa' | 'origen'>, fallback: EmpresaOrigen = 'RIDS') =>
      pendientes.has(getEmpresaFavoritaKey(empresa, fallback)),
    sincronizar,
    toggleFavorita,
  };
}

function normalizarOrigen(value: string | null | undefined, fallback: EmpresaOrigen): EmpresaOrigen {
  return String(value ?? fallback).toUpperCase() === 'ECONNET' ? 'ECONNET' : 'RIDS';
}

function fromKey(key: string): EmpresaFavorita {
  const [origen, empresaId] = key.split(':');
  return {
    empresaId: Number(empresaId),
    origen: normalizarOrigen(origen, 'RIDS'),
  };
}

function normalizarFavoritos(favoritos: EmpresaFavorita[]) {
  return favoritos
    .filter((item) => Number.isInteger(item.empresaId) && item.empresaId > 0)
    .map((item) => `${normalizarOrigen(item.origen, 'RIDS')}:${item.empresaId}`);
}

async function readLocal(tecnicoId: number) {
  const storageKey = `${STORAGE_PREFIX}.${tecnicoId}`;
  const raw = await AsyncStorage.getItem(storageKey);
  let keys: string[] = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) keys = parsed.filter((key): key is string => typeof key === 'string');
    } catch {
      await AsyncStorage.removeItem(storageKey);
    }
  }

  const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
  if (!legacyRaw) return { keys, legacyKeys: [] };

  try {
    const legacy = JSON.parse(legacyRaw);
    const legacyKeys = Array.isArray(legacy)
      ? legacy.map(Number).filter((id) => Number.isInteger(id) && id > 0).map((id) => `RIDS:${id}`)
      : [];
    keys = Array.from(new Set([...keys, ...legacyKeys]));
    await writeLocal(tecnicoId, keys);
    return { keys, legacyKeys };
  } catch {
    await AsyncStorage.removeItem(LEGACY_KEY);
    return { keys, legacyKeys: [] };
  }
}

function writeLocal(tecnicoId: number, keys: string[]) {
  return AsyncStorage.setItem(`${STORAGE_PREFIX}.${tecnicoId}`, JSON.stringify(Array.from(new Set(keys))));
}
