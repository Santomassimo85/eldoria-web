// Effetti a schermo dell'Arena: dal testo della riga di log alla forma/elemento dei pixel del World Boss.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.


// ── VFX d'Arena: classifica l'effetto pixelato dal testo della voce di log ──
// Disegna VfxLayer (WorldBossVfx.jsx/.css, gli stessi pixel del World Boss). Nessuna
// modifica ai 30+ handler d'attacco: deduciamo forma/elemento/esito dal `pub`/`att` e il
// bersaglio da defId (attacchi → nemico) o attId (cure/buff → sé stesso); il proiettile
// parte dall'avatar di chi attacca (`arena-fx:<matchId>:<uid>` su .cv-avatar-wrap).
// ── EFFETTI A SCHERMO (gli stessi PIXEL del World Boss: WorldBossVfx) ────────
// Dal testo di una riga di log ricavo forma + elemento + esito nel formato che
// legge VfxLayer: effect (slash · arrow · bolt · aoe · heal · buff · shield · debuff),
// effectEl (fire · frost · lightning · poison · darkness · radiant · arcane · physical),
// miss (sbuffo "mancato" al posto dello scoppio). Solo testo: la logica di
// combattimento non cambia. Ordine: esito → cure/scudi/buff/debuff → elemento → forma.
export const ARENA_FX_OFFENSIVE = new Set(["slash", "arrow", "bolt", "aoe", "debuff"]);
export const AOE_SPELL_RE = /(palla di fuoco|onda tonante|onda di tuono|frantumare|mani brucianti|cono di freddo|\bfulmine\b|tempesta|deflagraz|esplosion|\bbomba\b|soffio|nube|sfera infuocata|raggio di luna|pioggia|turbine)/;
export const RANGED_RE = /(\barco\b|frecc|balestra|pistol|fucile|moschetto|fionda|giavellotto|da lancio|dardo\b(?! incantato| di fuoco)|\btiro\b|picchiata|raffica)/;
export function arenaFxElement(text) {
  if (/(sacr|divin|smite|punizion|radios|raggio guida|fiamma sacra|\bluce\b)/.test(text)) return "radiant";
  if (/(fuoco|fiamm|brucia|rovente|incendi|\bbomba\b|infernal|deflagraz|arden|igne)/.test(text)) return "fire";
  if (/(\bgelo\b|freddo|ghiacc|congel|frost|gelid|brina)/.test(text)) return "frost";
  if (/(fulmin|scossa|tuono|tonante|schianto|elettr|folgor|tempesta|saetta)/.test(text)) return "lightning";
  if (/(veleno|tossic|velenos|acid|nube|infestazion|triboli|sanguinam|ragn)/.test(text)) return "poison";
  if (/(necro|tenebr|oscur|\bombra\b|vampir|hadar|sussurr|gelido tocco|tocco gelido|maledi)/.test(text)) return "darkness";
  return null;
}
export function classifyArenaVfx(entry) {
  if (!entry || typeof entry !== "object") return null;
  const text = (entry.pub || entry.att || "").toLowerCase();
  if (!text) return null;
  // Righe di servizio: iniziativa, apertura sfida, movimento, vincitore.
  if (/(tira iniziativa|tirate iniziativa|ha aperto una sfida|in attesa di|accetta la sfida|chiude la distanza|arretra|vincitore|abbandona|inizia il|turno passa|salta il turno)/.test(text)) return null;
  const miss = /(\bmanca\b|\bmanchi\b|\bmancato\b|nessun danno|schiva|evita il colpo|fallisce il colpo|non colpisce|resiste e non subisce)/.test(text) && !/dimezzat/.test(text);
  // Cure e recuperi
  if (/(\bcura\b|si cura|guari|canalizza il ki|secondo respiro|lay of hands|imposizione|ristora|recupera \d+ hp|tocco vampirico|drena|pozione di cura|rigenera)/.test(text)) return { kind: "heal", el: "radiant", miss: false };
  // Scudi, protezioni, PF temporanei
  if (/(scudo della fede|scudo magico|armatura magica|protezione|pelle di pietra|barriera|campo protettivo|difesa|si protegge|pf temporanei|assorbe|golem|forgia)/.test(text) && !/manca|manchi/.test(text)) return { kind: "shield", el: "arcane", miss: false };
  // Debuff e controllo sull'avversario
  if (/(svantaggio|paraliz|stordi|acciec|accec|spavent|ragnatela|\bsonno\b|ammalia|charm|controll|maledi|indeboli|rallent|intrappol|disarm|riscaldare arma|incandescen|trattien|blocca|corona della pazzia|confus)/.test(text)) return { kind: "debuff", el: arenaFxElement(text) || "darkness", miss };
  // Buff su di sé o su un alleato (non "attacco furtivo", che è un colpo)
  if (/(\baiuto\b|ispirazione|\bfuria\b|marchio|vantaggio|benedizion|eroismo|scatto d'azione|azione extra|velocit|invisib|furtività|concentraz|si prepara|attiva|patto|fonte di magia|recupero arcano)/.test(text) && !/attacco furtivo|colpisce|colpisci/.test(text)) return { kind: "buff", el: arenaFxElement(text) || "radiant", miss: false };
  // Da qui in giù: danno. Elemento dal testo, forma dal tipo di attacco.
  const el = arenaFxElement(text);
  if (/smite|punizione/.test(text)) return { kind: "slash", el: "radiant", miss };
  // Colpi d'arma "con la freccia" del log delle abilità (Attacco Furtivo, Triboli…): non sono magie.
  if (/(attacco furtivo|furtivo|triboli|turbine di lame|colpo stordente|deathblow|colpo mortale|\bcarica\b)/.test(text)) return { kind: "slash", el: el || "physical", miss };
  const isSpell = /✨|→ [^:]+:|incantesimo|\bts\b|tiro salvezza|lancia (?:un |una |l')?(?:incantesimo|magia)/.test(text);
  if (AOE_SPELL_RE.test(text)) return { kind: "aoe", el: el || (isSpell ? "arcane" : "fire"), miss };
  if (isSpell) return { kind: "bolt", el: el || "arcane", miss };
  if (/☠|veleno|pozione/.test(text)) return { kind: "bolt", el: el || "poison", miss };
  if (RANGED_RE.test(text)) return { kind: "arrow", el: el || "physical", miss };
  if (/(colpisce|colpisci|attacc|fendente|carica|furtivo|colpo|mischia|lama|taglia|morso|artigli|pugno|calcio|danni)/.test(text)) return { kind: "slash", el: el || "physical", miss };
  if (el) return { kind: "bolt", el, miss };
  return null;
}
// Codici legacy di `lastFx` (heal · slash · ranged · fire · frost · lightning · poison · magic)
// oppure già {kind, el} → formato VfxLayer.
export function normalizeArenaFx(effect) {
  if (!effect) return null;
  if (typeof effect === "object") return { kind: effect.kind || "bolt", el: effect.el || "arcane", miss: !!effect.miss };
  const legacy = {
    heal: ["heal", "radiant"], slash: ["slash", "physical"], ranged: ["arrow", "physical"],
    fire: ["bolt", "fire"], frost: ["bolt", "frost"], lightning: ["bolt", "lightning"], poison: ["bolt", "poison"],
    magic: ["bolt", "arcane"], shield: ["shield", "arcane"], buff: ["buff", "radiant"], debuff: ["debuff", "darkness"],
  };
  const [kind, el] = legacy[effect] || ["bolt", "arcane"];
  return { kind, el, miss: false };
}
// Aggancia un effetto VFX al match tramite un campo PARALLELO `lastFx` (NON tocca
// i log né la logica di combattimento). Serve per pet/demoni/costrutti/cure, che
// usano log-stringa privi del riferimento al bersaglio. Il driver legge lastFx.
// `effect` = codice legacy ("slash", "fire"…) o {kind, el, miss}; `fromId` = chi agisce.
export function withArenaFx(matches, matchId, effect, targetId, fromId = null) {
  if (!targetId || !effect) return matches;
  const fx = { id: `${typeof effect === "string" ? effect : effect.kind}:${targetId}:${Date.now()}`, effect, targetId, ...(fromId ? { fromId } : {}) };
  return matches.map(m => (m.matchId === matchId ? { ...m, lastFx: fx } : m));
}
