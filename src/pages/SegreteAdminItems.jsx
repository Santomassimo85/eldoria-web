/* Admin delle Segrete, piega «⚔ Oggetti» (2026-11-08): crea gli oggetti del gioco delle Segrete.
   Prima si creavano dalla Forgia del Mercato Nero (destinazione «Le Segrete») con la scheda di
   Foundry, che il gioco non sapeva usare. Ora il form usa le regole delle Segrete: armi (base, +N,
   effetti al colpo: danno extra, bruciatura, veleno, rallenta, stordisce, risucchio, critico, colpo
   doppio), armature e scudi (+CA, resistenze, +TS, spine), oggetti da lotta (cura, rianima,
   purifica, potenzia, da lancio). Chi lo può usare si deduce dalla base (gearUsers). Niente
   immagine: in prima persona si vedono gli sprite (armi in mano, maniche dell'armatura), che si
   generano dalla piega «🎮 Prima persona» partendo da `look`. Doc: segrete_items/{x_…}. */
import { useMemo, useState } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DIFFICULTIES, STORY_CLASSES, dungeonSlug } from "../data/segrete";
import { WEAPONS, WEAPON_CHOICES, ARMORS, ARMOR_CAT_IT, canWear } from "../data/segreteKits";
import { ITEMS, ITEM_KINDS, RARITY, DMG_KEYS, CUSTOM_PREFIX, COIN_ICON, normalizeCustomItem, gearUsers } from "../data/segreteItems";
import { useSegreteItems } from "../utils/segreteItemsLive";

const DMG_LABEL = { slashing: "🗡 Tagliente", piercing: "🏹 Perforante", bludgeoning: "🔨 Contundente", fire: "🔥 Fuoco", cold: "❄ Freddo", lightning: "⚡ Fulmine", thunder: "🔊 Tuono", acid: "🧪 Acido", poison: "☠ Veleno", necrotic: "🌑 Necrotico", radiant: "✨ Radioso", force: "💫 Forza", psychic: "🧠 Psichico" };
const clsName = (k) => STORY_CLASSES.find((c) => c.key === k)?.it || k;
const blank = (kind = "weapon") => ({ kind, name: "", icon: "", rarity: "uncommon", desc: "", look: "", price: 0, daily: 1, dungeons: [], minDiff: "", hidden: false,
  base: kind === "weapon" ? "spada_lunga" : kind === "armor" ? "cuoio" : "", plus: 0, fx: {}, res: [], saveBonus: 0, thorns: null,
  dice: "2d4", flat: 0, pct: 50, buff: "ac", value: 2, turns: 2, dmg: "fire", save: "dex", dc: 13 });

