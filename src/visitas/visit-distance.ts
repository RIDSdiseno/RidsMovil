import * as Location from 'expo-location';

import { VisitaAsignada } from '@/src/types/api';

const EARTH_RADIUS_METERS = 6_371_000;

export function hasVisitCoordinates(visita: VisitaAsignada) {
  return typeof visita.latitud === 'number' && typeof visita.longitud === 'number';
}

export async function getDistanceFromCurrentLocation(visita: VisitaAsignada) {
  if (!hasVisitCoordinates(visita)) return null;

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  }).catch(() => null);

  if (!position) return null;

  return getDistanceMeters(
    position.coords.latitude,
    position.coords.longitude,
    visita.latitud as number,
    visita.longitud as number,
  );
}

export function getDistanceMeters(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const fromLatRad = toRadians(fromLat);
  const toLatRad = toRadians(toLat);
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLatRad) * Math.cos(toLatRad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceMeters(distance: number) {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1).replace('.', ',')} km`;
  }

  return `${Math.round(distance)} metros`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
