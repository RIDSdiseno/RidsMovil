import * as SecureStore from 'expo-secure-store';

import { API_URL } from './config';

const TOKEN_KEY = 'rids.auth.token';
const REFRESH_TOKEN_KEY = 'rids.auth.refreshToken';

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getStoredRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setStoredRefreshToken(token: string) {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearStoredRefreshToken() {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// Handler que se invoca cuando la sesión expira de verdad (el refresh token ya
// no sirve). Lo registra AuthContext para cerrar sesión y llevar al login.
// OJO: solo se llama ante refresh inválido/expirado, NO ante error de red.
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

// Un único refresh en vuelo: si varias peticiones reciben 401 a la vez, todas
// esperan el mismo intento de renovación en lugar de disparar varios.
let refreshInFlight: Promise<string | null> | null = null;

// Exportada para que la cola de ubicaciones pueda renovar la sesión desde la
// tarea en segundo plano: ahí no se pasa por apiRequest, así que sin esto un
// access token vencido dejaba la cola pausada hasta reabrir la app.
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) {
      // 401 sin refresh token: no hay forma de renovar, la sesión terminó.
      await clearStoredToken();
      sessionExpiredHandler?.();
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh inválido/expirado/revocado: se limpia y se avisa a la app.
        await clearStoredToken();
        await clearStoredRefreshToken();
        sessionExpiredHandler?.();
        return null;
      }

      const data = await response.json().catch(() => null);
      if (!data?.token) {
        await clearStoredToken();
        await clearStoredRefreshToken();
        sessionExpiredHandler?.();
        return null;
      }

      await setStoredToken(data.token);
      if (data.refreshToken) await setStoredRefreshToken(data.refreshToken);
      return data.token as string;
    } catch {
      // Error de red: no se borra la sesión, se reintentará más adelante.
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiRequestInternal<T>(path, options, false);
}

async function apiRequestInternal<T>(path: string, options: RequestOptions, isRetry: boolean): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false) {
    const token = await getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(`No se pudo conectar con la API. Revisa EXPO_PUBLIC_API_URL.`);
  }

  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  let data: any = null;
  if (text && isJson) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`La API devolvió una respuesta inválida (${response.status}).`);
    }
  }

  if (text && !isJson) {
    throw new Error(
      `La API no respondio JSON. Revisa EXPO_PUBLIC_API_URL (${response.status}).`,
    );
  }

  if (response.status === 401) {
    // No intentar refresh para los propios endpoints de sesión ni en un reintento.
    const esRutaSesion =
      path.startsWith('/auth/refresh') ||
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/microsoft');

    if (options.auth !== false && !isRetry && !esRutaSesion) {
      const nuevoToken = await refreshAccessToken();
      if (nuevoToken) {
        return apiRequestInternal<T>(path, options, true);
      }
    }
    throw new Error(data?.message || data?.error || 'Tu sesión expiró. Vuelve a iniciar sesión.');
  }

  if (!response.ok) {
    const message = data?.message || data?.error || 'No se pudo completar la solicitud.';
    throw new Error(message);
  }

  return data as T;
}
