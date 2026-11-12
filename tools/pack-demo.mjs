// Impacchetta la demo delle Segrete (dopo `vite build -c vite.demo.config.js`) in UN file
// HTML che si apre col doppio clic (file://), e lo zippa con le istruzioni.
// Uso: npm run build:demo
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dist = path.resolve("dist-demo");
const out = path.resolve("demo-release");
let html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const assets = path.join(dist, "assets");
const files = fs.readdirSync(assets);
const css = files.filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n");
let js = files.filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n");

// i suoni dei colpi d'arma: dentro il file, come data URI
for (const s of ["slash", "ranged", "heal", "spell"]) {
  const p = path.resolve("public/sounds", `${s}.mp3`);
  if (fs.existsSync(p)) js = js.split(`/sounds/${s}.mp3`).join(`data:audio/mpeg;base64,${fs.readFileSync(p).toString("base64")}`);
}
js = js.replace(/<\/script/gi, "<\\/script");

html = html
  .replace(/<script[^>]*src="[^"]*assets\/[^"]+\.js"[^>]*><\/script>/g, "")
  .replace(/<link[^>]*href="[^"]*assets\/[^"]+\.css"[^>]*>/g, "")
  .replace("</head>", `<style>${css}</style>\n</head>`)
  .replace("</body>", `<script type="module">${js}</script>\n</body>`);

const leaks = ["AIza", "firebaseapp", "firebasestorage", "@gmail", "santomassimo"].filter((k) => html.includes(k));
if (leaks.length) { console.error("STOP: dati privati nel pacchetto:", leaks); process.exit(1); }

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const folder = path.join(out, "Le Segrete - Demo");
fs.mkdirSync(folder);
fs.writeFileSync(path.join(folder, "Gioca.html"), html);
fs.writeFileSync(path.join(folder, "LEGGIMI.txt"), [
  "LE SEGRETE - DEMO",
  "=================",
  "",
  "Per giocare: doppio clic su \"Gioca.html\" (si apre nel browser: Chrome, Edge, Firefox o Safari).",
  "Non serve installare niente ne' creare un account. Serve internet solo per i caratteri del testo.",
  "",
  "Cosa c'e': crei un eroe (12 classi, 5 razze), poi due sale di mostri e il primo boss.",
  "Ricaricando la pagina si riparte da zero.",
  "",
  "Demo privata: per favore non condividerla.",
  "",
].join("\r\n"));
const zip = path.join(out, "Le-Segrete-Demo.zip");
execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${folder}' -DestinationPath '${zip}' -Force`], { stdio: "inherit" });
console.log(`OK: ${zip} (${(fs.statSync(zip).size / 1024 / 1024).toFixed(2)} MB)`);
