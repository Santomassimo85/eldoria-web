// ── L'Officina: il crafting giocabile dall'app ───────────────────────────────
// I giocatori scelgono la professione, puntano a una pregiatura, tirano il d20
// (+ modificatore, + competenza strumenti, + grado) e il d12 sulla tabella del
// manuale; l'oggetto uscito viene mandato nella coda "Crea Oggetto → Foundry"
// del Master (collection `foundry_inbox`, target = inventario del giocatore)
// con tutti i campi del form (tipo, rarità, danno/CA SRD, proprietà…).
// Limiti: 1 prova al giorno, 3 a settimana, reset domenica ore 22:00.
// Stato sul personaggio: `characters/{uid}.crafting` (vedi craftAllowance).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteField, doc, getDocs, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { showD20Roll } from "../components/DiceRoll";
import { isHiddenChar } from "../data/hiddenPlayers";
import { PREGIATURE, PREGIATURA_COSTS, PROFESSIONI } from "../data/crafting";
import { CRAFT_MAX_PER_DAY, CRAFT_MAX_PER_WEEK, craftAllowance, craftResetLabel } from "../data/craftingWeek";
import { serverClockOffset, serverNow } from "../data/serverClock";
import { GRADE_BONUS, XP_LEVELS, XP_PER_TIER, progression, xpForCraft } from "../data/craftingProgress";
import { ENHANCERS, TIER_TO_FOUNDRY, craftedItemToFoundryPayload, enhancerEvidence, itemChoices } from "../data/craftingFoundry";
import "./CraftingOfficina.css";

const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];
const STAT_KEY = { FOR: "str", DES: "dex", INT: "int", SAG: "wis" };
const TIER_ORDER = ["scarso", "comune", "raro", "magico", "perfetto"];

