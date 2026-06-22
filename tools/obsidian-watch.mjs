#!/usr/bin/env node
/**
 * obsidian-watch.mjs
 * ------------------------------------------------------------------
 * "Sorvegliante": resta in ascolto su Firestore e, appena qualcosa cambia
 * in summaries / geo_archive / npcs / quests, rilancia obsidian-sync.mjs
 * da solo. Niente più doppio-click.
 *
 * - All'avvio fa SEMPRE un sync di recupero (catch-up) con i dati attuali.
 * - Poi reagisce in tempo reale alle aggiunte/modifiche (debounce 8s).
 * - Va tenuto in esecuzione: si avvia al login di Windows (Task Scheduler).
 *   Quando il PC è spento non perde nulla: al riavvio recupera tutto.
 *
 *   node tools/obsidian-watch.mjs
 * ------------------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SYNC_SCRIPT = path.join(__dirname, "obsidian-sync.mjs");
const LOG_FILE = path.join(__dirname, "obsidian-watch.log");

/* ── log su console + file (utile quando gira nascosto) ── */
function log(msg) {
  const line = `[${new Date().toISOString().slice(0, 19).replace("T", " ")}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch { /* ignore */ }
}

/* ── env (.env.local) ── */
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}
const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/* ── esecuzione sync, senza sovrapposizioni ── */
let running = false;
let pending = false;
function runSync(reason) {
  if (running) { pending = true; return; }
  running = true;
  log(`▶ sync (${reason})…`);
  const child = spawn(process.execPath, [SYNC_SCRIPT], { cwd: PROJECT_ROOT });
  let tail = "";
  const grab = (d) => { tail = (tail + d.toString()).split("\n").slice(-6).join("\n"); };
  child.stdout.on("data", grab);
  child.stderr.on("data", grab);
  child.on("close", (code) => {
    running = false;
    log(`✔ sync finito (exit ${code}).`);
    if (tail.trim()) for (const l of tail.trim().split("\n")) log("   " + l.trim());
    if (pending) { pending = false; runSync("modifiche accodate"); }
  });
  child.on("error", (e) => { running = false; log("✖ errore avvio sync: " + e.message); });
}

/* ── debounce: raggruppa raffiche di cambiamenti in un solo sync ── */
let timer = null;
let firstBurst = true;
function schedule(coll) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const why = firstBurst ? "avvio: recupero iniziale" : `cambiamento in ${coll}`;
    firstBurst = false;
    runSync(why);
  }, 8000);
}

/* ── attacca i listener ── */
function main() {
  log("👁  Sorvegliante Obsidian avviato. In ascolto su Firestore…");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  for (const name of ["summaries", "geo_archive", "npcs", "quests"]) {
    onSnapshot(
      collection(db, name),
      () => schedule(name),
      (err) => log(`⚠ listener ${name}: ${err.message}`)
    );
  }
  // mantiene vivo il processo
  process.stdin.resume();
  process.on("SIGINT", () => { log("⏹  Sorvegliante fermato."); process.exit(0); });
  process.on("SIGTERM", () => { log("⏹  Sorvegliante fermato."); process.exit(0); });
}

main();
