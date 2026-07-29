// Opciones compartidas entre "Agregar equipo" y "Gestionar equipo > editar".
// Deben coincidir exactamente con los enums TipoEquipo/EstadoEquipo de Prisma
// (ambos backends) y con los 3 valores de "propiedad" que aceptan.

export type PropiedadEquipo = 'Empresa' | 'Personal' | 'Externo';

export const TIPO_EQUIPO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'GENERICO', label: 'Genérico' },
  { value: 'NOTEBOOK', label: 'Notebook' },
  { value: 'ALL_IN_ONE', label: 'All in One' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'CPU', label: 'CPU' },
  { value: 'EQUIPO_ARMADO', label: 'Equipo Armado' },
  { value: 'IMPRESORA', label: 'Impresora' },
  { value: 'SCANNER', label: 'Scanner' },
  { value: 'LASER', label: 'Láser' },
  { value: 'LED', label: 'LED' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'NAS', label: 'NAS' },
  { value: 'ROUTER', label: 'Router' },
  { value: 'DISCO_DURO_EXTERNO', label: 'Disco Duro Externo' },
  { value: 'CARGADOR', label: 'Cargador' },
  { value: 'INSUMOS_COMPUTACIONALES', label: 'Insumos Computacionales' },
  { value: 'RELOJ_CONTROL', label: 'Reloj Control' },
  { value: 'OTRO', label: 'Otro' },
];

export const ESTADO_EQUIPO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'EN_STOCK', label: 'En stock' },
  { value: 'DADO_DE_BAJA', label: 'Dado de baja' },
  { value: 'EN_RIDS', label: 'En RIDS' },
  { value: 'EN_GARANTIA', label: 'En garantía' },
  { value: 'EN_TALLER_EXTERNO', label: 'En taller externo' },
];

export const PROPIEDAD_EQUIPO_OPTIONS: Array<{ value: PropiedadEquipo; label: string }> = [
  { value: 'Empresa', label: 'Empresa' },
  { value: 'Personal', label: 'Personal' },
  { value: 'Externo', label: 'Externo' },
];

// Tipos de equipo que, en la intranet, no requieren procesador/RAM/disco.
export const TIPOS_SIN_ESPECIFICACIONES = new Set([
  'IMPRESORA', 'SCANNER', 'LASER', 'LED', 'MONITOR', 'ROUTER',
  'CARGADOR', 'INSUMOS_COMPUTACIONALES', 'RELOJ_CONTROL', 'OTRO',
]);

export const MARCAS_SUGERIDAS = ['ACER', 'APPLE', 'ASUS', 'CHUWI', 'DELL', 'HP', 'HUAWEI', 'LENOVO', 'MSI', 'SAMSUNG'];
export const PROCESADORES_SUGERIDOS = [
  'Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9',
  'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'Apple M1', 'Apple M2', 'Apple M3',
];

export function labelDeTipoEquipo(value?: string | null) {
  return TIPO_EQUIPO_OPTIONS.find((o) => o.value === value)?.label ?? value ?? 'Sin definir';
}

export function labelDeEstadoEquipo(value?: string | null) {
  return ESTADO_EQUIPO_OPTIONS.find((o) => o.value === value)?.label ?? value ?? 'Sin definir';
}
