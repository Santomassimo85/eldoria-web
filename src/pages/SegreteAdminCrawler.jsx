/* Admin delle Segrete, piega "Prima persona" (2026-11-07): tutta l'art della vista nuova.
   Anteprima dal vivo · pareti/pavimento/soffitto per dungeon · armi in mano · sprite frontali.
   La vista classica non usa niente di tutto questo: frontImageUrl è un campo a parte. */
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteField, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import ImageTonePicker from "../components/ImageTonePicker";
import { sizeScale } from "../data/segrete";
import { WEAPONS, WEAPON_CHOICES, TWO_HANDED, armorProf, canTwoHand } from "../data/segreteKits";
import { ITEMS } from "../data/segreteItems";
import { dataUrlToTransparentDataUrl } from "../utils/aiSprite";
import { askImage, frontSpriteUrl, touchesTop } from "../utils/crawlerGen";
import { CrawlerEngine, CW_H, CW_W } from "../fx/crawlerEngine";
import { GLOVES, bakeTile, gloveOf, handDoc, handEntries, handPrompt, handSpec, materialOf, pairKey, tilePrompt, twoHandedFor, weaponEffectsText } from "../fx/crawlerArt";
import { STORY_CLASSES } from "../data/segrete";

const SLOTS = [["wall", "Pareti"], ["floor", "Pavimento"], ["ceil", "Soffitto"]];
// la lista: per ogni guanto la mano sinistra, lo scudo, le armi delle sue classi e le armi speciali
const HANDS = handEntries({ WEAPONS, WEAPON_CHOICES, TWO_HANDED, ITEMS, armorProf, canTwoHand });
const fileToUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
// una foto caricata dal PC: solo rimpicciolita, il fondo trasparente deve già averlo
const fitHand = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => { const k = Math.min(1, 320 / Math.max(i.width, i.height)), c = document.createElement("canvas"); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL("image/png")); };
  i.onerror = () => rej(new Error("Immagine non leggibile."));
  i.src = src;
});

function Preview({ dungeons, monsters, tiles }) {
  const [cv, setCv] = useState(null);
  const [fg, setFg] = useState(null);
  const eng = useRef(null);
  const [key, setKey] = useState("segrete");
  const [cls, setCls] = useState("fighter");
  const [weapon, setWeapon] = useState("spada_lunga");
  const [shield, setShield] = useState(true);
  useEffect(() => {
    if (!cv || !fg) return undefined;
    const e = new CrawlerEngine(cv, fg); eng.current = e;
    return () => { e.destroy(); eng.current = null; };
  }, [cv, fg]);
  const foes = useMemo(() => {
    const own = monsters.filter((m) => (m.dungeons || []).includes(key));
    const boss = own.find((m) => m.role === "boss");
    return [...own.filter((m) => m.role !== "boss").slice(0, boss ? 2 : 5), ...(boss ? [boss] : [])]
      .map((m, i) => ({ id: `p${i}`, hp: 10, maxHp: 10, role: m.role, icon: m.icon, img: m.frontImageUrl || m.imageUrl || "", scale: sizeScale(m) }));
  }, [monsters, key]);
  const t = tiles[key];
  useEffect(() => { eng.current?.setTheme(key, t); }, [cv, fg, key, t]);
  useEffect(() => { eng.current?.setFoes(foes); }, [cv, fg, foes]);
  const choices = WEAPON_CHOICES[cls] || [];
  const wk = choices.includes(weapon) ? weapon : choices[0];
  const canShield = armorProf(cls).shield && !twoHandedFor(cls, wk, TWO_HANDED.has(wk));
  const { off, glove } = handSpec({ cls, gear: { shield: canShield && shield } }, wk, TWO_HANDED.has(wk));
  const hp = tiles[handDoc(pairKey(wk, off), glove)]?.image || "";
  useEffect(() => { eng.current?.setHands(`${wk}:${off}:${glove}:${hp.length}`, { main: wk, off, pairUrl: hp }); }, [cv, fg, wk, off, glove, hp]);
  return (
    <div className="sga-card">
      <h3 className="sga-h3">Anteprima <small>come la vede il giocatore, con l'art salvata</small></h3>
      <div className="sga-row">
        <label className="sga-field sga-field--s"><span>Dungeon</span>
          <select className="admin-field-input" value={key} onChange={(e) => setKey(e.target.value)}>{dungeons.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}</select></label>
        <label className="sga-field sga-field--s"><span>Classe</span>
          <select className="admin-field-input" value={cls} onChange={(e) => setCls(e.target.value)}>{STORY_CLASSES.map((c) => <option key={c.key} value={c.key}>{c.it}</option>)}</select></label>
        <label className="sga-field sga-field--s"><span>Arma</span>
          <select className="admin-field-input" value={wk} onChange={(e) => setWeapon(e.target.value)}>{choices.map((k) => <option key={k} value={k}>{WEAPONS[k].name}</option>)}</select></label>
      </div>
      {canShield && <label className="sga-check"><input type="checkbox" checked={shield} onChange={(e) => setShield(e.target.checked)} /> Impugna lo scudo</label>}
      <p className="sga-hint">{GLOVES[gloveOf(cls)].name} · {off === "shield" ? "scudo a sinistra" : off === "none" ? "arma a due mani" : GLOVES[gloveOf(cls)].focus ? "focus arcano a sinistra" : "mano sinistra semiaperta"}</p>
      <div className="sga-cw-prev">
        <canvas ref={setCv} width={CW_W} height={CW_H} aria-label="Anteprima della stanza in prima persona" />
        <canvas ref={setFg} aria-hidden="true" />
      </div>
      {!foes.length && <p className="sga-hint">Nessun mostro in questo dungeon.</p>}
    </div>
  );
}

