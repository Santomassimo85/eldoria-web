import React, { useState } from "react";
import { EMPTY_FOUNDRY, resolveFoundryType } from "../utils/foundryMap";
import FoundryItemFields from "../components/FoundryItemFields";

/* ============================================================
   Premi del World Boss (2026-10-21): non più un testo libero ma
   PE · Corone · monete in gioco (mo) · oggetti · bonus.
   Gli oggetti hanno la stessa forma di quelli del Mercato
   (name/type/class/description/img/price + `foundry`), così
   `marketItemToFoundryPayload` li porta su Foundry tali e quali.
   Il campo `rewards` (testo) resta e lo si riscrive col riassunto:
   la pagina del fight e la mappa lo leggono già.
   ============================================================ */

export const REWARD_ITEM_TYPES = ["Arma", "Armatura", "Accessori", "Artefatto Magico", "Pozioni", "Pergamene", "Reagenti", "Varie"];
export const REWARD_RARITIES = ["Comune", "Non comune", "Rara", "Molto rara", "Leggendaria", "Artefatto"];

const TYPE_ICON = {
  "Arma": "⚔", "Armatura": "🛡", "Accessori": "💍", "Artefatto Magico": "🔮",
  "Pozioni": "🧪", "Pergamene": "📜", "Reagenti": "🌿", "Varie": "🎒",
};

export const blankRewardItem = () => ({
  name: "", type: "Arma", class: "Rara", description: "", img: "", price: "",
  foundry: { ...EMPTY_FOUNDRY },
});

export const blankRewards = () => ({ xp: "", corone: "", gp: "", items: [], bonuses: [], note: "" });

// Boss vecchi: `rewards` era solo testo → finisce nelle note.
export const normalizeRewards = (boss) => {
  const r = boss?.rewardsData;
  if (!r) return { ...blankRewards(), note: boss?.rewards || "" };
  return {
    ...blankRewards(),
    ...r,
    items: (r.items || []).map((it) => ({ ...blankRewardItem(), ...it, foundry: { ...EMPTY_FOUNDRY, ...(it.foundry || {}) } })),
    bonuses: Array.isArray(r.bonuses) ? r.bonuses : [],
  };
};

const num = (v) => Math.max(0, parseInt(v, 10) || 0);

// Pulisce prima di salvare: numeri veri, niente oggetti/bonus vuoti.
export const cleanRewards = (r) => ({
  xp: num(r.xp),
  corone: num(r.corone),
  gp: num(r.gp),
  items: (r.items || []).filter((it) => it.name?.trim()).map((it) => ({
    ...it,
    name: it.name.trim(),
    price: num(it.price),
  })),
  bonuses: (r.bonuses || []).map((b) => String(b || "").trim()).filter(Boolean),
  note: String(r.note || "").trim(),
});

// Riassunto in una riga per il campo `rewards` (fight, mappa).
export const rewardsSummary = (r) => {
  const c = cleanRewards(r);
  const parts = [];
  if (c.xp) parts.push(`${c.xp} PE`);
  if (c.corone) parts.push(`${c.corone} Corone`);
  if (c.gp) parts.push(`${c.gp} mo`);
  c.items.forEach((it) => parts.push(`${it.name} (${it.class})`));
  c.bonuses.forEach((b) => parts.push(b));
  if (c.note) parts.push(c.note);
  return parts.join(" · ");
};