// Modificatori dichiarabili (dal manuale, tranne "professione non principale").
const MODS = [
  { key: "materiali",  ic: "💎", label: "Materiali di qualità superiore", eff: "Vantaggio",  adv: 1 },
  { key: "tempo2",     ic: "⏳", label: "Tempo doppio",                    eff: "+2",         val: 2 },
  { key: "aiuto",      ic: "🤝", label: "Aiuto di un artigiano",           eff: "+1",         val: 1 },
  { key: "scarsi",     ic: "🪨", label: "Materiali di fortuna",            eff: "Svantaggio", adv: -1 },
  { key: "fretta",     ic: "🏃", label: "Creazione frettolosa",            eff: "−2",         val: -2 },
  { key: "strumenti0", ic: "🚫", label: "Senza strumenti adeguati",        eff: "Svantaggio", adv: -1 },
];

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
  const [target, setTarget] = useState("comune");
  const [tools, setTools] = useState(true);
  const [mods, setMods] = useState({});
  const [result, setResult] = useState(null);   // ultima prova appena fatta (voce del registro)
  const [choice, setChoice] = useState("");
  const [enhKey, setEnhKey] = useState("");
  const [note, setNote] = useState("");
  const [clockOffset, setClockOffset] = useState(0); // server − dispositivo (ms)

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

  // Giorno e settimana si contano con l'ora del SERVER, non del telefono
  // (spostare l'orologio avanti non regala prove). Sonda una volta per chi ha
  // una professione; il tiro la rifà da capo dentro la transazione.
  useEffect(() => {
    if (!uid || !hasProf) return;
    serverClockOffset().then(setClockOffset).catch(() => {});
  }, [uid, hasProf]);
  const now = new Date(Date.now() + clockOffset);
  const prog = useMemo(() => progression(crafting.xp || 0), [crafting.xp]);
  const allowBase = useMemo(() => craftAllowance(crafting, now), [crafting.weekKey, crafting.weekCount, crafting.lastDayKey, clockOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  // Il Master non ha limiti: crea quante volte vuole (i contatori restano solo informativi).
  const allow = isMaster ? { ...allowBase, can: true, reason: "", unlimited: true } : allowBase;
  const log = Array.isArray(crafting.log) ? crafting.log : [];
  const pendingEntry = result || log.find((e) => !e.inboxId && !e.skipped) || null; // prova ancora da spedire

  // Bonus al tiro.
  const abil = prof ? abilityModFor(charData, prof) : 0;
  const toolB = tools ? profBonus(charData) : 0;
  const gradeB = prog.bonus;
  const extra = MODS.reduce((a, m) => a + (mods[m.key] && m.val ? m.val : 0), 0);
  const advSum = MODS.reduce((a, m) => a + (mods[m.key] && m.adv ? m.adv : 0), 0);
  const advMode = advSum > 0 ? "adv" : advSum < 0 ? "dis" : "";
  const bonus = abil + toolB + gradeB + extra;
  const targetCost = PREGIATURA_COSTS.find((c) => c.tier === target);

  const activeEntry = pendingEntry;
  const activeProf = activeEntry ? (PROFESSIONI.find((x) => x.key === activeEntry.profession) || prof) : null;
  const previewName = activeEntry ? (itemChoices(activeEntry.name).length > 1 ? (choice || itemChoices(activeEntry.name)[0]) : activeEntry.name) : "";
  const preview = useMemo(() => {
    if (!activeEntry || !activeProf) return null;
    const enh = ENHANCERS.find((x) => x.key === enhKey) || null;
    return craftedItemToFoundryPayload({
      profession: activeProf, tier: activeEntry.tier, name: activeEntry.name, desc: activeEntry.desc,
      choice: previewName, enhancer: enh, note: note.trim(),
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

  // ── La prova: d20 → pregiatura → d12 → oggetto. Consuma l'uso al momento del tiro. ──
  async function roll() {
    if (!prof || busy) return;
    if (!allow.can) { setMsg(allow.reason); return; }
    setBusy(true); setMsg("");
    try {
      // Ora vera dal server: è lei a decidere il giorno e la settimana della prova.
      const srvNow = await serverNow();
      setClockOffset(srvNow.getTime() - Date.now());
      const a = rnd(20), b = rnd(20);
      const d20 = advMode === "adv" ? Math.max(a, b) : advMode === "dis" ? Math.min(a, b) : a;
      const total = d20 + bonus;
      let tier = tierByTotal(total);
      // Non si supera la pregiatura mirata (i materiali sono quelli); Perfetto solo dal Maestro.
      if (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(target)) tier = target;
      if (tier === "perfetto" && !prog.canPerfetto) tier = "magico";
      if (tier === "scarso" && prog.scarsoAsComune) tier = "comune";
      const d12 = rnd(12);
      const [name, desc] = prof.creazioni[tier][d12 - 1];
      const nat20 = d20 === 20;
      const entry = {
        id: `${srvNow.getTime()}-${d20}${d12}`, at: srvNow.getTime(), dayKey: "", weekKey: "",
        profession: prof.key, targetTier: target, tier, d20, d20b: advMode ? b : 0, adv: advMode,
        bonus, bonusParts: { abil, tools: toolB, grade: gradeB, extra }, total, d12, name, desc,
        xp: xpForCraft(tier, nat20), nat20, inboxId: "", enhancer: "", choice: "", note: "",
      };
      // Transazione: rilegge i contatori e rifiuta se nel frattempo l'uso è stato consumato.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "characters", uid);
        const snap = await tx.get(ref);
        const cur = snap.exists() ? (snap.data().crafting || {}) : {};
        const al = craftAllowance(cur, srvNow);
        if (!isMaster && !al.can) throw new Error(al.reason);
        entry.dayKey = al.dayKey; entry.weekKey = al.weekKey;
        const prevLog = Array.isArray(cur.log) ? cur.log : [];
        tx.update(ref, {
          "crafting.weekKey": al.weekKey,
          "crafting.weekCount": al.weekCount + 1,
          "crafting.lastDayKey": al.dayKey,
          "crafting.lastAt": serverTimestamp(),
          "crafting.xp": (Number(cur.xp) || 0) + entry.xp,
          "crafting.log": [entry, ...prevLog].slice(0, 40),
        });
      });
      await showD20Roll(d20, { label: `Pregiatura · ${prof.name}` });
      setResult(entry); setChoice(itemChoices(name)[0]); setEnhKey(""); setNote("");
      const tm = tierMeta(tier);
      setMsg(`${tm.icon} ${d20}${advMode ? ` (${advMode === "adv" ? "vantaggio" : "svantaggio"}: ${a}/${b})` : ""} ${sign(bonus)} = ${total} → ${tm.label}. d12 = ${d12}: ${name}. +${entry.xp} PE${nat20 ? " (20 naturale, raddoppiati!)" : ""}.`);
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
        enhancer: enh, note: note.trim(),
        crafter: { uid, name: charData?.name || currentUser.email, gradeName: prog.grado.name },
        roll: { d20: entry.d20, bonus: entry.bonus, total: entry.total, d12: entry.d12 },
      });
      const ref = await addDoc(collection(db, "foundry_inbox"), {
        status: "pending", ...payload,
        origin: "crafting", crafterUid: uid, crafterName: charData?.name || "",
        craft: { profession: p.key, tier: entry.tier, targetTier: entry.targetTier, d20: entry.d20, total: entry.total, d12: entry.d12, enhancer: enh?.key || "", enhancerSource: ev?.source || "", enhancerProof: ev?.label || "", note: note.trim(), cost: targetCostFor(entry.targetTier), mods: Object.keys(mods).filter((k) => mods[k]) },
        createdAt: serverTimestamp(), createdBy: currentUser.email,
      });
      const newLog = log.map((e) => (e.id === entry.id ? { ...e, inboxId: ref.id, enhancer: enh?.key || "", choice: payload.name, note: note.trim() } : e));
      if (!newLog.some((e) => e.id === entry.id)) newLog.unshift({ ...entry, inboxId: ref.id, enhancer: enh?.key || "", choice: payload.name, note: note.trim() });
      const patch = { "crafting.log": newLog.slice(0, 40) };
      // La scorta assegnata dal Master si consuma: un cristallo incastonato non torna indietro.
      if (ev?.source === "scorta") patch[`crafting.enhancers.${enh.key}`] = Math.max(0, (ev.stock || 1) - 1);
      await updateDoc(doc(db, "characters", uid), patch);
      setResult(null);
      setMsg(`📦 "${payload.name}" è nella coda del Master: comparirà nel tuo inventario su Foundry alla prossima importazione.`);
    } catch (e) { setMsg("Errore: " + (e.message || e)); }
    finally { setBusy(false); }
  }

  // Scarta la prova senza mandarla (resta nel registro come "non inviata").
  async function skipEntry(entry) {
    if (!entry) return;
    const newLog = log.map((e) => (e.id === entry.id ? { ...e, skipped: true } : e));
    await updateDoc(doc(db, "characters", uid), { "crafting.log": newLog });
    setResult(null);
  }


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

      {/* ── LA PROVA (se non c'è un oggetto da spedire) ── */}
      {prof && !activeEntry && (
        <div className="nx-pannello off-box off-prova">
          <h3 className="off-h"><span className="orb" aria-hidden="true">1</span> A cosa punti</h3>
          <div className="off-tiers">
            {PREGIATURE.filter((p) => p.key !== "scarso").map((p) => {
              const locked = p.key === "perfetto" && !prog.canPerfetto;
              return (
                <button key={p.key} type="button" className={`off-tier${target === p.key ? " on" : ""}`} style={{ "--q": p.color }} disabled={locked} onClick={() => setTarget(p.key)} title={locked ? "Solo dal grado Maestro" : p.desc}>
                  <span aria-hidden="true">{p.icon}</span> {p.label} <small>{p.range}</small>{locked && <em>🔒 Maestro</em>}
                </button>
              );
            })}
          </div>
          {targetCost && <p className="nx-nota off-cost"><strong>Materiali:</strong> {targetCost.costo} · <strong>tempo:</strong> {targetCost.tempo}{prog.level.lv >= 6 ? " (−¼, Ritmo di bottega)" : ""} — si pagano e si contano in gioco; il Master vede tutto nella coda. Un tiro più basso dà un oggetto inferiore, uno più alto non supera la pregiatura mirata.</p>}
          {prog.level.lv >= 4 && (
            <p className="nx-nota off-peek">👁 Occhio esperto · con 1: <em>{prof.creazioni[target][0][0]}</em> · con 12: <em>{prof.creazioni[target][11][0]}</em></p>
          )}

          <h3 className="off-h"><span className="orb" aria-hidden="true">2</span> Il tuo tiro</h3>
          <div className="off-formula">
            <span className="off-die">d20</span>
            <span className="off-piece"><b>{sign(abil)}</b><small>{prof.caratteristica}</small></span>
            <button type="button" className={`off-piece off-toggle${tools ? " on" : ""}`} onClick={() => setTools(!tools)} title="Competenza negli strumenti della professione">
              <b>{sign(toolB)}</b><small>strumenti {tools ? "✓" : "✗"}</small>
            </button>
            <span className="off-piece"><b>{sign(gradeB)}</b><small>{prog.grado.name}</small></span>
            {extra !== 0 && <span className="off-piece"><b>{sign(extra)}</b><small>condizioni</small></span>}
            <span className="off-eq">= d20 {sign(bonus)}{advMode && <em> · {advMode === "adv" ? "vantaggio" : "svantaggio"}</em>}</span>
          </div>
          <details className="off-mods">
            <summary>Condizioni particolari <small>(da concordare col Master: restano scritte nella coda)</small></summary>
            <div className="off-mods-list">
              {MODS.map((m) => (
                <button key={m.key} type="button" className={`off-mod${mods[m.key] ? " on" : ""}${(m.val || 0) < 0 || (m.adv || 0) < 0 ? " is-bad" : ""}`} onClick={() => setMods((cur) => ({ ...cur, [m.key]: !cur[m.key] }))}>
                  <span aria-hidden="true">{m.ic}</span> {m.label} <b>{m.eff}</b>
                </button>
              ))}
            </div>
          </details>

          <div className="off-go">
            <button type="button" className="cta off-cta" disabled={busy || !allow.can} onClick={roll}>
              {busy ? "…" : allow.can ? "🎲 Tira la Pregiatura" : "Prova non disponibile"}
            </button>
            {!allow.can && <span className="nx-nota off-why">{allow.reason}</span>}
          </div>
        </div>
      )}

      {/* ── RISULTATO → FORM FOUNDRY ── */}
      {prof && activeEntry && preview && (
        <div className="nx-pannello off-box off-esito" style={{ "--q": tierMeta(activeEntry.tier).color }}>
          <div className="off-esito-head">
            <span className="nx-tag">{tierMeta(activeEntry.tier).icon} {tierMeta(activeEntry.tier).label}</span>
            <div className="off-esito-roll">d20 <b>{activeEntry.d20}</b>{activeEntry.adv ? <small> ({activeEntry.adv === "adv" ? "vant." : "svant."} {activeEntry.d20b})</small> : null} {sign(activeEntry.bonus)} = <b>{activeEntry.total}</b> · d12 <b>{activeEntry.d12}</b> · +{activeEntry.xp} PE</div>
          </div>
          <h3 className="nx-titolo off-esito-name">{previewName}</h3>
          <p className="nx-prosa off-esito-desc">{activeEntry.desc}</p>

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

      {/* ── REGISTRO ── */}
      {prof && log.length > 0 && (
        <details className="nx-pannello off-box off-log">
          <summary>📜 Le tue creazioni <small>({log.length})</small></summary>
          <ul className="off-log-list">
            {log.map((e) => {
              const tm = tierMeta(e.tier);
              return (
                <li key={e.id} style={{ "--q": tm.color }}>
                  <span className="off-log-ic" aria-hidden="true">{tm.icon}</span>
                  <span className="off-log-main"><b>{e.choice || e.name}</b><small>{new Date(e.at).toLocaleDateString("it-IT")} · d20 {e.d20}{sign(e.bonus)}={e.total} · d12 {e.d12} · +{e.xp} PE</small></span>
                  <span className={`off-log-st${e.inboxId ? " ok" : e.skipped ? " no" : ""}`}>{e.inboxId ? "📦 in coda" : e.skipped ? "non inviato" : "da inviare"}</span>
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
  return c ? `${c.costo} · ${c.tempo}` : "";
}

// ── Pannello del Master: professioni, PE e usi di tutti gli eroi attivi ──────
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

  return (
    <details className="nx-pannello off-box off-master">
      <summary>🎯 Master · artigiani del tavolo <small>({chars.length})</small></summary>
      <ul className="off-master-list">
        {chars.map((c) => {
          const cr = c.crafting || {};
          const p = PROFESSIONI.find((x) => x.key === cr.profession);
          const pr = progression(cr.xp || 0);
          const al = craftAllowance(cr);
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
                <button type="button" className="off-ghost" disabled={busy === c.uid || !c.crafting} onClick={() => { if (window.confirm(`Azzerare del tutto il crafting di ${c.name} (professione, PE, registro)?`)) act(c.uid, { crafting: deleteField() }); }}>Reset totale</button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="nx-nota">Gli oggetti creati arrivano in <Link to="/dm-admin/foundry-item">Crea Oggetto → Foundry</Link> con l'etichetta ⚒ e la nota della prova. Rarità Foundry per pregiatura: {TIER_ORDER.map((t) => `${tierMeta(t).label} → ${RARITY_LABEL[TIER_TO_FOUNDRY[t].rarity]}`).join(", ")}.</p>
    </details>
  );
}
