export const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const INTRANET_API_URL = process.env.EXPO_PUBLIC_INTRANET_API_URL;

if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL no esta configurada.');
}
