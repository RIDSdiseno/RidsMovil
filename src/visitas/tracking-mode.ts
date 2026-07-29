// Modo de captura de ubicación.
//
//   true  -> tarea en segundo plano (TaskManager) + foreground service en
//            Android + permiso "Always" en iOS. Requiere una build nativa
//            (TestFlight en iOS, APK/AAB custom en Android).
//   false -> solo primer plano, sin permiso de background ni notificación
//            persistente. Es el único modo que soporta Expo Go.
//
// IMPORTANTE: para volver a probar en Expo Go hay que ponerlo en `false`, o la
// app fallará al iniciar el tracking (Expo Go no registra tareas en segundo
// plano). En builds de EAS debe quedar en `true`.
export const BACKGROUND_LOCATION_ENABLED = true;
