// src/pages/ForgiaNemici.jsx
// Forgia dei Nemici (2026-10-29) — /dm-admin/nemici, Master e co-master.
// L'AI (api/genera-boss.js con tipo "nemico" → api/_enemy.js) scrive la scheda
// 5e completa; qui si ritocca, si disegna il ritratto (descrizione facoltativa
// + tono), si salva nel bestiario (`enemies`) e si manda a Foundry: la voce
// `foundry_inbox` kind "actor" / status "pending_actor" porta l'attore già
// costruito da src/data/enemyFoundry.js, e "Fetch admin" lo crea nella cartella
// "Nemici dal sito" prendendo gli incantesimi dal compendio SRD.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db, storage } from "../firebase";
import {
  collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadString, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../AuthContext";
import { isAdminEmail } from "../utils/roles";
import { getImageTone } from "../data/imageTone";
import ImageTonePicker from "../components/ImageTonePicker";
import {
  CREATURE_TYPES, SIZES, ABILITIES, ABILITY_IT, DAMAGE_IT, SKILLS, SRD_ARMOR, SRD_WEAPONS,
  normalizeEnemy, enemyToFoundryActor, abilityMod, fmtMod, profForCr, fmtCr, xpForCr,
  hpOf, acOf, weaponStats, featureDc, typeLabel,
} from "../data/enemyFoundry";
import "./ForgiaNemici.css";

const RUOLI = [
  { key: "", label: "Decide l'AI", icon: "🎲" },
  { key: "sgherro", label: "Sgherro", icon: "🗡" },
  { key: "bruto", label: "Bruto", icon: "🪓" },
  { key: "cecchino", label: "Cecchino", icon: "🏹" },
  { key: "furtivo", label: "Furtivo", icon: "🥷" },
  { key: "incantatore", label: "Incantatore", icon: "🔮" },
  { key: "supporto", label: "Supporto", icon: "✚" },
  { key: "capo", label: "Capo", icon: "👑" },
  { key: "boss", label: "Boss", icon: "💀" },
];
const CRS = [0.125, 0.25, 0.5, ...Array.from({ length: 20 }, (_, i) => i + 1), 21, 22, 24, 26, 30];
const KIND_IT = { passive: "Tratto", action: "Azione", bonus: "Azione bonus", reaction: "Reazione", legendary: "Leggendaria" };
const MODE_IT = { atwill: "a volontà", innate: "/giorno", spell: "" };
const USES_IT = (u) => !u?.per ? "" : u.per === "recharge" ? `ricarica ${u.recharge || 5}–6` : `${u.max || 1}/${u.per === "day" ? "giorno" : u.per === "sr" ? "riposo breve" : "riposo lungo"}`;

const ft = (n) => `${n} ft (${Math.round(n * 0.3 * 10) / 10} m)`;

export default function ForgiaNemici() {
  const { currentUser } = useAuth();
  const ok = isAdminEmail(currentUser?.email);

  const [tipo, setTipo] = useState("");
  const [cr, setCr] = useState("");
  const [ruolo, setRuolo] = useState("");
  const [spunto, setSpunto] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [enemy, setEnemy] = useState(null);
  const [enemyId, setEnemyId] = useState(null);
  const [image, setImage] = useState("");
  const [imgHint, setImgHint] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState([]);
  const [queued, setQueued] = useState(() => new Set());
  const [seen, setSeen] = useState([]);

  useEffect(() => {
    if (!ok) return undefined;
    const u1 = onSnapshot(query(collection(db, "enemies"), orderBy("createdAt", "desc")), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    // "In coda" finché la voce è in foundry_inbox, poi "su Foundry" (l'ha creata Fetch admin).
    const u2 = onSnapshot(collection(db, "foundry_inbox"), (s) => setQueued(new Set(s.docs.map((d) => d.id))), () => {});
    return () => { u1(); u2(); };
  }, [ok]);

  const n = useMemo(() => (enemy ? normalizeEnemy(enemy) : null), [enemy]);

  if (!ok) return <section className="fn-page"><p className="fn-locked">Solo il Master può forgiare nemici.</p></section>;

  const patch = (p) => setEnemy((e) => ({ ...e, ...p }));
  const dropAt = (key, i) => setEnemy((e) => ({ ...e, [key]: e[key].filter((_, j) => j !== i) }));
  const dropSpell = (i) => setEnemy((e) => ({ ...e, spellcasting: { ...e.spellcasting, spells: e.spellcasting.spells.filter((_, j) => j !== i) } }));

  async function forgia() {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/genera-boss", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: "nemico", creatureType: tipo, cr, ruolo, spunto, evita: seen }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error || !data.enemy) throw new Error(data.error || `HTTP ${r.status}`);
      setEnemy(data.enemy); setEnemyId(null); setImage(""); setImgHint("");
      setSeen((s) => [...s, data.enemy.name].slice(-20));
    } catch (e) {
      setErr(e.message || String(e));
    } finally { setBusy(false); }
  }

  async function disegna() {
    if (!n) return;
    setImgBusy(true); setErr("");
    try {
      const prompt = [
        `Fantasy creature portrait for a Dungeons & Dragons bestiary: "${n.name}", a ${SIZES[n.size] ? n.size : "medium"} ${n.creatureType}${n.subtype ? ` (${n.subtype})` : ""}.`,
        `Appearance (Italian): ${imgHint.trim() || n.appearance || n.description || ""}`,
        n.weapons.length ? `Wielding or showing: ${n.weapons.map((w) => w.name).join(", ")}.` : "",
        "Full figure, menacing pose, dramatic lighting, painterly dark fantasy concept art, simple dark background.",
        "No text, no lettering, no frame, no border.",
      ].filter(Boolean).join(" ");
      const r = await fetch("/api/genera-immagine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, aspectRatio: "1:1", tono: getImageTone() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error || !data.immagine) throw new Error(data.error || `HTTP ${r.status}`);
      const ref = storageRef(storage, `npcs/nemico-${Date.now()}-${slug(n.name)}.png`);
      await uploadString(ref, data.immagine, "data_url");
      setImage(await getDownloadURL(ref));
    } catch (e) {
      setErr("Ritratto non riuscito: " + (e.message || e));
    } finally { setImgBusy(false); }
  }

  async function carica(file) {
    if (!file) return;
    setImgBusy(true); setErr("");
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ref = storageRef(storage, `npcs/nemico-${Date.now()}-${slug(n?.name)}.${ext}`);
      await uploadBytes(ref, file);
      setImage(await getDownloadURL(ref));
    } catch (e) {
      setErr("Caricamento non riuscito: " + (e.message || e));
    } finally { setImgBusy(false); }
  }

  async function salva() {
    if (!enemy) return null;
    setSaving(true); setErr("");
    try {
      const data = { enemy, image, imgHint, name: n.name, creatureType: n.creatureType, cr: n.cr, updatedAt: serverTimestamp() };
      let id = enemyId;
      if (id) await setDoc(doc(db, "enemies", id), data, { merge: true });
      else {
        const ref = await addDoc(collection(db, "enemies"), { ...data, createdAt: serverTimestamp(), createdBy: currentUser.email });
        id = ref.id; setEnemyId(id);
      }
      setMsg("💾 Salvato nel bestiario.");
      return id;
    } catch (e) {
      setErr("Salvataggio non riuscito: " + (e.message || e));
      return null;
    } finally { setSaving(false); }
  }

  async function manda(src) {
    const e = src ? src.enemy : enemy;
    const img = src ? src.image : image;
    const id = src ? src.id : await salva();
    if (!e || !id) return;
    setSaving(true); setErr("");
    try {
      const built = enemyToFoundryActor(e, { img });
      const ref = await addDoc(collection(db, "foundry_inbox"), {
        kind: "actor", status: "pending_actor", origin: "forgia", target: "world",
        name: built.actor.name, img: img || "", enemyId: id,
        actorJson: JSON.stringify(built),
        createdAt: serverTimestamp(), createdBy: currentUser.email,
      });
      await setDoc(doc(db, "enemies", id), { inboxId: ref.id, sentAt: serverTimestamp() }, { merge: true });
      setMsg(`📤 «${built.actor.name}» è in coda: lo crea "Fetch admin" su Foundry, nella cartella "Nemici dal sito".`);
    } catch (er) {
      setErr("Invio non riuscito: " + (er.message || er));
    } finally { setSaving(false); }
  }

  async function elimina(item) {
    if (!window.confirm(`Togliere «${item.name}» dal bestiario? (Su Foundry resta.)`)) return;
    await deleteDoc(doc(db, "enemies", item.id)).catch(() => {});
    if (item.inboxId && queued.has(item.inboxId)) await deleteDoc(doc(db, "foundry_inbox", item.inboxId)).catch(() => {});
    if (enemyId === item.id) { setEnemy(null); setEnemyId(null); setImage(""); }
  }

  const apri = (item) => {
    setEnemy(item.enemy); setEnemyId(item.id); setImage(item.image || ""); setImgHint(item.imgHint || ""); setMsg(""); setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const statoDi = (item) => !item.inboxId ? { t: "non mandato", c: "" } : queued.has(item.inboxId) ? { t: "📦 in coda", c: "is-queued" } : { t: "✓ su Foundry", c: "is-done" };

  return (
    <section className="fn-page">
      <header className="fn-head">
        <Link to="/dm-admin" className="fn-back">← DM Admin</Link>
        <p className="fn-eyebrow">Officina del DM</p>
        <h1 className="fn-title">La Forgia dei Nemici</h1>
        <p className="fn-sub">
          Scegli che creatura vuoi (o lascia decidere all'AI): esce la scheda D&D 5e completa, con armi vere, capacità e incantesimi.
          Su Foundry diventa un <strong>PNG</strong> (attore «npc»), il formato giusto per i nemici: grado di sfida, azioni leggendarie, token ostile.
          Il «personaggio» serve solo ai giocatori (classi e livelli).
        </p>
      </header>

      <div className="fn-grid">
        <div className="fn-col">
          <div className="fn-panel">
            <h2 className="fn-h2"><span>1</span> Che nemico vuoi</h2>
            <p className="fn-label">Tipo di creatura</p>
            <div className="fn-chips">
              <button type="button" className={`fn-chip${tipo === "" ? " is-on" : ""}`} aria-pressed={tipo === ""} onClick={() => setTipo("")}>🎲 Decide l'AI</button>
              {CREATURE_TYPES.map((t) => (
                <button key={t.key} type="button" className={`fn-chip${tipo === t.key ? " is-on" : ""}`} aria-pressed={tipo === t.key} onClick={() => setTipo(t.key)}>{t.icon} {t.label}</button>
              ))}
            </div>
            <p className="fn-label">Ruolo</p>
            <div className="fn-chips">
              {RUOLI.map((r) => (
                <button key={r.key || "ai"} type="button" className={`fn-chip${ruolo === r.key ? " is-on" : ""}`} aria-pressed={ruolo === r.key} onClick={() => setRuolo(r.key)}>{r.icon} {r.label}</button>
              ))}
            </div>
            <label className="fn-label" htmlFor="fn-cr">Grado di sfida</label>
            <select id="fn-cr" className="fn-input fn-input--short" value={cr} onChange={(e) => setCr(e.target.value)}>
              <option value="">🎲 Decide l'AI</option>
              {CRS.map((c) => <option key={c} value={c}>GS {fmtCr(c)} · {xpForCr(c).toLocaleString("it-IT")} PE</option>)}
            </select>
            <label className="fn-label" htmlFor="fn-spunto">Spunto (facoltativo)</label>
            <textarea id="fn-spunto" className="fn-input" rows={3} value={spunto} onChange={(e) => setSpunto(e.target.value)}
              placeholder="Es. capitano dei pirati non morto che comanda una ciurma di annegati; usa un uncino e una pistola a pietra focaia…" />
            <button type="button" className="fn-cta" onClick={forgia} disabled={busy}>
              {busy ? "⏳ Sto forgiando… (circa 40 secondi)" : enemy ? "🔁 Forgia un altro nemico" : "⚒ Forgia il nemico"}
            </button>
          </div>

          {n && (
            <div className="fn-panel">
              <h2 className="fn-h2"><span>2</span> Ritratto</h2>
              <div className="fn-portrait">
                <div className={`fn-portrait-img${image ? "" : " is-empty"}`}>
                  {image ? <img src={image} alt={n.name} /> : <span>{CREATURE_TYPES.find((t) => t.key === n.creatureType)?.icon || "👹"}</span>}
                </div>
                <div className="fn-portrait-side">
                  <label className="fn-label" htmlFor="fn-imghint">Descrizione per il disegno</label>
                  <textarea id="fn-imghint" className="fn-input" rows={3} value={imgHint} onChange={(e) => setImgHint(e.target.value)}
                    placeholder={n.appearance ? `Vuoto = quella dell'AI: «${n.appearance.slice(0, 110)}${n.appearance.length > 110 ? "…" : ""}»` : "Vuoto = decide l'AI"} />
                  <ImageTonePicker compact disabled={imgBusy} />
                  <div className="fn-row">
                    <button type="button" className="fn-btn" onClick={disegna} disabled={imgBusy}>{imgBusy ? "⏳ Disegno…" : image ? "✨ Ridisegna" : "✨ Disegna"}</button>
                    <label className="fn-btn fn-btn--ghost">
                      📁 Carica dal PC
                      <input type="file" accept="image/*" hidden onChange={(e) => carica(e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {n && (
            <div className="fn-panel fn-send">
              <h2 className="fn-h2"><span>3</span> Salva e porta su Foundry</h2>
              <div className="fn-row">
                <button type="button" className="fn-btn" onClick={salva} disabled={saving}>💾 Salva nel bestiario</button>
                <button type="button" className="fn-cta fn-cta--inline" onClick={() => manda()} disabled={saving}>📤 Manda a Foundry</button>
              </div>
              <p className="fn-note">Su Foundry lo crea la macro <strong>Fetch admin</strong> (anche da sola ogni 2 minuti, se è accesa), nella cartella «Nemici dal sito». Gli incantesimi arrivano dal compendio SRD, le armi come armi vere.</p>
            </div>
          )}
          {(msg || err) && <p className={`fn-msg${err ? " is-err" : ""}`} role="status">{err || msg}</p>}
        </div>

        <div className="fn-col">
          {n ? <StatBlock n={n} patch={patch} dropAt={dropAt} dropSpell={dropSpell} /> : (
            <div className="fn-empty">
              <p className="fn-empty-glyph" aria-hidden="true">⚒</p>
              <p>La scheda del nemico comparirà qui.</p>
            </div>
          )}
        </div>
      </div>

      <section className="fn-bestiary">
        <h2 className="fn-h2 fn-h2--wide">Bestiario della Forgia <em>{list.length}</em></h2>
        {list.length === 0 ? <p className="fn-note">Ancora nessun nemico salvato.</p> : (
          <ul className="fn-cards">
            {list.map((it) => {
              const st = statoDi(it);
              return (
                <li key={it.id} className={`fn-card${enemyId === it.id ? " is-open" : ""}`}>
                  <button type="button" className="fn-card-open" onClick={() => apri(it)}>
                    <span className="fn-card-img">{it.image ? <img src={it.image} alt="" loading="lazy" /> : "👹"}</span>
                    <span className="fn-card-name">{it.name}</span>
                    <span className="fn-card-meta">{typeLabel(it.creatureType)} · GS {fmtCr(it.cr)}</span>
                  </button>
                  <div className="fn-card-foot">
                    <span className={`fn-card-state ${st.c}`}>{st.t}</span>
                    <button type="button" className="fn-mini" onClick={() => manda(it)} disabled={saving} title="Manda (di nuovo) a Foundry">📤</button>
                    <button type="button" className="fn-mini" onClick={() => elimina(it)} title="Togli dal bestiario">✕</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

const slug = (s) => String(s || "nemico").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 32).toLowerCase();

function StatBlock({ n, patch, dropAt, dropSpell }) {
  const prof = profForCr(n.cr);
  const hp = hpOf(n);
  const ac = acOf(n);
  const armor = SRD_ARMOR[n.armor.base];
  const speed = Object.entries(n.speed || {}).filter(([k, v]) => k !== "hover" && Number(v) > 0)
    .map(([k, v]) => `${{ walk: "", fly: "volare ", swim: "nuotare ", climb: "scalare ", burrow: "scavare " }[k] ?? ""}${ft(Number(v))}`).join(", ");
  const senses = Object.entries(n.senses || {}).filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => `${{ darkvision: "scurovisione", blindsight: "vista cieca", tremorsense: "percezione tellurica", truesight: "vista pura" }[k] || k} ${ft(Number(v))}`);
  const passive = 10 + abilityMod(n.abilities.wis) + (n.skills.some((s) => s.key === "prc") ? prof : 0);
  const sc = n.spellcasting?.spells?.length ? n.spellcasting : null;
  const byLevel = sc ? sc.spells.reduce((m, s, i) => { (m[s.level] = m[s.level] || []).push({ ...s, i }); return m; }, {}) : {};

  return (
    <article className="fn-sb">
      <input className="fn-sb-name" value={n.name} onChange={(e) => patch({ name: e.target.value })} aria-label="Nome" />
      <p className="fn-sb-kind">{SIZES[n.size]} · {typeLabel(n.creatureType)}{n.subtype ? ` (${n.subtype})` : ""}{n.alignment ? `, ${n.alignment}` : ""}</p>
      <hr />
      <dl className="fn-sb-core">
        <div><dt>Classe Armatura</dt><dd>{ac}{armor ? ` (${n.armor.name || armor[0]}${n.armor.shield ? ", scudo" : ""})` : " (armatura naturale)"}</dd></div>
        <div>
          <dt>Punti Ferita</dt>
          <dd>{hp.max} ({hp.formula}) · dadi vita
            <input type="number" min={1} max={40} className="fn-sb-num" value={n.hitDice.count}
              onChange={(e) => patch({ hitDice: { ...n.hitDice, count: Number(e.target.value) || 1 } })} aria-label="Numero di dadi vita" />
          </dd>
        </div>
        <div><dt>Velocità</dt><dd>{speed || "—"}{n.speed?.hover ? " (fluttua)" : ""}</dd></div>
      </dl>
      <hr />
      <div className="fn-sb-abil">
        {ABILITIES.map((k) => (
          <label key={k}>
            <span>{ABILITY_IT[k]}</span>
            <input type="number" min={1} max={30} value={n.abilities[k]}
              onChange={(e) => patch({ abilities: { ...n.abilities, [k]: Number(e.target.value) || 1 } })} />
            <em>{fmtMod(abilityMod(n.abilities[k]))}</em>
          </label>
        ))}
      </div>
      <hr />
      <dl className="fn-sb-lines">
        {n.saves.length > 0 && <div><dt>Tiri salvezza</dt><dd>{n.saves.map((k) => `${ABILITY_IT[k]} ${fmtMod(abilityMod(n.abilities[k]) + prof)}`).join(", ")}</dd></div>}
        {n.skills.length > 0 && <div><dt>Abilità</dt><dd>{n.skills.map((s) => `${SKILLS[s.key]} ${fmtMod(abilityMod(n.abilities[{ acr: "dex", ani: "wis", arc: "int", ath: "str", dec: "cha", his: "int", ins: "wis", itm: "cha", inv: "int", med: "wis", nat: "int", prc: "wis", prf: "cha", per: "cha", rel: "int", slt: "dex", ste: "dex", sur: "wis" }[s.key]]) + prof * (s.expertise ? 2 : 1))}`).join(", ")}</dd></div>}
        {n.vulnerabilities.length > 0 && <div><dt>Vulnerabilità</dt><dd>{n.vulnerabilities.map((d) => DAMAGE_IT[d]).join(", ")}</dd></div>}
        {n.resistances.length > 0 && <div><dt>Resistenze</dt><dd>{n.resistances.map((d) => DAMAGE_IT[d]).join(", ")}</dd></div>}
        {n.immunities.length > 0 && <div><dt>Immunità</dt><dd>{n.immunities.map((d) => DAMAGE_IT[d]).join(", ")}</dd></div>}
        {n.conditionImmunities.length > 0 && <div><dt>Immune a</dt><dd>{n.conditionImmunities.join(", ")}</dd></div>}
        <div><dt>Sensi</dt><dd>{[...senses, `Percezione passiva ${passive}`].join(", ")}</dd></div>
        <div><dt>Linguaggi</dt><dd>{n.languages || "—"}</dd></div>
        <div>
          <dt>Sfida</dt>
          <dd>
            <select className="fn-sb-sel" value={n.cr} onChange={(e) => patch({ cr: Number(e.target.value) })} aria-label="Grado di sfida">
              {CRS.map((c) => <option key={c} value={c}>{fmtCr(c)}</option>)}
            </select> ({xpForCr(n.cr).toLocaleString("it-IT")} PE) · competenza {fmtMod(prof)}
          </dd>
        </div>
      </dl>

      {n.features.filter((f) => f.kind === "passive").length > 0 && <hr />}
      {n.features.map((f, i) => f.kind === "passive" && <Feature key={i} f={f} n={n} onDrop={() => dropAt("features", i)} />)}

      <h3 className="fn-sb-sec">Azioni</h3>
      {n.multiattack && <p className="fn-sb-p"><strong>Multiattacco.</strong> {n.multiattack}</p>}
      {n.weapons.map((w, i) => {
        const st = weaponStats(n, w);
        return (
          <div key={i} className="fn-sb-item">
            <p className="fn-sb-p">
              <strong>{w.name}.</strong> <em>{st.ranged ? "Attacco con arma a distanza" : "Attacco con arma da mischia"}:</em> {fmtMod(st.toHit)} a colpire,
              {" "}{st.ranged ? `gittata ${(SRD_WEAPONS[w.base]?.[5] || [w.range || 60, (w.range || 60) * 4]).join("/")} ft` : `portata ${Number(w.reach) > 5 ? 10 : 5} ft`}. <em>Colpito:</em> {st.dice}{st.mod ? ` ${st.mod > 0 ? "+" : "−"} ${Math.abs(st.mod)}` : ""} {DAMAGE_IT[st.dtype]}
              {w.extra?.formula ? ` più ${w.extra.formula} ${DAMAGE_IT[w.extra.type] || ""}` : ""}{w.magicBonus ? ` · arma +${w.magicBonus}` : ""}.
              {w.description ? ` ${w.description}` : ""}
              <span className="fn-tag">{w.base === "natural" ? "arma naturale" : "arma SRD"}</span>
            </p>
            <button type="button" className="fn-x" onClick={() => dropAt("weapons", i)} aria-label={`Togli ${w.name}`}>✕</button>
          </div>
        );
      })}
      {n.features.map((f, i) => (f.kind === "action") && <Feature key={i} f={f} n={n} onDrop={() => dropAt("features", i)} />)}

      {n.features.some((f) => f.kind === "bonus") && <h3 className="fn-sb-sec">Azioni bonus</h3>}
      {n.features.map((f, i) => f.kind === "bonus" && <Feature key={i} f={f} n={n} onDrop={() => dropAt("features", i)} />)}
      {n.features.some((f) => f.kind === "reaction") && <h3 className="fn-sb-sec">Reazioni</h3>}
      {n.features.map((f, i) => f.kind === "reaction" && <Feature key={i} f={f} n={n} onDrop={() => dropAt("features", i)} />)}
      {(n.legendaryActions > 0 || n.features.some((f) => f.kind === "legendary")) && <h3 className="fn-sb-sec">Azioni leggendarie ({n.legendaryActions || 3})</h3>}
      {n.features.map((f, i) => f.kind === "legendary" && <Feature key={i} f={f} n={n} onDrop={() => dropAt("features", i)} />)}

      {sc && (
        <>
          <h3 className="fn-sb-sec">Incantesimi</h3>
          <p className="fn-sb-p">Incantatore di {sc.level}° livello · {ABILITY_IT[sc.ability] || "INT"} · CD {featureDc(n, sc.ability)}, {fmtMod(prof + abilityMod(n.abilities[sc.ability] || 10))} a colpire. <span className="fn-tag">dal compendio SRD</span></p>
          <ul className="fn-spells">
            {Object.entries(byLevel).sort(([a], [b]) => a - b).map(([lvl, arr]) => (
              <li key={lvl}>
                <span className="fn-spells-lvl">{lvl === "0" ? "Trucchetti" : `${lvl}°`}</span>
                {arr.map((s) => (
                  <span key={s.i} className="fn-spell">
                    {s.name}{s.mode === "innate" ? ` ${s.perDay || 1}${MODE_IT.innate}` : s.mode === "atwill" && lvl !== "0" ? ` (${MODE_IT.atwill})` : ""}
                    <button type="button" onClick={() => dropSpell(s.i)} aria-label={`Togli ${s.name}`}>✕</button>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}

      <hr />
      <label className="fn-label" htmlFor="fn-desc">Descrizione</label>
      <textarea id="fn-desc" className="fn-input" rows={3} value={n.description || ""} onChange={(e) => patch({ description: e.target.value })} />
      {n.tactics && <p className="fn-sb-p"><strong>Tattica.</strong> {n.tactics}</p>}
      {n.loot && <p className="fn-sb-p"><strong>Bottino.</strong> {n.loot}</p>}
    </article>
  );
}

function Feature({ f, n, onDrop }) {
  const uses = USES_IT(f.uses);
  const dc = f.save?.ability ? `TS ${ABILITY_IT[f.save.ability]} CD ${featureDc(n, f.dcAbility || "con")}` : "";
  const bits = [KIND_IT[f.kind], uses, dc, f.area?.type ? `${f.area.type} ${f.area.size} ft` : "", f.damage?.formula ? `${f.damage.formula} ${DAMAGE_IT[f.damage.type] || ""}` : ""].filter(Boolean);
  return (
    <div className="fn-sb-item">
      <p className="fn-sb-p">
        <strong>{f.name}{uses ? ` (${uses})` : ""}.</strong> {f.description}
        {f.kind !== "passive" && <span className="fn-tag">{bits.join(" · ")}</span>}
      </p>
      <button type="button" className="fn-x" onClick={onDrop} aria-label={`Togli ${f.name}`}>✕</button>
    </div>
  );
}
