// Configuración PÚBLICA de notificaciones.
// No pegues claves REST, cuentas de servicio ni contraseñas aquí.
// Crea la app en OneSignal y pega su App ID. Luego despliega el Worker y pega su URL.
export const notificationsConfig = {
  oneSignalAppId: "7f344df7-17dd-42ea-903c-d22f12a870e4",
  workerUrl: "https://babystock-alerts.lbecerraocaranza.workers.dev"
};

export const notificationsAreConfigured = !notificationsConfig.oneSignalAppId.startsWith("PEGA_AQUI") &&
  !notificationsConfig.workerUrl.startsWith("PEGA_AQUI");
