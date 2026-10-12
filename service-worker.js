// Caché exclusiva de la PWA. Las alertas Android se reciben de forma nativa mediante OneSignal.
const CACHE = "babystock-v11";
const ASSETS = ["./", "./index.html", "./style.css", "./script.js?v=20261012-mobile", "./firebase-config.js", "./notifications-config.js", "./manifest.json", "./icons/icon.svg"];

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const currentCode = event.request.mode === "navigate" || ["/index.html", "/script.js", "/style.css", "/firebase-config.js", "/notifications-config.js"].some((path) => url.pathname.endsWith(path));
  event.respondWith(currentCode ? fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request)) : caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
