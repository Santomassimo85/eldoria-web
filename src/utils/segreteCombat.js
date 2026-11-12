/* Informazioni delle azioni e stati della lotta delle Segrete. */
export function statusIcons(c, round) {
  const fx = c.fx || {};
  const untilOf = (u) => (typeof u === "number" ? u : u?.until || 0);
  const on = (u) => !!u && round < untilOf(u);
  const left = (u) => Math.max(1, untilOf(u) - round);
  const out = [];
  (fx.ac || []).filter(on).forEach((e, i) => out.push({ k: `ac${i}`, ico: "🛡", n: left(e), good: true, tag: `+${e.v} CA`, t: `+${e.v} CA` }));
  if (fx.dodge) out.push({ k: "dodge", ico: "🌀", n: 1, good: true, tag: "+4 CA", t: "In difesa: +4 CA fino alla sua prossima azione" });
  if (on(fx.adv)) out.push({ k: "adv", ico: "🎯", n: left(fx.adv), good: true, tag: "vant.", t: "Vantaggio agli attacchi" });
  if (on(fx.dmg)) out.push({ k: "dmg", ico: "⚔", n: left(fx.dmg), good: true, tag: `+${fx.dmg.v} danni`, t: `+${fx.dmg.v} ai danni` });
  if (on(fx.rage)) out.push({ k: "rage", ico: "💢", n: left(fx.rage), good: true, tag: `+${fx.rage.v} furia`, t: `Furia: +${fx.rage.v} danni, danni fisici dimezzati` });
  if (on(fx.dis)) out.push({ k: "dis", ico: "🌫", n: left(fx.dis), good: false, tag: "svant.", t: "Svantaggio agli attacchi" });
  if (on(fx.reckless)) out.push({ k: "reck", ico: "😤", n: left(fx.reckless), good: false, tag: "−2 CA", t: "Irruento: −2 CA" });
  if (fx.stun) out.push({ k: "stun", ico: "💫", n: 1, good: false, tag: "salta", t: "Stordito: salta il prossimo turno" });
  // STATI (2026-11-06): danni a turni, blocchi e malus (vedi STATUS in segreteEngine.js)
  if (on(fx.burn)) out.push({ k: "burn", ico: "🔥", n: left(fx.burn), good: false, tag: `${fx.burn.dice}/t`, t: `Bruciato: ${fx.burn.dice} fuoco all'inizio di ogni suo turno (Tonico o Bomba d'Acqua)` });
  if (on(fx.poison)) out.push({ k: "poison", ico: "☠", n: left(fx.poison), good: false, tag: `${fx.poison.dice}/t`, t: `Avvelenato: ${fx.poison.dice} veleno all'inizio di ogni suo turno (Tonico)` });
  if (fx.frozen) out.push({ k: "frozen", ico: "🧊", n: fx.frozen.left, good: false, tag: "−2 CA", t: "Congelato: salta i turni e −2 CA. Lo libera il Tonico o un colpo di fuoco" });
  if (fx.paralyzed) out.push({ k: "par", ico: "⚡", n: fx.paralyzed.left, good: false, tag: "fermo", t: `Paralizzato: salta il turno, TS ${String(fx.paralyzed.stat || "con").toUpperCase()} CD ${fx.paralyzed.dc || 12} a ogni turno per liberarsi; chi lo attacca ha vantaggio` });
  if (fx.petrified) out.push({ k: "stone", ico: "🗿", n: fx.petrified.left, good: false, tag: "pietra", t: "Pietrificato: non agisce, danni dimezzati, chi lo attacca ha vantaggio. Solo la Panacea lo libera prima" });
  if (on(fx.frightened)) out.push({ k: "fear", ico: "😱", n: left(fx.frightened), good: false, tag: "paura", t: "Spaventato: svantaggio, non può curare né aiutare gli altri (Tonico)" });
  if (on(fx.blinded)) out.push({ k: "blind", ico: "🌑", n: left(fx.blinded), good: false, tag: "cieco", t: "Accecato: svantaggio, chi lo attacca ha vantaggio (Tonico)" });
  if (on(fx.slow)) out.push({ k: "slow", ico: "🐌", n: left(fx.slow), good: false, tag: "lento", t: "Rallentato: svantaggio agli attacchi (Tonico o Bomba d'Acqua)" });
  if (on(fx.taunt)) out.push({ k: "taunt", ico: "📣", n: left(fx.taunt), good: false, tag: "provocato", t: "Provocato: attacca soltanto il guerriero che lo ha sfidato" });
  if (on(fx.confused)) out.push({ k: "conf", ico: "😵", n: left(fx.confused), good: false, tag: "confuso", t: "Confuso: sceglie l'azione ma il bersaglio esce a caso, anche un compagno (Tonico)" });
  return out;
}

export function actInfo(a, lv) {
  if (a.healPool) return "riserva PF massimi + livello · scegli quanto curare";
  if ((a.cantrip || a.kind === "taunt" || a.id === "cura_c") && a.info) return a.info;
  if (a.kind === "defend") return "+4 CA fino al tuo turno";
  if (a.kind === "grip") return `${a.info} · gratis`;
  if (a.kind === "heal") return a.flat ? `cura ${lv * 5}` : `cura ${a.dice}${a.plusMod ? "+mod" : ""}`;
  if (a.kind === "heal_all") return `cura tutti ${a.dice}+mod`;
  if (a.kind === "debuff") return a.info || `${a.inflict?.key === "frightened" ? "paura" : "svantaggio"} · ${a.turns}t`;
  if (a.kind === "buff") return a.buff === "ac" ? `+${a.value} CA · ${a.turns}t` : a.buff === "adv" ? `vantaggio${a.allParty ? " a tutto il party" : ""} · ${a.turns}t` : `+${a.value} danni · ${a.turns}t`;
  if (a.kind === "save") return `${a.dice} · TS ${a.save.toUpperCase()}${a.area ? " · tutti" : ""}`;
  if (a.kind === "missile") return `${a.dice}+${a.flat || 0} · colpisce sempre`;
  return `${a.dice}${a.kind === "weapon" ? "+mod" : ""}`;
}

