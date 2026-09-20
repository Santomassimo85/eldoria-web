// ── L'Officina: il crafting giocabile dall'app ───────────────────────────────
// I giocatori scelgono la professione, puntano a una pregiatura, preparano il
// banco (strumenti, componenti trovati in sessione, aiuto, materiali, ritmo) e
// tirano il d20 (+ modificatore, + competenza strumenti, + grado, + condizioni)
// e il d12 sulla tabella del manuale. Il tiro AVVIA un lavoro con un tempo
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
import { PREGIATURE, PREGIATURA_COSTS, PROFESSIONI } from "../data/crafting";
import { CRAFT_MAX_PER_DAY, CRAFT_MAX_PER_WEEK, craftAllowance, craftDayKey, craftResetLabel, craftWeekKey } from "../data/craftingWeek";
import { serverClockOffset, serverNow } from "../data/serverClock";
import { GRADE_BONUS, XP_LEVELS, XP_PER_TIER, progression, xpForCraft } from "../data/craftingProgress";
import { ENHANCERS, TIER_TO_FOUNDRY, craftedItemToFoundryPayload, enhancerEvidence, itemChoices } from "../data/craftingFoundry";
import { COMPONENTS, COMPONENT_ROLL_DIE, CRAFT_BASE_MINUTES, HELP_OPTIONS, MAX_COMPONENTS, PACE_OPTIONS, TOOLS_MINUTES, componentByKey, componentEffectLabel, craftMinutes, craftTimeLabel, fmtCountdown, fmtMinutes, helpByKey, paceByKey } from "../data/craftingTime";
import { componentEvidence, toolsEvidence } from "../data/craftingOwnership";
import "./CraftingOfficina.css";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];
const STAT_KEY = { FOR: "str", DES: "dex", INT: "int", SAG: "wis" };
const TIER_ORDER = ["scarso", "comune", "raro", "magico", "perfetto"];

