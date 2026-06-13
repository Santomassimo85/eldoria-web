import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import {
  collection, addDoc, getDocs, query, orderBy,
  onSnapshot, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import "../GeneraNPC.css";
import "./DmTools.css";

/* ============================================================
   Crea Oggetto → Foundry
   Master-only. Scrive un oggetto in `foundry_inbox` (stato "pending").
   Poi la MACRO inversa su Foundry lo legge e lo crea come Item dnd5e
   (nel mondo o nell'inventario di un personaggio scelto).
   Vedi src/foundry-macro-create-items.txt per la macro da incollare.
   ============================================================ */

const MASTER_EMAIL = "santomassimo85@gmail.com";

const FOUNDRY_TYPES = [
  { v: "weapon", label: "Arma" },
  { v: "equipment", label: "Armatura / Equipaggiamento" },
  { v: "consumable", label: "Consumabile (pozione, pergamena)" },
  { v: "loot", label: "Tesoro / Varie" },
  { v: "tool", label: "Strumento" },
];
const RARITIES = [
  { v: "common", label: "Comune" },
  { v: "uncommon", label: "Non comune" },
  { v: "rare", label: "Raro" },
  { v: "veryRare", label: "Molto raro" },
  { v: "legendary", label: "Leggendario" },
  { v: "artifact", label: "Artefatto" },
];
const DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "psychic", "force"];
const ACTION_TYPES = [
  { v: "", label: "Nessuno (passivo)" },
  { v: "mwak", label: "Arma da mischia" },
  { v: "rwak", label: "Arma a distanza" },
  { v: "msak", label: "Incantesimo da mischia" },
  { v: "rsak", label: "Incantesimo a distanza" },
  { v: "save", label: "Solo Tiro Salvezza" },
];
const WEAPON_PROPS = [
  { v: "fin", label: "Finezza" },
  { v: "ver", label: "Versatile" },
  { v: "two", label: "Due mani" },
  { v: "thr", label: "Da lancio" },
  { v: "lgt", label: "Leggera" },
  { v: "hvy", label: "Pesante" },
  { v: "rch", label: "Portata" },
  { v: "amm", label: "Munizioni" },
  { v: "mgc", label: "Magica" },
];
const ARMOR_TYPES = [
  { v: "", label: "—" },
  { v: "light", label: "Leggera" },
  { v: "medium", label: "Media" },
  { v: "heavy", label: "Pesante" },
  { v: "shield", label: "Scudo" },
];
const ABILITIES = ["", "str", "dex", "con", "int", "wis", "cha"];

const EMPTY = {
  name: "", foundryType: "weapon", rarity: "common",
  description: "", img: "", price: "", weight: "", quantity: 1,
  target: "world", targetUid: "", targetName: "",
  actionType: "mwak", damageFormula: "", damageType: "slashing",
  damage2Formula: "", damage2Type: "", versatileFormula: "",
  attackBonus: "", proficient: true, properties: [],
  armorType: "", armorValue: "",
  saveAbility: "", saveDC: "",
};

