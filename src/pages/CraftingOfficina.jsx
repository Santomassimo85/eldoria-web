// ── L'Officina: il crafting giocabile dall'app ───────────────────────────────
// I giocatori scelgono la professione, puntano a una RARITÀ (Comune · Non
// comune · Raro: scelgono anche QUALE oggetto fra i 6 del catalogo della
// professione; Molto raro · Leggendario: l'oggetto lo decide il d12), preparano
// il banco (strumenti, componenti trovati in sessione, aiuto, materiali, ritmo)
// e tirano il d20 (+ modificatore, + competenza strumenti, + grado, + condizioni).
// Un tiro sotto la rarità mirata dà lo stesso oggetto della rarità inferiore
// (sotto 6 uno Scarso a caso). Il Master vede il tavolo in tempo reale
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
import { ENHANCERS, TIER_TO_FOUNDRY, craftedItemToFoundryPayload, enhancerEvidence, itemChoices } from "../data/craftingFoundry";
import { COMPONENTS, COMPONENT_ROLL_DIE, CRAFT_BASE_MINUTES, INVESTMENTS, MAX_COMPONENTS, PACE_OPTIONS, TOOLS_MINUTES, componentByKey, applyOutcomeTime, componentEffectLabel, craftMinutes, craftTimeLabel, fmtCountdown, fmtMinutes, fmtMo, investCostMo, investmentByKey, outcomeTimeBy, outcomeTimeRange, paceByKey, xpWithInvestment } from "../data/craftingTime";
import { componentEvidence, toolsEvidence } from "../data/craftingOwnership";
import "./CraftingOfficina.css";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];
const STAT_KEY = { FOR: "str", DES: "dex", INT: "int", SAG: "wis" };

// Qualità dei materiali e aiuto al banco: scelte DISMESSE il 2026-09-22 (al loro
// posto c'è l'investimento). Le etichette restano solo per rileggere le prove vecchie.
const LEGACY_QUALITY = { sup: "di qualità superiore", fortuna: "di fortuna" };
// Costo dei materiali della rarità, in monete.
const tierMo = (tier) => PREGIATURA_COSTS.find((c) => c.tier === normTier(tier))?.mo || 0;
// Un 1 naturale (o il fallimento della fretta) rovina il lavoro: il banco resta
// occupato due minuti con la barra rossa, poi si scopre il disastro.
const FAIL_MINUTES = 2;

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

