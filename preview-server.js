// Servidor local para probar BabyStock en tu propio navegador.
// Inícialo con doble clic en "iniciar-prueba.cmd".
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

http.createServer((request, response) => {
  const relative = request.url === "/" ? "index.html" : decodeURIComponent(request.url).replace(/^[/\\]+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root)) { response.writeHead(403); response.end("Acceso no permitido"); return; }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404); response.end("Archivo no encontrado"); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    response.end(content);
  });
}).listen(4173, "127.0.0.1", () => {
  console.log("BabyStock está disponible en: http://127.0.0.1:4173");
  console.log("No cierres esta ventana mientras estés probando la aplicación.");
});