// riga di riepilogo con i numeri veri (anche come descrizione proposta)
export function itemSummary(it) {
  if (!it) return "";
  const out = [];
  if (it.kind === "weapon") {
    const w = WEAPONS[it.base];
    out.push(`${w?.name || it.base} ${w?.dice || ""}${it.plus ? ` +${it.plus}` : ""}`);
    const f = it.fx || {};
    if (f.extra) out.push(`+${f.extra[0]} ${DMG_LABEL[f.extra[1]] || f.extra[1]}`);
    if (f.burn) out.push(`🔥 ${f.burn.chance}% brucia ${f.burn.dice}×${f.burn.turns}t`);
    if (f.poison) out.push(`☠ ${f.poison.chance}% veleno ${f.poison.dice}×${f.poison.turns}t`);
    if (f.slow) out.push(`🐌 ${f.slow.chance}% rallenta ${f.slow.turns}t`);
    if (f.stun) out.push(`💫 ${f.stun.chance}% stordisce`);
    if (f.drain) out.push(`🩸 ${f.drain}% del danno extra ti cura`);
    if (f.crit) out.push(`critico da ${f.crit}`);
    if (f.multi) out.push(`⚔ ${f.multi.double}% doppio${f.multi.none ? ` · ${f.multi.none}% a vuoto` : ""}`);
  } else if (it.kind === "armor" || it.kind === "shield") {
    if (it.kind === "armor") { const a = ARMORS[it.base]; out.push(`${a?.name || it.base}${a?.base ? ` (CA ${a.base + (it.plus || 0)}${a.dex === 99 ? " + DES" : a.dex ? ` + DES max ${a.dex}` : ""})` : it.plus ? ` +${it.plus} CA` : ""}`); }
    else out.push(`+${2 + (it.plus || 0)} CA`);
    if (it.res?.length) out.push(`resiste a ${it.res.map((r) => DMG_LABEL[r] || r).join(", ")}`);
    if (it.saveBonus) out.push(`+${it.saveBonus} ai TS`);
    if (it.thorns) out.push(`spine ${it.thorns.chance}%: ${it.thorns.dice} ${DMG_LABEL[it.thorns.dmg] || ""}`);
  } else if (it.kind === "heal") out.push(`❤ +${it.dice}${it.flat ? `+${it.flat}` : ""} PF`);
  else if (it.kind === "revive") out.push(`rialza a ${it.pct}% PF`);
  else if (it.kind === "buff") out.push(it.buff === "ac" ? `🛡 +${it.value} CA · ${it.turns} round` : `🎯 vantaggio · ${it.turns} round`);
  else if (it.kind === "throw") out.push(`${it.dice} ${DMG_LABEL[it.dmg] || ""} · colpisce sempre`);
  else if (it.kind === "throw_area") out.push(`${it.dice} ${DMG_LABEL[it.dmg] || ""} a tutti i nemici · TS ${String(it.save).toUpperCase()} CD ${it.dc} per metà`);
  else out.push(ITEM_KINDS[it.kind]?.it || "");
  return out.join(" · ");
}

/* campi del form (fuori dal componente: definiti dentro, a ogni tasto perdevano il cursore) */
const NumF = ({ label, v, on, min = 0, max = 100, w = "xs" }) => (
  <label className={`sga-field sga-field--${w}`}><span>{label}</span>
    <input className="admin-field-input" type="number" min={min} max={max} value={v ?? ""} onChange={(e) => on(e.target.value)} /></label>
);
const DiceF = ({ label, v, on }) => (
  <label className="sga-field sga-field--xs"><span>{label}</span>
    <input className="admin-field-input" value={v || ""} placeholder="1d6" onChange={(e) => on(e.target.value)} /></label>
);
const DmgF = ({ label, v, on }) => (
  <label className="sga-field sga-field--s"><span>{label}</span>
    <select className="admin-field-input" value={v || "fire"} onChange={(e) => on(e.target.value)}>{DMG_KEYS.map((d) => <option key={d} value={d}>{DMG_LABEL[d]}</option>)}</select></label>
);
const FxToggle = ({ on, onToggle, label, children }) => (
  <div className={`sgi-fx${on ? " is-on" : ""}`}>
    <label className="sga-check"><input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} /> {label}</label>
    {on && <div className="sga-row">{children}</div>}
  </div>
);

