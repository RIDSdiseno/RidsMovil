import * as SecureStore from 'expo-secure-store';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { clearStoredRefreshToken, clearStoredToken, getStoredToken, setSessionExpiredHandler, setStoredRefreshToken, setStoredToken } from '@/src/api/client';
import { invalidateCache } from '@/src/api/cache';
import { getMisVisitasAsignadasHoy, loginMicrosoft, loginTecnico } from '@/src/api/rids';
import { clearEntregaState } from '@/src/entregas/entrega-state';
import { clearEquipoState } from '@/src/equipos/equipo-state';
import { clearGestionarEquipoState } from '@/src/equipos/gestionar-state';
import { Tecnico } from '@/src/types/api';
import { reconcileTrackingForAssignedAgendas } from '@/src/visitas/agenda-tracking-flow';
import { reconcileDailyLocationTracking } from '@/src/visitas/daily-location-tracking';
import { stopAgendaLocationTracking } from '@/src/visitas/location-tracking';
import { flushPendingLocationsForCurrentSession } from '@/src/visitas/offline-location-queue';
import { clearAgendaTrackingContext } from '@/src/visitas/tracking-context';
import { clearVisitaState } from '@/src/visitas/visita-state';

const USER_KEY = 'rids.auth.user';

type AuthContextValue = {
  isLoading: boolean;
  token: string | null;
  tecnico: Tecnico | null;
  isSignedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInMicrosoft: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [tecnico, setTecnico] = useState<Tecnico | null>(null);
  const expirandoRef = useRef(false);

  // Puente desde la capa de API: si el refresh token ya no sirve (sesión
  // realmente expirada), se limpia todo y se vuelve al login automáticamente.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (expirandoRef.current) return;
      expirandoRef.current = true;
      void (async () => {
        try {
          await stopAgendaLocationTracking();
        } catch {
          await clearAgendaTrackingContext().catch(() => undefined);
        }
        // Solo se limpia la sesión. El trabajo en curso (visita, entrega o
        // registro de equipo) se conserva a propósito: la visita ya existe en
        // el servidor en estado pendiente, y borrarla acá la dejaba abierta sin
        // forma de retomarla ni cerrarla. Al volver a entrar el mismo técnico
        // se continúa donde estaba; si entra otro, se descarta en el login.
        await Promise.all([
          clearStoredToken(),
          clearStoredRefreshToken(),
          SecureStore.deleteItemAsync(USER_KEY),
        ]).catch(() => undefined);
        invalidateCache();
        setToken(null);
        setTecnico(null);
        Alert.alert('Sesión expirada', 'Tu sesión expiró. Inicia sesión nuevamente.');
      })();
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    async function hydrate() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          getStoredToken(),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        const parsedUser = storedUser ? JSON.parse(storedUser) as Tecnico : null;
        if (storedToken && parsedUser) await restoreAgendaTracking(parsedUser);
        setToken(storedToken);
        setTecnico(parsedUser);
      } finally {
        setIsLoading(false);
      }
    }

    hydrate();
  }, []);

  useEffect(() => {
    const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;
    if (!token || !tecnicoId) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void flushPendingLocationsForCurrentSession(tecnicoId, { maxPoints: 50 }).catch(() => undefined);
    });

    return () => subscription.remove();
  }, [tecnico, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      token,
      tecnico,
      isSignedIn: Boolean(token),
      async signIn(email: string, password: string) {
        const response = await loginTecnico(email.trim(), password);
        await descartarTrabajoDeOtroTecnico(response.user);
        await setStoredToken(response.token);
        if (response.refreshToken) await setStoredRefreshToken(response.refreshToken);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));
        await restoreAgendaTracking(response.user);
        setToken(response.token);
        setTecnico(response.user);
        expirandoRef.current = false;
      },
      async signInMicrosoft(idToken: string) {
        const response = await loginMicrosoft(idToken);
        await descartarTrabajoDeOtroTecnico(response.user);
        await setStoredToken(response.token);
        if (response.refreshToken) await setStoredRefreshToken(response.refreshToken);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));
        await restoreAgendaTracking(response.user);
        setToken(response.token);
        setTecnico(response.user);
        expirandoRef.current = false;
      },
      async signOut() {
        const tecnicoId = tecnico?.id_tecnico ?? tecnico?.id ?? null;
        await flushBeforeSignOut(tecnicoId);

        try {
          await stopAgendaLocationTracking();
        } catch (error) {
          console.warn('No se pudo detener el tracking antes de cerrar sesión:', error);
          await clearAgendaTrackingContext().catch(() => undefined);
        }

        await Promise.all([
          clearStoredToken(),
          clearStoredRefreshToken(),
          SecureStore.deleteItemAsync(USER_KEY),
          clearVisitaState(),
          clearEntregaState(),
          clearEquipoState(),
          clearGestionarEquipoState(),
        ]);
        invalidateCache();
        setToken(null);
        setTecnico(null);
      },
    }),
    [isLoading, tecnico, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// El trabajo en curso ahora sobrevive a una sesión vencida, así que hay que
// asegurarse de que no lo herede otra persona: si en este teléfono entra un
// técnico distinto al que lo dejó, se descarta.
async function descartarTrabajoDeOtroTecnico(user: Tecnico) {
  const nuevoId = user.id_tecnico ?? user.id ?? null;

  const previoRaw = await SecureStore.getItemAsync(USER_KEY).catch(() => null);
  if (!previoRaw) return;

  let previoId: number | null = null;
  try {
    const previo = JSON.parse(previoRaw) as Tecnico;
    previoId = previo.id_tecnico ?? previo.id ?? null;
  } catch {
    previoId = null;
  }

  if (previoId === null || nuevoId === null || previoId === nuevoId) return;

  await Promise.all([
    clearVisitaState(),
    clearEntregaState(),
    clearEquipoState(),
    clearGestionarEquipoState(),
  ]).catch(() => undefined);
}

async function restoreAgendaTracking(user: Tecnico) {
  const tecnicoId = user.id_tecnico ?? user.id ?? null;
  try {
    const response = await getMisVisitasAsignadasHoy();
    const visitasHoy = response.visitas ?? [];
    await reconcileTrackingForAssignedAgendas(visitasHoy, tecnicoId);
    await reconcileDailyLocationTracking(visitasHoy, tecnicoId).catch((error) => {
      console.warn('[daily-tracking] Error al reconciliar tracking de jornada:', error);
    });
  } catch (error) {
    console.warn(
      '[tracking] No se pudo reconciliar la agenda al restaurar la sesión:',
      error instanceof Error ? error.message : 'error desconocido',
    );
  } finally {
    void flushPendingLocationsForCurrentSession(tecnicoId, { maxPoints: 50 }).catch(() => undefined);
  }
}

async function flushBeforeSignOut(tecnicoId: number | null) {
  if (!tecnicoId) return;

  await Promise.race([
    flushPendingLocationsForCurrentSession(tecnicoId, { maxPoints: 50, timeoutMs: 5_000 }),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]).catch(() => undefined);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
