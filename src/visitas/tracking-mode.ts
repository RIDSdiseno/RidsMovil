import Constants, { ExecutionEnvironment } from 'expo-constants';

// Modo de captura de ubicación, resuelto en tiempo de ejecución según dónde
// corre la app:
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
export const BACKGROUND_LOCATION_ENABLED =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
