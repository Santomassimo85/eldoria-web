/* Admin delle Segrete, piega "Prima persona" (2026-11-07): tutta l'art della vista nuova.
   Anteprima dal vivo · pareti/pavimento/soffitto per dungeon · armi in mano · sprite frontali.
   La vista classica non usa niente di tutto questo: frontImageUrl è un campo a parte. */
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteField, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import ImageTonePicker from "../components/ImageTonePicker";
import { sizeScale } from "../data/segrete";
import { WEAPONS, TWO_HANDED } from "../data/segreteKits";
import { dataUrlToTransparentDataUrl } from "../utils/aiSprite";
import { askImage, frontSpriteUrl } from "../utils/crawlerGen";
import { CrawlerEngine, CW_H, CW_W } from "../fx/crawlerEngine";
import { bakeTile, handPrompt, tilePrompt } from "../fx/crawlerArt";

const SLOTS = [["wall", "Pareti"], ["floor", "Pavimento"], ["ceil", "Soffitto"]];
const HANDS = [...Object.entries(WEAPONS).map(([k, w]) => ({ key: k, name: w.name, icon: w.icon })), { key: "shield", name: "Scudo", icon: "🛡" }, { key: "magic", name: "Mano da incantatore", icon: "✋" }];

function Preview({ dungeons, monsters, tiles }) {
  const [cv, setCv] = useState(null);
  const eng = useRef(null);
  const [key, setKey] = useState("segrete");
  const [weapon, setWeapon] = useState("spada_lunga");
  useEffect(() => {
    if (!cv) return undefined;
    const e = new CrawlerEngine(cv); eng.current = e;
    return () => { e.destroy(); eng.current = null; };
  }, [cv]);
  const foes = useMemo(() => {
    const own = monsters.filter((m) => (m.dungeons || []).includes(key));
    const boss = own.find((m) => m.role === "boss");
    return [...own.filter((m) => m.role !== "boss").slice(0, boss ? 2 : 5), ...(boss ? [boss] : [])]
      .map((m, i) => ({ id: `p${i}`, hp: 10, maxHp: 10, role: m.role, icon: m.icon, img: m.frontImageUrl || m.imageUrl || "", scale: sizeScale(m) }));
  }, [monsters, key]);
  const t = tiles[key];
  useEffect(() => { eng.current?.setTheme(key, t); }, [cv, key, t]);
  useEffect(() => { eng.current?.setFoes(foes); }, [cv, foes]);
  const hw = tiles[`hand_${weapon}`]?.image || "", two = TWO_HANDED.has(weapon), off = two ? "none" : "shield", ho = two ? "" : tiles.hand_shield?.image || "";
  useEffect(() => { eng.current?.setHands(`${weapon}:${off}:${hw.length}:${ho.length}`, { main: weapon, off, mainUrl: hw, offUrl: ho }); }, [cv, weapon, off, hw, ho]);
  return (
    <div className="sga-card">
      <h3 className="sga-h3">Anteprima <small>come la vede il giocatore, con l'art salvata</small></h3>
      <div className="sga-row">
        <label className="sga-field sga-field--s"><span>Dungeon</span>
          <select className="admin-field-input" value={key} onChange={(e) => setKey(e.target.value)}>{dungeons.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}</select></label>
        <label className="sga-field sga-field--s"><span>Arma</span>
          <select className="admin-field-input" value={weapon} onChange={(e) => setWeapon(e.target.value)}>{Object.entries(WEAPONS).map(([k, w]) => <option key={k} value={k}>{w.name}</option>)}</select></label>
      </div>
      <canvas ref={setCv} width={CW_W} height={CW_H} className="sga-cw-prev" aria-label="Anteprima della stanza in prima persona" />
      {!foes.length && <p className="sga-hint">Nessun mostro in questo dungeon.</p>}
    </div>
  );
}

export default function CrawlerArtTab({ dungeons, monsters }) {
  const [tiles, setTiles] = useState({});
  const [busy, setBusy] = useState("");
  const [idea, setIdea] = useState("");
  const [front, setFront] = useState(null); // {done, total, failed}
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
  const genHand = (h) => run(`hand:${h.key}`, async () => {
    const img = await askImage({ prompt: handPrompt(h.key, h.name), aspectRatio: "1:1" });
    await setDoc(doc(db, "dungeon_tiles", `hand_${h.key}`), { image: await dataUrlToTransparentDataUrl(img, 256), updatedAt: serverTimestamp() });
  });
  const dropHand = (h) => setDoc(doc(db, "dungeon_tiles", `hand_${h.key}`), { image: deleteField() }, { merge: true }).catch((e) => alert(e.message));

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
        <h3 className="sga-h3">Armi in mano <small>viste da chi le impugna</small></h3>
        <div className="sga-cw-tiles">
          {HANDS.map((h) => {
            const src = tiles[`hand_${h.key}`]?.image;
            return (
              <figure key={h.key} className="sga-cw-tile">
                {src ? <img src={src} alt={h.name} /> : <span>{h.icon}</span>}
                <figcaption>{h.name}</figcaption>
                <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genHand(h)}>{busy === `hand:${h.key}` ? "⏳" : "✨ Genera"}</button>
                {src && <button type="button" className="sga-x" aria-label={`Togli ${h.name}`} onClick={() => dropHand(h)}>✕</button>}
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
