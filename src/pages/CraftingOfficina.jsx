// ── L'Officina: il crafting giocabile dall'app ───────────────────────────────
// I giocatori scelgono la professione, puntano a una RARITÀ (Comune · Non
// comune · Raro: scelgono anche QUALE oggetto fra i 6 del catalogo della
// professione; Molto raro · Leggendario: l'oggetto lo decide il d12), preparano
// il banco (strumenti, componenti trovati in sessione, aiuto, materiali, ritmo)
// e tirano il d20 (+ modificatore, + competenza strumenti, + grado, + condizioni).
// Un tiro sotto la rarità mirata dà lo stesso oggetto della rarità inferiore
// (sotto 6 uno Scarso a caso).
// IL TIRO È SEGRETO (2026-09-22): il dado si ferma su una runa e finché il
// pezzo è sul banco il giocatore non vede né d20 né rarità — li legge solo il
// Master. Un 1 NATURALE non brucia più il lavoro: l'oggetto esce Scarso e
// MALEDETTO (craftingCurse.js, maledizione scritta da Gemini su misura), e la
// maledizione resta roba da Master: nel registro, nel tavolo e nella coda di
// Foundry, mai nella descrizione dell'oggetto né in nessuna schermata del
// giocatore. Il Master vede il tavolo in tempo reale
// (MasterBoard): chi sta forgiando cosa, a che punto è, cosa ha finito. Il tiro AVVIA un lavoro con un tempo
// fisso in tempo reale (craftingTime.js): finché non scade si vede solo la
// barra; poi l'oggetto si "ritira" e va nella coda "Crea Oggetto → Foundry"
// del Master (collection `foundry_inbox`, target = inventario del giocatore).
// Limiti: 1 prova al giorno, 3 a settimana, reset domenica ore 22:00; l'uso e i
// componenti si consumano all'avvio del lavoro (transazione, ora del server).
// Stato sul personaggio: `characters/{uid}.crafting` (vedi craftAllowance).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { showD20Roll } from "../components/DiceRoll";
import { isHiddenChar } from "../data/hiddenPlayers";
import { PREGIATURE, PREGIATURA_COSTS, PROFESSIONI, TIER_ORDER, normTier, postazioneFor, tierByKey, tierByTotal, tierMinGrade } from "../data/crafting";
import { CRAFT_MAX_PER_DAY, CRAFT_MAX_PER_WEEK, craftAllowance, craftDayKey, craftResetLabel, craftWeekKey } from "../data/craftingWeek";
import { serverClockOffset, serverNow } from "../data/serverClock";
import { GRADE_BONUS, XP_LEVELS, XP_PER_TIER, progression, xpForCraft } from "../data/craftingProgress";
import { ENHANCERS, TIER_TO_FOUNDRY, classifyCraftedItem, craftGoldPayload, craftedItemToFoundryPayload, enhancerEvidence, itemChoices } from "../data/craftingFoundry";
import { curseGravita, generateCurse, gravitaByKey } from "../data/craftingCurse";
import { COMPONENTS, COMPONENT_ROLL_DIE, CRAFT_BASE_MINUTES, INVESTMENTS, MAX_COMPONENTS, PACE_OPTIONS, TOOLS_MINUTES, componentByKey, applyOutcomeTime, componentEffectLabel, craftMinutes, craftTimeLabel, fmtCountdown, fmtMinutes, fmtMo, investCostMo, investmentByKey, outcomeTimeBy, outcomeTimeRange, paceByKey, xpWithInvestment } from "../data/craftingTime";
import { componentEvidence, toolsEvidence } from "../data/craftingOwnership";
import { affordFromSnapshot, availableGp, canAfford, goldPending, hasPurse, pendingAfterClose, sheetGp } from "../data/craftingPurse";
import "./CraftingOfficina.css";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];
const STAT_KEY = { FOR: "str", DES: "dex", INT: "int", SAG: "wis" };

// Qualità dei materiali e aiuto al banco: scelte DISMESSE il 2026-09-22 (al loro
// posto c'è l'investimento). Le etichette restano solo per rileggere le prove vecchie.
const LEGACY_QUALITY = { sup: "di qualità superiore", fortuna: "di fortuna" };
// Costo dei materiali della rarità, in monete.
const tierMo = (tier) => PREGIATURA_COSTS.find((c) => c.tier === normTier(tier))?.mo || 0;
// Il fallimento critico della FRETTA (5%) rovina il lavoro: il banco resta
// occupato due minuti con la barra rossa, poi si scopre il disastro. L'1
// naturale non passa più di qui: l'oggetto esce, Scarso e maledetto.
const FAIL_MINUTES = 2;
// 20 naturale: metà dei materiali basta, quindi si paga la metà.
const NAT20_COST_MULT = 0.5;