export default function CrawlerArtTab({ dungeons, monsters }) {
  const [tiles, setTiles] = useState({});
  const [busy, setBusy] = useState("");
  // idea per le tessere: una per dungeon (prima era una sola per tutti)
  const [ideas, setIdeas] = useState({});
  const [front, setFront] = useState(null); // {done, total, failed}
  const [handsDone, setHandsDone] = useState("");
  useEffect(() => onSnapshot(collection(db, "dungeon_tiles"), (s) => { const m = {}; s.docs.forEach((d) => { m[d.id] = d.data(); }); setTiles(m); }, () => {}), []);
  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { alert(`Non riuscito: ${e.message || e}`); } finally { setBusy(""); }
  };
  const makeTile = async (d, slot) => {
    const img = await askImage({ prompt: tilePrompt(d, slot, (ideas[d.key] || "").trim()), aspectRatio: "1:1" });
    await setDoc(doc(db, "dungeon_tiles", d.key), { [slot]: await bakeTile(img), updatedAt: serverTimestamp() }, { merge: true });
  };
  const genTile = (d, slot) => run(`${d.key}:${slot}`, () => makeTile(d, slot));
  const genAllTiles = (d) => run(`${d.key}:all`, async () => { for (const [slot] of SLOTS) await makeTile(d, slot); });
  const dropTile = (d, slot) => setDoc(doc(db, "dungeon_tiles", d.key), { [slot]: deleteField() }, { merge: true }).catch((e) => alert(e.message));
  const idOf = (h) => handDoc(h.key, h.glove);
  // L'ASPETTO DELLE ARMI SPECIALI (2026-11-07): testo in dungeon_tiles/look_<arma>, scritto dall'IA dai
  // danni e dagli effetti, ritoccabile; entra nella richiesta dello sprite.
  const lookOf = (item) => tiles[`look_${item}`]?.text || "";
  const [drafts, setDrafts] = useState({});
  const draftOf = (item) => (drafts[item] ?? lookOf(item));
  const genLook = (h) => run(`look:${h.item}`, async () => {
    const it = ITEMS[h.item], w = WEAPONS[h.base];
    const r = await fetch("/api/genera-oggetto-arena", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "aspettoArma", arma: { name: it?.name, weapon: w?.name, desc: it?.desc, effects: weaponEffectsText(it, w) } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.look) throw new Error(j.error || "nessuna descrizione");
    setDrafts((d) => ({ ...d, [h.item]: j.look }));
  });
  const saveLook = (item) => run(`looksave:${item}`, async () => {
    await setDoc(doc(db, "dungeon_tiles", `look_${item}`), { text: draftOf(item).trim(), updatedAt: serverTimestamp() });
    setDrafts((d) => { const n = { ...d }; delete n[item]; return n; });
  });
  const makeHand = async (h) => {
    if (h.special) h = { ...h, look: draftOf(h.item).trim() };
    let image = "";
    // tagliata in alto? si rifà UNA volta da sola (se esce di nuovo tagliata la si tiene, con l'avviso)
    for (let tries = 0; tries < 2; tries++) {
      const img = await askImage({ prompt: handPrompt(h), aspectRatio: "4:3" });
      image = await dataUrlToTransparentDataUrl(img, 480);
      if (!(await touchesTop(image))) break;
    }
    await setDoc(doc(db, "dungeon_tiles", idOf(h)), { image, updatedAt: serverTimestamp() });
  };
  const genHand = (h) => run(`hand:${idOf(h)}`, () => makeHand(h));
  const upHand = (h, file) => run(`hand:${idOf(h)}`, async () => {
    const image = await fitHand(await fileToUrl(file));
    await setDoc(doc(db, "dungeon_tiles", idOf(h)), { image, updatedAt: serverTimestamp() });
  });
  const handsMissing = HANDS.filter((h) => !tiles[idOf(h)]?.image);
  const tile = (h) => {
    const id = idOf(h), src = tiles[id]?.image;
    return (
      <figure key={id} className="sga-cw-tile">
        {src ? <img src={src} alt={h.name} /> : <span>{h.icon}</span>}
        {src && cut[id] && <em className="sga-cw-cut">⚠ tagliata: rigenerala</em>}
        <figcaption>{h.special ? "" : h.name} <small>{h.off === "shield" ? "+ scudo" : h.off === "none" ? "a due mani" : GLOVES[h.glove]?.focus ? "+ focus arcano" : "+ mano libera"}</small></figcaption>
        <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genHand(h)}>{busy === `hand:${id}` ? "⏳" : src ? "✨ Rigenera" : "✨ Genera sprite"}</button>
        <label className="adm-btn sga-cw-up">📁 Carica<input type="file" accept="image/png,image/webp" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) upHand(h, file); e.target.value = ""; }} /></label>
        {src && <button type="button" className="sga-x" aria-label={`Togli ${h.name}`} onClick={() => dropHand(h)}>✕</button>}
      </figure>
    );
  };
  const genAllHands = () => {
    if (!handsMissing.length || !window.confirm(`Generare ${handsMissing.length} sprite delle mani? Circa 3 centesimi l'uno di credito Gemini.`)) return;
    run("hands", async () => {
      let failed = 0;
      for (let i = 0; i < handsMissing.length; i++) {
        setHandsDone(`${i}/${handsMissing.length}`);
        try { await makeHand(handsMissing[i]); } catch { failed++; }
      }
      setHandsDone("");
      if (failed) alert(`${failed} sprite non generati: riprova con lo stesso tasto.`);
    });
  };
  const dropHand = (h) => setDoc(doc(db, "dungeon_tiles", idOf(h)), { image: deleteField() }, { merge: true }).catch((e) => alert(e.message));
  // armi già salvate tagliate in alto: avviso sulla miniatura
  const [cut, setCut] = useState({});
  useEffect(() => {
    let live = true;
    HANDS.forEach((h) => {
      const src = tiles[idOf(h)]?.image;
      if (!src) return;
      touchesTop(src).then((v) => { if (live) setCut((m) => (m[idOf(h)] === v ? m : { ...m, [idOf(h)]: v })); }).catch(() => {});
    });
    return () => { live = false; };
  }, [tiles]);
  // le prove di prima, senza guanto: non le usa più nessuno
  const ids = new Set(HANDS.map(idOf));
  const old = Object.keys(tiles).filter((k) => k.startsWith("hand_") && !ids.has(k) && tiles[k]?.image);

  const missing = monsters.filter((m) => !m.frontImageUrl);
  const genFronts = async () => {
    if (!missing.length || front) return;
    if (!window.confirm(`Generare ${missing.length} sprite frontali? Ogni immagine consuma un po' di credito Gemini (circa 3 centesimi l'una, ${missing.length} in tutto) e ci vuole qualche minuto.`)) return;
    let failed = 0;
    for (let i = 0; i < missing.length; i++) {
      setFront({ done: i, total: missing.length, failed });
      try { await setDoc(doc(db, "dungeon_monsters", missing[i].id), { frontImageUrl: await frontSpriteUrl(missing[i]), updatedAt: serverTimestamp() }, { merge: true }); }
      catch { failed++; }
    }
    setFront(null);
    alert(`Fatto: ${missing.length - failed} frontali su ${missing.length}.${failed ? " Quelli mancanti si possono rigenerare con lo stesso tasto." : ""}`);
  };

  return (
    <div className="sga-cw">
      <p className="sga-hint">Questa è l'art della vista in prima persona, che per ora vedi solo tu. Finché un pezzo manca si usa la riserva disegnata dal codice. I giocatori continuano a vedere la lotta classica.</p>
      <ImageTonePicker />
      <Preview dungeons={dungeons} monsters={monsters} tiles={tiles} />

      <div className="sga-card">
        <h3 className="sga-h3">Sprite frontali <small>{monsters.length - missing.length} su {monsters.length}</small></h3>
        <p className="sga-hint">I mostri ora si guardano in faccia: serve uno sprite di fronte. L'IA parte dallo sprite che hai già, così resta lo stesso mostro. Si possono fare uno per uno nella scheda del mostro.</p>
        <button type="button" className="adm-btn adm-btn--gold" disabled={!missing.length || !!front} onClick={genFronts}>
          {front ? `⏳ ${front.done}/${front.total}…` : missing.length ? `✨ Genera i frontali mancanti (${missing.length})` : "✓ Tutti i mostri hanno il frontale"}
        </button>
      </div>

      <div className="sga-card">
        <h3 className="sga-h3">Pareti, pavimento e soffitto <small>tessere che si ripetono, una serie per dungeon</small></h3>
        <p className="sga-hint">Ogni dungeon ha il suo materiale (sotto il nome): l'IA lo usa insieme al nome e alla descrizione. Per cambiarlo scrivi un'idea nella casella del dungeon.</p>
        {dungeons.map((d) => {
          const mat = materialOf(d);
          return (
            <div key={d.key} className="sga-cw-row">
              <b>{d.icon} {d.name}</b>
              <small className="sga-cw-mat">{mat ? `🧱 ${mat.wall} · 🎨 ${mat.colors}` : "🧱 materiale deciso dall'IA dal nome del dungeon"}</small>
              <div className="sga-row">
                <input className="admin-field-input" value={ideas[d.key] || ""} onChange={(e) => setIdeas((m) => ({ ...m, [d.key]: e.target.value }))}
                  placeholder='Idea per le tessere (facoltativa): es. "mattoni con muschio", "ghiaccio con crepe azzurre"' />
                <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genAllTiles(d)}>{busy === `${d.key}:all` ? "⏳ Disegno…" : "✨ Genera tutte e tre"}</button>
              </div>
              <div className="sga-cw-tiles">
                {SLOTS.map(([slot, label]) => {
                  const src = tiles[d.key]?.[slot];
                  return (
                    <figure key={slot} className="sga-cw-tile">
                      {src ? <img src={src} alt={`${label} di ${d.name}`} /> : <span>riserva</span>}
                      <figcaption>{label}</figcaption>
                      <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genTile(d, slot)}>{busy === `${d.key}:${slot}` ? "⏳" : src ? "✨ Rigenera" : "✨ Genera"}</button>
                      {src && <button type="button" className="sga-x" aria-label={`Togli ${label}`} onClick={() => dropTile(d, slot)}>✕</button>}
                    </figure>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sga-card">
        <h3 className="sga-h3">Mani e armi <small>{HANDS.length - handsMissing.length} su {HANDS.length} · viste da chi le impugna</small></h3>
        <p className="sga-hint">Ogni classe ha i suoi guanti. Ogni sprite ha TUTTE E DUE le mani, larghe quanto la scena: la destra con l'arma e la sinistra libera (o con lo scudo, per chi lo può portare); così i guanti e le misure vengono uguali. Le +1 e +2 usano lo sprite dell'arma base, le armi speciali il loro. Da «Carica» puoi mettere un tuo disegno: PNG 4:3 col fondo trasparente, le mani che entrano dal bordo in basso.</p>
        <button type="button" className="adm-btn adm-btn--gold" disabled={!handsMissing.length || !!busy} onClick={genAllHands}>
          {handsDone ? `⏳ ${handsDone}…` : handsMissing.length ? `✨ Genera quelli mancanti (${handsMissing.length})` : "✓ Tutte le mani hanno lo sprite"}
        </button>
        {!!old.length && <p className="sga-hint">Ci sono {old.length} sprite vecchi (mani separate), che la lotta non usa più. <button type="button" className="adm-btn" onClick={() => old.forEach((k) => setDoc(doc(db, "dungeon_tiles", k), { image: deleteField() }, { merge: true }))}>🗑 Togli le prove vecchie</button></p>}
        {Object.entries(GLOVES).map(([glove, g]) => {
          const all = HANDS.filter((h) => h.glove === glove), base = all.filter((h) => !h.special);
          const specials = [...new Set(all.filter((h) => h.special).map((h) => h.item))];
          const baseDone = base.filter((h) => tiles[idOf(h)]?.image).length;
          return (
            <div key={glove} className="sga-cw-row">
              <b>{g.icon} {g.name} <small>· {g.classes.map((c) => STORY_CLASSES.find((x) => x.key === c)?.it || c).join(", ")}</small></b>
              <details className="sga-cw-base">
                <summary>Armi base · {baseDone} su {base.length}{baseDone < base.length ? " ⚠ ne mancano" : " ✓"}</summary>
                <div className="sga-cw-tiles">{base.map(tile)}</div>
              </details>
              {specials.map((item) => {
                const vars = all.filter((h) => h.item === item), h0 = vars[0], it = ITEMS[item], draft = draftOf(item), changed = draft !== lookOf(item);
                return (
                  <div key={item} className="sga-cw-special">
                    <p className="sga-cw-sp-h">{it?.icon} <b>{it?.name}</b> <small>{WEAPONS[h0.base]?.name} · {weaponEffectsText(it, WEAPONS[h0.base])}</small></p>
                    <textarea className="admin-field-input" rows={3} value={draft} placeholder="Aspetto dell'arma: premi «Genera descrizione», poi ritoccala se vuoi." onChange={(e) => setDrafts((d) => ({ ...d, [item]: e.target.value }))} />
                    <div className="sga-row">
                      <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genLook(h0)}>{busy === `look:${item}` ? "⏳ Scrivo…" : "📝 Genera descrizione"}</button>
                      {changed && <button type="button" className="adm-btn adm-btn--gold" disabled={!!busy || !draft.trim()} onClick={() => saveLook(item)}>💾 Salva descrizione</button>}
                    </div>
                    {!draft.trim() && <p className="sga-hint">Senza descrizione lo sprite viene generico: prima la descrizione, poi lo sprite.</p>}
                    <div className="sga-cw-tiles">{vars.map(tile)}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
