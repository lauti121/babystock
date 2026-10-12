# BabyStock Android y notificaciones sin Blaze

Esta ruta evita Firebase Functions y no requiere tarjeta para Firebase. La aplicación Android usa Capacitor; los avisos usan OneSignal en su plan gratuito y un Cloudflare Worker que protege la llave privada de envío.

## 1. Crear la aplicación OneSignal

1. Regístrate en [OneSignal](https://onesignal.com/) y crea una aplicación **Mobile Push** llamada `BabyStock`.
2. Agrega la plataforma **Android (FCM)**. OneSignal te pedirá las credenciales de Firebase Cloud Messaging: súbelas solamente en el panel de OneSignal. **Nunca** copies la cuenta de servicio a este repositorio ni la pegues en la app.
3. Copia el **App ID** público de OneSignal y pégalo en `notifications-config.js`, en `oneSignalAppId`.

## 1.1 Registrar el APK en Firebase

1. En Firebase Console abre **Configuración del proyecto** y pulsa **Agregar app > Android**.
2. Escribe exactamente este identificador: `com.babystock.familia`.
3. Descarga `google-services.json` y guárdalo en `android/app/google-services.json`. Este archivo está ignorado por Git.
4. Para que Google funcione dentro del APK, añade la huella SHA-1 de la firma de depuración a esa aplicación Android en Firebase y vuelve a descargar `google-services.json`. Android Studio muestra esa huella con la tarea Gradle `signingReport`.

## 2. Desplegar el Worker en Cloudflare

Desde la carpeta `worker`, inicia sesión una vez y crea los dos secretos. Sustituye los valores por los que entrega OneSignal:

```powershell
cd worker
npx wrangler login
npx wrangler secret put ONESIGNAL_APP_ID
npx wrangler secret put ONESIGNAL_REST_API_KEY
npx wrangler deploy
```

Cloudflare mostrará una URL como `https://babystock-alerts.tu-cuenta.workers.dev`. Cópiala en `notifications-config.js`, en `workerUrl`.

El Worker recibe el token de inicio de sesión de Firebase y consulta Firestore con ese mismo token. Por tanto, solo un integrante autorizado de la familia puede pedir avisos para esa familia. La llave REST de OneSignal queda guardada como secreto de Cloudflare y no viaja a los teléfonos.

## 3. Publicar la configuración web

```powershell
cd ..
git add .
git commit -m "Preparar app Android y alertas gratuitas"
git push
firebase deploy --only firestore:rules
```

Espera que Cloudflare Pages termine su despliegue antes de instalar un APK nuevo.

## 4. Generar la aplicación Android

Instala Android Studio y, durante la instalación, acepta Android SDK y las herramientas de plataforma. Si Gradle muestra `SDK location not found`, abre Android Studio una vez, entra a **More Actions > SDK Manager**, instala una plataforma Android (API 36 o posterior) y vuelve a ejecutar la compilación. Luego, desde la raíz de BabyStock:

```powershell
npm install
npx cap add android
npm run sync:android
npm run open:android
```

Android Studio abrirá el proyecto. Conecta un teléfono Android por USB con depuración activada, o crea un emulador, y usa el botón verde **Run**. Para crear un APK instalable: **Build > Build APK(s)**. Android Studio indicará dónde quedó `app-debug.apk`.

También puedes compilar desde PowerShell, después de que Android Studio haya instalado el SDK:

```powershell
cd android
.\gradlew.bat assembleDebug
```

El APK quedará en `android/app/build/outputs/apk/debug/app-debug.apk`.

## 5. Activar alertas

Instalen el APK en ambos teléfonos, entren con su cuenta y abran el perfil. Pulsen **Activar alertas en este dispositivo** y acepten el permiso de Android. Cada miembro recibe un identificador privado por familia, por lo que no se mezclan familias distintas.

## Prueba

En el teléfono A publica una nota en **Familia** o deja un producto bajo su mínimo. El teléfono B debe recibir el aviso incluso con BabyStock cerrada. La primera prueba requiere conexión y que ambos hayan abierto la app al menos una vez para registrarse en OneSignal.
