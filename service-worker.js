// Cache de la PWA y receptor de Firebase Cloud Messaging en segundo plano.
importScripts("./firebase-messaging-config.js");
if (self.BABYSTOCK_FIREBASE_CONFIG?.apiKey) {
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
  firebase.initializeApp(self.BABYSTOCK_FIREBASE_CONFIG);
  firebase.messaging().onBackgroundMessage((payload) => {
    const title = payload?.data?.title || payload?.notification?.title || "BabyStock";
    const options = { body: payload?.data?.body || payload?.notification?.body || "Tienes una actualización familiar.", icon: "./icons/icon.svg", badge: "./icons/icon.svg", data: { link: payload?.fcmOptions?.link || "./" }, tag: "babystock-family" };
    self.registration.showNotification(title, options);
  });
}

const CACHE = "babystock-v10";
const ASSETS = ["./", "./index.html", "./style.css", "./script.js?v=20261011-push", "./firebase-config.js", "./firebase-messaging-config.js", "./manifest.json", "./icons/icon.svg"];

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const currentCode = event.request.mode === "navigate" || ["/index.html", "/script.js", "/style.css", "/firebase-config.js", "/firebase-messaging-config.js"].some((path) => url.pathname.endsWith(path));
  event.respondWith(currentCode ? fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request)) : caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.link || "./")); });