/* ── Un oggetto del bottino: riga chiusa, scheda completa aperta ── */
const RewardItemCard = ({ item, open, onToggle, onChange, onRemove, onUploadImg }) => {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fType = resolveFoundryType(item);
  const f = item.foundry || {};
  const stat = fType === "weapon"
    ? [f.damageFormula, f.damageType].filter(Boolean).join(" ")
    : fType === "equipment" && f.armorValue ? `CA ${f.armorValue}` : "";
  const incomplete = fType === "weapon" && !(f.damageFormula || "").trim();

  // Stessa AI della Forgia del Mercato (testo + dati Foundry, senza immagine).
  const genera = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/genera-oggetto-completo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim() || item.name || "un bottino degno di un boss",
          rarita: item.class || undefined,
          tipoOggetto: item.type || undefined,
          mode: "normale",
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "Generazione fallita.");
      const o = d.oggetto || {};
      onChange({
        name: o.name || item.name,
        type: REWARD_ITEM_TYPES.includes(o.type) ? o.type : item.type,
        class: REWARD_RARITIES.includes(o.class) ? o.class : item.class,
        description: o.description || item.description,
        price: o.startingBid != null ? String(o.startingBid) : item.price,
        foundry: { ...EMPTY_FOUNDRY, ...(o.foundry || {}) },
      });
    } catch (e) {
      setErr(`L'AI non ha risposto (funziona solo online): ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`wbr-item${open ? " is-open" : ""}`}>
      <div className="wbr-item-head">
        <button type="button" className="wbr-item-main" onClick={onToggle} aria-expanded={open}>
          {item.img
            ? <img src={item.img} alt="" className="wbr-item-thumb" />
            : <span className="wbr-item-thumb wbr-item-thumb--ico">{TYPE_ICON[item.type] || "🎁"}</span>}
          <span className="wbr-item-txt">
            <strong>{item.name || "Oggetto senza nome"}</strong>
            <small>
              {item.type} · {item.class}{stat ? ` · ${stat}` : ""}
              {incomplete && <em className="wbr-warn"> · manca il danno</em>}
            </small>
          </span>
          <span className="wbr-item-caret" aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
        <button type="button" className="wbr-x" onClick={onRemove} title="Togli dal bottino">✕</button>
      </div>

      {open && (
        <div className="wbr-item-body">
          <div className="wbr-ai">
            <input className="admin-field-input" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="Idea per l'AI (es. ascia del boss, gronda di veleno)" disabled={busy} />
            <button type="button" className="wb-ai-btn" onClick={genera} disabled={busy}>
              {busy ? "✨ Forgio…" : "✨ Compila con l'AI"}
            </button>
          </div>
          {err && <p className="wbr-err">{err}</p>}

          <div className="wbr-grid">
            <label className="fif-f wbr-span2">
              <span>Nome</span>
              <input className="admin-field-input" value={item.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="es. Zanna del Divoratore" />
            </label>
            <label className="fif-f">
              <span>Tipo</span>
              <select className="admin-field-input" value={item.type} onChange={(e) => onChange({ type: e.target.value })}>
                {REWARD_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="fif-f">
              <span>Rarità</span>
              <select className="admin-field-input" value={item.class} onChange={(e) => onChange({ class: e.target.value })}>
                {REWARD_RARITIES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="fif-f">
              <span>Valore (mo)</span>
              <input className="admin-field-input" type="number" min="0" value={item.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="0" />
            </label>
            <label className="fif-f wbr-span3">
              <span>Immagine (URL)</span>
              <span className="wbr-img">
                <input className="admin-field-input" value={item.img} onChange={(e) => onChange({ img: e.target.value })} placeholder="https://…" />
                <label className="wb-btn ghost wbr-upload">
                  ⬆ Carica
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files?.[0]; e.target.value = "";
                    if (!file) return;
                    const url = await onUploadImg(file);
                    if (url) onChange({ img: url });
                  }} />
                </label>
              </span>
            </label>
            <label className="fif-f wbr-span-all">
              <span>Descrizione (la vede il giocatore su Foundry)</span>
              <textarea className="admin-field-textarea" rows="3" value={item.description} onChange={(e) => onChange({ description: e.target.value })} />
            </label>
          </div>

          <div className="wbr-foundry">
            <div className="wbr-sub">⚒ Statistiche Foundry</div>
            <FoundryItemFields item={item} onChange={(foundry) => onChange({ foundry })} />
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Editor completo dei premi ── */
export default function BossRewardsEditor({ value, onChange, onUploadImg }) {
  const r = value || blankRewards();
  const [openIdx, setOpenIdx] = useState(-1);
  const set = (patch) => onChange({ ...r, ...patch });
  const setItem = (i, patch) => set({ items: r.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const setBonus = (i, v) => set({ bonuses: r.bonuses.map((b, k) => (k === i ? v : b)) });

  return (
    <div className="wbr">
      <div className="wbr-currency">
        <label className="wbr-coin">
          <span>⭐ PE</span>
          <input className="admin-field-input" type="number" min="0" value={r.xp} onChange={(e) => set({ xp: e.target.value })} placeholder="0" />
        </label>
        <label className="wbr-coin">
          <span>👑 Corone</span>
          <input className="admin-field-input" type="number" min="0" value={r.corone} onChange={(e) => set({ corone: e.target.value })} placeholder="0" />
        </label>
        <label className="wbr-coin">
          <span>🪙 Monete (mo)</span>
          <input className="admin-field-input" type="number" min="0" value={r.gp} onChange={(e) => set({ gp: e.target.value })} placeholder="0" />
        </label>
      </div>

      <div className="wbr-block">
        <div className="wbr-block-head">
          <span className="wbr-sub">🎁 Oggetti <small>({r.items.length})</small></span>
          <button type="button" className="wb-add-action-btn" onClick={() => {
            set({ items: [...r.items, blankRewardItem()] });
            setOpenIdx(r.items.length);
          }}>+ Oggetto</button>
        </div>
        {r.items.length === 0
          ? <p className="wbr-empty">Nessun oggetto. Si creano come nel Mercato, con le statistiche per Foundry.</p>
          : r.items.map((it, i) => (
            <RewardItemCard key={i} item={it} open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
              onChange={(patch) => setItem(i, patch)}
              onRemove={() => { set({ items: r.items.filter((_, k) => k !== i) }); setOpenIdx(-1); }}
              onUploadImg={onUploadImg} />
          ))}
      </div>

      <div className="wbr-block">
        <div className="wbr-block-head">
          <span className="wbr-sub">✦ Bonus <small>({r.bonuses.length})</small></span>
          <button type="button" className="wb-add-action-btn" onClick={() => set({ bonuses: [...r.bonuses, ""] })}>+ Bonus</button>
        </div>
        {r.bonuses.length === 0
          ? <p className="wbr-empty">Benedizioni, titoli, vantaggi… (es. «Vantaggio ai TS contro paura per una settimana»).</p>
          : r.bonuses.map((b, i) => (
            <div key={i} className="wbr-bonus">
              <input className="admin-field-input" value={b} onChange={(e) => setBonus(i, e.target.value)} placeholder="es. Titolo «Ammazzadraghi» · +1 CA fino alla prossima sessione" />
              <button type="button" className="wbr-x" onClick={() => set({ bonuses: r.bonuses.filter((_, k) => k !== i) })} title="Togli">✕</button>
            </div>
          ))}
      </div>

      <label className="fif-f">
        <span>Note (facoltative)</span>
        <input className="admin-field-input" value={r.note} onChange={(e) => set({ note: e.target.value })} placeholder="Altro da dire ai giocatori sul bottino" />
      </label>
    </div>
  );
}
