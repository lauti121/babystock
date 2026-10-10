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
export const firebaseIsConfigured = !firebaseConfig.apiKey.startsWith("PEGA_AQUI") &&
  !firebaseConfig.projectId.startsWith("TU_PROYECTO");
