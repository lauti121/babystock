# Publicar BabyStock

## Cloudflare Pages

1. Sube esta carpeta a un repositorio privado de GitHub.
2. En Cloudflare Pages, elige **Create a project > Connect to Git**.
3. Selecciona el repositorio. Framework: **None**; build command: vacío; output directory: `.`.
4. Publica y agrega el dominio `pages.dev` de Cloudflare en Firebase Authentication > Settings > Authorized domains.
5. Copia `firestore.rules` a Firebase Firestore > Rules y publícalas antes de compartir el enlace.

## Correo con Google

Una web estática no puede enviar correos automáticamente de manera segura: requeriría guardar credenciales de Gmail en el navegador, lo cual no es aceptable. La solución segura es un backend autenticado (Firebase Cloud Functions o Google Apps Script autenticado) que reciba alertas de Firestore y use OAuth de Google.

Para activarlo se necesita que el propietario conecte su cuenta/proyecto de Google y autorice el permiso de Gmail. No subas contraseñas, claves de API ni archivos de cuenta de servicio al repositorio. Una vez que indiques si prefieres **Firebase Cloud Functions** o **Google Apps Script**, se puede añadir el backend y el flujo de autorización correspondiente.

## Asistente de stock

Ya funciona desde el navegador: utiliza mínimos configurados y consumos de los últimos 14 días. No envía información familiar a servicios externos.
