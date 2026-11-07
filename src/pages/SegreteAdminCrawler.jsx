/* Admin delle Segrete, piega "Prima persona" (2026-11-07): tutta l'art della vista nuova.
   Anteprima dal vivo · pareti/pavimento/soffitto per dungeon · armi in mano · sprite frontali.
   La vista classica non usa niente di tutto questo: frontImageUrl è un campo a parte. */
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteField, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import ImageTonePicker from "../components/ImageTonePicker";
import { sizeScale } from "../data/segrete";
import { WEAPONS, WEAPON_CHOICES, TWO_HANDED, armorProf } from "../data/segreteKits";
import { ITEMS } from "../data/segreteItems";
import { dataUrlToTransparentDataUrl } from "../utils/aiSprite";
import { askImage, dropExtraHand, frontSpriteUrl } from "../utils/crawlerGen";
import { CrawlerEngine, CW_H, CW_W } from "../fx/crawlerEngine";
import { GLOVES, bakeTile, gloveOf, handDoc, handEntries, handPrompt, handSpec, tilePrompt } from "../fx/crawlerArt";
import { STORY_CLASSES } from "../data/segrete";

const SLOTS = [["wall", "Pareti"], ["floor", "Pavimento"], ["ceil", "Soffitto"]];
// la lista: per ogni guanto la mano sinistra, lo scudo, le armi delle sue classi e le armi speciali
const HANDS = handEntries({ WEAPONS, WEAPON_CHOICES, TWO_HANDED, ITEMS, armorProf });
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
  const canShield = armorProf(cls).shield && !TWO_HANDED.has(wk);
  const { off, glove } = handSpec({ cls, gear: { shield: canShield && shield } }, wk, TWO_HANDED.has(wk));
  const hw = tiles[handDoc(wk, glove)]?.image || "", ho = off === "none" ? "" : tiles[handDoc(off === "hand" ? "open" : off, glove)]?.image || "";
  useEffect(() => { eng.current?.setHands(`${wk}:${off}:${glove}:${hw.length}:${ho.length}`, { main: wk, off, mainUrl: hw, offUrl: ho }); }, [cv, fg, wk, off, glove, hw, ho]);
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
      <p className="sga-hint">{GLOVES[gloveOf(cls)].name} · {off === "shield" ? "scudo a sinistra" : off === "none" ? "arma a due mani" : "mano sinistra semiaperta"}</p>
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
  const [idea, setIdea] = useState("");
  const [front, setFront] = useState(null); // {done, total, failed}
  const [handsDone, setHandsDone] = useState("");
  useEffect(() => onSnapshot(collection(db, "dungeon_tiles"), (s) => { const m = {}; s.docs.forEach((d) => { m[d.id] = d.data(); }); setTiles(m); }, () => {}), []);
  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { alert(`Non riuscito: ${e.message || e}`); } finally { setBusy(""); }
  };
  const genTile = (d, slot) => run(`${d.key}:${slot}`, async () => {
    const img = await askImage({ prompt: tilePrompt(d, slot, idea.trim()), aspectRatio: "1:1" });
    await setDoc(doc(db, "dungeon_tiles", d.key), { [slot]: await bakeTile(img), updatedAt: serverTimestamp() }, { merge: true });
  });
  const dropTile = (d, slot) => setDoc(doc(db, "dungeon_tiles", d.key), { [slot]: deleteField() }, { merge: true }).catch((e) => alert(e.message));
  const idOf = (h) => handDoc(h.key, h.glove);
  const makeHand = async (h) => {
    const img = await askImage({ prompt: handPrompt(h), aspectRatio: "1:1" });
    let image = await dataUrlToTransparentDataUrl(img, 320);
    if (h.kind === "weapon" && !h.two) image = (await dropExtraHand(image)) || image;
    await setDoc(doc(db, "dungeon_tiles", idOf(h)), { image, updatedAt: serverTimestamp() });
  };
  const genHand = (h) => run(`hand:${idOf(h)}`, () => makeHand(h));
  const upHand = (h, file) => run(`hand:${idOf(h)}`, async () => {
    const image = await fitHand(await fileToUrl(file));
    await setDoc(doc(db, "dungeon_tiles", idOf(h)), { image, updatedAt: serverTimestamp() });
  });
  const handsMissing = HANDS.filter((h) => !tiles[idOf(h)]?.image);
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
  const extra = HANDS.filter((h) => h.kind === "weapon" && !h.two && tiles[idOf(h)]?.image);
  const fixExtra = () => run("fix", async () => {
    let fixed = 0;
    for (const h of extra) {
      const out = await dropExtraHand(tiles[idOf(h)].image);
      if (out) { await setDoc(doc(db, "dungeon_tiles", idOf(h)), { image: out, updatedAt: serverTimestamp() }, { merge: true }); fixed++; }
    }
    alert(fixed ? `Ripulite ${fixed} armi.` : "Nessuna mano in più trovata.");
  });
  // le prove di prima, senza guanto: non le usa più nessuno
  const old = Object.keys(tiles).filter((k) => /^hand_[^_].*$/.test(k) && !k.includes("__") && tiles[k]?.image);

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
        <textarea className="admin-field-input" rows={2} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder='Idea per le tessere (facoltativa): es. "mattoni con muschio", "ghiaccio con crepe azzurre"' />
        {dungeons.map((d) => (
          <div key={d.key} className="sga-cw-row">
            <b>{d.icon} {d.name}</b>
            <div className="sga-cw-tiles">
              {SLOTS.map(([slot, label]) => {
                const src = tiles[d.key]?.[slot];
                return (
                  <figure key={slot} className="sga-cw-tile">
                    {src ? <img src={src} alt={`${label} di ${d.name}`} /> : <span>riserva</span>}
                    <figcaption>{label}</figcaption>
                    <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genTile(d, slot)}>{busy === `${d.key}:${slot}` ? "⏳" : "✨ Genera"}</button>
                    {src && <button type="button" className="sga-x" aria-label={`Togli ${label}`} onClick={() => dropTile(d, slot)}>✕</button>}
                  </figure>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sga-card">
        <h3 className="sga-h3">Mani e armi <small>{HANDS.length - handsMissing.length} su {HANDS.length} · viste da chi le impugna</small></h3>
        <p className="sga-hint">Ogni classe ha i suoi guanti. Ogni sprite di un guanto usa la stessa descrizione di quel guanto, così mano sinistra, armi e scudo si somigliano. Le +1 e +2 usano lo sprite dell'arma base, le armi speciali il loro. A sinistra si vede lo scudo solo se l'eroe lo impugna. Da «Carica» puoi mettere un tuo disegno (PNG col fondo trasparente, solo mano e polso: destra in basso a destra, sinistra in basso a sinistra; lo scudo visto da dietro).</p>
        <button type="button" className="adm-btn adm-btn--gold" disabled={!handsMissing.length || !!busy} onClick={genAllHands}>
          {handsDone ? `⏳ ${handsDone}…` : handsMissing.length ? `✨ Genera quelli mancanti (${handsMissing.length})` : "✓ Tutte le mani hanno lo sprite"}
        </button>
        {!!extra.length && <p className="sga-hint">{extra.length} armi a una mano già generate: se hanno una mano in più in basso a sinistra, questo la cancella senza rigenerarle (gratis). <button type="button" className="adm-btn" disabled={!!busy} onClick={fixExtra}>🧽 Togli le mani in più</button></p>}
        {!!old.length && <p className="sga-hint">Ci sono {old.length} prove vecchie senza guanto, che la lotta non usa più. <button type="button" className="adm-btn" onClick={() => old.forEach((k) => setDoc(doc(db, "dungeon_tiles", k), { image: deleteField() }, { merge: true }))}>🗑 Togli le prove vecchie</button></p>}
        {Object.entries(GLOVES).map(([glove, g]) => (
          <div key={glove} className="sga-cw-row">
            <b>{g.icon} {g.name} <small>· {g.classes.map((c) => STORY_CLASSES.find((x) => x.key === c)?.it || c).join(", ")}</small></b>
            <div className="sga-cw-tiles">
              {HANDS.filter((h) => h.glove === glove).map((h) => {
                const id = idOf(h), src = tiles[id]?.image;
                return (
                  <figure key={id} className="sga-cw-tile">
                    {src ? <img src={src} alt={h.name} /> : <span>{h.icon}</span>}
                    <figcaption>{h.name}{h.two ? " · due mani" : ""}{h.special ? " ★" : ""}</figcaption>
                    <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genHand(h)}>{busy === `hand:${id}` ? "⏳" : "✨ Genera"}</button>
                    <label className="adm-btn sga-cw-up">📁 Carica<input type="file" accept="image/png,image/webp" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) upHand(h, file); e.target.value = ""; }} /></label>
                    {src && <button type="button" className="sga-x" aria-label={`Togli ${h.name}`} onClick={() => dropHand(h)}>✕</button>}
                  </figure>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