export default function FoundryItemForm() {
  const { currentUser } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [chars, setChars] = useState([]);
  const [pending, setPending] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const isMaster = currentUser?.email === MASTER_EMAIL;
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const toggleProp = (p) => setF(s => ({
    ...s, properties: s.properties.includes(p) ? s.properties.filter(x => x !== p) : [...s.properties, p],
  }));

  // Lista personaggi per la destinazione "inventario giocatore".
  useEffect(() => {
    if (!isMaster) return;
    getDocs(collection(db, "characters")).then(snap => {
      setChars(snap.docs.map(d => ({ uid: d.id, name: d.data().name || d.id })).filter(c => c.name).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
  }, [isMaster]);

  // Coda in arrivo (live).
  useEffect(() => {
    if (!isMaster) return;
    const unsub = onSnapshot(query(collection(db, "foundry_inbox"), orderBy("createdAt", "desc")), snap => {
      setPending(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isMaster]);

  if (!isMaster) {
    return <div className="npcgen-page"><div className="npcgen-inner"><h1 className="npcgen-title">Riservato al Master</h1></div></div>;
  }

  async function submit() {
    if (!f.name.trim()) { setMsg("Errore: serve almeno il nome."); return; }
    if (f.target === "player" && !f.targetUid) { setMsg("Errore: scegli il personaggio destinatario."); return; }
    setBusy(true); setMsg("Invio in coda…");
    try {
      const payload = {
        status: "pending",
        name: f.name.trim(),
        foundryType: f.foundryType,
        rarity: f.rarity,
        description: f.description || "",
        img: f.img.trim() || "",
        price: Number(f.price) || 0,
        weight: Number(f.weight) || 0,
        quantity: Number(f.quantity) || 1,
        target: f.target,
        targetUid: f.target === "player" ? f.targetUid : "",
        targetName: f.target === "player" ? f.targetName : "",
        // meccanica
        actionType: f.foundryType === "weapon" || f.foundryType === "consumable" ? f.actionType : "",
        damageFormula: f.damageFormula.trim(),
        damageType: f.damageType,
        damage2Formula: f.damage2Formula.trim(),
        damage2Type: f.damage2Type,
        versatileFormula: f.versatileFormula.trim(),
        attackBonus: f.attackBonus === "" ? 0 : Number(f.attackBonus) || 0,
        proficient: !!f.proficient,
        properties: f.foundryType === "weapon" ? f.properties : [],
        armorType: f.foundryType === "equipment" ? f.armorType : "",
        armorValue: f.foundryType === "equipment" ? (Number(f.armorValue) || 0) : 0,
        saveAbility: f.saveAbility,
        saveDC: f.saveDC === "" ? 0 : Number(f.saveDC) || 0,
        createdAt: serverTimestamp(),
        createdBy: currentUser.email,
      };
      await addDoc(collection(db, "foundry_inbox"), payload);
      setMsg(`✅ "${payload.name}" in coda! Lancia la macro su Foundry per crearlo.`);
      setF(s => ({ ...EMPTY, foundryType: s.foundryType, target: s.target, targetUid: s.targetUid, targetName: s.targetName }));
    } catch (e) {
      setMsg("Errore: " + (e.message || e));
    } finally { setBusy(false); }
  }

  async function removePending(id) {
    try { await deleteDoc(doc(db, "foundry_inbox", id)); } catch {}
  }

  const t = f.foundryType;
  return (
    <div className="npcgen-page">
      <div className="npcgen-inner">
        <h1 className="npcgen-title">Crea Oggetto → Foundry</h1>
        <p className="npcgen-sub">Compila l'oggetto, mettilo in coda, poi lancia la macro su Foundry per crearlo (nel mondo o nell'inventario di un giocatore).</p>

        {/* IDENTITÀ */}
        <div className="dmt-field">
          <label className="npcgen-label">Nome</label>
          <input className="npcgen-input" value={f.name} onChange={e => set("name", e.target.value)} placeholder="es. Lama Sonante" />
        </div>
        <div className="dmt-row">
          <div className="dmt-field">
            <label className="npcgen-label">Tipo</label>
            <select className="npcgen-input" value={f.foundryType} onChange={e => set("foundryType", e.target.value)}>
              {FOUNDRY_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Rarità</label>
            <select className="npcgen-input" value={f.rarity} onChange={e => set("rarity", e.target.value)}>
              {RARITIES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="dmt-row">
          <div className="dmt-field">
            <label className="npcgen-label">Prezzo (mo)</label>
            <input className="npcgen-input" type="number" value={f.price} onChange={e => set("price", e.target.value)} />
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Peso (lb)</label>
            <input className="npcgen-input" type="number" value={f.weight} onChange={e => set("weight", e.target.value)} />
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Quantità</label>
            <input className="npcgen-input" type="number" value={f.quantity} onChange={e => set("quantity", e.target.value)} />
          </div>
        </div>
        <div className="dmt-field">
          <label className="npcgen-label">Immagine (URL, facoltativa)</label>
          <input className="npcgen-input" value={f.img} onChange={e => set("img", e.target.value)} placeholder="https://… oppure icons/…" />
        </div>
        <div className="dmt-field">
          <label className="npcgen-label">Descrizione</label>
          <textarea className="npcgen-input" rows={4} value={f.description} onChange={e => set("description", e.target.value)} />
        </div>

        {/* MECCANICA: ARMA */}
        {t === "weapon" && (<>
          <p className="npcgen-k" style={{ marginTop: 14 }}>Meccanica arma</p>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Tipo d'attacco</label>
              <select className="npcgen-input" value={f.actionType} onChange={e => set("actionType", e.target.value)}>
                {ACTION_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">Bonus al colpire (+x oggetto)</label>
              <input className="npcgen-input" type="number" value={f.attackBonus} onChange={e => set("attackBonus", e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Danno (formula)</label>
              <input className="npcgen-input" value={f.damageFormula} onChange={e => set("damageFormula", e.target.value)} placeholder="es. 1d8" />
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">Tipo di danno</label>
              <select className="npcgen-input" value={f.damageType} onChange={e => set("damageType", e.target.value)}>
                {DAMAGE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Danno extra (facoltativo)</label>
              <input className="npcgen-input" value={f.damage2Formula} onChange={e => set("damage2Formula", e.target.value)} placeholder="es. 1d6" />
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">Tipo danno extra</label>
              <select className="npcgen-input" value={f.damage2Type} onChange={e => set("damage2Type", e.target.value)}>
                <option value="">—</option>
                {DAMAGE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Formula versatile (se a due mani fa più danno)</label>
            <input className="npcgen-input" value={f.versatileFormula} onChange={e => set("versatileFormula", e.target.value)} placeholder="es. 1d10" />
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Proprietà</label>
            <div className="dmt-row" style={{ flexWrap: "wrap", gap: 8 }}>
              {WEAPON_PROPS.map(p => (
                <label key={p.v} className={"dmt-tab" + (f.properties.includes(p.v) ? " on" : "")} style={{ flex: "0 0 auto", padding: "6px 12px", cursor: "pointer" }} onClick={() => toggleProp(p.v)}>
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <label className="npcgen-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={f.proficient} onChange={e => set("proficient", e.target.checked)} /> Competente con quest'arma
          </label>
        </>)}

        {/* MECCANICA: ARMATURA */}
        {t === "equipment" && (<>
          <p className="npcgen-k" style={{ marginTop: 14 }}>Armatura</p>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Tipo armatura</label>
              <select className="npcgen-input" value={f.armorType} onChange={e => set("armorType", e.target.value)}>
                {ARMOR_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">Valore CA</label>
              <input className="npcgen-input" type="number" value={f.armorValue} onChange={e => set("armorValue", e.target.value)} placeholder="es. 14" />
            </div>
          </div>
        </>)}

        {/* SAVE (consumabile/arma con TS) */}
        {(t === "consumable" || t === "weapon") && (<>
          <p className="npcgen-k" style={{ marginTop: 14 }}>Tiro Salvezza (facoltativo)</p>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Caratteristica TS</label>
              <select className="npcgen-input" value={f.saveAbility} onChange={e => set("saveAbility", e.target.value)}>
                {ABILITIES.map(a => <option key={a} value={a}>{a ? a.toUpperCase() : "—"}</option>)}
              </select>
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">CD</label>
              <input className="npcgen-input" type="number" value={f.saveDC} onChange={e => set("saveDC", e.target.value)} placeholder="es. 15" />
            </div>
          </div>
        </>)}

        {/* DESTINAZIONE */}
        <p className="npcgen-k" style={{ marginTop: 14 }}>Destinazione su Foundry</p>
        <div className="dmt-row">
          <div className="dmt-field">
            <label className="npcgen-label">Dove crearlo</label>
            <select className="npcgen-input" value={f.target} onChange={e => set("target", e.target.value)}>
              <option value="world">Cartella Oggetti del mondo</option>
              <option value="player">Inventario di un giocatore</option>
            </select>
          </div>
          {f.target === "player" && (
            <div className="dmt-field">
              <label className="npcgen-label">Giocatore</label>
              <select className="npcgen-input" value={f.targetUid}
                onChange={e => { const c = chars.find(x => x.uid === e.target.value); set("targetUid", e.target.value); set("targetName", c?.name || ""); }}>
                <option value="">— scegli —</option>
                {chars.map(c => <option key={c.uid} value={c.uid}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <button className="npcgen-btn" style={{ marginTop: 20 }} onClick={submit} disabled={busy}>
          {busy ? "Invio…" : "📦 Metti in coda per Foundry"}
        </button>
        <div className={`npcgen-status${msg.startsWith("Errore") ? " npcgen-status--error" : ""}`}>{msg}</div>

        {/* CODA */}
        <div className="dmt-result">
          <p className="npcgen-k">In coda ({pending.length})</p>
          {pending.length === 0 && <p className="npcgen-v">Nessun oggetto in coda. Quelli importati su Foundry vengono rimossi dalla macro.</p>}
          {pending.map(p => (
            <div className="dmt-li" key={p.id}>
              <div className="n">
                {p.name}
                <span className="npcgen-chip dmt-pill">{(FOUNDRY_TYPES.find(x => x.v === p.foundryType) || {}).label || p.foundryType}</span>
                <span className="npcgen-chip dmt-pill">{p.status === "imported" ? "✅ importato" : "⏳ in attesa"}</span>
              </div>
              <div className="d">
                {p.target === "player" ? `→ ${p.targetName || "giocatore"}` : "→ mondo"}
                {p.damageFormula ? ` · ${p.damageFormula} ${p.damageType}` : ""}
                <button className="npcgen-btn npcgen-btn--ghost" style={{ marginLeft: 10, padding: "2px 10px", fontSize: 12 }} onClick={() => removePending(p.id)}>Elimina</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