export default function CraftingOfficina() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  // In DEV `?vista=player` fa vedere al Master la pagina con i limiti di un giocatore (per provarli).
  const devPlayerView = import.meta.env.DEV && new URLSearchParams(window.location.search).get("vista") === "player";
  const isMaster = MASTER_EMAILS.includes(currentUser?.email) && !devPlayerView;
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
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [working]);

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
      // Disastro: 1 naturale sul d20, oppure il fallimento critico della fretta (5%).
      // In entrambi i casi materiali e monete sono persi e non esce nulla.
      const fumble = d20 === 1;
      const critRoll = paceOpt.critFail ? rnd(100) : 0;
      const paceFail = !!paceOpt.critFail && critRoll <= paceOpt.critFail;
      const failed = fumble || paceFail;
      let tier = tierByTotal(total);
      // Non si supera la rarità mirata (i materiali sono quelli); Molto raro/Leggendario solo dal grado giusto.
      if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(target)) tier = target;
      while (tierMinGrade(tier) > prog.level.grado) tier = TIER_ORDER[TIER_ORDER.indexOf(tier) - 1];
      if (tier === "scarso" && prog.scarsoAsComune) tier = "common";
      // L'oggetto: la linea scelta nel catalogo (alla rarità uscita) oppure il d12 sulla tabella.
      const picked = pickLine && tierMeta(tier).pick ? pickLine[tier] : null;
      const d12 = picked ? 0 : rnd(12);
      const failDesc = fumble
        ? `Un 1 naturale: il pezzo ti si è rovinato fra le mani. I materiali e le ${fmtMo(costMo)} spese sono perduti e non è uscito nulla.`
        : `La fretta ha rovinato tutto: i materiali e le ${fmtMo(costMo)} spese sono perduti e non è uscito nulla.`;
      const [name, desc] = failed ? ["Fallimento critico", failDesc] : picked || prof.creazioni[tier][d12 - 1];
      const failMs = FAIL_MINUTES * 60000;
      const nat20 = d20 === 20;
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
        invest: investOpt.key, upgraded: !failed && investOpt.upgrade, costMo, pace: paceOpt.key, components: work.components,
        dist, outcome: failed ? "" : outWork.outcome,
        xp: failed ? 0 : xpWithInvestment(xpForCraft(tier, nat20), investOpt), nat20, inboxId: "", enhancer: "", choice: "", note: "",
        failed, fumble, critRoll, skipped: false, // anche il disastro sta sul banco: due minuti di barra rossa
        componentProof: {}, toolsProof: toolsOn ? toolsEv.label : "",
      };
      // Transazione: rilegge contatori e scorte e rifiuta se nel frattempo sono stati consumati.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "characters", uid);
        const snap = await tx.get(ref);
        const cur = snap.exists() ? (snap.data().crafting || {}) : {};
        const al = craftAllowance(cur, srvNow);
        if (!isMaster && !al.can) throw new Error(al.reason);
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
          "crafting.xp": (Number(cur.xp) || 0) + entry.xp,
          "crafting.log": [entry, ...prevLog].slice(0, 40),
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
      await showD20Roll(d20, { label: `Pregiatura · ${prof.name}` });
      setComps([]); setPickIdx(-1); setInvest(""); setChoice(""); setEnhKey(""); setNote(""); setRevealedId("");
      const tm = tierMeta(tier);
      const compTxt = compRolls.length ? ` (componenti +${compBonus})` : "";
      if (failed) setMsg(`💥 ${fumble ? "1 naturale" : `Fallimento critico della fretta (${critRoll}/100 sotto il ${paceOpt.critFail}%)`}: il lavoro sta andando a rotoli. Fra ${FAIL_MINUTES} minuti vedrai i danni.`);
      else {
        const o = outcomeTimeBy(outWork.outcome);
        const timeTxt = outWork.minutes === work.minutes
          ? `Il lavoro dura ${fmtMinutes(outWork.minutes)}`
          : `${o.label}: il lavoro passa da ${fmtMinutes(work.minutes)} a ${fmtMinutes(outWork.minutes)}`;
        setMsg(`${tm.icon} ${d20}${advMode ? ` (${advMode === "adv" ? "vantaggio" : "svantaggio"}: ${a}/${b})` : ""} ${sign(rollBonus)}${compTxt} = ${total} → ${tm.label}${investOpt.upgrade ? " (di fattura superiore)" : ""}. Paghi ${fmtMo(costMo)} di materiali. ${timeTxt}: l'oggetto si ritira ${whenLabel(entry.readyAt, srvNow)}. +${entry.xp} PE${nat20 ? " (20 naturale, raddoppiati!)" : ""}.`);
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
  const TABS = [
    { key: "banco", label: prof ? "Il banco" : "La professione" },
    { key: "creazioni", label: "Creazioni", n: log.length },
    { key: "componenti", label: "Componenti", n: compCount },
    { key: "progressi", label: "Progressi" },
    ...(isMaster ? [{ key: "master", label: "Master", n: tableChars.filter((c) => (c.crafting?.log || []).some((e) => !e.inboxId && !e.skipped)).length }] : []),
  ];
  const curTab = TABS.some((t) => t.key === tab) ? tab : "banco";

  return (
    <div className="off" id="off-banco">
      {/* ── TESTATA: professione, grado, usi ── */}
      <div className="nx-pannello off-box off-head">
        <div className="off-head-main">
          <span className="nx-tag">⚒ Officina</span>
          {prof ? (
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
        {allow.unlimited ? (
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
      {prof && pendingEntry && !revealed && (
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
                <div className="off-band is-fail" style={{ "--q": "#b91c1c" }}>
                  <span className="off-band-r">1 nat.</span>
                  <span className="off-band-t">💥 Disastro</span>
                  <span className="off-band-n">niente: materiali e monete perduti</span>
                  <span className="off-band-x">⏱ {FAIL_MINUTES} min · +0 PE</span>
                </div>
              </div>
              <p className="nx-nota off-bands-note">Il totale non può salire sopra la rarità mirata: i materiali sono quelli. Più il tiro resta sotto, più pezzi devi rifare e più il lavoro dura (+25% una rarità sotto, +50% da due in giù). Con un <strong>20 naturale</strong> ti riesce al primo colpo: tempo al 60% e PE doppi.</p>
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
                  <span className="off-sum-cost">Materiali <b>{fmtMo(costMo)}</b>{investOpt.costPct ? <i> (+{investOpt.costPct}% sui {fmtMo(baseMo)} di base)</i> : null}, da pagare in gioco · <b>+{xpGain} PE</b> se esce {targetMeta.label}</span>
                </div>
              </div>

              <div className="off-go off-go--bar">
                <button type="button" className="cta off-cta" disabled={busy || !allow.can || needsPick} onClick={roll}>
                  {busy ? "…" : !allow.can ? "Prova non disponibile" : needsPick ? "Scegli prima l'oggetto" : `🎲 Tira e inizia · ${fmtMinutes(work.minutes)}`}
                </button>
                {!allow.can && <span className="nx-nota off-why">{allow.reason}</span>}
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
            <span className="off-work-roll">{pendingEntry.failed
              ? <>d20 <b>{pendingEntry.d20}</b>{pendingEntry.fumble ? <> · <b>1 naturale</b></> : <> · fretta</>} → <b>fallimento critico</b></>
              : <>{pendingEntry.pickName ? <>{tierMeta(pendingEntry.targetTier).icon} {pendingEntry.pickName} · </> : null}d20 <b>{pendingEntry.d20}</b> {sign(pendingEntry.bonus)} = <b>{pendingEntry.total}</b> → {tierMeta(pendingEntry.tier).icon} {tierMeta(pendingEntry.tier).label}</>}</span>
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
              : <>Il lavoro dura <strong>{pendingEntry.work ? craftTimeLabel(pendingEntry.work) : fmtMinutes(pendingEntry.minutes || 0)}</strong>{pendingEntry.plannedMinutes && pendingEntry.plannedMinutes !== pendingEntry.minutes ? <> invece dei {fmtMinutes(pendingEntry.plannedMinutes)} preparati, perché {outcomeTimeBy(pendingEntry.outcome).label.toLowerCase()}</> : null}: finché non è finito l'oggetto resta sul banco. Puoi chiudere la pagina e tornare.</>}
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
            <div className="off-esito-roll">d20 <b>{activeEntry.d20}</b>{activeEntry.adv ? <small> ({activeEntry.adv === "adv" ? "vant." : "svant."} {activeEntry.d20b})</small> : null}{activeEntry.fumble ? <> · <b>1 naturale</b></> : <> · fretta ({activeEntry.critRoll}/100)</>} · +0 PE</div>
          </div>
          <h3 className="nx-titolo off-esito-name">Hai perso tutto</h3>
          <p className="nx-prosa off-esito-desc">{activeEntry.desc}</p>
          <ul className="off-fail-list">
            <li>💰 <b>{fmtMo(activeEntry.costMo || 0)}</b> di materiali: <strong>persi</strong>, toglili dal tuo oro in gioco.</li>
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
          {activeEntry.upgraded && <p className="nx-nota off-esito-up">✦ <strong>Fattura superiore</strong>: hai speso il {investmentByKey(activeEntry.invest).costPct}% in più di materiali ({fmtMo(activeEntry.costMo || 0)}) e l'oggetto esce potenziato.</p>}
          {(activeEntry.compRolls || []).length > 0 && (
            <p className="nx-nota off-esito-comps">🧪 Componenti: {activeEntry.compRolls.map((r) => { const c = componentByKey(r.key); return c ? `${c.icon} ${c.name} +${r.roll}${c.effect ? ` (${componentEffectLabel(c)})` : ""}` : r.key; }).join(" · ")}</p>
          )}

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
                return (
                  <li key={e.id} style={{ "--q": tm.color }}>
                    <span className="off-log-ic" aria-hidden="true">{tm.icon}</span>
                    <span className="off-log-main"><b>{onBench && (Number(e.readyAt) || 0) > nowMs ? "Sul banco…" : (e.choice || e.name)}{e.upgraded ? " ✦" : ""}</b><small>{new Date(e.at).toLocaleDateString("it-IT")} · d20 {e.d20}{sign(e.bonus)}={e.total}{e.d12 ? ` · d12 ${e.d12}` : ""} · +{e.xp} PE{e.minutes ? ` · ⏱ ${fmtMinutes(e.minutes)}` : ""}{e.costMo ? ` · ${fmtMo(e.costMo)}` : ""}</small></span>
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
        <MasterBoard chars={tableChars} nowMs={nowMs} />
        <MasterPanel chars={tableChars} />
      </>)}
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
                      <b>{b.failed ? "💥 Fallimento critico" : `${tm.icon} ${b.pickName || b.name}`}</b>
                      <small>{b.failed
                        ? `${b.fumble ? "1 naturale" : "fretta"} puntando a ${tm.label} · ${fmtMo(b.costMo || 0)} di materiali persi`
                        : `punta a ${tm.label}${b.pickName ? "" : " (d12 a fine lavoro)"} · esce ${tierMeta(b.tier).label}${b.pickName && b.name !== b.pickName ? `: ${b.name}` : ""} · d20 ${b.d20}${sign(b.bonus)}=${b.total}`}</small>
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

// ── Pannello del Master: professioni, PE, usi, scorte e lavori di tutti gli eroi attivi ──
function MasterPanel({ chars }) {
  const [busy, setBusy] = useState("");
  const [nudge, setNudge] = useState(""); // esito dell'avviso "scegli una professione"
  const load = async () => {}; // i personaggi arrivano già in tempo reale (onSnapshot)

  // Eroi che non hanno ancora scelto la professione: si può avvisarli in un tocco.
  const senza = chars.filter((c) => !c.crafting?.profession);

  // Un doc in `notifications` per ciascuno: la campanella dell'app e, via
  // `pushOnNotification` (functions), anche la notifica push sul telefono.
  async function nudgeSenzaProfessione() {
    if (!senza.length) return;
    if (!window.confirm(`Mandare l'avviso dell'Officina a ${senza.length} eroi senza professione?

${senza.map((c) => c.name).join(", ")}`)) return;
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

  async function act(uid, patch) {
    setBusy(uid);
    try { await updateDoc(doc(db, "characters", uid), patch); }
    catch (e) { alert("Errore: " + (e.message || e)); }
    finally { setBusy(""); }
  }

  // Il lavoro sul banco finisce subito (il Master lo "sblocca").
  async function finishNow(c, entry) {
    const srv = await serverNow().catch(() => new Date());
    const log = (c.crafting?.log || []).map((e) => (e.id === entry.id ? { ...e, readyAt: srv.getTime() - 1000, finishedByMaster: true } : e));
    await act(c.uid, { "crafting.log": log, "crafting.busyUntil": deleteField() });
  }

  return (
    <details className="nx-pannello off-box off-master">
      <summary>🎯 Master · professioni, PE, scorte <small>({chars.length} eroi · {senza.length} senza professione)</small></summary>
      <div className="off-master-nudge">
        <span>
          <b>{senza.length}</b> {senza.length === 1 ? "eroe non ha" : "eroi non hanno"} ancora una professione{senza.length ? `: ${senza.map((c) => c.name).join(", ")}` : "."}
        </span>
        <button type="button" className="off-ghost" disabled={busy === "nudge" || !senza.length} onClick={nudgeSenzaProfessione}>
          {busy === "nudge" ? "Invio…" : `🔔 Avvisali (${senza.length})`}
        </button>
        {nudge && <em className={nudge.startsWith("Errore") ? "is-err" : ""}>{nudge}</em>}
      </div>
      <ul className="off-master-list">
        {chars.map((c) => {
          const cr = c.crafting || {};
          const p = PROFESSIONI.find((x) => x.key === cr.profession);
          const pr = progression(cr.xp || 0);
          const al = craftAllowance(cr);
          const bench = (cr.log || []).find((e) => !e.inboxId && !e.skipped) || null;
          const benchLeft = bench ? (Number(bench.readyAt) || 0) - Date.now() : 0;
          return (
            <li key={c.uid}>
              <div className="off-master-row">
                <b>{c.name}</b>
                <select className="off-input" value={cr.profession || ""} disabled={busy === c.uid} onChange={(e) => act(c.uid, { "crafting.profession": e.target.value })}>
                  <option value="">— nessuna professione —</option>
                  {PROFESSIONI.map((x) => <option key={x.key} value={x.key}>{x.icon} {x.name}</option>)}
                </select>
                <small>{p ? `${pr.grado.name} · lv ${pr.level.lv} · ${pr.xp} PE` : "—"} · settimana {al.weekCount}/{CRAFT_MAX_PER_WEEK}{al.usedToday ? " · oggi usata" : ""}</small>
              </div>
              {bench && (
                <div className="off-master-bench">
                  <small>Sul banco:</small> {tierMeta(bench.tier).icon} {bench.name} · {benchLeft > 0 ? `pronto tra ${fmtCountdown(benchLeft)}` : "finito, da ritirare"}
                  {benchLeft > 0 && <button type="button" className="off-ghost" disabled={busy === c.uid} onClick={() => finishNow(c, bench)}>⏩ Termina ora</button>}
                </div>
              )}
              <div className="off-master-enh">
                <small>Componenti trovati:</small>
                {COMPONENTS.map((k) => {
                  const n = Number(cr.components?.[k.key]) || 0;
                  return (
                    <span key={k.key} className={`off-stock${n > 0 ? " on" : ""}`} title={`${k.name} · −${k.minutes} min`}>
                      <button type="button" disabled={busy === c.uid || n <= 0} onClick={() => act(c.uid, { [`crafting.components.${k.key}`]: n - 1 })} aria-label={`Togli ${k.name}`}>−</button>
                      <b>{k.icon} {n}</b>
                      <button type="button" disabled={busy === c.uid} onClick={() => act(c.uid, { [`crafting.components.${k.key}`]: n + 1 })} aria-label={`Assegna ${k.name}`}>+</button>
                    </span>
                  );
                })}
              </div>
              <div className="off-master-enh">
                <small>Potenziatori assegnati:</small>
                {ENHANCERS.map((e) => {
                  const n = Number(cr.enhancers?.[e.key]) || 0;
                  return (
                    <span key={e.key} className={`off-stock${n > 0 ? " on" : ""}`} title={e.name}>
                      <button type="button" disabled={busy === c.uid || n <= 0} onClick={() => act(c.uid, { [`crafting.enhancers.${e.key}`]: n - 1 })} aria-label={`Togli ${e.name}`}>−</button>
                      <b>{e.icon} {n}</b>
                      <button type="button" disabled={busy === c.uid} onClick={() => act(c.uid, { [`crafting.enhancers.${e.key}`]: n + 1 })} aria-label={`Assegna ${e.name}`}>+</button>
                    </span>
                  );
                })}
              </div>
              <div className="off-master-acts">
                <button type="button" className="off-ghost" disabled={busy === c.uid} onClick={() => act(c.uid, { "crafting.xp": (Number(cr.xp) || 0) + 25 })}>+25 PE</button>
                <button type="button" className="off-ghost" disabled={busy === c.uid || !(Number(cr.xp) > 0)} onClick={() => act(c.uid, { "crafting.xp": Math.max(0, (Number(cr.xp) || 0) - 25) })}>−25 PE</button>
                <button type="button" className="off-ghost" disabled={busy === c.uid} onClick={() => act(c.uid, { "crafting.weekCount": 0, "crafting.lastDayKey": "" })}>Azzera usi</button>
                <button type="button" className="off-ghost" disabled={busy === c.uid || !c.crafting} onClick={() => { if (window.confirm(`Azzerare del tutto il crafting di ${c.name} (professione, PE, registro, scorte)?`)) act(c.uid, { crafting: deleteField() }); }}>Reset totale</button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="nx-nota">Gli oggetti creati arrivano in <Link to="/dm-admin/foundry-item">Crea Oggetto → Foundry</Link> con l'etichetta ⚒, il tempo di lavoro e la nota della prova. Valore Foundry per rarità: {TIER_ORDER.map((t) => `${tierMeta(t).label} ${TIER_TO_FOUNDRY[t].price} mo`).join(", ")}.</p>
      <CraftLedger chars={chars} reload={load} patchChar={() => {}} />
    </details>
  );
}

// ── Registro dei craft del tavolo: quanti (totale · oggi · settimana) e cosa, per ogni PG ──
const dayLabel = (key) => key ? new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${key}T12:00:00Z`)) : "—";
const timeLabel = (ms) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, hour: "2-digit", minute: "2-digit" }).format(new Date(ms || 0));
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
          "crafting.xp": Math.max(0, (Number(cur.xp) || 0) - (Number(e.xp) || 0)),
        };
        if (cur.weekKey && cur.weekKey === e.weekKey) patch["crafting.weekCount"] = Math.max(0, (Number(cur.weekCount) || 0) - 1);
        if (cur.lastDayKey && cur.lastDayKey === e.dayKey && !log.some((x) => x.dayKey === e.dayKey)) patch["crafting.lastDayKey"] = "";
        if (!e.inboxId && !e.skipped) patch["crafting.busyUntil"] = deleteField();
        tx.update(ref, patch);
      });
      if (e.inboxId) await deleteDoc(doc(db, "foundry_inbox", e.inboxId)).catch(() => {});
      setConfirmId("");
      // Aggiorno subito la tabella (la rilettura da Firestore può arrivare dopo), poi ricarico.
      if (newLog) patchChar(uid, (cr) => ({ ...cr, log: newLog, totalCount: Math.max(0, Math.max(Number(cr.totalCount) || 0, newLog.length + 1) - 1), xp: Math.max(0, (Number(cr.xp) || 0) - (Number(e.xp) || 0)) }));
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
    <div className="off-ledger">
      <div className="off-ledger-head">
        <span className="off-label">📊 Registro dei craft <small>(totale a vita · oggi · questa settimana; il dettaglio tiene le ultime 40 prove di ogni PG)</small></span>
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
              <div className="off-ledger-wk"><b>Settimana da domenica {dayLabel(w.key)}</b>{w.key === weekKey && <em>in corso</em>}<small>{w.days.reduce((a, d) => a + d.items.length, 0)} prove</small></div>
              {w.days.map((d) => (
                <div key={d.key} className="off-ledger-day">
                  <div className="off-ledger-dk">{dayLabel(d.key)}{d.key === dayKey && <em>oggi</em>}<small>{d.items.length}</small></div>
                  <ul>
                    {d.items.map((e) => (
                      <li key={e.id} style={{ "--q": tierMeta(e.tier).color }}>
                        <span className="off-ledger-t">{timeLabel(e.at)}</span>
                        <span className="off-ledger-item"><b>{tierMeta(e.tier).icon} {e.choice || e.name}</b><small>{tierMeta(e.tier).label}{e.targetTier && normTier(e.targetTier) !== normTier(e.tier) ? ` (mirava ${tierMeta(e.targetTier).label}${e.pickName ? `: ${e.pickName}` : ""})` : ""} · d20 {e.d20}{sign(e.bonus)}={e.total}{e.d12 ? ` · d12 ${e.d12}` : ""} · +{e.xp} PE{e.minutes ? ` · ⏱ ${fmtMinutes(e.minutes)}` : ""}{e.enhancer ? ` · ${ENHANCERS.find((x) => x.key === e.enhancer)?.name || e.enhancer}` : ""}{e.note ? ` · "${e.note}"` : ""}</small></span>
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
