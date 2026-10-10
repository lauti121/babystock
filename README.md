# BabyStock

Aplicación web móvil/PWA para gestionar el inventario familiar de pañales, toallitas y otros productos de bebé.

## Estructura y datos

```text
families/{familyId}
  babies/{babyId}
  products/{productId}       # Incluye babyId, cantidad y mínimo
  movements/{movementId}     # Historial inmutable de cada cambio
```

Un producto se **archiva** en lugar de eliminarse de Firestore. El historial permanece intacto.

## Probarla localmente

Haz doble clic en `iniciar-prueba.cmd`. Se abrirá una ventana negra que indicará la dirección de prueba. Sin cerrarla, abre `http://127.0.0.1:4173` en Chrome o Edge y selecciona **Probar con datos de ejemplo**. Incluye pañales M, pañales G y toallitas húmedas, y guarda los cambios en el navegador.

Como alternativa, abre `index.html` con un servidor local, por ejemplo mediante la extensión **Live Server** de VS Code.

## Conectar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Añade una aplicación **Web** y copia su configuración en `firebase-config.js`.
3. En **Authentication > Sign-in method**, activa **Correo electrónico/contraseña**.
4. En **Firestore Database**, crea una base de datos en modo producción.
5. Copia el contenido de `firestore.rules` en la pestaña **Rules** de Firestore y publícalo.
6. Recarga la aplicación. Ahora puedes crear una cuenta de familia y usar la misma cuenta de correo en ambos teléfonos para compartir el inventario.

> La configuración web de Firebase identifica el proyecto, pero las reglas de Firestore y Authentication son las que protegen los datos. No uses el modo de prueba de Firestore en producción.

## Publicar en Cloudflare Pages

1. Sube estos archivos a un repositorio GitHub (no subas secretos adicionales; el archivo de configuración web es habitual en aplicaciones Firebase).
2. En [Cloudflare Pages](https://pages.cloudflare.com/), selecciona **Create a project > Connect to Git**.
3. Elige el repositorio. Como es HTML estático, usa `Ninguno` como framework y deja vacío el comando de compilación.
4. Define el directorio de salida como `.` y publica.
5. En Firebase Authentication > Settings > Authorized domains, agrega el dominio `*.pages.dev` que te entregue Cloudflare.

Para instalarla en Android, abre la URL publicada en Chrome y elige **Instalar aplicación** o **Añadir a pantalla de inicio**.
