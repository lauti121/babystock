// Configuración PÚBLICA de notificaciones.
// No pegues claves REST, cuentas de servicio ni contraseñas aquí.
// Crea la app en OneSignal y pega su App ID. Luego despliega el Worker y pega su URL.
export const notificationsConfig = {
  oneSignalAppId: "PEGA_AQUI_EL_APP_ID_DE_ONESIGNAL",
  workerUrl: "PEGA_AQUI_LA_URL_DEL_WORKER_DE_CLOUDFLARE"
};

export const notificationsAreConfigured = !notificationsConfig.oneSignalAppId.startsWith("PEGA_AQUI") &&
  !notificationsConfig.workerUrl.startsWith("PEGA_AQUI");
