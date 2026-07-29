import { Solicitante, Sucursal } from '@/src/types/api';

export function getSolicitanteId(solicitante: Solicitante) {
  return solicitante.id_solicitante ?? solicitante.id ?? 0;
}

export function getSucursalId(sucursal: Sucursal) {
  return sucursal.id_sucursal ?? sucursal.id ?? 0;
}

export function formatCoords(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) return null;
  return `${lat},${lon}`;
}
