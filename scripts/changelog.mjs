#!/usr/bin/env node
/**
 * Gestione changelog (src/data/changelog.json).
 *
 * Due modalità:
 *   1) Voce curata (manuale):
 *        npm run changelog -- "Testo della modifica" --type fix
 *        node scripts/changelog.mjs "Testo" --type balance --version 0.5.0
 *      type: feature | fix | balance | chore  (default: fix)
 *
 *   2) Auto dai commit non ancora pushati (usata dall'hook pre-push):
 *        node scripts/changelog.mjs --from-commits
 *      Aggiunge una voce per ogni commit nuovo (classificato dal prefisso del
 *      messaggio). Lascia il file modificato nel working tree: committalo quando
 *      vuoi (di norma viaggia col push successivo).
 *
 * Regola versione: se la versione in cima ha la data di oggi vi si appende,
 * altrimenti si crea una nuova versione (patch +1) datata oggi.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "src", "data", "changelog.json");
const VALID_TYPES = ["feature", "fix", "balance", "chore"];

function load() {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    if (!Array.isArray(data.versions)) data.versions = [];
    return data;
  } catch {
    return { versions: [] };
  }
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function bumpPatch(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version || "");
  if (!m) return "0.1.0";
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

// Ritorna la versione "corrente" su cui appendere, creandola se serve.
function currentVersion(data, explicitVersion) {
  const today = todayISO();
  if (explicitVersion) {
    let v = data.versions.find((x) => x.version === explicitVersion);
    if (!v) {
      v = { version: explicitVersion, date: today, title: "", changes: [] };
      data.versions.unshift(v);
    }
    return v;
  }
  const top = data.versions[0];
  if (top && top.date === today) return top;
  const v = { version: bumpPatch(top?.version), date: today, title: "", changes: [] };
  data.versions.unshift(v);
  return v;
}

function addChange(data, { type, text, version }) {
  const t = VALID_TYPES.includes(type) ? type : "fix";
  const clean = (text || "").trim();
  if (!clean) return false;
  const v = currentVersion(data, version);
  // Evita duplicati esatti nella stessa versione.
  if (v.changes.some((c) => c.text === clean)) return false;
  v.changes.push({ type: t, text: clean });
  return true;
}

// ── Classifica un messaggio di commit in un tipo ─────────────────────────────
function classify(subject) {
  const s = subject.toLowerCase();
  if (/^(feat|feature)(\(|:|\s)/.test(s) || s.includes("nuov") || s.includes("aggiunt")) return "feature";
  if (/^fix(\(|:|\s)/.test(s) || s.includes("fix") || s.includes("bug") || s.includes("corregg")) return "fix";
  if (/^(balance|bal)(\(|:|\s)/.test(s) || s.includes("bilanc") || s.includes("nerf") || s.includes("buff")) return "balance";
  if (/^(chore|build|ci|docs|refactor|style|test)(\(|:|\s)/.test(s)) return "chore";
  return "chore";
}

// Pulisce il prefisso conventional-commit dal testo mostrato.
function stripPrefix(subject) {
  return subject.replace(/^(feat|feature|fix|balance|bal|chore|build|ci|docs|refactor|style|test)(\([^)]*\))?:\s*/i, "").trim();
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

function unpushedSubjects() {
  let range = "";
  try {
    git("rev-parse --abbrev-ref --symbolic-full-name @{u}"); // ha upstream?
    range = "@{u}..HEAD";
  } catch {
    // Nessun upstream: prendi solo l'ultimo commit.
    range = "-n 1";
  }
  let out = "";
  try {
    out = git(`log ${range} --no-merges --format=%s`);
  } catch {
    return [];
  }
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

function getFlag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (argv.includes("--from-commits")) {
  const subjects = unpushedSubjects();
  if (subjects.length === 0) {
    console.log("📝 changelog: nessun commit nuovo da registrare.");
    process.exit(0);
  }
  const data = load();
  let added = 0;
  for (const subj of subjects) {
    // Salta i commit di sola manutenzione del changelog.
    if (/changelog/i.test(subj) && /^(chore|docs)/i.test(subj)) continue;
    if (addChange(data, { type: classify(subj), text: stripPrefix(subj) })) added++;
  }
  if (added > 0) {
    save(data);
    console.log(`📝 changelog.json aggiornato: +${added} voce/i dai commit pushati. Committalo quando vuoi.`);
  } else {
    console.log("📝 changelog: niente di nuovo da aggiungere.");
  }
  process.exit(0);
}

// Modalità manuale: il primo argomento non-flag è il testo.
const text = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--type" && argv[argv.indexOf(a) - 1] !== "--version");
if (!text) {
  console.error('Uso: npm run changelog -- "Testo della modifica" [--type feature|fix|balance|chore] [--version x.y.z]');
  process.exit(1);
}
const data = load();
const ok = addChange(data, { type: getFlag("type"), text, version: getFlag("version") });
if (ok) {
  save(data);
  const v = data.versions[0];
  console.log(`📝 Aggiunta voce a v${v.version} (${v.date}).`);
} else {
  console.log("📝 Nessuna voce aggiunta (testo vuoto o duplicato).");
}