export default function SegreteAdminItems({ dungeons }) {
  const { docs } = useSegreteItems();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const [idea, setIdea] = useState("");
  const [filter, setFilter] = useState("all");
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const setFx = (k, v) => setForm((f) => { const fx = { ...(f.fx || {}) }; if (v == null) delete fx[k]; else fx[k] = v; return { ...f, fx }; });
  const norm = useMemo(() => (form ? normalizeCustomItem(form) : null), [form]);
  const users = norm ? gearUsers(norm) : [];
  const list = docs.filter((d) => filter === "all" || d.kind === filter || (filter === "gear" && ["weapon", "armor", "shield"].includes(d.kind)) || (filter === "use" && !["weapon", "armor", "shield"].includes(d.kind)))
    .sort((a, b) => String(a.name).localeCompare(b.name));
  const baseItems = Object.entries(ITEMS).filter(([id]) => !id.startsWith(CUSTOM_PREFIX) && !/_[12]$/.test(id));

  const save = async () => {
    const it = normalizeCustomItem(form);
    if (!it || !String(form.name || "").trim()) return alert("Dai un nome all'oggetto (e una base per armi e armature).");
    setBusy("save");
    try {
      const id = form.id || `${CUSTOM_PREFIX}${dungeonSlug(form.name).slice(0, 30)}-${Math.random().toString(36).slice(2, 6)}`;
      await setDoc(doc(db, "segrete_items", id), { ...it, desc: it.desc || itemSummary(it), hidden: !!form.hidden, updatedAt: serverTimestamp(), ...(form.id ? {} : { createdAt: serverTimestamp() }) });
      setForm(null);
    } catch (e) { alert(e.message); } finally { setBusy(""); }
  };
  const remove = async () => {
    if (!window.confirm(`Eliminare «${form.name}»? Chi lo ha nello zaino non lo vedrà più.`)) return;
    await deleteDoc(doc(db, "segrete_items", form.id)).catch((e) => alert(e.message));
    setForm(null);
  };
  // L'IA: oggetto nel formato delle Segrete (api/_segreteItem.js)
  const generate = async () => {
    setBusy("ai");
    try {
      const vocab = {
        weapons: Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, { name: w.name, dice: w.dice, dmg: w.dmg, classes: Object.keys(WEAPON_CHOICES).filter((c) => WEAPON_CHOICES[c].includes(k)).map(clsName) }])),
        armors: Object.fromEntries(Object.entries(ARMORS).map(([k, a]) => [k, { name: a.name, cat: ARMOR_CAT_IT[a.cat] || a.cat, ac: a.base || "—", classes: STORY_CLASSES.filter((c) => canWear(c.key, k)).map((c) => c.it) }])),
      };
      const ds = (form.dungeons || []).map((k) => dungeons.find((d) => d.key === k)).filter(Boolean);
      const r = await fetch("/api/genera-boss", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: "segreteItem", kind: form.kind, base: form.base && form.base !== blank(form.kind).base ? form.base : "", rarity: "", idea: idea.trim(),
          dungeon: ds.length ? { name: ds.map((d) => d.name).join(" / "), desc: ds.map((d) => d.desc).filter(Boolean).join(" ") } : {},
          vocab, evita: [...docs.map((d) => d.name), ...baseItems.map(([, it]) => it.name)] }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.item) throw new Error(j.error || "Generazione fallita.");
      const g = j.item;
      setForm((f) => ({ ...blank(g.kind || f.kind), ...f, ...g, id: f.id, dungeons: f.dungeons, minDiff: f.minDiff, hidden: f.hidden,
        fx: g.fx || {}, res: g.res || [], thorns: g.thorns || null, saveBonus: g.saveBonus || 0, base: g.base || blank(g.kind || f.kind).base }));
    } catch (e) { alert("IA: " + (e.message || e)); } finally { setBusy(""); }
  };

  if (form) {
    const k = form.kind, fx = form.fx || {}, gear = ["weapon", "armor", "shield"].includes(k);
    const tg = (key, def) => ({ on: !!fx[key], onToggle: (v) => setFx(key, v ? def : null) });
    return (
      <div className="sga-card sga-form sga-mform">
        <h2 className="sga-h2">{form.icon || ITEM_KINDS[k]?.icon} {form.id ? form.name || "Oggetto" : "Nuovo oggetto"}</h2>

        <div className="sga-ai">
          <div className="sga-ai-head"><b>✨ Fatti aiutare dall'IA</b><small>Scrive nome, aspetto, numeri ed effetti con le regole delle Segrete. Usa il tipo, la base (se l'hai cambiata) e i dungeon scelti qui sotto.</small></div>
          <input className="admin-field-input" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder='Idea (facoltativa): es. "ascia di un nano ubriaco che a volte manca", "veste di seta nera che resiste al necrotico"' />
          <div className="sga-btns"><button type="button" className="adm-btn adm-btn--gold" disabled={!!busy} onClick={generate}>{busy === "ai" ? "⏳ Scrivo…" : "✨ Crea con l'IA"}</button></div>
        </div>

        <section className="sga-sec">
          <h3 className="sga-sec-h"><span>1</span> Cos'è</h3>
          <div className="sga-chips">
            {Object.entries(ITEM_KINDS).map(([key, v]) => (
              <button key={key} type="button" aria-pressed={k === key} className={k === key ? "is-on" : ""} onClick={() => set({ kind: key, base: blank(key).base })}>{v.icon} {v.it}</button>
            ))}
          </div>
          <div className="sga-row">
            <label className="sga-field sga-field--xs"><span>Icona</span><input className="admin-field-input" value={form.icon || ""} maxLength={8} placeholder={ITEM_KINDS[k]?.icon} onChange={(e) => set({ icon: e.target.value })} /></label>
            <label className="sga-field"><span>Nome</span><input className="admin-field-input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
            <label className="sga-field sga-field--s"><span>Rarità</span>
              <select className="admin-field-input" value={form.rarity} onChange={(e) => set({ rarity: e.target.value })}>{Object.entries(RARITY).map(([r, v]) => <option key={r} value={r}>{v.it}</option>)}</select></label>
          </div>
        </section>

        {k === "weapon" && (
          <section className="sga-sec">
            <h3 className="sga-sec-h"><span>2</span> Arma</h3>
            <div className="sga-row">
              <label className="sga-field sga-field--s"><span>Arma base</span>
                <select className="admin-field-input" value={form.base} onChange={(e) => set({ base: e.target.value })}>
                  {Object.entries(WEAPONS).map(([wk, w]) => <option key={wk} value={wk}>{w.icon} {w.name} · {w.dice}</option>)}
                </select></label>
              <NumF label="Magica +" v={form.plus} min={0} max={3} on={(v) => set({ plus: v })} />
            </div>
            <h4 className="sgi-h4">Effetti al colpo</h4>
            <FxToggle label="Danno in più a ogni colpo" {...tg("extra", ["1d4", "fire"])}>
              <DiceF label="Dadi" v={fx.extra?.[0]} on={(v) => setFx("extra", [v, fx.extra?.[1] || "fire"])} />
              <DmgF label="Tipo" v={fx.extra?.[1]} on={(v) => setFx("extra", [fx.extra?.[0] || "1d4", v])} />
            </FxToggle>
            {fx.extra && <FxToggle label="🩸 Il danno in più ti cura (risucchio)" {...tg("drain", 50)}><NumF label="% del danno" v={fx.drain} min={10} on={(v) => setFx("drain", v)} /></FxToggle>}
            {[["burn", "🔥 Brucia (danno a ogni turno)"], ["poison", "☠ Avvelena (danno a ogni turno)"]].map(([key, label]) => (
              <FxToggle key={key} label={label} {...tg(key, { chance: 20, dice: "1d4", turns: 2 })}>
                <NumF label="Probabilità %" v={fx[key]?.chance} on={(v) => setFx(key, { ...fx[key], chance: v })} />
                <DiceF label="Danno" v={fx[key]?.dice} on={(v) => setFx(key, { ...fx[key], dice: v })} />
                <NumF label="Turni" v={fx[key]?.turns} min={1} max={4} on={(v) => setFx(key, { ...fx[key], turns: v })} />
              </FxToggle>
            ))}
            <FxToggle label="🐌 Rallenta (svantaggio)" {...tg("slow", { chance: 25, turns: 1 })}>
              <NumF label="Probabilità %" v={fx.slow?.chance} on={(v) => setFx("slow", { ...fx.slow, chance: v })} />
              <NumF label="Turni" v={fx.slow?.turns} min={1} max={3} on={(v) => setFx("slow", { ...fx.slow, turns: v })} />
            </FxToggle>
            <FxToggle label="💫 Stordisce (i boss lo evitano metà delle volte)" {...tg("stun", { chance: 10 })}>
              <NumF label="Probabilità %" v={fx.stun?.chance} max={50} on={(v) => setFx("stun", { chance: v })} />
            </FxToggle>
            <FxToggle label="🎯 Critico più facile" {...tg("crit", 19)}>
              <label className="sga-field sga-field--s"><span>Critico da</span>
                <select className="admin-field-input" value={fx.crit} onChange={(e) => setFx("crit", Number(e.target.value))}>{[19, 18, 17].map((c) => <option key={c} value={c}>{c}–20</option>)}</select></label>
            </FxToggle>
            <FxToggle label="⚔ Colpo doppio (e a volte a vuoto)" {...tg("multi", { double: 20, none: 5 })}>
              <NumF label="% doppio" v={fx.multi?.double} max={50} on={(v) => setFx("multi", { ...fx.multi, double: v })} />
              <NumF label="% a vuoto" v={fx.multi?.none} max={30} on={(v) => setFx("multi", { ...fx.multi, none: v })} />
            </FxToggle>
          </section>
        )}

        {(k === "armor" || k === "shield") && (
          <section className="sga-sec">
            <h3 className="sga-sec-h"><span>2</span> {k === "armor" ? "Armatura" : "Scudo"}</h3>
            <div className="sga-row">
              {k === "armor" && (
                <label className="sga-field"><span>Armatura base (decide chi la porta)</span>
                  <select className="admin-field-input" value={form.base} onChange={(e) => set({ base: e.target.value })}>
                    {Object.entries(ARMORS).map(([ak, a]) => <option key={ak} value={ak}>{a.icon} {a.name} · {ARMOR_CAT_IT[a.cat]}{a.base ? ` · CA ${a.base}` : ""}</option>)}
                  </select></label>
              )}
              <NumF label="+ CA" v={form.plus} min={0} max={3} on={(v) => set({ plus: v })} />
              <NumF label="+ ai TS" v={form.saveBonus} min={0} max={3} on={(v) => set({ saveBonus: v })} />
            </div>
            <span className="sga-field-l">Resistenze ai danni</span>
            <div className="sga-chips">
              {DMG_KEYS.map((d) => { const on = (form.res || []).includes(d); return <button key={d} type="button" aria-pressed={on} className={on ? "is-on" : ""} onClick={() => set({ res: on ? form.res.filter((x) => x !== d) : [...(form.res || []), d] })}>{DMG_LABEL[d]}</button>; })}
            </div>
            <div className={`sgi-fx${form.thorns ? " is-on" : ""}`}>
              <label className="sga-check"><input type="checkbox" checked={!!form.thorns} onChange={(e) => set({ thorns: e.target.checked ? { chance: 25, dice: "1d4", dmg: "bludgeoning" } : null })} /> 🌵 Spine: chi ti colpisce in mischia a volte si fa male</label>
              {form.thorns && (
                <div className="sga-row">
                  <NumF label="Probabilità %" v={form.thorns.chance} on={(v) => set({ thorns: { ...form.thorns, chance: v } })} />
                  <DiceF label="Danno" v={form.thorns.dice} on={(v) => set({ thorns: { ...form.thorns, dice: v } })} />
                  <DmgF label="Tipo" v={form.thorns.dmg} on={(v) => set({ thorns: { ...form.thorns, dmg: v } })} />
                </div>
              )}
            </div>
          </section>
        )}

        {!gear && (
          <section className="sga-sec">
            <h3 className="sga-sec-h"><span>2</span> Effetto in lotta</h3>
            <p className="sga-hint">Si usa col turno, come un'azione, e si consuma.</p>
            <div className="sga-row">
              {(k === "heal" || k === "throw" || k === "throw_area") && <DiceF label={k === "heal" ? "PF curati" : "Danno"} v={form.dice} on={(v) => set({ dice: v })} />}
              {k === "heal" && <NumF label="+ PF fissi" v={form.flat} max={50} on={(v) => set({ flat: v })} />}
              {k === "revive" && <NumF label="Rialza a % PF" v={form.pct} min={10} on={(v) => set({ pct: v })} />}
              {(k === "throw" || k === "throw_area") && <DmgF label="Tipo di danno" v={form.dmg} on={(v) => set({ dmg: v })} />}
              {k === "throw_area" && (<>
                <label className="sga-field sga-field--xs"><span>TS</span>
                  <select className="admin-field-input" value={form.save} onChange={(e) => set({ save: e.target.value })}>{["str", "dex", "con", "wis"].map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label>
                <NumF label="CD" v={form.dc} min={8} max={22} on={(v) => set({ dc: v })} />
              </>)}
              {k === "buff" && (<>
                <label className="sga-field sga-field--s"><span>Effetto</span>
                  <select className="admin-field-input" value={form.buff} onChange={(e) => set({ buff: e.target.value })}><option value="ac">🛡 + CA</option><option value="adv">🎯 Vantaggio agli attacchi</option></select></label>
                {form.buff === "ac" && <NumF label="+ CA" v={form.value} min={1} max={5} on={(v) => set({ value: v })} />}
                <NumF label="Round" v={form.turns} min={1} max={5} on={(v) => set({ turns: v })} />
              </>)}
            </div>
            {(k === "cleanse" || k === "cleanse_party" || k === "panacea") && <p className="sga-hint">{k === "cleanse" ? "Toglie bruciatura, veleno, congelamento, paralisi, paura, cecità, rallentamento, confusione (non la pietra)." : k === "cleanse_party" ? "A tutto il gruppo: toglie bruciatura, rallentamento e paralisi." : "Toglie tutti gli stati, anche la pietra."}</p>}
          </section>
        )}

        <section className="sga-sec">
          <h3 className="sga-sec-h"><span>3</span> Chi lo usa e dove si trova</h3>
          {gear && <p className={`sgi-users${users.length ? "" : " is-none"}`}>{users.length ? <>👤 Usabile da: <b>{users.map(clsName).join(", ")}</b></> : "⚠ Nessuna classe lo può usare con questa base"}</p>}
          {!gear && <p className="sgi-users">👤 Usabile da tutte le classi</p>}
          {k === "shield" && <p className="sga-hint">Lo scudo va solo con un'arma a una mano.</p>}
          <div className="sga-row">
            <NumF label={`Prezzo in bottega ${COIN_ICON}`} v={form.price} max={100000} w="s" on={(v) => set({ price: v })} />
            {Number(form.price) > 0 && <NumF label="Massimo al giorno" v={form.daily} min={1} max={10} on={(v) => set({ daily: v })} />}
            <label className="sga-field sga-field--s"><span>Esce da difficoltà</span>
              <select className="admin-field-input" value={form.minDiff || ""} onChange={(e) => set({ minDiff: e.target.value })}>
                <option value="">Tutte</option>{DIFFICULTIES.filter((d) => d.rank > 0).map((d) => <option key={d.key} value={d.key}>{d.icon} {d.name} in su</option>)}
              </select></label>
          </div>
          <p className="sga-hint">{Number(form.price) > 0 ? "Si compra in Bottega e si può anche trovare." : "Prezzo 0 = non si compra: si trova solo addosso ai mostri."} Dungeon: nessuno scelto = in tutti.</p>
          <div className="sga-chips">
            {dungeons.filter((d) => !d.hidden).map((d) => { const on = (form.dungeons || []).includes(d.key); return <button key={d.key} type="button" aria-pressed={on} className={on ? "is-on" : ""} onClick={() => set({ dungeons: on ? form.dungeons.filter((x) => x !== d.key) : [...(form.dungeons || []), d.key] })}>{d.icon} {d.name}</button>; })}
          </div>
        </section>

        <section className="sga-sec">
          <h3 className="sga-sec-h"><span>4</span> Testi e aspetto</h3>
          <p className="sgi-sum">{norm ? itemSummary(norm) : "—"}</p>
          <label className="sga-field"><span>Descrizione per i giocatori (vuota = la riga qui sopra)</span>
            <textarea className="admin-field-input" rows={2} value={form.desc} placeholder={norm ? itemSummary(norm) : ""} onChange={(e) => set({ desc: e.target.value })} /></label>
          {(k === "weapon" || k === "armor") && (
            <label className="sga-field"><span>{k === "armor" ? "Aspetto di maniche, avambracci e guanti (in inglese): in prima persona si vedono questi" : "Aspetto dell'arma (in inglese): serve allo sprite in mano"}</span>
              <textarea className="admin-field-input" rows={2} value={form.look || ""} placeholder={k === "armor" ? "es. black silk sleeves embroidered with silver runes, thin black leather gloves" : "es. a longsword with a blade of red volcanic glass and a gold guard"} onChange={(e) => set({ look: e.target.value })} /></label>
          )}
          {(k === "weapon" || k === "armor") && <p className="sga-hint">Gli sprite si generano da «🎮 Prima persona» → «🗡 Armi e mani», dopo aver salvato.{k === "armor" && !form.look ? " Senza aspetto in prima persona si vedono i guanti normali della classe." : ""}</p>}
          <label className="sga-check"><input type="checkbox" checked={!!form.hidden} onChange={(e) => set({ hidden: e.target.checked })} /> Nascosto (non esce e non si vende)</label>
        </section>

        <div className="sga-savebar">
          <button type="button" className="adm-btn adm-btn--gold" disabled={!!busy} onClick={save}>{busy === "save" ? "Salvo…" : "💾 Salva"}</button>
          <button type="button" className="adm-btn" onClick={() => setForm(null)}>Annulla</button>
          {form.id && <button type="button" className="adm-btn" onClick={() => setForm({ ...form, id: undefined, name: `${form.name} (copia)` })}>⧉ Duplica</button>}
          {form.id && <button type="button" className="adm-btn adm-btn--danger" onClick={remove}>🗑 Elimina</button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="sga-hint">Gli oggetti del gioco delle Segrete: armi, armature, scudi e oggetti da lotta, con le regole del gioco. Escono dai mostri (e se hanno un prezzo si comprano in Bottega). Per i premi da portare su Foundry c'è la piega «🎁 Bottino».</p>
      <div className="sga-btns">
        <button type="button" className="adm-btn adm-btn--gold" onClick={() => { setIdea(""); setForm(blank("weapon")); }}>＋ Nuovo oggetto</button>
      </div>
      <div className="sga-chips sga-filter">
        {[["all", "Tutti"], ["weapon", "⚔ Armi"], ["armor", "🛡 Armature"], ["shield", "🛡 Scudi"], ["use", "🧪 Da lotta"]].map(([f, l]) => (
          <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)}>{l}</button>
        ))}
      </div>
      {!list.length && <p className="sga-hint">Nessun oggetto creato qui. Creane uno o fallo inventare all'IA.</p>}
      <div className="sga-grid">
        {list.map((d) => {
          const it = normalizeCustomItem(d), u = it ? gearUsers(it) : [];
          return (
            <button key={d.id} type="button" className={`sga-card sga-mcard sgi-card${d.hidden ? " is-hidden" : ""}`} style={{ "--rar": RARITY[d.rarity]?.color }} onClick={() => { setIdea(""); setForm({ ...blank(d.kind), ...d, fx: d.fx || {}, res: d.res || [], thorns: d.thorns || null }); }}>
              <div className="sga-mcard-img"><span aria-hidden="true">{d.icon || ITEM_KINDS[d.kind]?.icon}</span></div>
              <div className="sga-mcard-main">
                <b>{d.name}{d.hidden ? " · nascosto" : ""}</b>
                <small className="sgi-rar">{RARITY[d.rarity]?.it} · {ITEM_KINDS[d.kind]?.it}{d.price > 0 ? ` · ${COIN_ICON} ${d.price}` : " · solo bottino"}</small>
                <small>{it ? itemSummary(it) : "⚠ dati non validi"}</small>
                {["weapon", "armor", "shield"].includes(d.kind) && <small>👤 {u.length ? u.map(clsName).join(", ") : "nessuna classe"}</small>}
                <small>{(d.dungeons || []).length ? (d.dungeons || []).map((x) => dungeons.find((y) => y.key === x)?.icon || x).join(" ") : "tutti i dungeon"}{d.minDiff ? ` · da ${d.minDiff}` : ""}{(d.kind === "armor" || d.kind === "weapon") && !d.look ? " · ⚠ manca l'aspetto" : ""}</small>
              </div>
            </button>
          );
        })}
      </div>
      <details className="sga-fold">
        <summary>Oggetti di base del gioco ({baseItems.length}) · scritti nel codice, non si modificano da qui</summary>
        <div className="sgi-base">
          {baseItems.map(([id, it]) => <span key={id} title={it.desc}>{it.icon} {it.name}</span>)}
        </div>
      </details>
    </>
  );
}

