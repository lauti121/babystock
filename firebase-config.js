// Copia aquí la configuración que entrega Firebase Console > Configuración del proyecto > Tus apps > Web.
// Este archivo no contiene credenciales reales y puede mantenerse público.
export const firebaseConfig = {
    apiKey: "AIzaSyAn2cNligZrAV65_IIWrS8v1LZ0fifOL34",
    authDomain: "babystock-6789b.firebaseapp.com",
    projectId: "babystock-6789b",
    storageBucket: "babystock-6789b.firebasestorage.app",
    messagingSenderId: "356990647288",
    appId: "1:356990647288:web:79ca862b83134a3d40b40d"
};
// Firebase Console > Configuración del proyecto > Cloud Messaging > Certificados Web Push.
// Esta es una clave PÚBLICA; no pegues aquí claves privadas ni cuentas de servicio.
export const firebaseMessagingVapidKey = "PEGA_AQUI_LA_CLAVE_PUBLICA_VAPID";
export const firebaseIsConfigured = !firebaseConfig.apiKey.startsWith("PEGA_AQUI") &&
  !firebaseConfig.projectId.startsWith("TU_PROYECTO");
export const firebaseMessagingIsConfigured = firebaseIsConfigured &&
  !firebaseMessagingVapidKey.startsWith("PEGA_AQUI");
