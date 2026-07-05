import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  WIZARD_SPELLS, SORCERER_SPELLS, WARLOCK_SPELLS, DRUID_SPELLS,
  CLERIC_SPELLS, BARD_SPELLS, PALADIN_SPELLS, RANGER_SPELLS, ARTIFICER_SPELLS,
} from "../pages/Arena";
import { weekEndLabel } from "../data/arenaWeek";
import { DAMAGE_TYPES, DAMAGE_TYPE_MAP, RESIST_LEVELS } from "../data/arenaDamageTypes";

// ── Catalogo del Master (collection `arena_market_items`) ────────────────────
// Ogni creazione resta salvata per sempre e può essere rimessa in vetrina in
// qualsiasi momento (`active: true` = acquistabile questa settimana). Gli
// acquisti dei giocatori valgono fino a domenica alle 24:00 e funzionano SOLO
// nei tornei — l'iniezione nel combattimento avviene in Arena.jsx.

export const MARKET_CATEGORIES = [
  { key: "item",   label: "Oggetto",      icon: "🎒" },
  { key: "spell",  label: "Spell Scroll", icon: "📜" },
  { key: "weapon", label: "Arma",         icon: "⚔️" },
  { key: "armor",  label: "Armatura",     icon: "🛡️" },
  { key: "pet",    label: "Pet",          icon: "🐾" },
];

// Caratteristiche di lancio selezionabili per uno spell scroll.
const CAST_STATS = [
  { key: "int", label: "Intelligenza (INT)" },
  { key: "wis", label: "Saggezza (SAG)" },
  { key: "cha", label: "Carisma (CAR)" },
  { key: "dex", label: "Destrezza (DES)" },
  { key: "con", label: "Costituzione (COS)" },
  { key: "str", label: "Forza (FOR)" },
];
// Livelli di spell slot che uno scroll può togliere.
const SCROLL_SLOT_LEVELS = [1, 2, 3];

// Le spell acquistabili sono SOLO quelle già esistenti nel motore dell'Arena:
// si salva un riferimento {spellClass, spellName} e il fight le risolve dalle
// stesse liste, così qualunque scelta è funzionante al 100% senza codice nuovo.
const SPELL_SOURCES = {
  wizard:    { label: "Mago",      spells: WIZARD_SPELLS },
  sorcerer:  { label: "Stregone",  spells: SORCERER_SPELLS },
  warlock:   { label: "Warlock",   spells: WARLOCK_SPELLS },
  druid:     { label: "Druido",    spells: DRUID_SPELLS },
  cleric:    { label: "Chierico",  spells: CLERIC_SPELLS },
  bard:      { label: "Bardo",     spells: BARD_SPELLS },
  paladin:   { label: "Paladino",  spells: PALADIN_SPELLS },
  ranger:    { label: "Ranger",    spells: RANGER_SPELLS },
  artificer: { label: "Artefice",  spells: ARTIFICER_SPELLS },
};

const BUFF_TYPES = [
  { key: "hit", label: "+ Tiri per colpire" },
  { key: "dmg", label: "+ Danni" },
  { key: "ac",  label: "+ Classe Armatura" },
  { key: "ts",  label: "+ Tiri Salvezza" },
];

const DICE_RE = /^\d{1,2}d\d{1,3}([+-]\d{1,3})?$/;

const EMPTY_FORM = {
  name: "", icon: "", description: "", price: "", maxPerWeek: "1",
  // oggetto / pet
  effect: "heal", dice: "2d8", uses: "1",
  buffType: "hit", buffAmount: "1", buffTurns: "3",
  // spell scroll
  spellClass: "wizard", spellName: "",
  charges: "1", castStat: "int", castStatMin: "0", slotCost: {}, // slotCost: { livello: quantità }
  // arma — danno multi-componente tipizzato (+ legacy dmgBonus per retro-compat edit)
  hitBonus: "0", dmgBonus: "0", ranged: false,
  weaponComponents: [{ dice: "1d8", type: "tagliente" }],
  // armatura / oggetto — resistenze per tipo: { [tipo]: "resist"|"immune"|"vuln" }
  acBonus: "1",
  resist: {},
  // pet
  autoHit: false, petHitBonus: "3",
};

