import Constants, { ExecutionEnvironment } from 'expo-constants';

// Capacidad del entorno: si esta build puede usar ubicación en segundo plano.
// Es una propiedad del binario, no del permiso: que el sistema lo soporte no
// significa que el técnico lo haya concedido. El modo efectivo se resuelve en
// location-tracking según los permisos reales.
//
//   Expo Go (storeClient) -> solo primer plano. Expo Go no puede registrar
//                            tareas en segundo plano ni mostrar el foreground
//                            service de Android, así que pedir background ahí
//                            falla al iniciar el tracking.
//   Build de EAS          -> segundo plano completo (TaskManager + foreground
//                            service en Android + permiso "Always" en iOS).
//
// Se detecta en runtime y no con una bandera manual a propósito: el mismo
// bundle de JS puede publicarse por OTA tanto al canal que usan los técnicos
// en Expo Go como a las builds nativas. Con una bandera fija, cada publicación
// rompía uno de los dos entornos según cómo estuviera puesta.
export const BACKGROUND_LOCATION_SUPPORTED =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
