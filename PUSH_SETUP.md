# Configuración anterior de Firebase Messaging

Esta configuración usa Cloud Functions y requiere Blaze. No la uses si quieres mantener BabyStock sin facturación. La ruta recomendada es [ANDROID_GRATIS.md](ANDROID_GRATIS.md): Android + OneSignal + Cloudflare Worker gratuito.

1. En Firebase Console abre **Configuración del proyecto > Cloud Messaging**. En **Certificados Web Push**, genera un par de claves y copia la **clave pública**.
2. Pega esa clave en `firebase-config.js`, en `firebaseMessagingVapidKey`. No pegues claves privadas ni cuentas de servicio.
3. En una terminal del proyecto instala Firebase CLI si aún no lo tienes: `npm install -g firebase-tools`. Luego ejecuta `firebase login`.
4. Instala las dependencias del emisor: `cd functions`, `npm install`, vuelve a la carpeta raíz y ejecuta `firebase deploy --only firestore:rules,functions`.
5. Abre BabyStock en cada teléfono, inicia sesión, entra a tu perfil y toca **Activar alertas en este dispositivo**. Cada dispositivo debe aceptar el permiso.

La función `notifyFamilyPost` avisa a los otros integrantes cuando se crea una nota, una compra pendiente o un recuerdo; no alerta al teléfono que publicó. Los tokens vencidos se eliminan automáticamente.

Cloud Functions requiere que el proyecto Firebase tenga la facturación necesaria para desplegar funciones de segunda generación. Firebase Cloud Messaging no cobra por los mensajes enviados.