// Riassunto leggibile dell'effetto (usato nelle card e come descrizione automatica).
export function resistSummary(resist) {
  if (!resist || !Object.keys(resist).length) return "";
  return Object.entries(resist)
    .map(([type, lvl]) => `${DAMAGE_TYPE_MAP[type]?.icon || ""}${DAMAGE_TYPE_MAP[type]?.label || type} ${RESIST_LEVELS[lvl]?.short || ""}`)
    .join(" · ");
}

export function marketItemSummary(it) {
  const p = it.payload || {};
  switch (it.category) {
    case "item":
      if (p.effect === "resist") return `Resistenze passive: ${resistSummary(p.resist)}`;
      if (p.effect === "heal")   return `Cura ${p.dice} · ${p.uses} us${p.uses === 1 ? "o" : "i"} per fight · azione gratuita`;
      if (p.effect === "damage") return `${p.dice} danni al bersaglio · ${p.uses} us${p.uses === 1 ? "o" : "i"} per fight · azione gratuita`;
      return `${BUFF_TYPES.find(b => b.key === p.buffType)?.label || "Bonus"} +${p.buffAmount}${p.buffTurns > 0 ? ` per ${p.buffTurns} turni` : " per tutto il fight"} · ${p.uses} us${p.uses === 1 ? "o" : "i"} per fight`;
    case "spell": {
      const src = SPELL_SOURCES[p.spellClass];
      const sp = src?.spells.find(s => s.name === p.spellName);
      const bits = [`📜 ${p.spellName}`, `${p.charges ?? 1} caric${(p.charges ?? 1) === 1 ? "a" : "he"}`];
      if (p.castStat) bits.push(`usa ${p.castStat.toUpperCase()}${p.castStatMin > 0 ? ` ≥ ${p.castStatMin}` : ""}`);
      const cost = Object.entries(p.slotCost || {}).filter(([, n]) => n > 0).map(([l, n]) => `−${n} slot Lv${l}`).join(" · ");
      if (cost) bits.push(cost);
      return `${bits.join(" · ")}${sp?.info ? ` — ${sp.info}` : ""}`;
    }
    case "weapon": {
      const comps = (Array.isArray(p.components) && p.components.length)
        ? p.components.map(c => `${c.dice} ${DAMAGE_TYPE_MAP[c.type]?.label || c.type}`).join(" + ")
        : `${p.dice} danni${+p.dmgBonus ? `+${p.dmgBonus}` : ""}`;
      return `${comps}${+p.hitBonus ? ` · +${p.hitBonus} colpire` : ""} · ${p.ranged ? "distanza" : "mischia"}`;
    }
    case "armor": {
      const r = resistSummary(p.resist);
      return `+${p.acBonus} Classe Armatura${r ? ` · Resist: ${r}` : ""}`;
    }
    case "pet":
      return `Azione bonus: ${p.effect === "heal" ? `cura ${p.dice}` : `${p.dice} danni${p.autoHit ? " auto-hit" : ""}`} · max ${p.uses} us${p.uses === 1 ? "o" : "i"} per fight`;
    default:
      return "";
  }
}

