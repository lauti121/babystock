import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const rootFiles = [
  "index.html", "style.css", "script.js", "firebase-config.js", "firebase-messaging-config.js",
  "notifications-config.js", "manifest.json", "service-worker.js", "OneSignalSDKWorker.js"
];

await rm("www", { recursive: true, force: true });
await mkdir("www", { recursive: true });
for (const file of rootFiles) {
  try { await cp(file, `www/${file}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
}
await cp("icons", "www/icons", { recursive: true });

let html = await readFile("index.html", "utf8");
html = html.replace(
  '<script type="module" src="script.js?v=20261012-mobile"></script>',
  '<script type="module" src="./mobile-notifications.js"></script>\n    <script type="module" src="./mobile-native-auth.js"></script>\n    <script type="module" src="script.js?v=20261012-mobile"></script>'
);
await writeFile("www/index.html", html);

await build({
  entryPoints: ["mobile/native-notifications.js", "mobile/native-auth.js"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  outdir: "www"
});
await cp("www/native-notifications.js", "www/mobile-notifications.js");
await cp("www/native-auth.js", "www/mobile-native-auth.js");

console.log("Paquete web Android listo en www/.");
