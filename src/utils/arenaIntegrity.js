// ── Arena · integrità dei PF ────────────────────────────────────────────────
// I giocatori morivano "con danni inesistenti": PF che calavano senza una riga
// della cronaca che lo dicesse (TS automatici che toglievano 2d6 in silenzio,
// voci di log senza la versione per attaccante/difensore, valori NaN…).
// auditArenaMatch confronta i PF di ogni giocatore prima/dopo un'azione e:
//   • scrive la variazione sulla voce di log dell'azione (`hp: {uid: [prima, dopo]}`),
//     così la cronaca mostra "❤ Lael 52 → 34" accanto al colpo;
//   • se l'azione non ha scritto nessuna riga, ne aggiunge una che lo dice;
//   • se un PF diventa NaN/undefined (danno malformato) lo riporta al valore di
//     prima invece di lasciare il giocatore "morto" (NaN > 0 è falso).

const logText = (l) => (typeof l === "string" ? l : (l && (l.pub || l.att || l.def)) || "");
const isWinnerLine = (l) => /È IL VINCITORE/.test(logText(l));

export function auditArenaMatch(base, next, nowIso = new Date().toISOString()) {
  if (!base || !next || base === next) return next;
  const baseLogs = base.logs || [];
  const nextLogs = next.logs || [];
  // Solo azioni che AGGIUNGONO righe alla cronaca (non reset/rimozioni).
  if (nextLogs.length < baseLogs.length) return next;
  const before = new Map((base.players || []).map(p => [p.id, p]));
  const changes = {};
  const fixed = [];
  let players = next.players || [];
  players = players.map(p => {
    const b = before.get(p.id);
    if (!b) return p;
    const h0 = Number(b.hp);
    let h1 = Number(p.hp);
    let out = p;
    if (!Number.isFinite(h1) && Number.isFinite(h0)) {
      fixed.push(p.name || p.id);
      h1 = h0;
      out = { ...p, hp: h0 };
    }
    if (Number.isFinite(h0) && Number.isFinite(h1) && h0 !== h1) changes[p.id] = [h0, h1];
    return out;
  });
  if (!Object.keys(changes).length && !fixed.length) return next;

  const logs = [...nextLogs];
  // Voce dell'azione = l'ultima nuova riga che non sia l'annuncio del vincitore.
  let idx = -1;
  for (let i = logs.length - 1; i >= baseLogs.length; i--) {
    if (!isWinnerLine(logs[i])) { idx = i; break; }
  }
  if (Object.keys(changes).length) {
    if (idx >= 0) {
      const l = logs[idx];
      const obj = typeof l === "string" ? { pub: l, ts: nowIso } : { ...l, ts: l.ts || nowIso };
      obj.hp = { ...(obj.hp || {}), ...changes };
      logs[idx] = obj;
    } else {
      const names = Object.entries(changes).map(([id, [a, b]]) => {
        const n = players.find(p => p.id === id)?.name || "?";
        return `${n} ${a} → ${b}`;
      }).join(" · ");
      const entry = { pub: `⚠ Variazione di PF senza descrizione: ${names}`, ts: nowIso, hp: changes, audit: true };
      // Prima dell'eventuale annuncio del vincitore.
      const win = logs.length > baseLogs.length && isWinnerLine(logs[logs.length - 1]);
      if (win) logs.splice(logs.length - 1, 0, entry); else logs.push(entry);
    }
  }
  if (fixed.length) {
    logs.push({ pub: `⚠ Danno non valido ignorato (${fixed.join(", ")}): i PF restano quelli di prima.`, ts: nowIso, audit: true });
  }
  return { ...next, players, logs };
}

// Righe "❤ Nome 52 → 34 (−18)" per una voce di log con traccia PF.
export function hpTraceParts(entry, players) {
  if (!entry || typeof entry !== "object" || !entry.hp) return [];
  return Object.entries(entry.hp).map(([id, pair]) => {
    const [a, b] = Array.isArray(pair) ? pair : [];
    const name = (players || []).find(p => p.id === id)?.name || "?";
    const d = (Number(b) || 0) - (Number(a) || 0);
    return { id, name, from: a, to: b, delta: d };
  });
}