export default function ArenaMarketCatalog() {
  const [items, setItems] = useState([]);
  const [cat, setCat] = useState("item");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "arena_market_items"), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || ""));
      setItems(list);
    });
    return () => unsub();
  }, []);

  const showMsg = (text, type = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const set = (field) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
  };

  // Componenti di danno dell'arma (dado + tipo)
  const setComp = (i, field, val) => setForm(prev => ({
    ...prev,
    weaponComponents: prev.weaponComponents.map((c, idx) => idx === i ? { ...c, [field]: val } : c),
  }));
  const addComp = () => setForm(prev => ({
    ...prev,
    weaponComponents: [...prev.weaponComponents, { dice: "1d6", type: "fuoco" }],
  }));
  const removeComp = (i) => setForm(prev => ({
    ...prev,
    weaponComponents: prev.weaponComponents.filter((_, idx) => idx !== i),
  }));

  // Resistenze: clic su un tipo per ciclare — → Resistenza → Immunità → Vulnerabilità → —
  const cycleResist = (type) => setForm(prev => {
    const order = [undefined, "resist", "immune", "vuln"];
    const next = order[(order.indexOf(prev.resist[type]) + 1) % order.length];
    const r = { ...prev.resist };
    if (next) r[type] = next; else delete r[type];
    return { ...prev, resist: r };
  });
  const renderResistEditor = () => (
    <div className="am-cat-resist">
      <span className="am-cat-resist-hint">Resistenze per tipo — clic per ciclare: — → 🛡 Resistenza (½) → 🚫 Immunità (0) → 💥 Vulnerabilità (×2)</span>
      <div className="am-cat-resist-grid">
        {DAMAGE_TYPES.map(t => {
          const lvl = form.resist[t.key];
          const info = lvl ? RESIST_LEVELS[lvl] : null;
          return (
            <button
              type="button" key={t.key}
              className={`am-cat-resist-chip${lvl ? ` am-cat-resist-chip--${lvl}` : ""}`}
              onClick={() => cycleResist(t.key)}
              title={info ? info.label : "Nessuna"}
            >
              <span className="am-cat-resist-icon">{t.icon}</span>
              <span className="am-cat-resist-lab">{t.label}</span>
              <span className="am-cat-resist-lvl">{info ? `${info.icon}${info.short}` : "—"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const activeCount = items.filter(i => i.active).length;
  const spellOptions = useMemo(() => SPELL_SOURCES[form.spellClass]?.spells ?? [], [form.spellClass]);

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); };

  // ── Salvataggio (crea o aggiorna) ─────────────────────────────────────────
  const buildPayload = () => {
    const uses = Math.max(1, parseInt(form.uses, 10) || 1);
    switch (cat) {
      case "item":
        if (form.effect === "resist") {
          // Oggetto di sola resistenza passiva (sempre attiva nel torneo).
          if (!Object.keys(form.resist || {}).length) return null;
          return { effect: "resist", resist: form.resist };
        }
        if (form.effect === "buff") {
          return {
            effect: "buff",
            buffType: form.buffType,
            buffAmount: Math.max(1, parseInt(form.buffAmount, 10) || 1),
            buffTurns: Math.max(0, parseInt(form.buffTurns, 10) || 0), // 0 = tutto il fight
            uses,
          };
        }
        if (!DICE_RE.test(form.dice)) return null;
        return { effect: form.effect, dice: form.dice, uses };
      case "spell": {
        if (!form.spellName) return null;
        const slotCost = {};
        Object.entries(form.slotCost || {}).forEach(([lvl, n]) => {
          const v = parseInt(n, 10) || 0;
          if (v > 0) slotCost[lvl] = v;
        });
        return {
          spellClass: form.spellClass,
          spellName: form.spellName,
          charges: Math.max(1, parseInt(form.charges, 10) || 1),
          castStat: form.castStat || "int",
          castStatMin: Math.max(0, parseInt(form.castStatMin, 10) || 0),
          ...(Object.keys(slotCost).length ? { slotCost } : {}),
        };
      }
      case "weapon": {
        // Danno multi-componente tipizzato: ogni componente = { dice, type }.
        const comps = (form.weaponComponents || [])
          .filter(c => c && DICE_RE.test((c.dice || "").trim()))
          .map(c => ({ dice: c.dice.trim(), type: c.type || "tagliente" }));
        if (!comps.length) return null;
        return {
          components: comps,
          hitBonus: parseInt(form.hitBonus, 10) || 0,
          ranged: !!form.ranged,
        };
      }
      case "armor":
        return {
          acBonus: Math.max(1, parseInt(form.acBonus, 10) || 1),
          ...(Object.keys(form.resist || {}).length ? { resist: form.resist } : {}),
        };
      case "pet":
        if (!DICE_RE.test(form.dice)) return null;
        return {
          effect: form.effect === "heal" ? "heal" : "damage",
          dice: form.dice,
          autoHit: !!form.autoHit,
          hitBonus: parseInt(form.petHitBonus, 10) || 0,
          uses, // max azioni bonus per fight, deciso dal Master
        };
      default:
        return null;
    }
  };

  const saveItem = async () => {
    const name = form.name.trim();
    const price = parseInt(form.price, 10);
    if (!name) { showMsg("Serve un nome.", "err"); return; }
    if (isNaN(price) || price < 0) { showMsg("Prezzo non valido.", "err"); return; }
    const payload = buildPayload();
    if (!payload) { showMsg("Controlla i campi dell'effetto (dadi nel formato 2d8, spell scelta…).", "err"); return; }

    const docData = {
      name,
      icon: form.icon.trim() || MARKET_CATEGORIES.find(c => c.key === cat)?.icon || "🎁",
      description: form.description.trim(), // se vuota, in vetrina si mostra il riassunto automatico
      category: cat,
      price,
      maxPerWeek: Math.max(1, parseInt(form.maxPerWeek, 10) || 1),
      payload,
      updatedAt: new Date().toISOString(),
    };

    if (editingId) {
      await updateDoc(doc(db, "arena_market_items", editingId), docData);
      showMsg(`Aggiornato: ${name}`);
    } else {
      await addDoc(collection(db, "arena_market_items"), {
        ...docData,
        active: false, // si mette in vetrina esplicitamente dalla lista
        createdAt: new Date().toISOString(),
      });
      showMsg(`Creato: ${name} — ora puoi metterlo in vetrina.`);
    }
    resetForm();
  };

  const editItem = (it) => {
    setCat(it.category);
    setEditingId(it.id);
    setFormOpen(true);
    const p = it.payload || {};
    setForm({
      ...EMPTY_FORM,
      name: it.name || "",
      icon: it.icon || "",
      description: it.description || "",
      price: String(it.price ?? ""),
      maxPerWeek: String(it.maxPerWeek ?? 1),
      effect: p.effect || (it.category === "pet" ? "damage" : "heal"),
      dice: p.dice || EMPTY_FORM.dice,
      uses: String(p.uses ?? 1),
      buffType: p.buffType || "hit",
      buffAmount: String(p.buffAmount ?? 1),
      buffTurns: String(p.buffTurns ?? 3),
      spellClass: p.spellClass || "wizard",
      spellName: p.spellName || "",
      charges: String(p.charges ?? 1),
      castStat: p.castStat || "int",
      castStatMin: String(p.castStatMin ?? 0),
      slotCost: Object.fromEntries(Object.entries(p.slotCost || {}).map(([l, n]) => [l, String(n)])),
      hitBonus: String(p.hitBonus ?? 0),
      dmgBonus: String(p.dmgBonus ?? 0),
      ranged: !!p.ranged,
      weaponComponents: (Array.isArray(p.components) && p.components.length)
        ? p.components.map(c => ({ dice: c.dice, type: c.type || "tagliente" }))
        : [{ dice: p.dice || "1d8", type: p.ranged ? "perforante" : "tagliente" }],
      acBonus: String(p.acBonus ?? 1),
      resist: p.resist || {},
      autoHit: !!p.autoHit,
      petHitBonus: String(p.hitBonus ?? 3),
    });
  };

  const toggleActive = async (it) => {
    await updateDoc(doc(db, "arena_market_items", it.id), { active: !it.active });
  };

  const deleteItem = async (it) => {
    if (!window.confirm(`Eliminare "${it.name}" dal catalogo? (Sparisce anche dalla vetrina)`)) return;
    await deleteDoc(doc(db, "arena_market_items", it.id));
    if (editingId === it.id) resetForm();
  };

  return (
    <div className="am-master-panel am-catalog">
      <h3 className="am-master-panel-title">🛠️ Catalogo Settimanale (Master)</h3>
      <p className="am-master-note">
        Crea oggetti, spell, armi, armature e pet: restano <strong>salvati per sempre</strong> nel catalogo
        e li metti <strong>in vetrina</strong> quando vuoi. Gli acquisti dei giocatori valgono fino a
        <strong> {weekEndLabel()}</strong> e funzionano <strong>solo nei tornei</strong>.
        In vetrina ora: <strong>{activeCount}</strong>.
      </p>

      {msg && (
        <div className={`am-message ${msg.type === "err" ? "am-message--err" : ""}`}>{msg.text}</div>
      )}

      {/* ── FORM CREA/MODIFICA ── */}
      <button className="am-coin-save am-cat-form-toggle" onClick={() => { setFormOpen(o => !o); if (formOpen) resetForm(); }}>
        {formOpen ? "▲ Chiudi il banco di lavoro" : "▼ Apri il banco di lavoro (crea nuovo)"}
      </button>

      {formOpen && (
        <div className="am-cat-form">
          <div className="am-mp-tabs" role="tablist">
            {MARKET_CATEGORIES.map(c => (
              <button
                key={c.key}
                role="tab"
                className={`am-mp-tab ${cat === c.key ? "am-mp-tab--active" : ""}`}
                disabled={!!editingId && cat !== c.key}
                onClick={() => setCat(c.key)}
              >{c.icon} {c.label}</button>
            ))}
          </div>

          {editingId && <p className="am-master-note">✏️ Stai modificando una scheda esistente.</p>}

          {/* Campi comuni */}
          <div className="am-cat-grid">
            <label className="am-cat-field">
              <span>Nome</span>
              <input className="am-coin-input" type="text" placeholder="es. Spada delle Braci" value={form.name} onChange={set("name")} />
            </label>
            <label className="am-cat-field am-cat-field--sm">
              <span>Icona (emoji)</span>
              <input className="am-coin-input" type="text" placeholder="es. 🗡️" value={form.icon} onChange={set("icon")} />
            </label>
            <label className="am-cat-field am-cat-field--sm">
              <span>Prezzo (MA)</span>
              <input className="am-coin-input" type="number" min={0} value={form.price} onChange={set("price")} />
            </label>
            <label className="am-cat-field am-cat-field--sm">
              <span>Max acquisti/settimana</span>
              <input className="am-coin-input" type="number" min={1} value={form.maxPerWeek} onChange={set("maxPerWeek")} />
            </label>
          </div>

          {/* Campi per categoria */}
          {cat === "item" && (
            <div className="am-cat-grid">
              <label className="am-cat-field am-cat-field--sm">
                <span>Effetto</span>
                <select className="am-coin-input" value={form.effect} onChange={set("effect")}>
                  <option value="heal">Cura</option>
                  <option value="damage">Danno</option>
                  <option value="buff">Bonus</option>
                  <option value="resist">Resistenza</option>
                </select>
              </label>
              {form.effect !== "buff" && form.effect !== "resist" && (
                <label className="am-cat-field am-cat-field--sm">
                  <span>Dadi (es. 2d8, 3d6+2)</span>
                  <input className="am-coin-input" type="text" value={form.dice} onChange={set("dice")} />
                </label>
              )}
              {form.effect === "resist" && (
                <div className="am-cat-field am-cat-field--full">
                  {renderResistEditor()}
                  <p className="am-master-note am-cat-note">
                    Resistenza <strong>passiva</strong>: sempre attiva nei fight di torneo finché possiedi l'oggetto della settimana.
                  </p>
                </div>
              )}
              {form.effect === "buff" && (<>
                <label className="am-cat-field am-cat-field--sm">
                  <span>Tipo bonus</span>
                  <select className="am-coin-input" value={form.buffType} onChange={set("buffType")}>
                    {BUFF_TYPES.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                </label>
                <label className="am-cat-field am-cat-field--sm">
                  <span>Entità (+N)</span>
                  <input className="am-coin-input" type="number" min={1} value={form.buffAmount} onChange={set("buffAmount")} />
                </label>
                <label className="am-cat-field am-cat-field--sm">
                  <span>Turni (0 = tutto il fight)</span>
                  <input className="am-coin-input" type="number" min={0} value={form.buffTurns} onChange={set("buffTurns")} />
                </label>
              </>)}
              {form.effect !== "resist" && (
                <label className="am-cat-field am-cat-field--sm">
                  <span>Usi per fight</span>
                  <input className="am-coin-input" type="number" min={1} value={form.uses} onChange={set("uses")} />
                </label>
              )}
            </div>
          )}

          {cat === "spell" && (
            <div className="am-cat-grid">
              <label className="am-cat-field am-cat-field--sm">
                <span>Lista di classe</span>
                <select className="am-coin-input" value={form.spellClass} onChange={e => setForm(prev => ({ ...prev, spellClass: e.target.value, spellName: "" }))}>
                  {Object.entries(SPELL_SOURCES).map(([key, src]) => (
                    <option key={key} value={key}>{src.label}</option>
                  ))}
                </select>
              </label>
              <label className="am-cat-field">
                <span>Spell (già funzionante nel motore)</span>
                <select className="am-coin-input" value={form.spellName} onChange={set("spellName")}>
                  <option value="">— scegli una spell —</option>
                  {spellOptions.map(sp => (
                    <option key={sp.name} value={sp.name}>{sp.icon} {sp.name} — {sp.info}</option>
                  ))}
                </select>
              </label>
              <label className="am-cat-field am-cat-field--sm">
                <span>Cariche (usi per fight)</span>
                <input className="am-coin-input" type="number" min={1} value={form.charges} onChange={set("charges")} />
              </label>
              <label className="am-cat-field am-cat-field--sm">
                <span>Caratteristica per usarlo</span>
                <select className="am-coin-input" value={form.castStat} onChange={set("castStat")}>
                  {CAST_STATS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <label className="am-cat-field am-cat-field--sm">
                <span>Punteggio minimo richiesto (0 = nessun requisito)</span>
                <input className="am-coin-input" type="number" min={0} value={form.castStatMin} onChange={set("castStatMin")} />
              </label>
              <div className="am-cat-field am-cat-field--full">
                <span>Spell slot di classe persi equipaggiando lo scroll (0 = nessuno)</span>
                <div className="am-cat-slotcost">
                  {SCROLL_SLOT_LEVELS.map(lvl => (
                    <label key={lvl} className="am-cat-slotcost-item">
                      <span>Livello {lvl}</span>
                      <input
                        className="am-coin-input"
                        type="number" min={0} max={4}
                        value={form.slotCost[lvl] ?? "0"}
                        onChange={e => setForm(prev => ({ ...prev, slotCost: { ...prev.slotCost, [lvl]: e.target.value } }))}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <p className="am-master-note am-cat-note">
                <strong>Spell scroll</strong>: si aggiunge alle azioni del compratore per i fight del torneo con le
                <strong> cariche</strong> indicate e usa la <strong>caratteristica</strong> scelta per il tiro. È lanciabile
                anche se di livello alto. Se imposti degli <strong>spell slot persi</strong>, chi lo <strong>equipaggia</strong>
                rinuncia a quegli slot di classe di quei livelli (es. −1 Lv2 e −1 Lv3).
              </p>
            </div>
          )}

          {cat === "weapon" && (
            <div className="am-cat-grid">
              <div className="am-cat-field am-cat-field--full">
                <span>Componenti di danno (dado + tipo) — es. 2d6 Tagliente + 1d8 Fuoco</span>
                <div className="am-cat-dmg-list">
                  {(form.weaponComponents || []).map((c, i) => (
                    <div className="am-cat-dmg-row" key={i}>
                      <input
                        className="am-coin-input am-cat-dmg-dice" type="text" placeholder="2d6"
                        value={c.dice} onChange={e => setComp(i, "dice", e.target.value)}
                      />
                      <select className="am-coin-input am-cat-dmg-type" value={c.type} onChange={e => setComp(i, "type", e.target.value)}>
                        {DAMAGE_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                      </select>
                      {form.weaponComponents.length > 1 && (
                        <button type="button" className="am-cat-dmg-del" onClick={() => removeComp(i)} title="Rimuovi componente">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="am-cat-dmg-add" onClick={addComp}>+ Aggiungi componente di danno</button>
              </div>
              <label className="am-cat-field am-cat-field--sm">
                <span>Bonus colpire (+N)</span>
                <input className="am-coin-input" type="number" value={form.hitBonus} onChange={set("hitBonus")} />
              </label>
              <label className="am-cat-field am-cat-check">
                <input type="checkbox" checked={form.ranged} onChange={set("ranged")} />
                <span>Arma a distanza</span>
              </label>
            </div>
          )}

          {cat === "armor" && (
            <div className="am-cat-grid">
              <label className="am-cat-field am-cat-field--sm">
                <span>Bonus CA (+N)</span>
                <input className="am-coin-input" type="number" min={1} value={form.acBonus} onChange={set("acBonus")} />
              </label>
              <div className="am-cat-field am-cat-field--full">
                {renderResistEditor()}
              </div>
            </div>
          )}

          {cat === "pet" && (
            <div className="am-cat-grid">
              <label className="am-cat-field am-cat-field--sm">
                <span>Effetto dell'azione bonus</span>
                <select className="am-coin-input" value={form.effect} onChange={set("effect")}>
                  <option value="damage">Danno</option>
                  <option value="heal">Cura</option>
                </select>
              </label>
              <label className="am-cat-field am-cat-field--sm">
                <span>Dadi (es. 2d6)</span>
                <input className="am-coin-input" type="text" value={form.dice} onChange={set("dice")} />
              </label>
              {form.effect === "damage" && (<>
                <label className="am-cat-field am-cat-check">
                  <input type="checkbox" checked={form.autoHit} onChange={set("autoHit")} />
                  <span>Colpisce sempre (auto-hit)</span>
                </label>
                {!form.autoHit && (
                  <label className="am-cat-field am-cat-field--sm">
                    <span>Bonus colpire (+N)</span>
                    <input className="am-coin-input" type="number" value={form.petHitBonus} onChange={set("petHitBonus")} />
                  </label>
                )}
              </>)}
              <label className="am-cat-field am-cat-field--sm">
                <span>Max usi per fight</span>
                <input className="am-coin-input" type="number" min={1} value={form.uses} onChange={set("uses")} />
              </label>
              <p className="am-master-note am-cat-note">
                Il pet agisce come <strong>azione bonus</strong> nel turno del compratore (stesso
                funzionamento dei pet del Ranger), per il numero massimo di usi indicato.
              </p>
            </div>
          )}

          <label className="am-cat-field">
            <span>Descrizione in vetrina (vuota = riassunto automatico)</span>
            <textarea className="am-coin-input am-cat-textarea" rows={2} value={form.description} onChange={set("description")} />
          </label>

          <div className="am-cat-form-actions">
            <button className="am-coin-save" onClick={saveItem}>{editingId ? "💾 Salva modifiche" : "✨ Crea e salva nel catalogo"}</button>
            {editingId && <button className="am-coin-save am-cat-cancel" onClick={resetForm}>Annulla modifica</button>}
          </div>
        </div>
      )}

      {/* ── LISTA CATALOGO ── */}
      {items.length === 0 ? (
        <p className="cine-empty" style={{ marginTop: 10 }}>Il catalogo è vuoto: crea la prima meraviglia dal banco di lavoro.</p>
      ) : (
        <div className="am-cat-list">
          {MARKET_CATEGORIES.map(c => {
            const inCat = items.filter(i => i.category === c.key);
            if (inCat.length === 0) return null;
            return (
              <div key={c.key} className="am-cat-group">
                <div className="am-cat-group-title">{c.icon} {c.label} <span className="am-mp-tab-count">{inCat.length}</span></div>
                {inCat.map(it => (
                  <div key={it.id} className={`am-cat-row ${it.active ? "am-cat-row--active" : ""}`}>
                    <span className="am-cat-row-icon">{it.icon}</span>
                    <div className="am-cat-row-main">
                      <div className="am-cat-row-name">{it.name} <span className="am-cat-row-price">🪙 {it.price} MA</span>{(it.maxPerWeek ?? 1) > 1 && <span className="am-cat-row-price"> · max {it.maxPerWeek}/sett.</span>}</div>
                      <div className="am-cat-row-sum">{it.description || marketItemSummary(it)}</div>
                    </div>
                    <button
                      className={`am-coin-save am-cat-toggle ${it.active ? "am-cat-toggle--on" : ""}`}
                      title={it.active ? "Togli dalla vetrina" : "Metti in vetrina questa settimana"}
                      onClick={() => toggleActive(it)}
                    >{it.active ? "🟢 In vetrina" : "⚪ Fuori"}</button>
                    <button className="am-coin-save" title="Modifica" onClick={() => editItem(it)}>✏️</button>
                    <button className="am-coin-save am-cat-del" title="Elimina dal catalogo" onClick={() => deleteItem(it)}>🗑️</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
