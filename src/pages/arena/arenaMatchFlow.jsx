// Chiusura dei match: KO della Forma Selvatica e rete di sicurezza di fine match.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { WILD_SHAPES } from "./arenaGear";

// Fonte di Magia (Sorcerer) — ripristina 2 slot magia, 2 cariche
export const processWsKnockouts = (players) => {
  const extraLogs = [];
  const updated = players.map(p => {
    if (!p.wildShape || p.hp > 0) return p;
    const restoredMaxHp = p.preWildShapeMaxHp ?? p.maxHp ?? 1;
    // Morte in forma selvatica: torna umano con il 60% degli HP totali della forma umana.
    const restored = Math.max(1, Math.floor(restoredMaxHp * 0.6));
    const formName = WILD_SHAPES[p.wildShape]?.name || p.wildShape;
    extraLogs.push(`🐾 ${p.name} viene abbattuto in forma ${formName} e ritorna alla forma originale (${restored}/${restoredMaxHp} HP)!`);
    return { ...p, hp: restored, maxHp: restoredMaxHp, wildShape: null, preWildShapeHp: null, preWildShapeMaxHp: null };
  });
  return { players: updated, extraLogs };
};

// Rete di sicurezza sulla fine dello scontro: alcune strade (TS automatici, TS
// del veleno/Corona della Pazzia, DoT, attacco automatico a tempo scaduto)
// portavano un giocatore a 0 PF senza chiudere il match né passare il turno.
// Qui, per un match attivo: druido in forma selvatica a 0 → torna umano; resta un
// solo vivo → vince; il turno è di un morto → passa al prossimo vivo.
export function finalizeArenaMatch(m) {
  if (!m || m.status !== "active" || !Array.isArray(m.players) || m.players.length < 2) return m;
  const { players, extraLogs } = processWsKnockouts(m.players);
  let out = extraLogs.length ? { ...m, players, logs: [...(m.logs || []), ...extraLogs] } : m;
  const alive = out.players.filter(p => (Number(p.hp) || 0) > 0);
  if (alive.length <= 1) {
    const w = alive[0] || null;
    const already = (out.logs || []).some(l => /È IL VINCITORE/.test(typeof l === "string" ? l : (l?.pub || "")));
    return {
      ...out, status: "finished", winner: w?.id || null,
      logs: already || !w ? (out.logs || []) : [...(out.logs || []), `🏆 ${String(w.name || "?").toUpperCase()} È IL VINCITORE!`],
    };
  }
  const cur = out.players.find(p => p.id === out.turn);
  if (cur && (Number(cur.hp) || 0) <= 0) {
    const i = out.players.findIndex(p => p.id === out.turn);
    for (let k = 1; k <= out.players.length; k++) {
      const nx = out.players[(i + k) % out.players.length];
      if ((Number(nx.hp) || 0) > 0) { out = { ...out, turn: nx.id }; break; }
    }
  }
  return out;
}

export const FONTE_DI_MAGIA_ACTION = {
  name: "Fonte di Magia", hitBonus: 0, damage: "—", statKey: null,
  type: "skill", icon: "🔮", info: "Ripristina 2 slot magia a scelta · 2 cariche", special: "fonte_di_magia", maxUses: 2,
};

export const CASTER_SKILLS = [];