// Caratteristiche del PG in formato Foundry ({score, mod, save}) o vecchio (numero).
function statMod(charData, key) {
  const s = charData?.stats || {};
  const raw = s[key];
  if (raw == null) return 0;
  if (typeof raw === "object") {
    if (raw.mod != null) return Number(raw.mod) || 0;
    if (raw.score != null) return Math.floor((Number(raw.score) - 10) / 2);
    return 0;
  }
  return Number(raw) || 0;
}
function profBonus(charData) {
  const saved = parseInt(charData?.stats?.prof);
  if (saved > 0) return saved;
  const lvl = Math.max(1, parseInt(charData?.level) || 1);
  return Math.ceil(lvl / 4) + 1;
}
function abilityModFor(charData, prof) {
  if (prof.carShort === "MAG") return Math.max(statMod(charData, "int"), statMod(charData, "wis"), statMod(charData, "cha"));
  return statMod(charData, STAT_KEY[prof.carShort] || "int");
}
const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
const rnd = (n) => 1 + Math.floor(Math.random() * n);
const tierMeta = tierByKey; // accetta anche le chiavi vecchie (comune/raro/magico/perfetto)
const FT_LABEL = { weapon: "Arma", equipment: "Armatura / Equipaggiamento", consumable: "Consumabile", loot: "Tesoro / Varie", tool: "Strumento" };
const RARITY_LABEL = { common: "Comune", uncommon: "Non comune", rare: "Raro", veryRare: "Molto raro", legendary: "Leggendario", artifact: "Artefatto" };
const ROME = "Europe/Rome";
// "alle 18:40" se è oggi, altrimenti "dom 21 · 18:40".
function whenLabel(ms, now) {
  const d = new Date(ms);
  const day = (x) => new Intl.DateTimeFormat("en-CA", { timeZone: ROME, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const hm = new Intl.DateTimeFormat("it-IT", { timeZone: ROME, hour: "2-digit", minute: "2-digit" }).format(d);
  if (day(d) === day(now)) return `alle ${hm}`;
  const wd = new Intl.DateTimeFormat("it-IT", { timeZone: ROME, weekday: "short", day: "numeric" }).format(d);
  return `${wd} · ${hm}`;
}

// Il Master dell'Officina (anche per la testata di /officina). In DEV
// `?vista=player` fa vedere al Master la pagina con i limiti di un giocatore.
export function useOfficinaMaster() {
  const { currentUser } = useAuth();
  const devPlayerView = import.meta.env.DEV && new URLSearchParams(window.location.search).get("vista") === "player";
  return MASTER_EMAILS.includes(currentUser?.email) && !devPlayerView;
}

export default function CraftingOfficina() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const isMaster = useOfficinaMaster();
  const [charData, setCharData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pickProf, setPickProf] = useState(null);
  const [confirmProf, setConfirmProf] = useState(false);
  const [marketItems, setMarketItems] = useState([]);
  // Il banco di lavoro.
  const [target, setTarget] = useState("common");
  const [pickIdx, setPickIdx] = useState(-1); // linea del catalogo scelta (solo rarità "pick")
  const [comps, setComps] = useState([]);
  const [pace, setPace] = useState("normale");
  const [invest, setInvest] = useState(""); // quanto spendo sopra il costo dei materiali
  const [tab, setTab] = useState("banco");  // piega aperta (niente più muro di pannelli)
  // L'esito.
  const [revealedId, setRevealedId] = useState(""); // lavoro finito e "ritirato" in questa visita
  const [choice, setChoice] = useState("");
  const [enhKey, setEnhKey] = useState("");
  const [note, setNote] = useState("");
  const [clockOffset, setClockOffset] = useState(0); // server − dispositivo (ms)
  const [, setTick] = useState(0);                   // battito della barra del tempo

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "characters", uid), (snap) => setCharData(snap.exists() ? snap.data() : {}));
    return () => unsub();
  }, [uid]);

  // I tastini dell'intestazione della pagina (/officina) aprono la piega giusta e ci portano sopra.
  useEffect(() => {
    const go = (e) => {
      const k = e?.detail || "banco";
      setTab(k);
      requestAnimationFrame(() => document.getElementById("off-banco")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    window.addEventListener("officina:tab", go);
    return () => window.removeEventListener("officina:tab", go);
  }, []);

  // Il Master vede TUTTI gli artigiani del tavolo in tempo reale (tavolo + pannello).
  const [tableChars, setTableChars] = useState([]);
  useEffect(() => {
    if (!uid || !isMaster) return;
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      setTableChars(snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((c) => c.name && !isHiddenChar(c)).sort((a, b) => a.name.localeCompare(b.name)));
    }, () => {});
    return () => unsub();
  }, [uid, isMaster]);

  // Acquisti al Mercato Nero: servono come prova di possesso dei potenziatori.
  useEffect(() => {
    if (!uid) return;
    getDocs(collection(db, "items")).then((snap) => setMarketItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((i) => i.isSold))).catch(() => {});
  }, [uid]);

  const crafting = charData?.crafting || {};
  const prof = PROFESSIONI.find((p) => p.key === crafting.profession) || null;
  const hasProf = !!prof;
  // Strumenti e componenti si usano solo se risultano posseduti (scheda Foundry, scorta del Master, Mercato).
  const ownCtx = { charData, marketItems, isMaster };
  const toolsEv = prof ? toolsEvidence(prof, ownCtx) : { ok: false, label: "", hint: "" };
  const toolsOn = toolsEv.ok; // automatico: nessun tocco, conta solo la scheda

  // Giorno e settimana si contano con l'ora del SERVER, non del telefono
  // (spostare l'orologio avanti non regala prove né accorcia i lavori).
  // Sonda una volta per chi ha una professione; il tiro la rifà da capo.
  useEffect(() => {
    if (!uid || !hasProf) return;
    serverClockOffset().then(setClockOffset).catch(() => {});
  }, [uid, hasProf]);
  const nowMs = Date.now() + clockOffset;
  const now = new Date(nowMs);
  const prog = useMemo(() => progression(crafting.xp || 0), [crafting.xp]);
  const allowBase = useMemo(() => craftAllowance(crafting, now), [crafting.weekKey, crafting.weekCount, crafting.lastDayKey, clockOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  // Il Master non ha limiti: crea quante volte vuole (i contatori restano solo informativi).
  const allow = isMaster ? { ...allowBase, can: true, reason: "", unlimited: true } : allowBase;
  const log = Array.isArray(crafting.log) ? crafting.log : [];
  const pendingEntry = log.find((e) => !e.inboxId && !e.skipped) || null; // lavoro in corso o oggetto da spedire
  const readyAt = pendingEntry ? Number(pendingEntry.readyAt) || Number(pendingEntry.at) || 0 : 0;
  const working = !!pendingEntry && readyAt > nowMs;           // sul banco: si vede solo la barra
  const ready = !!pendingEntry && !working;                    // finito: da ritirare
  const revealed = ready && revealedId === pendingEntry.id;    // ritirato: si vede l'oggetto

  // Battito di un secondo finché c'è un lavoro sul banco.
  // Il Master batte anche lui sul tavolo e sugli artigiani (conti alla rovescia di tutti).
  const masterLive = isMaster && (tab === "master" || tab === "artigiani" || tab === "banco");
  useEffect(() => {
    if (!working && !masterLive) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [working, masterLive]);

  // Componenti selezionati che non si possiedono più (es. il Master li ha tolti): via.
  useEffect(() => {
    if (isMaster) return;
    setComps((cur) => cur.filter((k) => componentEvidence(componentByKey(k), { charData, marketItems, isMaster }).qty > 0));
  }, [charData, marketItems, isMaster]);

  // Bonus al tiro e tempo del lavoro.
  const abil = prof ? abilityModFor(charData, prof) : 0;
  const toolB = toolsOn ? profBonus(charData) : 0;
  const gradeB = prog.bonus;
  const paceOpt = paceByKey(pace), investOpt = investmentByKey(invest);
  const extra = paceOpt.roll + investOpt.roll;
  const advSum = toolsOn ? 0 : -1;
  const advMode = advSum > 0 ? "adv" : advSum < 0 ? "dis" : "";
  const bonus = abil + toolB + gradeB + extra;
  const targetCost = PREGIATURA_COSTS.find((c) => c.tier === target);
  const targetMeta = tierMeta(target);
  const catalogo = prof?.catalogo || [];
  const pickLine = targetMeta.pick && pickIdx >= 0 ? catalogo[pickIdx] || null : null;
  const needsPick = targetMeta.pick && !pickLine; // rarità a scelta: serve l'oggetto
  const work = useMemo(() => craftMinutes({ tier: target, tools: toolsOn, components: comps, pace, ritmoBottega: prog.level.lv >= 6 }), [target, toolsOn, comps, pace, prog.level.lv]);
  // Costo dei materiali con l'investimento scelto e PE attesi se il tiro conferma la rarità.
  const baseMo = tierMo(target);
  const costMo = investCostMo(baseMo, investOpt);
  const xpBase = XP_PER_TIER[target] || 0;
  const xpGain = xpWithInvestment(xpBase, investOpt);
  // La borsa: i materiali si pagano PRIMA di tirare, quindi l'oro sulla scheda
  // (meno quello già speso al banco e non ancora scalato su Foundry) deve
  // bastare. Chi non ha la scheda sincronizzata passa lo stesso, con avviso.
  const purse = useMemo(() => canAfford(charData, costMo, { isMaster }), [charData, costMo, isMaster]);
  // ── Le FASCE del d20: cosa esce, quanto dura e quanti PE dà, per ogni totale.
  // Stessa logica del tiro (mai sopra la mirata, Scarso = Comune dal grado
  // Artigiano), messa in tabella così si vede prima di tirare.
  const bands = useMemo(() => {
    const idxT = TIER_ORDER.indexOf(target);
    const rows = [];
    for (let i = idxT; i >= 0; i--) {
      const meta = tierMeta(TIER_ORDER[i]);
      const low = String(meta.range).split(/[–-]/)[0];
      const merged = TIER_ORDER[i] === "scarso" && prog.scarsoAsComune;
      const tier = merged ? "common" : TIER_ORDER[i];
      if (merged && rows.some((r) => r.tier === "common")) { rows[rows.length - 1].range = `${low}–${String(rows[rows.length - 1].range).split(/[–-]/).pop()}`; continue; }
      const tm = tierMeta(tier);
      const name = tm.pick
        ? (pickLine ? pickLine[tier][0] : "— scegli l'oggetto qui sopra —")
        : `un oggetto a caso della tabella ${tm.label} (d12)`;
      const dist = Math.max(0, idxT - TIER_ORDER.indexOf(tier));
      rows.push({
        key: TIER_ORDER[i], tier, top: i === idxT, merged,
        range: i === idxT ? `${low}+` : meta.range,
        name, dist,
        minutes: applyOutcomeTime(work, { dist }).minutes,
        xp: xpWithInvestment(XP_PER_TIER[tier] || 0, investOpt),
      });
    }
    return rows;
  }, [target, pickLine, work, investOpt, prog.scarsoAsComune]);
  const timeRange = outcomeTimeRange(work.minutes);
  // La riga dell'1 naturale nella tabella "Cosa può uscire": sempre Scarso,
  // con il tempo della caduta più lunga e i PE più bassi.
  const nat1Minutes = applyOutcomeTime(work, { dist: TIER_ORDER.indexOf(target) }).minutes;
  const nat1Xp = xpWithInvestment(XP_PER_TIER.scarso || 0, investOpt);

  const activeEntry = revealed ? pendingEntry : null;
  const activeProf = activeEntry ? (PROFESSIONI.find((x) => x.key === activeEntry.profession) || prof) : null;
  const previewName = activeEntry ? (itemChoices(activeEntry.name).length > 1 ? (choice || itemChoices(activeEntry.name)[0]) : activeEntry.name) : "";
  const preview = useMemo(() => {
    if (!activeEntry || !activeProf || activeEntry.failed) return null;
    const enh = ENHANCERS.find((x) => x.key === enhKey) || null;
    return craftedItemToFoundryPayload({
      profession: activeProf, tier: activeEntry.tier, name: activeEntry.name, desc: activeEntry.desc,
      choice: previewName, enhancer: enh, note: note.trim(), work: activeEntry.work || null, components: activeEntry.components || [], upgraded: !!activeEntry.upgraded,
      crafter: { uid, name: charData?.name || "", gradeName: prog.grado.name },
      roll: { d20: activeEntry.d20, bonus: activeEntry.bonus, total: activeEntry.total, d12: activeEntry.d12 },
    });
  }, [activeEntry, activeProf, previewName, enhKey, note, charData?.name, prog.grado.name, uid]);
  const previewType = preview ? preview.foundryType : "";
  // Si mostrano SOLO i potenziatori che il personaggio possiede davvero: gli altri
  // sparivano dietro un lucchetto e rubavano spazio. Il Master li vede tutti
  // (enhancerEvidence gli dà sempre ok).
  const enhancersFor = ENHANCERS.filter((e) => !previewType || e.applies.includes(previewType))
    .map((e) => ({ ...e, ev: enhancerEvidence(e, { charData, marketItems, isMaster }) }))
    .filter((e) => e.ev.ok);
  const enhSel = enhancersFor.find((e) => e.key === enhKey) || null;

  if (!uid) {
    return (
      <div className="nx-pannello off-box off-login">
        <span className="nx-tag">⚒ Officina</span>
        <p className="nx-prosa">Entra con il tuo personaggio per creare oggetti fuori dalla sessione: {CRAFT_MAX_PER_DAY} prova al giorno, {CRAFT_MAX_PER_WEEK} a settimana.</p>
      </div>
    );
  }

  // ── Scelta della professione (una volta; il Master può cambiarla) ──
  async function chooseProfession() {
    if (!pickProf) return;
    setBusy(true);
    try {
      // Una sola professione per personaggio: se nel frattempo è stata scritta, non si sovrascrive.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "characters", uid);
        const snap = await tx.get(ref);
        const cur = snap.exists() ? (snap.data().crafting || {}) : {};
        if (cur.profession) throw new Error("Hai già una professione: può cambiarla solo il Master.");
        tx.update(ref, { "crafting.profession": pickProf, "crafting.professionChosenAt": Date.now(), "crafting.xp": Number(cur.xp) || 0 });
      });
      setMsg(""); setConfirmProf(false);
    } catch (e) { setMsg("Errore: " + (e.message || e)); }
    finally { setBusy(false); }
  }

  function toggleComp(key) {
    setComps((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : cur.length >= MAX_COMPONENTS ? cur : [...cur, key]);
  }

  // ── La prova: d20 → pregiatura → d12 → oggetto. Consuma l'uso e i componenti all'avvio. ──
  async function roll() {
    if (!prof || busy) return;
    if (!allow.can) { setMsg(allow.reason); return; }
    // Niente lavoro a credito: i materiali si pagano prima di accendere la forgia.
    if (!purse.ok) { setMsg(`💰 Non hai abbastanza oro: servono ${fmtMo(purse.cost)} di materiali e in borsa ne hai ${fmtMo(purse.have)}${purse.pending ? ` (${fmtMo(purse.pending)} già spesi al banco)` : ""}. Ti mancano ${fmtMo(purse.missing)}.`); return; }
    setBusy(true); setMsg("");
    try {
      // Ora vera dal server: decide giorno, settimana e la fine del lavoro.
      const srvNow = await serverNow();
      setClockOffset(srvNow.getTime() - Date.now());
      const a = rnd(20), b = rnd(20);
      const d20 = advMode === "adv" ? Math.max(a, b) : advMode === "dis" ? Math.min(a, b) : a;
      // Ogni componente dà +1d3 al tiro (tirato adesso, resta nel registro).
      const compRolls = work.components.map((k) => ({ key: k, roll: rnd(COMPONENT_ROLL_DIE) }));
      const compBonus = compRolls.reduce((s, c) => s + c.roll, 0);
      const rollBonus = bonus + compBonus;
      const total = d20 + rollBonus;
      // Disastro vero = SOLO il fallimento critico della fretta (5%): materiali
      // e monete persi, niente oggetto.
      // L'1 NATURALE invece non brucia più il lavoro (2026-09-22): l'oggetto
      // esce comunque, ma sempre alla rarità più bassa (Scarso, anche per chi
      // di solito la salverebbe col grado Artigiano) e con una MALEDIZIONE che
      // vede solo il Master. Il giocatore vede solo un pezzo venuto male.
      const fumble = d20 === 1;
      const critRoll = paceOpt.critFail ? rnd(100) : 0;
      const paceFail = !!paceOpt.critFail && critRoll <= paceOpt.critFail;
      const failed = paceFail;
      let tier = tierByTotal(total);
      if (fumble) tier = "scarso";
      else {
        // Non si supera la rarità mirata (i materiali sono quelli); Molto raro/Leggendario solo dal grado giusto.
        if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(target)) tier = target;
        while (tierMinGrade(tier) > prog.level.grado) tier = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1];
        if (tier === "scarso" && prog.scarsoAsComune) tier = "common";
      }
      // L'oggetto: la linea scelta nel catalogo (alla rarità uscita) oppure il d12 sulla tabella.
      const picked = pickLine && tierMeta(tier).pick ? pickLine[tier] : null;
      const d12 = picked ? 0 : rnd(12);
      const failDesc = `La fretta ha rovinato tutto: i materiali e le ${fmtMo(costMo)} spese sono perduti e non è uscito nulla.`;
      const [name, desc] = failed ? ["Fallimento critico", failDesc] : picked || prof.creazioni[tier][d12 - 1];
      // La maledizione dell'1 naturale: su misura per l'oggetto e per l'impegno
      // messo nel lavoro. La inventa Gemini; se non risponde c'è la tabella
      // locale, così il tiro non resta mai appeso alla rete.
      let curse = null;
      if (fumble && !failed) {
        const cls = classifyCraftedItem(prof.key, name, desc);
        curse = await generateCurse({
          oggetto: name, descrizione: desc, tipo: cls.foundryType,
          professione: prof.name, artigiano: charData?.name || "",
          rarita: tierMeta(tier).label, rarritaMirata: targetMeta.label,
          gravita: curseGravita({ targetTier: target, invest: investOpt.key, components: work.components, pace: paceOpt.key }),
          investimento: investOpt.label, ritmo: paceOpt.label,
          componenti: work.components.map((k) => componentByKey(k)?.name || k),
        });
      }
      const failMs = FAIL_MINUTES * 60000;
      const nat20 = d20 === 20;
      // 20 naturale: tanta bravura che i materiali bastano per metà della spesa.
      const paidMo = nat20 && !failed ? Math.round(costMo * NAT20_COST_MULT) : costMo;
      // L'esito pesa sul tempo: centrare la rarità costa il tempo preparato,
      // mancarla lo allunga, un 20 naturale lo accorcia.
      const dist = Math.max(0, TIER_ORDER.indexOf(target) - TIER_ORDER.indexOf(tier));
      const outWork = failed ? work : applyOutcomeTime(work, { dist, nat20 });
      const startMs = srvNow.getTime();
      const entry = {
        id: `${startMs}-${d20}${d12}`, at: startMs, readyAt: startMs + (failed ? failMs : outWork.minutes * 60000), minutes: failed ? FAIL_MINUTES : outWork.minutes, work: outWork, plannedMinutes: work.minutes,
        dayKey: "", weekKey: "",
        profession: prof.key, targetTier: target, tier, d20, d20b: advMode ? b : 0, adv: advMode,
        bonus: rollBonus, bonusParts: { abil, tools: toolB, grade: gradeB, extra, comps: compBonus }, compRolls, total, d12, name, desc,
        pick: pickLine ? pickLine.key : "", pickName: pickLine ? pickLine[target][0] : "",
        // Con l'1 naturale i materiali di pregio vanno sprecati: niente ✦.
        invest: investOpt.key, upgraded: !failed && !fumble && investOpt.upgrade, costMo: paidMo, listCostMo: costMo, halfCost: nat20 && !failed, pace: paceOpt.key, components: work.components,
        goldInboxId: "", goldDone: false,
        dist, outcome: failed ? "" : outWork.outcome,
        xp: failed ? 0 : xpWithInvestment(xpForCraft(tier, nat20), investOpt), xpPaid: false, nat20, inboxId: "", enhancer: "", choice: "", note: "",
        failed, fumble, critRoll, skipped: false, // anche il disastro sta sul banco: due minuti di barra rossa
        cursed: !!curse, curse, // SOLO PER IL MASTER: il giocatore non deve vederla mai
        componentProof: {}, toolsProof: toolsOn ? toolsEv.label : "",
      };
      // Transazione: rilegge contatori e scorte e rifiuta se nel frattempo sono stati consumati.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "characters", uid);
        const snap = await tx.get(ref);
        const data = snap.exists() ? snap.data() : {};
        const cur = data.crafting || {};
        const al = craftAllowance(cur, srvNow);
        if (!isMaster && !al.can) throw new Error(al.reason);
        // L'oro si ricontrolla sullo snapshot fresco: due schede aperte in
        // parallelo non possono spendere due volte le stesse monete.
        const pay = affordFromSnapshot(data, costMo);
        if (!isMaster && !pay.ok) throw new Error(`💰 Non hai abbastanza oro: servono ${fmtMo(costMo)} di materiali e in borsa ne hai ${fmtMo(pay.have)}. Ti mancano ${fmtMo(pay.missing)}.`);
        const prevLog = Array.isArray(cur.log) ? cur.log : [];
        if (prevLog.some((e) => !e.inboxId && !e.skipped)) throw new Error("Hai già un lavoro sul banco: finiscilo o scartalo prima.");
        entry.dayKey = al.dayKey; entry.weekKey = al.weekKey;
        const patch = {
          "crafting.weekKey": al.weekKey,
          "crafting.weekCount": al.weekCount + 1,
          "crafting.lastDayKey": al.dayKey,
          "crafting.lastAt": serverTimestamp(),
          "crafting.totalCount": (Number(cur.totalCount) || 0) + 1, // contatore a vita: il registro tiene solo le ultime 40 voci
          "crafting.busyUntil": entry.readyAt,
          // I PE NON si accreditano qui: la barra che salta di 5 o di 60 direbbe
          // al giocatore com'è andato il tiro prima del tempo. Si pagano al
          // ritiro (claim), con `xpPaid` a fare da segno (2026-09-22).
          "crafting.log": [entry, ...prevLog].slice(0, 40),
          // Le monete escono ADESSO dalla borsa: `goldPending` è la spesa
          // dell'Officina non ancora scalata sull'attore di Foundry, e
          // `availableGp` la toglie dall'oro della scheda. Il Master la chiude
          // quando la manda alla macro (o la segna "già pagata").
          "crafting.goldPending": Math.max(0, (Number(cur.goldPending) || 0) + (Number(entry.costMo) || 0)),
        };
        // I componenti: dalla scorta del Master si consumano (uno per tipo); altrimenti
        // devono risultare sulla scheda Foundry o comprati al Mercato (il Master li toglie lui).
        for (const k of entry.components) {
          const c = componentByKey(k);
          const n = Number(cur.components?.[k]) || 0;
          if (n > 0) { patch[`crafting.components.${k}`] = n - 1; entry.componentProof[k] = `scorta del Master (consumato 1 di ${n})`; continue; }
          const ev = componentEvidence(c, ownCtx);
          if (!ev.ok && !isMaster) throw new Error(`${c?.name || k}: non risulta tra le tue cose.`);
          entry.componentProof[k] = ev.ok && ev.label ? `${ev.label} · da togliere dalla scheda` : "Master";
        }
        tx.update(ref, patch);
      });
      // Il dado rotola davanti a tutti, ma il numero lo vede solo il Master:
      // per i giocatori si ferma su una runa (2026-09-22).
      await showD20Roll(d20, { label: `Pregiatura · ${prof.name}`, hidden: !isMaster });
      setComps([]); setPickIdx(-1); setInvest(""); setChoice(""); setEnhKey(""); setNote(""); setRevealedId("");
      const tm = tierMeta(tier);
      const compTxt = compRolls.length ? ` (componenti +${compBonus})` : "";
      if (failed) setMsg(`💥 Fallimento critico della fretta (${critRoll}/100 sotto il ${paceOpt.critFail}%): il lavoro sta andando a rotoli. Fra ${FAIL_MINUTES} minuti vedrai i danni.`);
      // Al giocatore non si dice NIENTE dell'esito finché non ritira l'oggetto.
      else if (!isMaster) setMsg(`🔨 Il lavoro è partito e il banco è occupato. Il tiro lo ha visto solo il Master: cos'è uscito lo scopri quando ritiri l'oggetto, ${whenLabel(entry.readyAt, srvNow)}.`);
      else {
        const o = outcomeTimeBy(outWork.outcome);
        const timeTxt = outWork.minutes === work.minutes
          ? `Il lavoro dura ${fmtMinutes(outWork.minutes)}`
          : `${o.label}: il lavoro passa da ${fmtMinutes(work.minutes)} a ${fmtMinutes(outWork.minutes)}`;
        const costTxt = nat20 ? `Paghi solo ${fmtMo(paidMo)} invece di ${fmtMo(costMo)}: col 20 naturale ti è bastata metà dei materiali` : `Paghi ${fmtMo(paidMo)} di materiali`;
        const curseTxt = curse ? ` ☠ 1 NATURALE: l'oggetto esce Scarso e MALEDETTO — "${curse.nome}": ${curse.meccanica}` : "";
        setMsg(`${tm.icon} ${d20}${advMode ? ` (${advMode === "adv" ? "vantaggio" : "svantaggio"}: ${a}/${b})` : ""} ${sign(rollBonus)}${compTxt} = ${total} → ${tm.label}${investOpt.upgrade ? " (di fattura superiore)" : ""}. ${costTxt}. ${timeTxt}: l'oggetto si ritira ${whenLabel(entry.readyAt, srvNow)}. +${entry.xp} PE${nat20 ? " (20 naturale, PE raddoppiati!)" : ""}.${curseTxt}`);
      }
    } catch (e) { setMsg("Errore: " + (e.message || e)); }
    finally { setBusy(false); }
  }

  // ── Ritiro: si apre l'oggetto solo se, per l'ora del server, il lavoro è finito. ──
  async function claim() {
    if (!pendingEntry || busy) return;
    setBusy(true); setMsg("");
    try {
      const srvNow = await serverNow();
      setClockOffset(srvNow.getTime() - Date.now());
      if (srvNow.getTime() < readyAt) { setMsg(`Non è ancora pronto: mancano ${fmtCountdown(readyAt - srvNow.getTime())}.`); return; }
      // I PE della prova si accreditano ADESSO, aprendo l'oggetto: al tiro
      // resterebbero in vista e tradirebbero la rarità uscita.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "characters", uid);
        const snap = await tx.get(ref);
        const cur = snap.exists() ? (snap.data().crafting || {}) : {};
        const prevLog = Array.isArray(cur.log) ? cur.log : [];
        const e = prevLog.find((x) => x.id === pendingEntry.id);
        if (!e || e.xpPaid !== false) return; // già pagati, o prova di prima del 2026-09-22
        tx.update(ref, {
          "crafting.log": prevLog.map((x) => (x.id === e.id ? { ...x, xpPaid: true } : x)),
          "crafting.xp": (Number(cur.xp) || 0) + (Number(e.xp) || 0),
        });
      });
      setRevealedId(pendingEntry.id); setChoice(itemChoices(pendingEntry.name)[0]); setEnhKey(""); setNote("");
    } catch (e) { setMsg("Errore: " + (e.message || e)); }
    finally { setBusy(false); }
  }

  // ── Invio nella coda del Master (foundry_inbox) ──
  async function sendToFoundry(entry) {
    if (!entry || busy) return;
    const enh = ENHANCERS.find((x) => x.key === enhKey) || null;
    const ev = enh ? enhancerEvidence(enh, { charData, marketItems, isMaster }) : null;
    if (enh && !ev.ok) { setMsg(`Errore: ${enh.name} non risulta tra i tuoi oggetti (${ev.label}).`); return; }
    setBusy(true); setMsg("");
    try {
      const p = PROFESSIONI.find((x) => x.key === entry.profession) || prof;
      const payload = craftedItemToFoundryPayload({
        profession: p, tier: entry.tier, name: entry.name, desc: entry.desc,
        choice: itemChoices(entry.name).length > 1 ? choice : "",
        enhancer: enh, note: note.trim(), work: entry.work || null, components: entry.components || [], upgraded: !!entry.upgraded,
        crafter: { uid, name: charData?.name || currentUser.email, gradeName: prog.grado.name },
        roll: { d20: entry.d20, bonus: entry.bonus, total: entry.total, d12: entry.d12 },
      });
      const inv = investmentByKey(entry.invest);
      const conds = [
        inv.key ? `${inv.label.toLowerCase()} (+${inv.costPct}% di spesa)` : "",
        entry.quality ? `materiali ${LEGACY_QUALITY[entry.quality] || entry.quality}` : "", // prove di prima del 2026-09-22
        entry.work && !entry.work.tools ? "senza strumenti" : "",
      ].filter(Boolean);
      const ref = await addDoc(collection(db, "foundry_inbox"), {
        status: "pending", ...payload,
        origin: "crafting", crafterUid: uid, crafterName: charData?.name || "",
        craft: {
          profession: p.key, tier: entry.tier, targetTier: entry.targetTier, d20: entry.d20, total: entry.total, d12: entry.d12,
          enhancer: enh?.key || "", enhancerSource: ev?.source || "", enhancerProof: ev?.label || "", note: note.trim(),
          cost: fmtMo(entry.costMo || tierMo(entry.targetTier)), investment: inv.key, investmentPct: inv.costPct, upgraded: !!entry.upgraded, mods: conds,
          minutes: entry.minutes || 0, work: entry.work ? craftTimeLabel(entry.work) : "", startedAt: entry.at || 0, readyAt: entry.readyAt || 0,
          components: (entry.components || []).map((k) => componentByKey(k)?.name || k),
          componentBonus: entry.bonusParts?.comps || 0,
          componentProofs: (entry.components || []).map((k) => `${componentByKey(k)?.name || k}: ${entry.componentProof?.[k] || "—"}`),
          toolsProof: entry.toolsProof || "",
          componentEffects: (entry.components || []).map((k) => componentByKey(k)).filter((c) => c?.effect).map((c) => `${c.name}: ${c.effect.label}`),
          // ☠ Maledizione dell'1 naturale: va nella coda del Master, MAI nella
          // descrizione che finisce su Foundry (la leggerebbe il giocatore).
          cursed: !!entry.cursed,
          curse: entry.cursed && entry.curse ? entry.curse : null,
        },
        createdAt: serverTimestamp(), createdBy: currentUser.email,
      });
      const newLog = log.map((e) => (e.id === entry.id ? { ...e, inboxId: ref.id, enhancer: enh?.key || "", choice: payload.name, note: note.trim() } : e));
      const patch = { "crafting.log": newLog.slice(0, 40), "crafting.busyUntil": deleteField() };
      // La scorta assegnata dal Master si consuma: un cristallo incastonato non torna indietro.
      if (ev?.source === "scorta") patch[`crafting.enhancers.${enh.key}`] = Math.max(0, (ev.stock || 1) - 1);
      await updateDoc(doc(db, "characters", uid), patch);
      setRevealedId("");
      setMsg(`📦 "${payload.name}" è nella coda del Master: comparirà nel tuo inventario su Foundry alla prossima importazione.`);
    } catch (e) { setMsg("Errore: " + (e.message || e)); }
    finally { setBusy(false); }
  }

  // Scarta la prova senza mandarla (resta nel registro come "non inviata").
  async function skipEntry(entry) {
    if (!entry) return;
    const newLog = log.map((e) => (e.id === entry.id ? { ...e, skipped: true } : e));
    await updateDoc(doc(db, "characters", uid), { "crafting.log": newLog, "crafting.busyUntil": deleteField() });
    setRevealedId("");
  }

  const workPct = pendingEntry ? Math.max(0, Math.min(100, Math.round(((nowMs - (pendingEntry.at || 0)) / Math.max(1, readyAt - (pendingEntry.at || 0))) * 100))) : 0;
  const ownedComps = COMPONENTS.map((c) => { const ev = componentEvidence(c, ownCtx); return { ...c, n: ev.qty, ev }; });
  const anyComp = ownedComps.some((c) => c.n > 0);
  const compCount = ownedComps.reduce((a, c) => a + (Number.isFinite(c.n) ? c.n : 0), 0);

  // ── Le pieghe (2026-09-22): una schermata per volta, così il tiro è sempre
  // a portata di pollice e non si scorre mezza pagina per vedere le creazioni.
  // Niente icone: a queste pieghe covo.css mette la sua runa (tab = dadi runici).
  // Il MASTER non forgia: la sua Officina e' solo governo del tavolo e letture
  // (2026-09-22 sera). Niente banco, niente registro personale, niente scorta:
  // quelle pieghe sono del giocatore. Per provare il flusso da giocatore resta
  // `?vista=player` in DEV, che spegne `isMaster` e rimette tutto.
  const TABS = isMaster ? [
    { key: "master", label: "Il tavolo", n: tableChars.filter((c) => benchOf(c.crafting)).length },
    { key: "artigiani", label: "Artigiani", n: tableChars.filter((c) => c.crafting?.profession).length },
    { key: "scorte", label: "Scorte" },
    { key: "spese", label: "Spese", n: openSpese(tableChars).length },
    { key: "registro", label: "Registro" },
    { key: "statistiche", label: "Statistiche" },
    { key: "progressi", label: "Progressi" },
  ] : [
    { key: "banco", label: prof ? "Il banco" : "La professione" },
    { key: "creazioni", label: "Creazioni", n: log.length },
    { key: "componenti", label: "Componenti", n: compCount },
    { key: "progressi", label: "Progressi" },
  ];
  const curTab = TABS.some((t) => t.key === tab) ? tab : TABS[0].key;

  return (
    <div className="off" id="off-banco">
      {/* ── TESTATA: professione, grado, usi ── */}
      <div className={`nx-pannello off-box off-head${isMaster ? " off-head--master" : ""}`}>
        <div className="off-head-main">
          <span className="nx-tag">{isMaster ? "🎯 Officina · il tavolo" : "⚒ Officina"}</span>
          {isMaster ? (
            <p className="nx-prosa off-lead">Da qui <strong>governi</strong> l'Officina: chi sta forgiando adesso, il registro di tutte le prove, le scorte, le spese da scalare su Foundry e le statistiche del tavolo. <strong>Il banco è dei giocatori</strong>: tu non tiri e non paghi materiali.</p>
          ) : prof ? (
            <>
              <div className="off-prof" style={{ "--c": prof.carColor }}>
                <span className="off-prof-ic" aria-hidden="true">{prof.icon}</span>
                <div>
                  <div className="nx-nome off-prof-name">{charData?.name || "Il tuo personaggio"} · {prof.name}</div>
                  <div className="nx-meta">{prog.grado.icon} {prog.grado.name} · livello {prog.level.lv} · {prog.xp} PE {prog.next ? `(${prog.next.xp - prog.xp} al livello ${prog.next.lv})` : "· massimo"}</div>
                </div>
              </div>
              <div className="off-xp" role="progressbar" aria-valuenow={prog.pct} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${prog.pct}%` }} /></div>
              <p className="nx-nota off-postazione">🏠 Al tavolo ti serve <strong>{postazioneFor(prof.key)}</strong>; da qui nell'app puoi lavorare ovunque.</p>
            </>
          ) : (
            <p className="nx-prosa off-lead">Scegli la tua <strong>professione</strong>: <strong>una sola per personaggio</strong>, e non si cambia più (solo il Master può farlo). Da qui potrai creare oggetti anche fuori dalla sessione.</p>
          )}
        </div>
        {isMaster ? (
          <div className="off-usi" aria-label="Limiti dei giocatori">
            <div className="off-uso"><b>{CRAFT_MAX_PER_DAY}</b><small>al giorno</small></div>
            <div className="off-uso"><b>{CRAFT_MAX_PER_WEEK}</b><small>a settimana</small></div>
            <div className="off-reset"><small>si azzera</small>{craftResetLabel(now)}</div>
          </div>
        ) : allow.unlimited ? (
          <div className="off-usi" aria-label="Prove disponibili">
            <div className="off-uso"><b>∞</b><small>Master</small></div>
            <div className="off-reset"><small>senza limiti</small>i giocatori hanno {CRAFT_MAX_PER_DAY} prova al giorno, {CRAFT_MAX_PER_WEEK} a settimana</div>
          </div>
        ) : (
          <div className="off-usi" aria-label="Prove disponibili">
            <div className={`off-uso${allow.usedToday ? " is-off" : ""}`}><b>{allow.usedToday ? "0" : "1"}</b><small>oggi</small></div>
            <div className={`off-uso${allow.weekLeft === 0 ? " is-off" : ""}`}><b>{allow.weekLeft}<span>/{CRAFT_MAX_PER_WEEK}</span></b><small>settimana</small></div>
            <div className="off-reset"><small>si azzera</small>{craftResetLabel(now)}</div>
          </div>
        )}
      </div>

      {/* ── Il lavoro sul banco si vede da ogni piega ── */}
      {!isMaster && prof && pendingEntry && !revealed && (
        <button type="button" className={`off-live${pendingEntry.failed ? " is-fail" : ready ? " is-ready" : ""}`} onClick={() => setTab("banco")} style={{ "--q": pendingEntry.failed ? "#b91c1c" : tierMeta(pendingEntry.targetTier || pendingEntry.tier).color }}>
          <span className="off-live-ic" aria-hidden="true">{pendingEntry.failed ? "💥" : ready ? "✨" : "🔨"}</span>
          <span className="off-live-main">
            <b>{pendingEntry.failed ? (ready ? "Fallimento critico: guarda i danni" : "Il lavoro sta andando a rotoli…") : ready ? "Il lavoro è finito: ritira l'oggetto" : `Sul banco · ${pendingEntry.pickName || "oggetto a sorpresa"}`}</b>
            <span className="off-live-bar"><i style={{ width: `${workPct}%` }} /></span>
          </span>
          <span className="off-live-t">{ready ? "pronto" : fmtCountdown(readyAt - nowMs)}</span>
        </button>
      )}

      {/* ── LE PIEGHE ── */}
      {/* <div>, non <nav>: shell.css veste ogni <nav> da drawer e lo manderebbe fuori schermo */}
      <div className="off-tabs" role="tablist" aria-label="Sezioni dell'Officina">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={curTab === t.key} className={`off-tab${curTab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}{t.n ? ` · ${t.n}` : ""}
          </button>
        ))}
      </div>

      {msg && <div className={`off-msg${msg.startsWith("Errore") || msg.startsWith("💥") ? " is-err" : ""}`}><span>{msg}</span><button type="button" className="off-msg-x" onClick={() => setMsg("")} aria-label="Chiudi">✕</button></div>}

      {/* ══ PIEGA: IL BANCO ══ */}
      {curTab === "banco" && (<>

      {/* ── SCELTA PROFESSIONE ── */}
      {!prof && (
        <div className="nx-pannello off-box">
          <p className="nx-nota off-postazione off-postazione--intro">
            🏠 <strong>In sessione funziona uguale</strong>: stesso tiro, stesse rarità, stessi tempi. Al tavolo però ti serve la <strong>postazione</strong> della tua arte (fucina, alambicco, telaio…): si trovano nel mondo, nelle città, negli avamposti e in qualche rovina, e il Master ti dice quando ne hai una a portata. Da qui nell'app puoi lavorare sempre.
          </p>
          <div className="off-profs">
            {PROFESSIONI.map((p) => (
              <button key={p.key} type="button" className={`off-prof-btn${pickProf === p.key ? " on" : ""}`} style={{ "--c": p.carColor }} onClick={() => { setPickProf(p.key); setConfirmProf(false); }}>
                <span className="off-prof-btn-ic" aria-hidden="true">{p.icon}</span>
                <span className="off-prof-btn-name">{p.name}</span>
                <span className="off-prof-btn-stat">{p.caratteristica}</span>
              </button>
            ))}
          </div>
          {pickProf && (
            <div className="off-pick">
              <p className="nx-nota"><strong>{PROFESSIONI.find((p) => p.key === pickProf)?.caratteristica}</strong> · {PROFESSIONI.find((p) => p.key === pickProf)?.bonusIniziale}</p>
              <p className="nx-nota off-postazione">🏠 Postazione in gioco: <strong>{postazioneFor(pickProf)}</strong>.</p>
              {!confirmProf ? (
                <button type="button" className="cta off-cta" disabled={busy} onClick={() => setConfirmProf(true)}>Divento {PROFESSIONI.find((p) => p.key === pickProf)?.name}</button>
              ) : (
                <div className="off-confirm">
                  <p className="nx-nota"><strong>⚠ Scelta definitiva.</strong> Un personaggio ha una sola professione: da qui non si torna indietro senza il Master.</p>
                  <div className="off-go">
                    <button type="button" className="cta off-cta" disabled={busy} onClick={chooseProfession}>Confermo: sarò {PROFESSIONI.find((p) => p.key === pickProf)?.name}</button>
                    <button type="button" className="off-ghost" disabled={busy} onClick={() => setConfirmProf(false)}>Ci ripenso</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── IL BANCO: si prepara il lavoro (se non ce n'è uno in corso) ── */}
      {prof && !pendingEntry && (
        <div className="nx-pannello off-box off-prova">
          <div className="off-bank">
            <div className="off-bank-col">
              <h3 className="off-h"><span className="orb" aria-hidden="true">1</span> La rarità <small>materiali e tempo</small></h3>
              <div className="off-tiers">
                {PREGIATURE.filter((p) => p.key !== "scarso").map((p) => {
                  const locked = tierMinGrade(p.key) > prog.level.grado;
                  const gradeName = p.key === "legendary" ? "Leggenda" : "Maestro";
                  return (
                    <button key={p.key} type="button" className={`off-tier${target === p.key ? " on" : ""}`} style={{ "--q": p.color }} disabled={locked} onClick={() => { setTarget(p.key); setPickIdx(-1); }} title={locked ? `Solo dal grado ${gradeName}` : p.desc}>
                      <span className="off-tier-top"><span aria-hidden="true">{p.icon}</span> {p.label} <small>{p.range}</small></span>
                      <span className="off-tier-time">{locked ? `🔒 ${gradeName}` : `⏱ ${fmtMinutes(CRAFT_BASE_MINUTES[p.key])} · ${fmtMo(tierMo(p.key))}`}</span>
                    </button>
                  );
                })}
              </div>
              {targetCost && <p className="nx-nota off-cost">{targetMeta.pick ? "Se il tiro non conferma la rarità esce lo stesso oggetto della rarità sotto; sotto 6 uno Scarso a caso." : "L'oggetto lo decide il d12 alla fine; con un tiro basso esce un oggetto a caso della rarità uscita."}</p>}

              <h3 className="off-h"><span className="orb" aria-hidden="true">2</span> {targetMeta.pick ? "L'oggetto" : "L'oggetto lo decide il dado"} <small>{targetMeta.pick ? `uno dei ${catalogo.length} del ${prof.name}` : `tabella ${targetMeta.label}, d12`}</small></h3>
              {targetMeta.pick ? (
                <div className="off-items">
                  {catalogo.map((line, i) => {
                    const [nm, ds] = line[target] || ["—", ""];
                    const below = target !== "common" ? line[TIER_ORDER[TIER_ORDER.indexOf(target) - 1]]?.[0] : "";
                    return (
                      <button key={line.key} type="button" className={`off-item${pickIdx === i ? " on" : ""}`} style={{ "--q": targetMeta.color }} onClick={() => setPickIdx(i)}>
                        <span className="off-item-ic" aria-hidden="true">{line.icon}</span>
                        <span className="off-item-main"><b>{nm}</b><small>{ds}</small>{pickIdx === i && below && <em>con un tiro basso: {below}</em>}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="off-random" style={{ "--q": targetMeta.color }}>
                  <span className="off-random-die" aria-hidden="true">d12</span>
                  <span className="off-random-main">
                    <b>{targetMeta.icon} {targetMeta.label}: {prof.creazioni[target]?.length || 12} possibili creazioni</b>
                    <small>Escono a caso alla fine del lavoro. Le vedi tutte nel <Link to="/crafting#cr-professioni">manuale</Link>, alla scheda del {prof.name}.</small>
                    {prog.level.lv >= 4 && prof.creazioni[target]?.length === 12 && <em>👁 Occhio esperto · con 1: {prof.creazioni[target][0][0]} · con 12: {prof.creazioni[target][11][0]}</em>}
                  </span>
                </div>
              )}

              <h3 className="off-h"><span className="orb" aria-hidden="true">✦</span> Cosa può uscire <small>il tiro decide oggetto, tempo e PE</small></h3>
              <div className="off-bands">
                {bands.map((b) => {
                  const tm = tierMeta(b.tier);
                  return (
                    <div key={b.key} className={`off-band${b.top ? " is-top" : ""}`} style={{ "--q": tm.color }}>
                      <span className="off-band-r">{b.range}</span>
                      <span className="off-band-t">{tm.icon} {tm.label}{b.merged ? <i> (lo Scarso ti conta come Comune)</i> : null}</span>
                      <span className="off-band-n">{b.name}</span>
                      <span className="off-band-x">⏱ {fmtMinutes(b.minutes)} · +{b.xp} PE</span>
                    </div>
                  );
                })}
                {/* L'1 naturale non brucia più il lavoro: l'oggetto esce, ma è
                    il peggio del banco — e si porta dietro qualcosa che solo il
                    Master conosce (2026-09-22). */}
                <div className="off-band is-fail" style={{ "--q": "#6b21a8" }}>
                  <span className="off-band-r">1 nat.</span>
                  <span className="off-band-t">🪨 Scarso</span>
                  <span className="off-band-n">esce il peggio del banco, e il pezzo si porta dietro qualcosa: lo sa solo il Master</span>
                  <span className="off-band-x">⏱ {fmtMinutes(nat1Minutes)} · +{nat1Xp} PE</span>
                </div>
              </div>
              <p className="nx-nota off-bands-note">Il totale non può salire sopra la rarità mirata: i materiali sono quelli. Più il tiro resta sotto, più pezzi devi rifare e più il lavoro dura (+25% una rarità sotto, +50% da due in giù). Con un <strong>20 naturale</strong> ti riesce al primo colpo: tempo al 60%, PE doppi e <strong>materiali a metà prezzo</strong>, perché te ne è bastata la metà.</p>
            </div>

            <div className="off-bank-col off-bank-side">
              <h3 className="off-h"><span className="orb" aria-hidden="true">3</span> Il banco <small>tiro, tempo e spesa</small></h3>

              {/* strumenti: nessun tocco, conta solo la scheda */}
              {toolsEv.ok ? (
                <div className="off-tools is-ok">
                  <b>🧰 Hai gli strumenti</b>
                  <span>−{fmtMinutes(TOOLS_MINUTES)} · {sign(profBonus(charData))} competenza · ✓ {toolsEv.label}</span>
                </div>
              ) : (
                <div className="off-tools is-bad">
                  <b>🧰 Senza strumenti</b>
                  <span>tempo pieno e <em>svantaggio</em>. Non risultano <strong>{toolsEv.hint}</strong> sulla scheda: mettili nell'inventario su Foundry e sincronizza, oppure comprali al Mercato.</span>
                </div>
              )}

              <div className="off-bench">
                {/* componenti */}
                <div className="off-tile">
                  <span className="off-tile-h">🧪 Componenti <small>{comps.length}/{MAX_COMPONENTS}</small></span>
                  {anyComp ? (
                    <div className="off-comps">
                      {ownedComps.filter((c) => c.n > 0).map((c) => {
                        const on = comps.includes(c.key);
                        const full = !on && comps.length >= MAX_COMPONENTS;
                        return (
                          <button key={c.key} type="button" className={`off-comp${on ? " on" : ""}`} disabled={full} onClick={() => toggleComp(c.key)} title={`${c.desc} · ${c.ev.label}`}>
                            <span className="off-comp-ic" aria-hidden="true">{c.icon}</span>
                            <span className="off-comp-name">{c.name}{c.effect ? <i className="off-comp-eff"> · {componentEffectLabel(c)}</i> : null}</span>
                            <span className="off-comp-fx">−{c.minutes} min · +1–{COMPONENT_ROLL_DIE}{Number.isFinite(c.n) ? <i> · ×{c.n}</i> : null}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="off-tile-empty">Nessun componente risulta tuo: li trovi <strong>in sessione</strong>. Ognuno accorcia il lavoro di 30–60 min e dà +1–{COMPONENT_ROLL_DIE} al tiro.</p>
                  )}
                  {comps.length > 0 && <span className="off-tile-fx"><em>−{fmtMinutes(comps.reduce((a, k) => a + (componentByKey(k)?.minutes || 0), 0))}</em> · <em>+{comps.length}–{comps.length * COMPONENT_ROLL_DIE}</em> al tiro · si consumano</span>}
                </div>

                {/* investimento nei materiali */}
                <div className="off-tile">
                  <span className="off-tile-h">💰 Quanto spendi <small>base {fmtMo(baseMo)}</small></span>
                  <div className="off-seg off-seg--col" role="radiogroup" aria-label="Investimento nei materiali">
                    {INVESTMENTS.map((iv) => (
                      <button key={iv.key || "base"} type="button" role="radio" aria-checked={invest === iv.key} className={`off-seg-btn${invest === iv.key ? " on" : ""}`} onClick={() => setInvest(iv.key)} title={iv.desc}>
                        <span aria-hidden="true">{iv.icon}</span> {iv.label}
                        <i className="off-seg-n">{iv.costPct ? `${fmtMo(investCostMo(baseMo, iv))} · +${iv.costPct}%` : fmtMo(baseMo)}</i>
                      </button>
                    ))}
                  </div>
                  <span className="off-tile-fx">{investOpt.roll ? <><em>+{investOpt.roll} al tiro</em> · </> : null}{investOpt.upgrade ? <><em>oggetto migliorato</em> (+1 al colpire e ai danni, o +1 alla CA, o effetto più forte) · </> : null}{investOpt.xpPct ? <><em>+{investOpt.xpPct}% PE</em></> : "nessun extra: paghi solo i materiali"}</span>
                </div>

                {/* ritmo */}
                <div className="off-tile">
                  <span className="off-tile-h">⏳ Ritmo</span>
                  <div className="off-seg" role="radiogroup" aria-label="Ritmo del lavoro">
                    {PACE_OPTIONS.map((p) => (
                      <button key={p.key} type="button" role="radio" aria-checked={pace === p.key} className={`off-seg-btn${pace === p.key ? " on" : ""}${p.roll < 0 ? " is-bad" : ""}`} onClick={() => setPace(p.key)} title={p.desc}>
                        <span aria-hidden="true">{p.icon}</span> {p.label}
                      </button>
                    ))}
                  </div>
                  <span className="off-tile-fx">{paceOpt.mult === 1 ? "tempo pieno, tiro normale" : <><em>×{paceOpt.mult === 0.5 ? "½" : paceOpt.mult} tempo</em> · {sign(paceOpt.roll)} al tiro{paceOpt.critFail ? <> · <em>{paceOpt.critFail}% fallimento critico</em>: perdi i materiali</> : null}</>}</span>
                </div>
              </div>

              {/* riepilogo: tempo + tiro + spesa */}
              <div className="off-sum">
                <div className="off-sum-time">
                  <span className="off-sum-k">Tempo di lavoro <i>se centri la rarità</i></span>
                  <b>⏱ {fmtMinutes(work.minutes)}</b>
                  <span className="off-sum-range">col tiro può andare da <b>{fmtMinutes(timeRange.min)}</b> (20 naturale) a <b>{fmtMinutes(timeRange.max)}</b> (due rarità sotto)</span>
                  <span className="off-sum-parts">
                    {work.parts.map((p) => <span key={p.key} className={`off-part${p.min < 0 ? " is-less" : p.key !== "base" && p.min > 0 ? " is-more" : ""}`}>{p.label} {p.key === "base" ? fmtMinutes(p.min) : `${p.min < 0 ? "−" : "+"}${fmtMinutes(Math.abs(p.min))}`}</span>)}
                  </span>
                  <small>pronto {whenLabel(nowMs + work.minutes * 60000, now)} se inizi adesso e centri la rarità</small>
                </div>
                <div className="off-sum-roll">
                  <span className="off-sum-k">Il tuo tiro</span>
                  <div className="off-formula">
                    <span className="off-die">d20</span>
                    <span className="off-piece"><b>{sign(abil)}</b><small>{prof.caratteristica}</small></span>
                    <span className={`off-piece${toolsOn ? "" : " is-off"}`}><b>{sign(toolB)}</b><small>strumenti</small></span>
                    <span className="off-piece"><b>{sign(gradeB)}</b><small>{prog.grado.name}</small></span>
                    {extra !== 0 && <span className="off-piece"><b>{sign(extra)}</b><small>spesa/ritmo</small></span>}
                    {comps.length > 0 && <span className="off-piece"><b>+{comps.length}–{comps.length * COMPONENT_ROLL_DIE}</b><small>componenti</small></span>}
                    <span className="off-eq">= d20 {sign(bonus)}{comps.length > 0 && <> +{comps.length}d{COMPONENT_ROLL_DIE}</>}{advMode && <em> · {advMode === "adv" ? "vantaggio" : "svantaggio"}</em>}</span>
                  </div>
                  <span className="off-sum-cost">Materiali <b>{fmtMo(costMo)}</b>{investOpt.costPct ? <i> (+{investOpt.costPct}% sui {fmtMo(baseMo)} di base)</i> : null} · <b>+{xpGain} PE</b> se esce {targetMeta.label}<i> · con un 20 naturale paghi solo {fmtMo(Math.round(costMo * NAT20_COST_MULT))}</i></span>
                  {/* La borsa: le monete escono dalla scheda appena parte il lavoro. */}
                  <span className={`off-sum-borsa${purse.ok ? "" : " is-short"}`}>
                    {purse.master ? <>👑 Master: crei senza pagare.</>
                      : purse.unknown ? <>💰 Oro non ancora sincronizzato da Foundry: la spesa non si può controllare. Fai una sincronizzazione della scheda.</>
                      : purse.ok ? <>💰 In borsa <b>{fmtMo(purse.have)}</b> → dopo il lavoro te ne restano <b>{fmtMo(purse.have - purse.cost)}</b>{purse.pending ? <i> ({fmtMo(purse.pending)} già spesi al banco e non ancora scalati su Foundry)</i> : null}</>
                      : <>💰 In borsa <b>{fmtMo(purse.have)}</b>: ti mancano <b>{fmtMo(purse.missing)}</b> per i materiali{purse.pending ? <i> ({fmtMo(purse.pending)} già spesi al banco)</i> : null}</>}
                  </span>
                </div>
              </div>

              <div className="off-go off-go--bar">
                <button type="button" className="cta off-cta" disabled={busy || !allow.can || needsPick || !purse.ok} onClick={roll}>
                  {busy ? "…" : !allow.can ? "Prova non disponibile" : !purse.ok ? `💰 Ti mancano ${fmtMo(purse.missing)}` : needsPick ? "Scegli prima l'oggetto" : `🎲 Tira e inizia · ${fmtMinutes(work.minutes)}`}
                </button>
                {!allow.can && <span className="nx-nota off-why">{allow.reason}</span>}
                {allow.can && !purse.ok && <span className="nx-nota off-why is-short">I materiali si pagano prima di iniziare: servono {fmtMo(purse.cost)} e in borsa hai {fmtMo(purse.have)}. Vendi qualcosa, fatti pagare una taglia, o punta a una rarità più bassa.</span>}
                {allow.can && pickLine && <span className="nx-nota off-why">{targetMeta.icon} {pickLine[target][0]} · {fmtMo(costMo)}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUL BANCO: il lavoro in corso, solo la barra ── */}
      {prof && pendingEntry && !revealed && (
        <div className={`nx-pannello off-box off-work${pendingEntry.failed ? " is-fail" : ready ? " is-ready" : ""}`} style={{ "--q": pendingEntry.failed ? "#b91c1c" : tierMeta(pendingEntry.targetTier || pendingEntry.tier).color }}>
          <div className="off-work-head">
            <span className="nx-tag">{pendingEntry.failed ? (ready ? "💥 Disastro" : "💥 Sta andando a rotoli") : ready ? "✓ Lavoro finito" : "⚒ Sul banco"}</span>
            {/* Il tiro è roba da Master: finché il pezzo è sul banco il giocatore
                non vede né il d20 né la rarità uscita (2026-09-22). */}
            <span className="off-work-roll">{pendingEntry.failed
              ? <>d20 <b>{pendingEntry.d20}</b> · fretta → <b>fallimento critico</b></>
              : isMaster
                ? <>{pendingEntry.pickName ? <>{tierMeta(pendingEntry.targetTier).icon} {pendingEntry.pickName} · </> : null}d20 <b>{pendingEntry.d20}</b> {sign(pendingEntry.bonus)} = <b>{pendingEntry.total}</b> → {tierMeta(pendingEntry.tier).icon} {tierMeta(pendingEntry.tier).label}{pendingEntry.cursed ? <> · <b className="off-cursed-tag">☠ maledetto</b></> : null}</>
                : <>{pendingEntry.pickName ? <>{tierMeta(pendingEntry.targetTier).icon} {pendingEntry.pickName} · </> : null}🎲 <b>tiro segreto</b> <small>(lo sa solo il Master)</small></>}</span>
          </div>
          <div className="off-bar" role="progressbar" aria-valuenow={workPct} aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: `${workPct}%` }} />
            <i className="off-bar-anvil" style={{ left: `${workPct}%` }} aria-hidden="true">{pendingEntry.failed ? "💥" : ready ? "✨" : "🔨"}</i>
          </div>
          <div className="off-work-times">
            <span><small>Iniziato</small>{whenLabel(pendingEntry.at, now)}</span>
            <span className="off-work-left"><small>{ready ? "Pronto" : "Manca"}</small>{ready ? "ora" : fmtCountdown(readyAt - nowMs)}</span>
            <span><small>Pronto</small>{whenLabel(readyAt, now)}</span>
          </div>
          <p className="nx-nota off-work-note">
            {pendingEntry.failed
              ? (ready ? "Il lavoro è andato perduto: guarda cos'è rimasto." : <>Il pezzo si sta rovinando sul banco: fra <strong>{fmtCountdown(readyAt - nowMs)}</strong> vedrai i danni.</>)
              : ready ? "L'oggetto è finito: ritiralo per vedere cos'è uscito e mandarlo al Master."
              /* Il confronto "tanto invece dei tot preparati, perché…" direbbe al
                 giocatore com'è andato il tiro: lo legge solo il Master. */
              : <>Il lavoro dura <strong>{pendingEntry.work ? craftTimeLabel(pendingEntry.work) : fmtMinutes(pendingEntry.minutes || 0)}</strong>{isMaster && pendingEntry.plannedMinutes && pendingEntry.plannedMinutes !== pendingEntry.minutes ? <> invece dei {fmtMinutes(pendingEntry.plannedMinutes)} preparati, perché {outcomeTimeBy(pendingEntry.outcome).label.toLowerCase()}</> : null}: finché non è finito l'oggetto resta sul banco. Puoi chiudere la pagina e tornare.{isMaster ? null : <> Com'è venuto lo scopri al ritiro.</>}</>}
          </p>
          <div className="off-go">
            <button type="button" className="cta off-cta" disabled={busy || !ready} onClick={claim}>{busy ? "…" : pendingEntry.failed ? (ready ? "💥 Guarda i danni" : `⏳ Ancora ${fmtCountdown(readyAt - nowMs)}`) : ready ? "📦 Ritira l'oggetto" : `⏳ Pronto tra ${fmtCountdown(readyAt - nowMs)}`}</button>
          </div>
        </div>
      )}

      {/* ── DISASTRO: niente oggetto, materiali e monete perduti ── */}
      {prof && activeEntry && activeEntry.failed && (
        <div className="nx-pannello off-box off-esito off-fail" style={{ "--q": "#b91c1c" }}>
          <div className="off-esito-head">
            <span className="nx-tag">💥 Fallimento critico</span>
            <div className="off-esito-roll">{isMaster ? <>d20 <b>{activeEntry.d20}</b>{activeEntry.adv ? <small> ({activeEntry.adv === "adv" ? "vant." : "svant."} {activeEntry.d20b})</small> : null}{activeEntry.fumble ? <> · <b>1 naturale</b></> : <> · fretta ({activeEntry.critRoll}/100)</>} · </> : null}+0 PE</div>
          </div>
          <h3 className="nx-titolo off-esito-name">Hai perso tutto</h3>
          <p className="nx-prosa off-esito-desc">{activeEntry.desc}</p>
          <ul className="off-fail-list">
            <li>💰 <b>{fmtMo(activeEntry.costMo || 0)}</b> di materiali: <strong>persi</strong>. Sono già usciti dalla tua borsa; il Master li scala anche sulla scheda di Foundry.</li>
            {(activeEntry.components || []).length > 0 && <li>🧪 Componenti usati: <strong>consumati</strong> ({(activeEntry.components || []).map((k) => componentByKey(k)?.name || k).join(", ")}).</li>}
            <li>📦 Oggetto creato: <strong>nessuno</strong>, non c'è niente da mandare al Master.</li>
            <li>📈 Esperienza: <strong>0 PE</strong>, e la prova di oggi è consumata.</li>
          </ul>
          <div className="off-go off-go--bar">
            <button type="button" className="cta off-cta" disabled={busy} onClick={() => skipEntry(activeEntry)}>Libera il banco</button>
          </div>
        </div>
      )}

      {/* ── RISULTATO → FORM FOUNDRY ── */}
      {prof && activeEntry && preview && (
        <div className="nx-pannello off-box off-esito" style={{ "--q": tierMeta(activeEntry.tier).color }}>
          <div className="off-esito-head">
            <span className="nx-tag">{tierMeta(activeEntry.tier).icon} {tierMeta(activeEntry.tier).label}{activeEntry.upgraded ? " · ✦ superiore" : ""}</span>
            <div className="off-esito-roll">d20 <b>{activeEntry.d20}</b>{activeEntry.adv ? <small> ({activeEntry.adv === "adv" ? "vant." : "svant."} {activeEntry.d20b})</small> : null} {sign(activeEntry.bonus)} = <b>{activeEntry.total}</b>{activeEntry.d12 ? <> · d12 <b>{activeEntry.d12}</b></> : null} · +{activeEntry.xp} PE{activeEntry.minutes ? <> · ⏱ {fmtMinutes(activeEntry.minutes)}{activeEntry.plannedMinutes && activeEntry.plannedMinutes !== activeEntry.minutes ? <small> (previsti {fmtMinutes(activeEntry.plannedMinutes)} · {outcomeTimeBy(activeEntry.outcome).label.toLowerCase()})</small> : null}</> : null}</div>
          </div>
          <h3 className="nx-titolo off-esito-name">{previewName}</h3>
          <p className="nx-prosa off-esito-desc">{activeEntry.desc}</p>
          <p className="nx-nota off-esito-cost">
            💰 Materiali: <b>{fmtMo(activeEntry.costMo || 0)}</b>
            {activeEntry.halfCost ? <> invece di {fmtMo(activeEntry.listCostMo || 0)} — <strong>20 naturale</strong>, te n'è bastata metà.</> : "."}
            {" "}{activeEntry.goldInboxId ? "Spesa già mandata al Master per Foundry." : "Già uscita dalla tua borsa; il Master la scala anche su Foundry."}
          </p>
          {activeEntry.upgraded && <p className="nx-nota off-esito-up">✦ <strong>Fattura superiore</strong>: hai speso il {investmentByKey(activeEntry.invest).costPct}% in più di materiali ({fmtMo(activeEntry.costMo || 0)}) e l'oggetto esce potenziato.</p>}
          {(activeEntry.compRolls || []).length > 0 && (
            <p className="nx-nota off-esito-comps">🧪 Componenti: {activeEntry.compRolls.map((r) => { const c = componentByKey(r.key); return c ? `${c.icon} ${c.name} +${r.roll}${c.effect ? ` (${componentEffectLabel(c)})` : ""}` : r.key; }).join(" · ")}</p>
          )}
          {/* ☠ La maledizione dell'1 naturale: la legge SOLO il Master. Il
              giocatore ritira un oggetto venuto male e basta. */}
          {isMaster && activeEntry.cursed && activeEntry.curse && <CurseCard curse={activeEntry.curse} />}

          {itemChoices(activeEntry.name).length > 1 && (
            <div className="off-field">
              <span className="off-label">Quale hai forgiato?</span>
              <div className="off-choices">
                {itemChoices(activeEntry.name).map((c) => (
                  <button key={c} type="button" className={`nx-pillola${(choice || itemChoices(activeEntry.name)[0]) === c ? " on" : ""}`} onClick={() => setChoice(c)}>{c}</button>
                ))}
              </div>
            </div>
          )}

          <div className="off-field">
            <span className="off-label">Potenziatore <small>(facoltativo · qui ci sono solo i tuoi)</small></span>
            {enhancersFor.length > 0 && <div className="off-choices">
              <button type="button" className={`nx-pillola${!enhKey ? " on" : ""}`} onClick={() => setEnhKey("")}>Nessuno</button>
              {enhancersFor.map((e) => (
                <button key={e.key} type="button" className={`nx-pillola off-enh is-ok${enhKey === e.key ? " on" : ""}`} onClick={() => setEnhKey(e.key)} title={`${e.desc} · ${e.ev.label}`}>
                  {e.icon} {e.name} <em>✓</em>
                </button>
              ))}
            </div>}
            {enhSel ? (
              <p className="off-own"><strong>{enhSel.icon} {enhSel.name}</strong> — {enhSel.desc} <span className="off-proof">✓ {enhSel.ev.label}{enhSel.ev.source === "scorta" ? " · se ne consuma 1" : ""}</span></p>
            ) : (
              <p className="nx-nota off-enh-help">{enhancersFor.length
                ? "Compaiono solo i potenziatori che risultano tuoi: assegnati dal Master, sulla scheda sincronizzata da Foundry o comprati al Mercato Nero."
                : "Non possiedi potenziatori adatti a questo oggetto. Si trovano in gioco: te li assegna il Master, li porti sulla scheda Foundry o li compri al Mercato Nero."}</p>
            )}
          </div>

          <div className="off-field">
            <span className="off-label">Nota per il Master <small>(facoltativa)</small></span>
            <input className="off-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. l'ho forgiata nella fucina di Helmvil durante la sosta" maxLength={200} />
          </div>

          {/* Anteprima del form "Crea Oggetto → Foundry" */}
          <details className="off-form">
            <summary className="off-label">Scheda per Foundry <small>(come nel form del Master)</small></summary>
            <dl className="off-form-grid">
              <dt>Nome</dt><dd>{preview.name}</dd>
              <dt>Tipo</dt><dd>{FT_LABEL[preview.foundryType] || preview.foundryType}</dd>
              <dt>Rarità</dt><dd>{RARITY_LABEL[preview.rarity] || preview.rarity}</dd>
              <dt>Prezzo</dt><dd>{preview.price} mo</dd>
              <dt>Peso</dt><dd>{preview.weight} lb</dd>
              <dt>Quantità</dt><dd>{preview.quantity}</dd>
              {preview.foundryType === "weapon" && (<>
                <dt>Attacco</dt><dd>{preview.actionType === "rwak" ? "Arma a distanza" : "Arma da mischia"}{preview.attackBonus ? ` · +${preview.attackBonus} al colpire` : ""}</dd>
                <dt>Danno</dt><dd>{preview.damageFormula} {preview.damageType}{preview.versatileFormula ? ` (versatile ${preview.versatileFormula})` : ""}{preview.damage2Formula ? ` + ${preview.damage2Formula} ${preview.damage2Type}` : ""}</dd>
                <dt>Proprietà</dt><dd>{preview.properties.length ? preview.properties.join(", ") : "—"}</dd>
              </>)}
              {preview.foundryType === "equipment" && preview.armorType && (<>
                <dt>Armatura</dt><dd>{preview.armorType} · CA {preview.armorValue}</dd>
              </>)}
              <dt>Destinazione</dt><dd>Inventario di {preview.targetName || "te"}</dd>
              <dt>Descrizione</dt><dd className="off-form-desc">{preview.description}</dd>
            </dl>
          </details>

          <div className="off-go off-go--bar">
            <button type="button" className="cta off-cta" disabled={busy} onClick={() => sendToFoundry(activeEntry)}>{busy ? "Invio…" : "📦 Manda al Master per Foundry"}</button>
            <button type="button" className="off-ghost" disabled={busy} onClick={() => skipEntry(activeEntry)}>Non inviare</button>
          </div>
        </div>
      )}

      </>)}

      {/* ══ PIEGA: LE CREAZIONI ══ */}
      {curTab === "creazioni" && (
        <div className="nx-pannello off-box off-log">
          <span className="off-label">📜 Le tue creazioni <small>({log.length} nel registro{crafting.totalCount > log.length ? ` · ${crafting.totalCount} a vita` : ""})</small></span>
          {log.length === 0 ? <p className="nx-nota">Ancora nessuna prova: prepara il banco e tira.</p> : (
            <ul className="off-log-list">
              {log.map((e) => {
                const tm = tierMeta(e.tier);
                const onBench = !e.inboxId && !e.skipped;
                // Finché il pezzo è sul banco il tiro non si vede: niente d20,
                // niente rarità, niente PE che facciano indovinare l'esito.
                const segreto = !isMaster && onBench && (Number(e.readyAt) || 0) > nowMs;
                return (
                  <li key={e.id} style={{ "--q": segreto ? "#6b6252" : tm.color }}>
                    <span className="off-log-ic" aria-hidden="true">{segreto ? "🔨" : tm.icon}</span>
                    <span className="off-log-main"><b>{segreto ? "Sul banco…" : (e.choice || e.name)}{e.upgraded && !segreto ? " ✦" : ""}</b><small>{new Date(e.at).toLocaleDateString("it-IT")}{segreto ? " · 🎲 tiro segreto" : <> · d20 {e.d20}{sign(e.bonus)}={e.total}{e.d12 ? ` · d12 ${e.d12}` : ""} · +{e.xp} PE</>}{e.minutes ? ` · ⏱ ${fmtMinutes(e.minutes)}` : ""}{e.costMo ? ` · ${fmtMo(e.costMo)}` : ""}</small></span>
                    <span className={`off-log-st${e.inboxId ? " ok" : e.failed ? " bad" : e.skipped ? " no" : ""}`}>{e.inboxId ? "📦 in coda" : e.failed ? "💥 fallito" : e.skipped ? "non inviato" : (Number(e.readyAt) || 0) > nowMs ? "in lavorazione" : "da ritirare"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ══ PIEGA: I COMPONENTI ══ */}
      {curTab === "componenti" && (
        <div className="nx-pannello off-box off-stock-box">
          <span className="off-label">🧪 I tuoi componenti <small>({compCount} pezzi · dalla scheda Foundry, dal Master o dal Mercato)</small></span>
          <ul className="off-stock-list">
            {ownedComps.map((c) => {
              const n = Number.isFinite(c.n) ? c.n : 0;
              return (
                <li key={c.key} className={n > 0 ? "on" : ""}>
                  <span className="off-stock-ic" aria-hidden="true">{c.icon}</span>
                  <span className="off-stock-main"><b>{c.name} <i>×{n}</i></b><small>{c.desc}{c.effect ? ` — ${componentEffectLabel(c)}.` : ""}{n > 0 && c.ev.label ? <><br />✓ {c.ev.label}</> : null}</small></span>
                  <span className="off-stock-fx">−{c.minutes} min · +1–{COMPONENT_ROLL_DIE}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ══ PIEGA: I PROGRESSI ══ */}
      {curTab === "progressi" && (
        <div className="nx-pannello off-box off-xp-table">
          <span className="off-label">📈 Esperienza delle professioni <small>(PE per rarità: {TIER_ORDER.map((t) => `${tierMeta(t).label} ${XP_PER_TIER[t]}`).join(" · ")}; 20 naturale = doppi; +5% o +10% se spendi di più nei materiali)</small></span>
          <ol className="off-levels">
            {XP_LEVELS.map((l) => (
              <li key={l.lv} className={prof && prog.level.lv === l.lv ? "is-cur" : prof && prog.level.lv > l.lv ? "is-done" : ""}>
                <span className="orb" aria-hidden="true">{l.lv}</span>
                <span className="off-level-main"><b>{l.xp} PE · grado {l.grado} {GRADE_BONUS[l.grado] ? `(${sign(GRADE_BONUS[l.grado])} al tiro)` : ""}</b><small>{l.sblocca}</small></span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ══ PIEGA: IL MASTER ══ */}
      {curTab === "master" && isMaster && (<>
        <MasterTodo chars={tableChars} nowMs={nowMs} goTab={setTab} />
        <MasterBoard chars={tableChars} nowMs={nowMs} />
      </>)}
      {curTab === "artigiani" && isMaster && <MasterArtisans chars={tableChars} nowMs={nowMs} />}
      {curTab === "scorte" && isMaster && <MasterStock chars={tableChars} />}
      {curTab === "spese" && isMaster && <CraftSpese chars={tableChars} />}
      {curTab === "registro" && isMaster && <CraftLedger chars={tableChars} reload={async () => {}} patchChar={() => {}} />}

      {/* ══ PIEGA: LE STATISTICHE (solo Master) ══ */}
      {curTab === "statistiche" && isMaster && <CraftStats chars={tableChars} />}
    </div>
  );
}

// ── ☠ La maledizione dell'1 naturale (SOLO MASTER) ──────────────────────────
// Si mostra nell'esito, nel tavolo e nel registro: il giocatore non la vede in
// nessuna di queste schermate perché il componente si monta solo se isMaster.
function CurseCard({ curse, compact = false }) {
  if (!curse?.nome) return null;
  const g = gravitaByKey(curse.gravita);
  if (compact) return <span className="off-curse-chip" title={`${curse.meccanica}${curse.rivelazione ? ` · ${curse.rivelazione}` : ""}`}>☠ {curse.nome} <small>{curse.meccanica}</small></span>;
  return (
    <div className="off-curse">
      <span className="off-curse-head">☠ Maledetto <small>solo tu lo vedi · gravità {g.icon} {g.label}{curse.fonte === "tabella" ? " · dalla tabella (Gemini non ha risposto)" : ""}</small></span>
      <b className="off-curse-name">{curse.nome}</b>
      {curse.effetto && <p className="nx-prosa off-curse-desc">{curse.effetto}</p>}
      <dl className="off-curse-grid">
        <dt>Meccanica</dt><dd>{curse.meccanica}</dd>
        {curse.rivelazione && <><dt>Se ne accorge</dt><dd>{curse.rivelazione}</dd></>}
        {curse.rimozione && <><dt>Si spezza</dt><dd>{curse.rimozione}</dd></>}
      </dl>
      <p className="nx-nota off-curse-note">Il giocatore ritira un oggetto Scarso e non sa altro: l&apos;effetto lo applichi tu al tavolo, quando ti pare.</p>
    </div>
  );
}

// ── Il tavolo del Master: per ogni artigiano, cosa sta forgiando e a che punto è ──
function MasterBoard({ chars, nowMs }) {
  const [onlyActive, setOnlyActive] = useState(false);
  const [busy, setBusy] = useState("");
  const now = new Date(nowMs);
  const rows = chars.map((c) => {
    const cr = c.crafting || {};
    const log = Array.isArray(cr.log) ? cr.log : [];
    const prof = PROFESSIONI.find((p) => p.key === cr.profession) || null;
    const bench = log.find((e) => !e.inboxId && !e.skipped) || null;
    const readyAt = bench ? Number(bench.readyAt) || Number(bench.at) || 0 : 0;
    const startAt = bench ? Number(bench.at) || 0 : 0;
    const working = !!bench && readyAt > nowMs;
    const pct = bench ? Math.max(0, Math.min(100, Math.round(((nowMs - startAt) / Math.max(1, readyAt - startAt)) * 100))) : 0;
    const al = craftAllowance(cr, now);
    const last = log.find((e) => e !== bench) || null;
    return { c, cr, prof, bench, working, ready: !!bench && !working, pct, readyAt, al, last, total: Math.max(Number(cr.totalCount) || 0, log.length) };
  }).filter((r) => r.prof || r.total > 0);
  const shown = onlyActive ? rows.filter((r) => r.bench) : rows;
  const nWorking = rows.filter((r) => r.working).length, nReady = rows.filter((r) => r.ready).length;

  async function finishNow(r) {
    setBusy(r.c.uid);
    try {
      const srv = await serverNow().catch(() => new Date());
      const log = (r.cr.log || []).map((e) => (e.id === r.bench.id ? { ...e, readyAt: srv.getTime() - 1000, finishedByMaster: true } : e));
      await updateDoc(doc(db, "characters", r.c.uid), { "crafting.log": log, "crafting.busyUntil": deleteField() });
    } catch (e) { alert("Errore: " + (e.message || e)); }
    finally { setBusy(""); }
  }

  return (
    <div className="nx-pannello off-box off-board">
      <div className="off-board-head">
        <span className="nx-tag">🎯 Il tavolo · in tempo reale</span>
        <div className="off-board-sum">
          <span><b>{nWorking}</b><small>al lavoro</small></span>
          <span><b>{nReady}</b><small>da ritirare</small></span>
          <span><b>{rows.filter((r) => r.al.usedToday).length}</b><small>oggi</small></span>
        </div>
        <button type="button" className={`off-ghost${onlyActive ? " on" : ""}`} onClick={() => setOnlyActive((v) => !v)}>{onlyActive ? "Tutti gli artigiani" : "Solo chi sta lavorando"}</button>
      </div>
      {shown.length === 0 ? <p className="nx-nota">{onlyActive ? "Nessuno ha un lavoro sul banco adesso." : "Nessun artigiano ancora: le professioni si scelgono qui sotto."}</p> : (
        <ul className="off-board-list">
          {shown.map((r) => {
            const b = r.bench;
            const tm = b ? tierMeta(b.targetTier || b.tier) : null;
            return (
              <li key={r.c.uid} className={b?.failed ? "is-fail" : r.working ? "is-working" : r.ready ? "is-ready" : ""} style={{ "--q": b?.failed ? "#b91c1c" : tm ? tm.color : undefined }}>
                <div className="off-board-who">
                  <b>{r.c.name}</b>
                  <small>{r.prof ? `${r.prof.icon} ${r.prof.name}` : "senza professione"} · {r.total} creazioni · oggi {r.al.usedToday ? "1" : "0"}/{CRAFT_MAX_PER_DAY} · sett. {r.al.weekCount}/{CRAFT_MAX_PER_WEEK}</small>
                </div>
                {b ? (
                  <div className="off-board-job">
                    <div className="off-board-job-top">
                      <span className={`off-log-st${b.failed ? " bad" : r.ready ? " ok" : ""}`}>{b.failed ? (r.working ? "💥 sta rovinando tutto" : "💥 disastro, da chiudere") : r.working ? "⚒ sta forgiando" : "✓ finito, da ritirare"}</span>
                      <b>{b.failed ? "💥 Fallimento critico" : `${tm.icon} ${b.pickName || b.name}`}{b.cursed ? " ☠" : ""}</b>
                      <small>{b.failed
                        ? `${b.fumble ? "1 naturale" : "fretta"} puntando a ${tm.label} · ${fmtMo(b.costMo || 0)} di materiali persi`
                        : `punta a ${tm.label}${b.pickName ? "" : " (d12 a fine lavoro)"} · esce ${tierMeta(b.tier).label}${b.pickName && b.name !== b.pickName ? `: ${b.name}` : ""} · d20 ${b.d20}${sign(b.bonus)}=${b.total}${b.cursed ? " · 1 NATURALE" : ""}`}</small>
                      {/* ☠ Solo qui: il giocatore sta guardando la sua barra e non sa niente. */}
                      {b.cursed && b.curse && <CurseCard curse={b.curse} compact />}
                    </div>
                    <div className="off-bar off-bar--mini" role="progressbar" aria-valuenow={r.pct} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${r.pct}%` }} /></div>
                    <div className="off-board-job-time">
                      <span>{r.pct}% · iniziato {whenLabel(b.at, now)}</span>
                      <span>{r.working ? `pronto tra ${fmtCountdown(r.readyAt - nowMs)} (${whenLabel(r.readyAt, now)})` : `pronto ${whenLabel(r.readyAt, now)}`}</span>
                      {r.working && <button type="button" className="off-ghost" disabled={busy === r.c.uid} onClick={() => finishNow(r)}>⏩ Termina ora</button>}
                    </div>
                  </div>
                ) : (
                  <div className="off-board-idle">
                    <span className="off-log-st no">banco libero</span>
                    {r.last ? <small>ultima: {tierMeta(r.last.tier).icon} {r.last.choice || r.last.name} · {new Date(r.last.at).toLocaleDateString("it-IT")} · {entryStatus(r.last, nowMs)}</small> : <small>nessuna creazione ancora</small>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── IL GOVERNO DEL MASTER (2026-09-23) ──────────────────────────────────────
// Prima era UNA piega chiusa ("Master · professioni, PE, scorte") con dentro
// tutto: righe di PG con le scorte scritte solo come icona + numero, le spese,
// il registro. Ora ogni cosa ha la sua piega: Artigiani (per professione),
// Scorte (per componente / potenziatore), Spese, Registro. I nomi si leggono
// sempre per intero: un 🪵 3 non dice a nessuno cos'è.

// Il lavoro sul banco di un PG (la voce non ancora mandata né scartata).
const benchOf = (cr) => (Array.isArray(cr?.log) ? cr.log : []).find((e) => !e.inboxId && !e.skipped) || null;
// Spese dei materiali ancora aperte (da mandare a Foundry o da segnare pagate).
function openSpese(chars) {
  const rows = [];
  for (const c of chars) {
    for (const e of (Array.isArray(c.crafting?.log) ? c.crafting.log : [])) {
      if (Number(e.costMo) > 0 && !e.goldInboxId && !e.goldDone) rows.push({ c, e });
    }
  }
  return rows.sort((a, b) => (b.e.at || 0) - (a.e.at || 0));
}

// Scrive un patch sul personaggio e tiene il segno di chi è occupato.
function useCharAct() {
  const [busy, setBusy] = useState("");
  async function act(uid, patch, key = uid) {
    setBusy(key);
    try { await updateDoc(doc(db, "characters", uid), patch); }
    catch (e) { alert("Errore: " + (e.message || e)); }
    finally { setBusy(""); }
  }
  return { busy, setBusy, act };
}

// Il lavoro sul banco finisce subito (il Master lo "sblocca").
async function finishBenchNow(c, entry) {
  const srv = await serverNow().catch(() => new Date());
  const log = (c.crafting?.log || []).map((e) => (e.id === entry.id ? { ...e, readyAt: srv.getTime() - 1000, finishedByMaster: true } : e));
  await updateDoc(doc(db, "characters", c.uid), { "crafting.log": log, "crafting.busyUntil": deleteField() });
}

// ── "Da sistemare": in cima al tavolo, cosa aspetta il Master ──
function MasterTodo({ chars, nowMs, goTab }) {
  const spese = openSpese(chars);
  const speseMo = spese.reduce((a, r) => a + (Number(r.e.costMo) || 0), 0);
  const senza = chars.filter((c) => !c.crafting?.profession).length;
  const cursed = chars.filter((c) => benchOf(c.crafting)?.cursed).length;
  const ready = chars.filter((c) => { const b = benchOf(c.crafting); return b && !b.failed && (Number(b.readyAt) || 0) <= nowMs; }).length;
  const items = [
    spese.length && { key: "spese", tone: "gold", icon: "💰", n: spese.length, text: `${spese.length === 1 ? "spesa" : "spese"} dei materiali da scalare su Foundry (${fmtMo(speseMo)})`, cta: "Apri le spese" },
    cursed && { key: "master", tone: "curse", icon: "☠", n: cursed, text: cursed === 1 ? "oggetto maledetto sul banco: il giocatore non lo sa" : "oggetti maledetti sul banco: i giocatori non lo sanno", cta: null },
    ready && { key: "master", tone: "ok", icon: "✓", n: ready, text: ready === 1 ? "lavoro finito: lo ritira il giocatore" : "lavori finiti: li ritirano i giocatori", cta: null },
    senza && { key: "artigiani", tone: "", icon: "🔔", n: senza, text: senza === 1 ? "eroe senza professione" : "eroi senza professione", cta: "Vedi chi" },
  ].filter(Boolean);
  if (!items.length) return <p className="off-todo off-todo--clear">✓ Niente da sistemare: nessuna spesa aperta, tutti hanno una professione.</p>;
  return (
    <ul className="off-todo" aria-label="Da sistemare">
      {items.map((it, i) => (
        <li key={i} className={it.tone ? `is-${it.tone}` : ""}>
          <span className="off-todo-ic" aria-hidden="true">{it.icon}</span>
          <span className="off-todo-t"><b>{it.n}</b> {it.text}</span>
          {it.cta && <button type="button" className="off-ghost" onClick={() => goTab(it.key)}>{it.cta} →</button>}
        </li>
      ))}
    </ul>
  );
}

// ── Stepper di una scorta: − n + con il nome scritto per intero ──
function StockRow({ icon, name, sub, n, disabled, onMinus, onPlus }) {
  return (
    <li className={`off-stockrow${n > 0 ? " on" : ""}`}>
      <span className="off-stockrow-ic" aria-hidden="true">{icon}</span>
      <span className="off-stockrow-main"><b>{name}</b>{sub && <small>{sub}</small>}</span>
      <span className="off-step">
        <button type="button" disabled={disabled || n <= 0} onClick={onMinus} aria-label={`Togli ${name}`}>−</button>
        <b aria-live="polite">{n}</b>
        <button type="button" disabled={disabled} onClick={onPlus} aria-label={`Aggiungi ${name}`}>+</button>
      </span>
    </li>
  );
}

const compSub = (k) => [`−${k.minutes} min`, `+1d${COMPONENT_ROLL_DIE} al tiro`, componentEffectLabel(k)].filter(Boolean).join(" · ");
const enhSub = (e) => `${e.applies.map((t) => FT_LABEL[t] || t).join(", ")} · ${e.desc}`;

// ── ARTIGIANI: una scheda per PG, raggruppate per professione ──
function MasterArtisans({ chars, nowMs }) {
  const { busy, setBusy, act } = useCharAct();
  const [filter, setFilter] = useState("all"); // "all" · chiave professione · "none"
  const [openUid, setOpenUid] = useState("");
  const [nudge, setNudge] = useState("");
  const now = new Date(nowMs);

  const byProf = PROFESSIONI.map((p) => ({ p, list: chars.filter((c) => c.crafting?.profession === p.key) }));
  const senza = chars.filter((c) => !c.crafting?.profession);
  const groups = [
    ...byProf.filter((g) => g.list.length && (filter === "all" || filter === g.p.key)),
    ...(senza.length && (filter === "all" || filter === "none") ? [{ p: null, list: senza }] : []),
  ];

  // Un doc in `notifications` per ciascuno: la campanella dell'app e, via
  // `pushOnNotification` (functions), anche la notifica push sul telefono.
  async function nudgeSenzaProfessione() {
    if (!senza.length) return;
    if (!window.confirm(`Mandare l'avviso dell'Officina a ${senza.length} eroi senza professione?\n\n${senza.map((c) => c.name).join(", ")}`)) return;
    setBusy("nudge"); setNudge("");
    try {
      await Promise.all(senza.map((c) => addDoc(collection(db, "notifications"), {
        userId: c.uid,
        title: "⚒ L'Officina ti aspetta",
        message: "Non hai ancora scelto una professione da artigiano. Vai in Gilda → L'Officina, scegli la tua arte e comincia a creare oggetti: 1 prova al giorno, 3 a settimana. In sessione funziona uguale, ma lì ti serve la postazione giusta.",
        read: false, timestamp: serverTimestamp(),
      })));
      setNudge(`✓ Avviso mandato a ${senza.length} eroi.`);
    } catch (e) { setNudge("Errore: " + (e.message || e)); }
    finally { setBusy(""); }
  }

  return (
    <div className="nx-pannello off-box off-arts">
      <div className="off-sec-head">
        <span className="nx-tag">👥 Artigiani</span>
        <p className="nx-nota">{chars.length - senza.length} artigiani su {chars.length} eroi. Tocca <b>Gestisci</b> per cambiare professione, PE, usi e scorte.</p>
      </div>

      {/* Filtro per professione: bottoni, NON role="tab" (covo.css ci metterebbe le rune). */}
      <div className="off-chips" aria-label="Filtra per professione">
        <button type="button" className={`off-chip${filter === "all" ? " on" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Tutti <i>{chars.length}</i></button>
        {byProf.map(({ p, list }) => (
          <button key={p.key} type="button" className={`off-chip${filter === p.key ? " on" : ""}${list.length ? "" : " is-empty"}`} aria-pressed={filter === p.key} style={{ "--c": p.carColor }} onClick={() => setFilter(p.key)}>
            <span aria-hidden="true">{p.icon}</span> {p.name.split(" / ")[0]} <i>{list.length}</i>
          </button>
        ))}
        <button type="button" className={`off-chip is-none${filter === "none" ? " on" : ""}`} aria-pressed={filter === "none"} onClick={() => setFilter("none")}>Senza professione <i>{senza.length}</i></button>
      </div>

      {groups.length === 0 && (
        <p className="nx-nota off-empty">{filter === "none" ? "Tutti hanno scelto una professione." : `Nessuno è ${PROFESSIONI.find((p) => p.key === filter)?.name || "artigiano"}, per ora.`}</p>
      )}

      {groups.map(({ p, list }) => (
        <section key={p?.key || "none"} className={`off-group${p ? "" : " is-none"}`} style={p ? { "--c": p.carColor } : undefined}>
          <header className="off-group-head">
            <span className="off-group-ic" aria-hidden="true">{p ? p.icon : "·"}</span>
            <div className="off-group-t">
              <h3>{p ? p.name : "Senza professione"} <small>{list.length}</small></h3>
              <p>{p ? <>Tira con <b>{p.caratteristica}</b> · postazione in sessione: {postazioneFor(p.key)}</> : "Non possono ancora creare: la professione la scelgono loro dall'Officina (o gliela dai tu da Gestisci)."}</p>
            </div>
            {!p && (
              <button type="button" className="off-ghost" disabled={busy === "nudge"} onClick={nudgeSenzaProfessione}>{busy === "nudge" ? "Invio…" : `🔔 Avvisali (${list.length})`}</button>
            )}
          </header>
          {!p && nudge && <p className={`nx-nota off-nudge-msg${nudge.startsWith("Errore") ? " is-err" : ""}`}>{nudge}</p>}
          <ul className="off-cards">
            {list.map((c) => (
              <ArtisanCard key={c.uid} c={c} now={now} nowMs={nowMs} open={openUid === c.uid} onToggle={() => setOpenUid(openUid === c.uid ? "" : c.uid)} busy={busy} setBusy={setBusy} act={act} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ArtisanCard({ c, now, nowMs, open, onToggle, busy, setBusy, act }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const cr = c.crafting || {};
  const p = PROFESSIONI.find((x) => x.key === cr.profession) || null;
  const pr = progression(cr.xp || 0);
  const al = craftAllowance(cr, now);
  const bench = benchOf(cr);
  const left = bench ? (Number(bench.readyAt) || 0) - nowMs : 0;
  const total = Math.max(Number(cr.totalCount) || 0, (cr.log || []).length);
  const comps = COMPONENTS.map((k) => ({ ...k, n: Number(cr.components?.[k.key]) || 0 })).filter((k) => k.n > 0);
  const enhs = ENHANCERS.map((e) => ({ ...e, n: Number(cr.enhancers?.[e.key]) || 0 })).filter((e) => e.n > 0);
  const isBusy = busy === c.uid;
  const tm = bench ? tierMeta(bench.targetTier || bench.tier) : null;
  const st = !p ? { k: "none", t: "senza professione" }
    : bench ? (bench.failed ? { k: "bad", t: "💥 disastro" } : left > 0 ? { k: "work", t: "⚒ al lavoro" } : { k: "ok", t: "✓ da ritirare" })
    : { k: "idle", t: "banco libero" };

  return (
    <li className={`off-card${open ? " is-open" : ""}`} style={p ? { "--c": p.carColor } : undefined}>
      <div className="off-card-head">
        <span className="off-card-ic" aria-hidden="true">{p ? p.icon : "?"}</span>
        <div className="off-card-who">
          <b>{c.name}</b>
          <small>{p ? <>{pr.grado.icon} {pr.grado.name} · livello {pr.level.lv}{pr.bonus ? ` · ${sign(pr.bonus)} al tiro` : ""}</> : "nessuna arte"}</small>
        </div>
        <span className={`off-pill is-${st.k}`}>{st.t}</span>
      </div>

      {p && (
        <div className="off-card-xp">
          <div className="off-xp" role="progressbar" aria-label="Esperienza verso il prossimo livello" aria-valuenow={pr.pct} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${pr.pct}%` }} /></div>
          <small>{pr.xp} PE{pr.next ? ` · ${pr.next.xp - pr.xp} al livello ${pr.next.lv}` : " · livello massimo"}</small>
        </div>
      )}

      <dl className="off-card-nums">
        <div className={al.usedToday ? "is-used" : ""}><dt>Oggi</dt><dd>{al.usedToday ? 1 : 0}<i>/{CRAFT_MAX_PER_DAY}</i></dd></div>
        <div className={al.weekCount >= CRAFT_MAX_PER_WEEK ? "is-used" : ""}><dt>Settimana</dt><dd>{al.weekCount}<i>/{CRAFT_MAX_PER_WEEK}</i></dd></div>
        <div><dt>Creazioni</dt><dd>{total}</dd></div>
        <div title={hasPurse(c) ? `sulla scheda ${fmtMo(sheetGp(c))}${goldPending(cr) ? ` · ${fmtMo(goldPending(cr))} in sospeso` : ""}` : "oro non ancora sincronizzato da Foundry"}><dt>Oro</dt><dd className="is-gold">{hasPurse(c) ? fmtMo(availableGp(c)).replace(" mo", "") : "—"}{hasPurse(c) && <i> mo</i>}</dd></div>
      </dl>

      {bench && (
        <div className={`off-card-bench${bench.failed ? " is-fail" : ""}`} style={{ "--q": bench.failed ? "#b91c1c" : tm.color }}>
          <span>{bench.failed ? "💥 Fallimento critico" : <>{tm.icon} {bench.pickName || bench.name}{bench.cursed ? " ☠" : ""}</>}</span>
          <small>{left > 0 ? `pronto tra ${fmtCountdown(left)}` : "finito"}</small>
          {left > 0 && <button type="button" className="off-ghost" disabled={isBusy} onClick={async () => { setBusy(c.uid); try { await finishBenchNow(c, bench); } catch (e) { alert("Errore: " + (e.message || e)); } finally { setBusy(""); } }}>⏩ Termina ora</button>}
        </div>
      )}

      <div className="off-card-stock">
        {comps.length || enhs.length ? (
          <ul>
            {comps.map((k) => <li key={k.key} title={compSub(k)}><span aria-hidden="true">{k.icon}</span> {k.name} <b>×{k.n}</b></li>)}
            {enhs.map((e) => <li key={e.key} className="is-enh" title={e.desc}><span aria-hidden="true">{e.icon}</span> {e.name} <b>×{e.n}</b></li>)}
          </ul>
        ) : <small>Nessuna scorta assegnata.</small>}
      </div>

      <button type="button" className="off-card-toggle" aria-expanded={open} onClick={onToggle}>{open ? "▾ Chiudi" : "⚙ Gestisci"}</button>

      {open && (
        <div className="off-manage">
          <div className="off-manage-sec">
            <span className="off-label">Professione</span>
            <select className="off-input" value={cr.profession || ""} disabled={isBusy} onChange={(e) => act(c.uid, { "crafting.profession": e.target.value })} aria-label={`Professione di ${c.name}`}>
              <option value="">— nessuna professione —</option>
              {PROFESSIONI.map((x) => <option key={x.key} value={x.key}>{x.icon} {x.name}</option>)}
            </select>
            <small>Cambiarla non tocca PE né registro.</small>
          </div>
          <div className="off-manage-sec">
            <span className="off-label">Esperienza e usi</span>
            <div className="off-manage-btns">
              <button type="button" className="off-ghost" disabled={isBusy || !(Number(cr.xp) > 0)} onClick={() => act(c.uid, { "crafting.xp": Math.max(0, (Number(cr.xp) || 0) - 25) })}>−25 PE</button>
              <button type="button" className="off-ghost" disabled={isBusy} onClick={() => act(c.uid, { "crafting.xp": (Number(cr.xp) || 0) + 25 })}>+25 PE</button>
              <button type="button" className="off-ghost" disabled={isBusy || (!al.usedToday && !al.weekCount)} onClick={() => act(c.uid, { "crafting.weekCount": 0, "crafting.lastDayKey": "" })}>↺ Azzera usi</button>
            </div>
            <small>"Azzera usi" ridà la prova di oggi e le 3 della settimana.</small>
          </div>
          <div className="off-manage-sec is-wide">
            <span className="off-label">Componenti trovati in sessione <small>(ognuno: meno tempo e +1d{COMPONENT_ROLL_DIE} al tiro)</small></span>
            <ul className="off-stockrows">
              {COMPONENTS.map((k) => {
                const n = Number(cr.components?.[k.key]) || 0;
                return <StockRow key={k.key} icon={k.icon} name={k.name} sub={compSub(k)} n={n} disabled={isBusy}
                  onMinus={() => act(c.uid, { [`crafting.components.${k.key}`]: n - 1 })} onPlus={() => act(c.uid, { [`crafting.components.${k.key}`]: n + 1 })} />;
              })}
            </ul>
          </div>
          <div className="off-manage-sec is-wide">
            <span className="off-label">Potenziatori <small>(si consumano quando l'oggetto va a Foundry)</small></span>
            <ul className="off-stockrows">
              {ENHANCERS.map((e) => {
                const n = Number(cr.enhancers?.[e.key]) || 0;
                return <StockRow key={e.key} icon={e.icon} name={e.name} sub={enhSub(e)} n={n} disabled={isBusy}
                  onMinus={() => act(c.uid, { [`crafting.enhancers.${e.key}`]: n - 1 })} onPlus={() => act(c.uid, { [`crafting.enhancers.${e.key}`]: n + 1 })} />;
              })}
            </ul>
          </div>
          <div className="off-manage-sec is-wide is-danger">
            {confirmReset ? (
              <div className="off-manage-btns">
                <small>Cancello professione, PE, registro, scorte e oro in sospeso di <b>{c.name}</b>. Non si torna indietro.</small>
                <button type="button" className="off-ghost is-danger" disabled={isBusy} onClick={async () => { await act(c.uid, { crafting: deleteField() }); setConfirmReset(false); }}>Sì, azzera tutto</button>
                <button type="button" className="off-ghost" onClick={() => setConfirmReset(false)}>No</button>
              </div>
            ) : (
              <button type="button" className="off-ghost is-danger" disabled={isBusy || !c.crafting} onClick={() => setConfirmReset(true)}>Reset totale del crafting…</button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// ── SCORTE: chi ha cosa, per ogni componente e potenziatore ──
function MasterStock({ chars }) {
  const { busy, act } = useCharAct();
  const artisans = chars.filter((c) => c.crafting?.profession);
  const pool = artisans.length ? artisans : chars;
  const sections = [
    { field: "components", title: "Componenti trovati in sessione", note: `Si consumano all'avvio del lavoro: ognuno toglie tempo e dà +1d${COMPONENT_ROLL_DIE} al tiro, al massimo ${MAX_COMPONENTS} per prova.`, items: COMPONENTS.map((k) => ({ ...k, sub: compSub(k), about: k.desc })) },
    { field: "enhancers", title: "Potenziatori", note: "Cambiano l'oggetto su Foundry (danno, colpire, CA, rarità): il giocatore li vede al banco solo se ne ha uno adatto.", items: ENHANCERS.map((e) => ({ ...e, sub: e.applies.map((t) => FT_LABEL[t] || t).join(", "), about: e.desc })) },
  ];
  return (
    <div className="off-stockpage">
      {sections.map((s) => {
        const inCirc = s.items.reduce((a, it) => a + pool.reduce((b, c) => b + (Number(c.crafting?.[s.field]?.[it.key]) || 0), 0), 0);
        return (
          <div key={s.field} className="nx-pannello off-box">
            <div className="off-sec-head">
              <span className="nx-tag">{s.field === "components" ? "🧺" : "💠"} {s.title}</span>
              <p className="nx-nota">{s.note} <b>{inCirc}</b> in mano ai giocatori.</p>
            </div>
            <ul className="off-stockgrid">
              {s.items.map((it) => (
                <StockItemCard key={it.key} it={it} field={s.field} pool={pool} busy={busy} act={act} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function StockItemCard({ it, field, pool, busy, act }) {
  const [to, setTo] = useState("");
  const holders = pool.map((c) => ({ c, n: Number(c.crafting?.[field]?.[it.key]) || 0 })).filter((h) => h.n > 0);
  const tot = holders.reduce((a, h) => a + h.n, 0);
  const path = `crafting.${field}.${it.key}`;
  const target = pool.find((c) => c.uid === to);
  const tn = target ? Number(target.crafting?.[field]?.[it.key]) || 0 : 0;
  return (
    <li className={`off-sitem${tot ? " on" : ""}`}>
      <div className="off-sitem-head">
        <span className="off-sitem-ic" aria-hidden="true">{it.icon}</span>
        <div className="off-sitem-t"><b>{it.name}</b><small>{it.sub}</small></div>
        <span className="off-sitem-n" title="in circolo"><b>{tot}</b><small>in giro</small></span>
      </div>
      <p className="off-sitem-about">{it.about}</p>
      {holders.length > 0 && (
        <ul className="off-holders">
          {holders.map(({ c, n }) => (
            <li key={c.uid}>
              <span>{c.name}</span>
              <span className="off-step">
                <button type="button" disabled={busy === `${c.uid}${it.key}`} onClick={() => act(c.uid, { [path]: n - 1 }, `${c.uid}${it.key}`)} aria-label={`Togli ${it.name} a ${c.name}`}>−</button>
                <b>{n}</b>
                <button type="button" disabled={busy === `${c.uid}${it.key}`} onClick={() => act(c.uid, { [path]: n + 1 }, `${c.uid}${it.key}`)} aria-label={`Dai ${it.name} a ${c.name}`}>+</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="off-assign">
        <select className="off-input" value={to} onChange={(e) => setTo(e.target.value)} aria-label={`Assegna ${it.name} a`}>
          <option value="">Assegna a…</option>
          {pool.map((c) => <option key={c.uid} value={c.uid}>{c.name}</option>)}
        </select>
        <button type="button" className="off-ghost" disabled={!target || busy === `${to}${it.key}`} onClick={() => act(to, { [path]: tn + 1 }, `${to}${it.key}`)}>+1</button>
      </div>
    </li>
  );
}

// ── Le spese dei materiali: un tocco e finiscono nella coda di Foundry ───────
// Le monete si pagano in gioco. Qui il Master vede ogni prova che ha ancora una
// spesa aperta e con un bottone la manda in `foundry_inbox` come documento
// `kind: "gold"`: la macro "Crea Oggetti dal sito → Foundry" toglie le monete
// dall'attore e cancella il documento. "Già pagata" la chiude senza mandarla.
function CraftSpese({ chars }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const rows = openSpese(chars);
  const totale = rows.reduce((a, r) => a + (Number(r.e.costMo) || 0), 0);

  // Scrive la voce nella coda e segna la prova come "mandata".
  async function sendOne({ c, e }) {
    const p = PROFESSIONI.find((x) => x.key === e.profession);
    const ref = await addDoc(collection(db, "foundry_inbox"), {
      status: "pending",
      ...craftGoldPayload({
        crafter: { uid: c.uid, name: c.name || "" },
        amount: e.costMo,
        tierLabel: tierMeta(e.tier).label,
        itemName: e.failed ? "" : (e.choice || e.name),
        components: (e.components || []).map((k) => componentByKey(k)?.name || k),
        failed: !!e.failed, nat20: !!e.halfCost, note: p ? p.name : "",
      }),
      origin: "crafting", crafterUid: c.uid, crafterName: c.name || "", craftEntryId: e.id,
      createdAt: serverTimestamp(),
    });
    // Transazione: il registro si rilegge fresco (con "Manda tutte" due spese
    // dello stesso PG si sovrascriverebbero) e l'oro esce da `goldPending` una
    // volta sola: da qui in poi a scalarlo è la macro di Foundry.
    await runTransaction(db, async (tx) => {
      const cref = doc(db, "characters", c.uid);
      const snap = await tx.get(cref);
      const cur = snap.exists() ? (snap.data().crafting || {}) : {};
      const log = Array.isArray(cur.log) ? cur.log : [];
      tx.update(cref, {
        "crafting.goldPending": pendingAfterClose(cur, e.id),
        "crafting.log": log.map((x) => (x.id === e.id ? { ...x, goldInboxId: ref.id } : x)),
      });
    });
  }

  async function act(key, fn) {
    setBusy(key); setMsg("");
    try { await fn(); }
    catch (err) { setMsg("Errore: " + (err.message || err)); }
    finally { setBusy(""); }
  }

  // "Già pagata": l'oro l'ha scalato il Master a mano, quindi esce dalla borsa
  // del sito e la prova non compare più tra le spese aperte.
  const markPaid = ({ c, e }) => runTransaction(db, async (tx) => {
    const cref = doc(db, "characters", c.uid);
    const snap = await tx.get(cref);
    const cur = snap.exists() ? (snap.data().crafting || {}) : {};
    const log = Array.isArray(cur.log) ? cur.log : [];
    tx.update(cref, {
      "crafting.goldPending": pendingAfterClose(cur, e.id),
      "crafting.log": log.map((x) => (x.id === e.id ? { ...x, goldDone: true } : x)),
    });
  });

  return (
    <div className="nx-pannello off-box off-spese">
      <div className="off-spese-head">
        <div className="off-sec-head off-spese-t"><span className="nx-tag">💰 Spese dei materiali</span><p className="nx-nota">Monete già spese al banco e non ancora scalate dall'oro su Foundry: mandale in coda o segnale come pagate.</p></div>
        <div className="off-spese-sum"><span><b>{rows.length}</b><small>aperte</small></span><span><b>{fmtMo(totale)}</b><small>in totale</small></span></div>
        {rows.length > 1 && (
          <button type="button" className="off-ghost" disabled={!!busy} onClick={() => act("all", async () => { for (const r of rows) await sendOne(r); setMsg(`✓ ${rows.length} spese mandate alla coda di Foundry.`); })}>
            {busy === "all" ? "Invio…" : `📤 Manda tutte (${fmtMo(totale)})`}
          </button>
        )}
      </div>
      {rows.length === 0 ? <p className="nx-nota">Nessuna spesa aperta: tutte mandate a Foundry o segnate come pagate.</p> : (
        <ul className="off-spese-list">
          {rows.map(({ c, e }) => (
            <li key={`${c.uid}-${e.id}`} className={e.failed ? "is-fail" : ""}>
              <span className="off-spese-who"><b>{c.name}</b><small>{new Date(e.at).toLocaleDateString("it-IT")} · {e.failed ? "💥 prova fallita" : `${tierMeta(e.tier).icon} ${e.choice || e.name}`}{e.cursed ? " ☠ maledetto" : ""}{e.halfCost ? " · 20 naturale, metà spesa" : ""}</small>
                {/* La borsa com'è ADESSO: oro della scheda Foundry, meno quello
                    già speso al banco e non ancora scalato dalla macro. */}
                <small className="off-spese-borsa">{hasPurse(c)
                  ? <>👛 sulla scheda {fmtMo(sheetGp(c))} · disponibili {fmtMo(availableGp(c))}{goldPending(c.crafting) ? ` (${fmtMo(goldPending(c.crafting))} in sospeso)` : ""}</>
                  : <>👛 oro non ancora sincronizzato da Foundry</>}</small></span>
              <span className="off-spese-mo">{fmtMo(e.costMo)}{e.halfCost ? <i> invece di {fmtMo(e.listCostMo || 0)}</i> : null}</span>
              <span className="off-spese-acts">
                <button type="button" className="off-ghost" disabled={!!busy} onClick={() => act(e.id, async () => { await sendOne({ c, e }); setMsg(`✓ ${fmtMo(e.costMo)} di ${c.name} in coda: lancia la macro su Foundry.`); })}>{busy === e.id ? "…" : "📤 Manda a Foundry"}</button>
                <button type="button" className="off-ghost" disabled={!!busy} onClick={() => act(`p${e.id}`, () => markPaid({ c, e }))}>{busy === `p${e.id}` ? "…" : "✓ Già pagata"}</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={`nx-nota off-spese-msg${msg.startsWith("Errore") ? " is-err" : ""}`}>{msg}</p>}
      <p className="nx-nota">Gli <strong>oggetti</strong> creati arrivano in <Link to="/dm-admin/foundry-item">Crea Oggetto → Foundry</Link> con l'etichetta ⚒, il tempo di lavoro e la nota della prova. Valore Foundry per rarità: {TIER_ORDER.map((t) => `${tierMeta(t).label} ${TIER_TO_FOUNDRY[t].price} mo`).join(", ")}.</p>
      <p className="nx-nota">La macro <strong>Crea Oggetti dal sito → Foundry</strong> riconosce queste voci (<code>kind: "gold"</code>), toglie le monete all'attore col <code>firebaseUID</code> giusto e le cancella dalla coda.</p>
    </div>
  );
}

// ── STATISTICHE DEL TAVOLO (2026-09-22) ─────────────────────────────────────
// La vista del Master: i numeri grossi in cima, poi quattro grafici a barre.
// Tutti a UNA serie: l'identità sta nell'etichetta (nome + icona), mai nel
// colore, così restano leggibili anche in bianco e nero e per chi i colori non
// li distingue. Ogni barra porta il suo numero scritto: il grafico è il colpo
// d'occhio, la riga è già la tabella.
// I grafici leggono il REGISTRO (ultime 40 prove per PG); i totali a vita
// vengono da `crafting.totalCount`, che non si svuota mai.
const WEEKS_SHOWN = 8;
const weekLabel = (key) => {
  const d = new Date(`${key}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? key : new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "numeric", month: "short" }).format(d);
};

// Barre orizzontali: etichetta · barra · valore. rows = [{key,label,icon,v,sub,title}]
function StatBars({ rows, empty, suffix = "" }) {
  if (!rows.length) return <p className="nx-nota">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <ul className="off-stat-bars">
      {rows.map((r) => (
        <li key={r.key} title={r.title || `${r.label}: ${r.v}${suffix}`}>
          <span className="off-stat-lbl">{r.icon ? <i aria-hidden="true">{r.icon}</i> : null}{r.label}</span>
          <span className="off-stat-track"><i style={{ width: `${(r.v / max) * 100}%` }} /></span>
          <b className="off-stat-v">{r.v}{suffix}{r.sub ? <small>{r.sub}</small> : null}</b>
        </li>
      ))}
    </ul>
  );
}

// Colonne: una per settimana, il valore scritto sopra (sono pochi e piccoli).
function StatCols({ rows, empty }) {
  if (!rows.length) return <p className="nx-nota">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <ol className="off-stat-cols">
      {rows.map((r) => (
        <li key={r.key} title={r.title}>
          {/* il numero sta SOPRA la sua colonna: se galleggia in cima al
              riquadro, con valori bassi non si capisce piu' a cosa si riferisce */}
          <span className="off-stat-col"><i style={{ height: `${r.v ? Math.max(3, (r.v / max) * 100) : 0}%` }}><b>{r.v}</b></i></span>
          <small>{r.label}</small>
        </li>
      ))}
    </ol>
  );
}

function CraftStats({ chars }) {
  const s = useMemo(() => {
    const entries = [];
    for (const c of chars) for (const e of (Array.isArray(c.crafting?.log) ? c.crafting.log : [])) entries.push({ e, c });
    const done = entries.filter(({ e }) => !e.failed);
    const artigiani = chars.filter((c) => c.crafting?.profession);
    const num = (v) => Number(v) || 0;

    // Prove per professione, con quanti artigiani la esercitano.
    const profRows = PROFESSIONI.map((p) => {
      const prove = entries.filter(({ e }) => e.profession === p.key).length;
      const quanti = artigiani.filter((c) => c.crafting.profession === p.key).length;
      return {
        key: p.key, label: p.name, icon: p.icon, v: prove,
        sub: quanti ? `${quanti} ${quanti === 1 ? "artigiano" : "artigiani"}` : "nessun artigiano",
        title: `${p.name}: ${prove} prove · ${quanti} ${quanti === 1 ? "artigiano" : "artigiani"}`,
      };
    }).filter((r) => r.v > 0 || !r.sub.startsWith("nessun"))
      .sort((a, b) => b.v - a.v || a.label.localeCompare(b.label));

    // Rarità davvero uscite (i disastri della fretta non producono oggetti).
    const tierRows = TIER_ORDER.map((t) => {
      const m = tierMeta(t);
      const v = done.filter(({ e }) => normTier(e.tier) === t).length;
      const pct = done.length ? Math.round((v / done.length) * 100) : 0;
      return { key: t, label: m.label, icon: m.icon, v, sub: v ? `${pct}%` : "", title: `${m.label}: ${v} oggetti su ${done.length} (${pct}%)` };
    });

    // Utilizzi nel tempo: prove per settimana, le ultime WEEKS_SHOWN.
    const perWeek = new Map();
    for (const { e } of entries) if (e.weekKey) perWeek.set(e.weekKey, (perWeek.get(e.weekKey) || 0) + 1);
    const weekRows = [...perWeek.keys()].sort().slice(-WEEKS_SHOWN).map((k) => ({
      key: k, label: weekLabel(k), v: perWeek.get(k), title: `Settimana del ${weekLabel(k)}: ${perWeek.get(k)} prove`,
    }));

    // Chi lavora di più, con la sua arte accanto.
    const whoRows = chars.map((c) => {
      const lg = Array.isArray(c.crafting?.log) ? c.crafting.log : [];
      const p = PROFESSIONI.find((x) => x.key === c.crafting?.profession);
      return {
        key: c.uid, label: c.name || "—", icon: p?.icon || "·", v: lg.length,
        sub: p ? p.name : "senza professione",
        title: `${c.name}: ${lg.length} prove nel registro${p ? ` · ${p.name}` : ""}`,
      };
    }).filter((r) => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 12);

    return {
      entries, done, artigiani, profRows, tierRows, weekRows, whoRows,
      eroi: chars.length,
      vita: chars.reduce((a, c) => a + Math.max(num(c.crafting?.totalCount), (c.crafting?.log || []).length), 0),
      spesa: entries.reduce((a, { e }) => a + num(e.costMo), 0),
      sospeso: chars.reduce((a, c) => a + num(c.crafting?.goldPending), 0),
      inCoda: entries.filter(({ e }) => e.inboxId).length,
      falliti: entries.filter(({ e }) => e.failed).length,
      maledetti: entries.filter(({ e }) => e.cursed).length,
      ore: Math.round(entries.reduce((a, { e }) => a + num(e.minutes), 0) / 60),
      pe: chars.reduce((a, c) => a + num(c.crafting?.xp), 0),
    };
  }, [chars]);

  const pctFail = s.entries.length ? Math.round((s.falliti / s.entries.length) * 100) : 0;

  return (
    <div className="nx-pannello off-box off-stats">
      <span className="off-label">📊 Statistiche del tavolo <small>(grafici sulle {s.entries.length} prove nel registro · i totali a vita dai contatori)</small></span>

      {/* I numeri che il Master guarda per primi. */}
      <div className="off-stat-tiles">
        <div className="off-stat-tile"><b>{s.vita}</b><small>prove a vita</small></div>
        <div className="off-stat-tile"><b>{s.artigiani.length}<span>/{s.eroi}</span></b><small>artigiani</small></div>
        <div className="off-stat-tile"><b>{s.done.length}</b><small>oggetti riusciti</small></div>
        <div className="off-stat-tile"><b>{s.inCoda}</b><small>mandati su Foundry</small></div>
        <div className="off-stat-tile"><b>{fmtMo(s.spesa)}</b><small>materiali pagati</small></div>
        <div className={`off-stat-tile${s.sospeso ? " is-warn" : ""}`}><b>{fmtMo(s.sospeso)}</b><small>da scalare su Foundry</small></div>
        <div className={`off-stat-tile${s.falliti ? " is-bad" : ""}`}><b>{s.falliti}<span> · {pctFail}%</span></b><small>disastri della fretta</small></div>
        <div className={`off-stat-tile${s.maledetti ? " is-curse" : ""}`}><b>{s.maledetti}</b><small>maledetti (solo tu)</small></div>
        <div className="off-stat-tile"><b>{s.ore}<span> h</span></b><small>ore al banco</small></div>
        <div className="off-stat-tile"><b>{s.pe}</b><small>PE in circolo</small></div>
      </div>

      <div className="off-stat-grid">
        <section className="off-stat-card">
          <h4>Prove per professione</h4>
          <p className="nx-nota">Quanto si lavora in ogni arte, e quanti la esercitano.</p>
          <StatBars rows={s.profRows} empty="Nessuna professione ancora scelta al tavolo." />
        </section>

        <section className="off-stat-card">
          <h4>Rarità uscite</h4>
          <p className="nx-nota">Sui {s.done.length} oggetti riusciti: i disastri della fretta non producono nulla e restano fuori dal conto.</p>
          <StatBars rows={s.tierRows} empty="Ancora nessun oggetto riuscito." />
        </section>

        <section className="off-stat-card">
          <h4>Utilizzi per settimana</h4>
          <p className="nx-nota">Le ultime {WEEKS_SHOWN} settimane con almeno una prova (la settimana parte la domenica alle 22:00).</p>
          <StatCols rows={s.weekRows} empty="Nessuna prova nel registro." />
        </section>

        <section className="off-stat-card">
          <h4>Chi lavora di più</h4>
          <p className="nx-nota">Prove nel registro, per artigiano.</p>
          <StatBars rows={s.whoRows} empty="Nessuno ha ancora messo mano al banco." />
        </section>
      </div>
    </div>
  );
}

// ── Registro dei craft del tavolo: quanti (totale · oggi · settimana) e cosa, per ogni PG ──
const dayLabel = (key) => key ? new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${key}T12:00:00Z`)) : "—";
const timeLabel = (ms) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, hour: "2-digit", minute: "2-digit" }).format(new Date(ms || 0));
// PE davvero accreditati da una prova: chi non ha ancora ritirato l'oggetto non
// li ha presi (`xpPaid: false`). Le prove di prima del 2026-09-22 non hanno il
// campo e valgono come già pagate.
const xpOf = (e) => (e?.xpPaid === false ? 0 : Number(e?.xp) || 0);
const entryStatus = (e, nowMs) => e.inboxId ? "📦 in coda" : e.failed ? "💥 fallito" : e.skipped ? "non inviato" : (Number(e.readyAt) || 0) > nowMs ? "⚒ sul banco" : "da ritirare";

function CraftLedger({ chars, reload, patchChar }) {
  const [openUid, setOpenUid] = useState("");
  const [confirmId, setConfirmId] = useState(""); // voce in attesa di conferma di cancellazione
  const [busyId, setBusyId] = useState("");

  // Cancella una prova (del Master o di un giocatore) annullandola del tutto:
  // via dal registro, uso del giorno/settimana restituito, PE tolti, banco
  // liberato e, se era già in coda per Foundry, anche la coda ripulita.
  async function deleteEntry(uid, e) {
    setBusyId(e.id);
    let newLog = null;
    try {
      const ref = doc(db, "characters", uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists() ? (snap.data().crafting || {}) : {};
        const prevLog = Array.isArray(cur.log) ? cur.log : [];
        const log = prevLog.filter((x) => x.id !== e.id);
        newLog = log;
        const patch = {
          "crafting.log": log,
          "crafting.totalCount": Math.max(0, Math.max(Number(cur.totalCount) || 0, prevLog.length) - 1),
          // I PE si tolgono solo se erano stati accreditati: una prova mai
          // ritirata non li ha mai presi (`xpPaid: false`).
          "crafting.xp": Math.max(0, (Number(cur.xp) || 0) - xpOf(e)),
          // La prova non esiste più: se la sua spesa era ancora aperta, l'oro
          // torna in borsa (se era già andata a Foundry la macro l'ha scalata).
          "crafting.goldPending": pendingAfterClose(cur, e.id),
        };
        if (cur.weekKey && cur.weekKey === e.weekKey) patch["crafting.weekCount"] = Math.max(0, (Number(cur.weekCount) || 0) - 1);
        if (cur.lastDayKey && cur.lastDayKey === e.dayKey && !log.some((x) => x.dayKey === e.dayKey)) patch["crafting.lastDayKey"] = "";
        if (!e.inboxId && !e.skipped) patch["crafting.busyUntil"] = deleteField();
        tx.update(ref, patch);
      });
      if (e.inboxId) await deleteDoc(doc(db, "foundry_inbox", e.inboxId)).catch(() => {});
      if (e.goldInboxId) await deleteDoc(doc(db, "foundry_inbox", e.goldInboxId)).catch(() => {}); // via anche la spesa in coda
      setConfirmId("");
      // Aggiorno subito la tabella (la rilettura da Firestore può arrivare dopo), poi ricarico.
      if (newLog) patchChar(uid, (cr) => ({ ...cr, log: newLog, totalCount: Math.max(0, Math.max(Number(cr.totalCount) || 0, newLog.length + 1) - 1), xp: Math.max(0, (Number(cr.xp) || 0) - xpOf(e)) }));
      await reload();
    } catch (err) { alert("Errore: " + (err.message || err)); }
    finally { setBusyId(""); }
  }
  const nowMs = Date.now();
  const dayKey = craftDayKey(), weekKey = craftWeekKey();
  const rows = chars.map((c) => {
    const cr = c.crafting || {};
    const log = Array.isArray(cr.log) ? cr.log : [];
    return {
      uid: c.uid, name: c.name, prof: PROFESSIONI.find((p) => p.key === cr.profession) || null, log,
      total: Math.max(Number(cr.totalCount) || 0, log.length),
      today: log.filter((e) => e.dayKey === dayKey).length,
      week: log.filter((e) => e.weekKey === weekKey).length,
      sent: log.filter((e) => e.inboxId).length,
      last: log[0] || null,
    };
  }).filter((r) => r.prof || r.total > 0).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const open = rows.find((r) => r.uid === openUid) || null;
  // Settimana → giorno → voci (le più recenti in cima).
  const weeks = open ? [...open.log].sort((a, b) => (b.at || 0) - (a.at || 0)).reduce((acc, e) => {
    const wk = e.weekKey || "?", dk = e.dayKey || "?";
    let w = acc.find((x) => x.key === wk); if (!w) { w = { key: wk, days: [] }; acc.push(w); }
    let d = w.days.find((x) => x.key === dk); if (!d) { d = { key: dk, items: [] }; w.days.push(d); }
    d.items.push(e); return acc;
  }, []) : [];

  return (
    <div className="nx-pannello off-box off-ledger">
      <div className="off-ledger-head">
        <div className="off-sec-head off-ledger-t"><span className="nx-tag">📊 Registro dei craft</span><p className="nx-nota">Tocca un personaggio per vedere le sue prove giorno per giorno (le ultime 40). Da lì puoi annullarne una.</p></div>
        <div className="off-ledger-sum">
          <span><b>{sum("total")}</b><small>totale</small></span>
          <span><b>{sum("today")}</b><small>oggi</small></span>
          <span><b>{sum("week")}</b><small>settimana</small></span>
          <span><b>{sum("sent")}</b><small>in coda</small></span>
        </div>
      </div>
      {rows.length === 0 ? <p className="nx-nota">Nessuna prova ancora.</p> : (
        <div className="off-ledger-table">
          <div className="off-ledger-row is-head"><span>Personaggio</span><span>Totale</span><span>Oggi</span><span>Sett.</span><span>Ultima prova</span></div>
          {rows.map((r) => (
            <button key={r.uid} type="button" className={`off-ledger-row${openUid === r.uid ? " on" : ""}`} onClick={() => setOpenUid(openUid === r.uid ? "" : r.uid)} aria-expanded={openUid === r.uid}>
              <span className="off-ledger-name"><b>{r.name}</b><small>{r.prof ? `${r.prof.icon} ${r.prof.name}` : "—"}</small></span>
              <span className="off-ledger-n"><b>{r.total}</b></span>
              <span className={`off-ledger-n${r.today ? " is-on" : ""}`}>{r.today}<i>/{CRAFT_MAX_PER_DAY}</i></span>
              <span className={`off-ledger-n${r.week ? " is-on" : ""}`}>{r.week}<i>/{CRAFT_MAX_PER_WEEK}</i></span>
              <span className="off-ledger-last">{r.last ? <>{tierMeta(r.last.tier).icon} {r.last.choice || r.last.name}<small>{dayLabel(r.last.dayKey)} · {entryStatus(r.last, nowMs)}</small></> : <small>—</small>}</span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="off-ledger-detail">
          <span className="off-label">{open.name} · {open.log.length} prove nel registro{open.total > open.log.length ? ` (${open.total} a vita)` : ""} · {open.sent} mandate in coda <small>· ✕ elimina una prova e la annulla del tutto</small></span>
          {weeks.map((w) => (
            <div key={w.key} className="off-ledger-week">
              <div className="off-ledger-wk"><b>Settimana da {dayLabel(w.key)}</b>{w.key === weekKey && <em>in corso</em>}<small>{w.days.reduce((a, d) => a + d.items.length, 0)} prove</small></div>
              {w.days.map((d) => (
                <div key={d.key} className="off-ledger-day">
                  <div className="off-ledger-dk">{dayLabel(d.key)}{d.key === dayKey && <em>oggi</em>}<small>{d.items.length}</small></div>
                  <ul>
                    {d.items.map((e) => (
                      <li key={e.id} style={{ "--q": tierMeta(e.tier).color }}>
                        <span className="off-ledger-t">{timeLabel(e.at)}</span>
                        <span className="off-ledger-item"><b>{tierMeta(e.tier).icon} {e.choice || e.name}{e.cursed ? " ☠" : ""}</b><small>{tierMeta(e.tier).label}{e.targetTier && normTier(e.targetTier) !== normTier(e.tier) ? ` (mirava ${tierMeta(e.targetTier).label}${e.pickName ? `: ${e.pickName}` : ""})` : ""} · d20 {e.d20}{sign(e.bonus)}={e.total}{e.d12 ? ` · d12 ${e.d12}` : ""} · +{e.xp} PE{e.minutes ? ` · ⏱ ${fmtMinutes(e.minutes)}` : ""}{e.enhancer ? ` · ${ENHANCERS.find((x) => x.key === e.enhancer)?.name || e.enhancer}` : ""}{e.note ? ` · "${e.note}"` : ""}</small>{e.cursed && e.curse && <CurseCard curse={e.curse} compact />}</span>
                        <span className={`off-log-st${e.inboxId ? " ok" : e.failed ? " bad" : e.skipped ? " no" : ""}`}>{entryStatus(e, nowMs)}</span>
                        {confirmId === e.id ? (
                          <span className="off-ledger-del is-confirm">
                            <small>Annullo la prova: via dal registro, uso restituito, −{e.xp || 0} PE{e.inboxId ? ", tolta dalla coda" : ""}.</small>
                            <button type="button" className="off-ghost is-danger" disabled={busyId === e.id} onClick={() => deleteEntry(open.uid, e)}>{busyId === e.id ? "…" : "Sì, elimina"}</button>
                            <button type="button" className="off-ghost" disabled={busyId === e.id} onClick={() => setConfirmId("")}>No</button>
                          </span>
                        ) : (
                          <button type="button" className="off-ledger-del" title="Elimina questa prova" aria-label="Elimina questa prova" onClick={() => setConfirmId(e.id)}>✕</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