// Qualità dei materiali (dal manuale): vantaggio o svantaggio al tiro.
const QUALITY_OPTIONS = [
  { key: "",        icon: "📦", label: "Normali",              adv: 0,  desc: "I materiali di base della pregiatura, pagati in gioco." },
  { key: "sup",     icon: "💎", label: "Di qualità superiore", adv: 1,  desc: "Mithril, gemme rare…: vantaggio al tiro." },
  { key: "fortuna", icon: "🪨", label: "Di fortuna",           adv: -1, desc: "Quel che c'era: svantaggio al tiro." },
];
const qualityByKey = (k) => QUALITY_OPTIONS.find((q) => q.key === (k || "")) || QUALITY_OPTIONS[0];

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
const tierByTotal = (t) => (t <= 5 ? "scarso" : t <= 10 ? "comune" : t <= 15 ? "raro" : t <= 20 ? "magico" : "perfetto");
const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
const rnd = (n) => 1 + Math.floor(Math.random() * n);
const tierMeta = (k) => PREGIATURE.find((p) => p.key === k) || PREGIATURE[1];
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
  const [target, setTarget] = useState("comune");
  const [comps, setComps] = useState([]);
  const [help, setHelp] = useState("");
  const [pace, setPace] = useState("normale");
  const [quality, setQuality] = useState("");
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
  const helpOpt = helpByKey(help), paceOpt = paceByKey(pace), qualOpt = qualityByKey(quality);
  const extra = helpOpt.roll + paceOpt.roll;
  const advSum = qualOpt.adv + (toolsOn ? 0 : -1);
  const advMode = advSum > 0 ? "adv" : advSum < 0 ? "dis" : "";
  const bonus = abil + toolB + gradeB + extra;
  const targetCost = PREGIATURA_COSTS.find((c) => c.tier === target);
  const work = useMemo(() => craftMinutes({ tier: target, tools: toolsOn, components: comps, help, pace, ritmoBottega: prog.level.lv >= 6 }), [target, toolsOn, comps, help, pace, prog.level.lv]);

  const activeEntry = revealed ? pendingEntry : null;
  const activeProf = activeEntry ? (PROFESSIONI.find((x) => x.key === activeEntry.profession) || prof) : null;
  const previewName = activeEntry ? (itemChoices(activeEntry.name).length > 1 ? (choice || itemChoices(activeEntry.name)[0]) : activeEntry.name) : "";
  const preview = useMemo(() => {
    if (!activeEntry || !activeProf) return null;
    const enh = ENHANCERS.find((x) => x.key === enhKey) || null;
    return craftedItemToFoundryPayload({
      profession: activeProf, tier: activeEntry.tier, name: activeEntry.name, desc: activeEntry.desc,
      choice: previewName, enhancer: enh, note: note.trim(), work: activeEntry.work || null, components: activeEntry.components || [],
      crafter: { uid, name: charData?.name || "", gradeName: prog.grado.name },
      roll: { d20: activeEntry.d20, bonus: activeEntry.bonus, total: activeEntry.total, d12: activeEntry.d12 },
    });
  }, [activeEntry, activeProf, previewName, enhKey, note, charData?.name, prog.grado.name, uid]);
  const previewType = preview ? preview.foundryType : "";
  const enhancersFor = ENHANCERS.filter((e) => !previewType || e.applies.includes(previewType))
    .map((e) => ({ ...e, ev: enhancerEvidence(e, { charData, marketItems, isMaster }) }));
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
      // Di fretta: 5% di fallimento critico, i materiali vanno perduti e non esce nulla.
      const critRoll = paceOpt.critFail ? rnd(100) : 0;
      const failed = !!paceOpt.critFail && critRoll <= paceOpt.critFail;
      let tier = tierByTotal(total);
      // Non si supera la pregiatura mirata (i materiali sono quelli); Perfetto solo dal Maestro.
      if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(target)) tier = target;
      if (tier === "perfetto" && !prog.canPerfetto) tier = "magico";
      if (tier === "scarso" && prog.scarsoAsComune) tier = "comune";
      const d12 = rnd(12);
      const [name, desc] = failed ? ["Fallimento critico", `La fretta ha rovinato tutto: i materiali (${targetCostFor(target)}) sono andati perduti e non è uscito nulla.`] : prof.creazioni[tier][d12 - 1];
      const nat20 = d20 === 20;
      const startMs = srvNow.getTime();
      const entry = {
        id: `${startMs}-${d20}${d12}`, at: startMs, readyAt: failed ? startMs : startMs + work.minutes * 60000, minutes: failed ? 0 : work.minutes, work,
        dayKey: "", weekKey: "",
        profession: prof.key, targetTier: target, tier, d20, d20b: advMode ? b : 0, adv: advMode,
        bonus: rollBonus, bonusParts: { abil, tools: toolB, grade: gradeB, extra, comps: compBonus }, compRolls, total, d12, name, desc,
        quality: qualOpt.key, help: helpOpt.key, pace: paceOpt.key, components: work.components,
        xp: failed ? 0 : xpForCraft(tier, nat20), nat20, inboxId: "", enhancer: "", choice: "", note: "",
        failed, critRoll, skipped: failed, // fallito = chiuso subito, non blocca il banco
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
      setComps([]); setChoice(""); setEnhKey(""); setNote(""); setRevealedId("");
      const tm = tierMeta(tier);
      const compTxt = compRolls.length ? ` (componenti +${compBonus})` : "";
      if (failed) setMsg(`Errore: 💥 Fallimento critico (${critRoll}/100 sotto il ${paceOpt.critFail}%): la fretta ha rovinato il lavoro. I materiali (${targetCostFor(target)}) sono perduti, non hai creato nulla e la prova è consumata.`);
      else setMsg(`${tm.icon} ${d20}${advMode ? ` (${advMode === "adv" ? "vantaggio" : "svantaggio"}: ${a}/${b})` : ""} ${sign(rollBonus)}${compTxt} = ${total} → ${tm.label}. Il lavoro dura ${fmtMinutes(work.minutes)}: l'oggetto si ritira ${whenLabel(entry.readyAt, srvNow)}. +${entry.xp} PE${nat20 ? " (20 naturale, raddoppiati!)" : ""}.`);
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
        enhancer: enh, note: note.trim(), work: entry.work || null, components: entry.components || [],
        crafter: { uid, name: charData?.name || currentUser.email, gradeName: prog.grado.name },
        roll: { d20: entry.d20, bonus: entry.bonus, total: entry.total, d12: entry.d12 },
      });
      const conds = [qualityByKey(entry.quality).key ? `materiali ${qualityByKey(entry.quality).label.toLowerCase()}` : "", entry.work && !entry.work.tools ? "senza strumenti" : ""].filter(Boolean);
      const ref = await addDoc(collection(db, "foundry_inbox"), {
        status: "pending", ...payload,
        origin: "crafting", crafterUid: uid, crafterName: charData?.name || "",
        craft: {
          profession: p.key, tier: entry.tier, targetTier: entry.targetTier, d20: entry.d20, total: entry.total, d12: entry.d12,
          enhancer: enh?.key || "", enhancerSource: ev?.source || "", enhancerProof: ev?.label || "", note: note.trim(),
          cost: targetCostFor(entry.targetTier), mods: conds,
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

  return (
    <div className="off">
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

      {/* ── SCELTA PROFESSIONE ── */}
      {!prof && (
        <div className="nx-pannello off-box">
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
          <h3 className="off-h"><span className="orb" aria-hidden="true">1</span> A cosa punti <small>il tempo di lavoro parte da qui</small></h3>
          <div className="off-tiers">
            {PREGIATURE.filter((p) => p.key !== "scarso").map((p) => {
              const locked = p.key === "perfetto" && !prog.canPerfetto;
              return (
                <button key={p.key} type="button" className={`off-tier${target === p.key ? " on" : ""}`} style={{ "--q": p.color }} disabled={locked} onClick={() => setTarget(p.key)} title={locked ? "Solo dal grado Maestro" : p.desc}>
                  <span className="off-tier-top"><span aria-hidden="true">{p.icon}</span> {p.label} <small>{p.range}</small></span>
                  <span className="off-tier-time">{locked ? "🔒 Maestro" : `⏱ ${fmtMinutes(CRAFT_BASE_MINUTES[p.key])}`}</span>
                </button>
              );
            })}
          </div>
          {targetCost && <p className="nx-nota off-cost"><strong>Materiali:</strong> {targetCost.costo} (prezzo fisso, si pagano in gioco). Un tiro basso dà un oggetto inferiore; uno alto non supera la pregiatura mirata.</p>}
          {prog.level.lv >= 4 && (
            <p className="nx-nota off-peek">👁 Occhio esperto · con 1: <em>{prof.creazioni[target][0][0]}</em> · con 12: <em>{prof.creazioni[target][11][0]}</em></p>
          )}

          <h3 className="off-h"><span className="orb" aria-hidden="true">2</span> Prepara il banco <small>ogni voce accorcia il lavoro o cambia il tiro</small></h3>
          <div className="off-bench">
            {/* strumenti */}
            {toolsEv.ok ? (
              <div className="off-tile off-tile-btn on is-auto">
                <span className="off-tile-h">🧰 Strumenti <small>✓ automatico</small></span>
                <b className="off-tile-v">Hai gli strumenti</b>
                <span className="off-tile-fx"><em>−{fmtMinutes(TOOLS_MINUTES)}</em> · {sign(profBonus(charData))} competenza</span>
                <span className="off-tile-proof">✓ {toolsEv.label}</span>
              </div>
            ) : (
              <div className="off-tile off-tile-btn is-bad is-locked" aria-disabled="true">
                <span className="off-tile-h">🧰 Strumenti <small>✗ non li possiedi</small></span>
                <b className="off-tile-v">Senza strumenti</b>
                <span className="off-tile-fx"><em>tempo pieno</em> · svantaggio</span>
                <span className="off-tile-empty">Non risultano <strong>{toolsEv.hint}</strong> sulla tua scheda. Il controllo è automatico: mettili nell'inventario su Foundry e sincronizza (o comprali al Mercato) e la voce si accende da sola.</span>
              </div>
            )}

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
                <p className="off-tile-empty">Nessun componente risulta tuo. Li trovi <strong>in sessione</strong>: il Master te li assegna qui o li mette nell'inventario su Foundry (poi sincronizza); ognuno accorcia il lavoro di 30–60 min e dà +1–{COMPONENT_ROLL_DIE} al tiro.</p>
              )}
              {comps.length > 0 && <span className="off-tile-fx"><em>−{fmtMinutes(comps.reduce((a, k) => a + (componentByKey(k)?.minutes || 0), 0))}</em> · <em>+{comps.length}–{comps.length * COMPONENT_ROLL_DIE}</em> al tiro (si tira all'avvio) · si consumano</span>}
            </div>

            {/* aiuto */}
            <div className="off-tile">
              <span className="off-tile-h">🤝 Aiuto</span>
              <div className="off-seg" role="radiogroup" aria-label="Aiuto al banco">
                {HELP_OPTIONS.map((h) => (
                  <button key={h.key || "solo"} type="button" role="radio" aria-checked={help === h.key} className={`off-seg-btn${help === h.key ? " on" : ""}`} onClick={() => setHelp(h.key)} title={h.desc}>
                    <span aria-hidden="true">{h.icon}</span> {h.label}
                  </button>
                ))}
              </div>
              <span className="off-tile-fx">{helpOpt.pct ? <><em>−{helpOpt.pct}% del tempo</em> · +{helpOpt.roll} al tiro · da concordare col Master</> : "nessun bonus"}</span>
            </div>

            {/* materiali */}
            <div className="off-tile">
              <span className="off-tile-h">💎 Materiali</span>
              <div className="off-seg" role="radiogroup" aria-label="Qualità dei materiali">
                {QUALITY_OPTIONS.map((q) => (
                  <button key={q.key || "norm"} type="button" role="radio" aria-checked={quality === q.key} className={`off-seg-btn${quality === q.key ? " on" : ""}${q.adv < 0 ? " is-bad" : ""}`} onClick={() => setQuality(q.key)} title={q.desc}>
                    <span aria-hidden="true">{q.icon}</span> {q.label}
                  </button>
                ))}
              </div>
              <span className="off-tile-fx">{qualOpt.adv > 0 ? <><em>vantaggio</em> al tiro · da concordare col Master</> : qualOpt.adv < 0 ? <><em>svantaggio</em> al tiro</> : "tiro normale"}</span>
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
              <span className="off-tile-fx">{paceOpt.mult === 1 ? "tempo pieno, tiro normale" : <><em>×{paceOpt.mult === 0.5 ? "½" : paceOpt.mult} tempo</em> · {sign(paceOpt.roll)} al tiro{paceOpt.critFail ? <> · <em>{paceOpt.critFail}% fallimento critico</em>: perdi i materiali e non crei nulla</> : null}</>}</span>
            </div>
          </div>

          {/* riepilogo: tempo + formula + via */}
          <div className="off-sum">
            <div className="off-sum-time">
              <span className="off-sum-k">Tempo di lavoro</span>
              <b>⏱ {fmtMinutes(work.minutes)}</b>
              <span className="off-sum-parts">
                {work.parts.map((p) => <span key={p.key} className={`off-part${p.min < 0 ? " is-less" : p.key !== "base" && p.min > 0 ? " is-more" : ""}`}>{p.label} {p.key === "base" ? fmtMinutes(p.min) : `${p.min < 0 ? "−" : "+"}${fmtMinutes(Math.abs(p.min))}`}</span>)}
              </span>
              <small>pronto {whenLabel(nowMs + work.minutes * 60000, now)} se inizi adesso · il tiro non lo cambia</small>
            </div>
            <div className="off-sum-roll">
              <span className="off-sum-k">Il tuo tiro</span>
              <div className="off-formula">
                <span className="off-die">d20</span>
                <span className="off-piece"><b>{sign(abil)}</b><small>{prof.caratteristica}</small></span>
                <span className={`off-piece${tools ? "" : " is-off"}`}><b>{sign(toolB)}</b><small>strumenti</small></span>
                <span className="off-piece"><b>{sign(gradeB)}</b><small>{prog.grado.name}</small></span>
                {extra !== 0 && <span className="off-piece"><b>{sign(extra)}</b><small>aiuto/ritmo</small></span>}
                {comps.length > 0 && <span className="off-piece"><b>+{comps.length}–{comps.length * COMPONENT_ROLL_DIE}</b><small>componenti</small></span>}
                <span className="off-eq">= d20 {sign(bonus)}{comps.length > 0 && <> +{comps.length}d{COMPONENT_ROLL_DIE}</>}{advMode && <em> · {advMode === "adv" ? "vantaggio" : "svantaggio"}</em>}</span>
              </div>
            </div>
          </div>

          <div className="off-go">
            <button type="button" className="cta off-cta" disabled={busy || !allow.can} onClick={roll}>
              {busy ? "…" : allow.can ? `🎲 Tira e inizia il lavoro · ${fmtMinutes(work.minutes)}` : "Prova non disponibile"}
            </button>
            {!allow.can && <span className="nx-nota off-why">{allow.reason}</span>}
          </div>
        </div>
      )}

      {/* ── SUL BANCO: il lavoro in corso, solo la barra ── */}
      {prof && pendingEntry && !revealed && (
        <div className={`nx-pannello off-box off-work${ready ? " is-ready" : ""}`} style={{ "--q": tierMeta(pendingEntry.targetTier || pendingEntry.tier).color }}>
          <div className="off-work-head">
            <span className="nx-tag">{ready ? "✓ Lavoro finito" : "⚒ Sul banco"}</span>
            <span className="off-work-roll">d20 <b>{pendingEntry.d20}</b> {sign(pendingEntry.bonus)} = <b>{pendingEntry.total}</b> → {tierMeta(pendingEntry.tier).icon} {tierMeta(pendingEntry.tier).label}</span>
          </div>
          <div className="off-bar" role="progressbar" aria-valuenow={workPct} aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: `${workPct}%` }} />
            <i className="off-bar-anvil" style={{ left: `${workPct}%` }} aria-hidden="true">{ready ? "✨" : "🔨"}</i>
          </div>
          <div className="off-work-times">
            <span><small>Iniziato</small>{whenLabel(pendingEntry.at, now)}</span>
            <span className="off-work-left"><small>{ready ? "Pronto" : "Manca"}</small>{ready ? "ora" : fmtCountdown(readyAt - nowMs)}</span>
            <span><small>Pronto</small>{whenLabel(readyAt, now)}</span>
          </div>
          <p className="nx-nota off-work-note">
            {ready ? "L'oggetto è finito: ritiralo per vedere cos'è uscito e mandarlo al Master." : <>Il lavoro dura <strong>{pendingEntry.work ? craftTimeLabel(pendingEntry.work) : fmtMinutes(pendingEntry.minutes || 0)}</strong>: finché non è finito l'oggetto resta sul banco. Puoi chiudere la pagina e tornare.</>}
          </p>
          <div className="off-go">
            <button type="button" className="cta off-cta" disabled={busy || !ready} onClick={claim}>{busy ? "…" : ready ? "📦 Ritira l'oggetto" : `⏳ Pronto tra ${fmtCountdown(readyAt - nowMs)}`}</button>
          </div>
        </div>
      )}

      {/* ── RISULTATO → FORM FOUNDRY ── */}
      {prof && activeEntry && preview && (
        <div className="nx-pannello off-box off-esito" style={{ "--q": tierMeta(activeEntry.tier).color }}>
          <div className="off-esito-head">
            <span className="nx-tag">{tierMeta(activeEntry.tier).icon} {tierMeta(activeEntry.tier).label}</span>
            <div className="off-esito-roll">d20 <b>{activeEntry.d20}</b>{activeEntry.adv ? <small> ({activeEntry.adv === "adv" ? "vant." : "svant."} {activeEntry.d20b})</small> : null} {sign(activeEntry.bonus)} = <b>{activeEntry.total}</b> · d12 <b>{activeEntry.d12}</b> · +{activeEntry.xp} PE{activeEntry.minutes ? <> · ⏱ {fmtMinutes(activeEntry.minutes)}</> : null}</div>
          </div>
          <h3 className="nx-titolo off-esito-name">{previewName}</h3>
          <p className="nx-prosa off-esito-desc">{activeEntry.desc}</p>
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
            <span className="off-label">Potenziatore <small>(facoltativo · solo se lo possiedi davvero)</small></span>
            <div className="off-choices">
              <button type="button" className={`nx-pillola${!enhKey ? " on" : ""}`} onClick={() => setEnhKey("")}>Nessuno</button>
              {enhancersFor.map((e) => (
                <button key={e.key} type="button" className={`nx-pillola off-enh${enhKey === e.key ? " on" : ""}${e.ev.ok ? " is-ok" : " is-no"}`} disabled={!e.ev.ok} onClick={() => setEnhKey(e.key)} title={e.ev.ok ? `${e.desc} · ${e.ev.label}` : e.ev.label}>
                  {e.icon} {e.name} <em>{e.ev.ok ? "✓" : "🔒"}</em>
                </button>
              ))}
            </div>
            {enhSel ? (
              <p className="off-own"><strong>{enhSel.icon} {enhSel.name}</strong> — {enhSel.desc} <span className="off-proof">✓ {enhSel.ev.label}{enhSel.ev.source === "scorta" ? " · se ne consuma 1" : ""}</span></p>
            ) : (
              <p className="nx-nota off-enh-help">Si sblocca (✓) solo ciò che risulta tuo: assegnato dal Master, sulla scheda sincronizzata da Foundry o comprato al Mercato Nero. Il resto è 🔒.</p>
            )}
          </div>

          <div className="off-field">
            <span className="off-label">Nota per il Master <small>(facoltativa)</small></span>
            <input className="off-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. l'ho forgiata nella fucina di Helmvil durante la sosta" maxLength={200} />
          </div>

          {/* Anteprima del form "Crea Oggetto → Foundry" */}
          <div className="off-form">
            <span className="off-label">Scheda per Foundry <small>(come nel form del Master)</small></span>
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
          </div>

          <div className="off-go">
            <button type="button" className="cta off-cta" disabled={busy} onClick={() => sendToFoundry(activeEntry)}>{busy ? "Invio…" : "📦 Manda al Master per Foundry"}</button>
            <button type="button" className="off-ghost" disabled={busy} onClick={() => skipEntry(activeEntry)}>Non inviare</button>
          </div>
        </div>
      )}

      {msg && <div className={`off-msg${msg.startsWith("Errore") ? " is-err" : ""}`}>{msg}</div>}

      {/* ── LA TUA SCORTA DI COMPONENTI ── */}
      {prof && (
        <details className="nx-pannello off-box off-stock-box">
          <summary>🧪 I tuoi componenti <small>({ownedComps.filter((c) => Number.isFinite(c.n) && c.n > 0).reduce((a, c) => a + c.n, 0)} pezzi · dalla scheda Foundry, dal Master o dal Mercato)</small></summary>
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
        </details>
      )}

      {/* ── REGISTRO ── */}
      {prof && log.length > 0 && (
        <details className="nx-pannello off-box off-log">
          <summary>📜 Le tue creazioni <small>({log.length})</small></summary>
          <ul className="off-log-list">
            {log.map((e) => {
              const tm = tierMeta(e.tier);
              const onBench = !e.inboxId && !e.skipped;
              return (
                <li key={e.id} style={{ "--q": tm.color }}>
                  <span className="off-log-ic" aria-hidden="true">{tm.icon}</span>
                  <span className="off-log-main"><b>{onBench && (Number(e.readyAt) || 0) > nowMs ? "Sul banco…" : (e.choice || e.name)}</b><small>{new Date(e.at).toLocaleDateString("it-IT")} · d20 {e.d20}{sign(e.bonus)}={e.total} · d12 {e.d12} · +{e.xp} PE{e.minutes ? ` · ⏱ ${fmtMinutes(e.minutes)}` : ""}</small></span>
                  <span className={`off-log-st${e.inboxId ? " ok" : e.failed ? " bad" : e.skipped ? " no" : ""}`}>{e.inboxId ? "📦 in coda" : e.failed ? "💥 fallito" : e.skipped ? "non inviato" : (Number(e.readyAt) || 0) > nowMs ? "in lavorazione" : "da ritirare"}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* ── SCALA DELL'ESPERIENZA ── */}
      <details className="nx-pannello off-box off-xp-table">
        <summary>📈 Esperienza delle professioni <small>(PE per pregiatura: {TIER_ORDER.map((t) => `${tierMeta(t).label} ${XP_PER_TIER[t]}`).join(" · ")}; 20 naturale = doppi)</small></summary>
        <ol className="off-levels">
          {XP_LEVELS.map((l) => (
            <li key={l.lv} className={prof && prog.level.lv === l.lv ? "is-cur" : prof && prog.level.lv > l.lv ? "is-done" : ""}>
              <span className="orb" aria-hidden="true">{l.lv}</span>
              <span className="off-level-main"><b>{l.xp} PE · grado {l.grado} {GRADE_BONUS[l.grado] ? `(${sign(GRADE_BONUS[l.grado])} al tiro)` : ""}</b><small>{l.sblocca}</small></span>
            </li>
          ))}
        </ol>
      </details>

      {isMaster && <MasterPanel />}
    </div>
  );
}

function targetCostFor(tier) {
  const c = PREGIATURA_COSTS.find((x) => x.tier === tier);
  return c ? c.costo : "";
}

// ── Pannello del Master: professioni, PE, usi, scorte e lavori di tutti gli eroi attivi ──
function MasterPanel() {
  const [chars, setChars] = useState([]);
  const [busy, setBusy] = useState("");
  const load = () => getDocs(collection(db, "characters")).then((snap) => {
    setChars(snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((c) => c.name && !isHiddenChar(c)).sort((a, b) => a.name.localeCompare(b.name)));
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  async function act(uid, patch) {
    setBusy(uid);
    try { await updateDoc(doc(db, "characters", uid), patch); await load(); }
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
    <details className="nx-pannello off-box off-master" onToggle={(e) => { if (e.currentTarget.open) load(); }}>
      <summary>🎯 Master · artigiani del tavolo <small>({chars.length})</small></summary>
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
      <p className="nx-nota">Gli oggetti creati arrivano in <Link to="/dm-admin/foundry-item">Crea Oggetto → Foundry</Link> con l'etichetta ⚒, il tempo di lavoro e la nota della prova. Rarità Foundry per pregiatura: {TIER_ORDER.map((t) => `${tierMeta(t).label} → ${RARITY_LABEL[TIER_TO_FOUNDRY[t].rarity]}`).join(", ")}.</p>
      <CraftLedger chars={chars} reload={load} patchChar={(uid, fn) => setChars((cs) => cs.map((c) => (c.uid === uid ? { ...c, crafting: fn(c.crafting || {}) } : c)))} />
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
                        <span className="off-ledger-item"><b>{tierMeta(e.tier).icon} {e.choice || e.name}</b><small>{tierMeta(e.tier).label}{e.targetTier && e.targetTier !== e.tier ? ` (mirava ${tierMeta(e.targetTier).label})` : ""} · d20 {e.d20}{sign(e.bonus)}={e.total} · d12 {e.d12} · +{e.xp} PE{e.minutes ? ` · ⏱ ${fmtMinutes(e.minutes)}` : ""}{e.enhancer ? ` · ${ENHANCERS.find((x) => x.key === e.enhancer)?.name || e.enhancer}` : ""}{e.note ? ` · "${e.note}"` : ""}</small></span>
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
