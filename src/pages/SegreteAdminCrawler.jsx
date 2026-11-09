/* Admin delle Segrete, piega "Prima persona" (2026-11-07): tutta l'art della vista nuova.
   Anteprima dal vivo · pareti/pavimento/soffitto per dungeon · armi in mano · sprite frontali.
   La vista classica non usa niente di tutto questo: frontImageUrl è un campo a parte. */
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteField, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import ImageTonePicker from "../components/ImageTonePicker";
import { sizeScale } from "../data/segrete";
import { WEAPONS, WEAPON_CHOICES, TWO_HANDED, armorProf, canTwoHand } from "../data/segreteKits";
import { ITEMS, gearUsers } from "../data/segreteItems";
import { dataUrlToTransparentDataUrl } from "../utils/aiSprite";
import { askImage, frontSpriteUrl, refOnMagenta, touchesTop } from "../utils/crawlerGen";
import { CrawlerEngine, CW_H, CW_W } from "../fx/crawlerEngine";
import { GLOVES, bakeTile, gloveOf, handDoc, handEntries, handPrompt, handSpec, armorHandEntries, isRangedHand, materialOf, pairKey, releasedPrompt, tilePrompt, twoHandedFor, weaponEffectsText } from "../fx/crawlerArt";
import { STORY_CLASSES } from "../data/segrete";

const SLOTS = [["wall", "Pareti"], ["floor", "Pavimento"], ["ceil", "Soffitto"]];
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
  const hp = tiles[handDoc(pairKey(wk, off), glove)]?.image || "", he = tiles[handDoc(pairKey(wk, off), glove)]?.empty || "";
  useEffect(() => { eng.current?.setHands(`${wk}:${off}:${glove}:${hp.length}:${he.length}`, { main: wk, off, pairUrl: hp, pairEmptyUrl: he }); }, [cv, fg, wk, off, glove, hp, he]);
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
      <p className="sga-hint">{GLOVES[gloveOf(cls)].name} · {off === "mirror" ? (wk === "pugni" ? "due pugni" : "un pugnale per mano") : off === "shield" ? "scudo a sinistra" : off === "none" ? "arma a due mani" : GLOVES[gloveOf(cls)].focus ? "focus arcano a sinistra" : "mano sinistra semiaperta"}</p>
      <div className="sga-cw-prev">
        <canvas ref={setCv} width={CW_W} height={CW_H} aria-label="Anteprima della stanza in prima persona" />
        <canvas ref={setFg} aria-hidden="true" />
      </div>
      <div className="sga-btns"><button type="button" className="adm-btn" onClick={() => eng.current?.attack(WEAPONS[wk]?.ranged || wk === "arco_lungo" || wk === "balestra_l" ? "arrow" : "slash")}>▶ Prova il colpo</button></div>
      {!foes.length && <p className="sga-hint">Nessun mostro in questo dungeon.</p>}
    </div>
  );
}

export default function CrawlerArtTab({ dungeons, monsters, itemsV = 0 }) {
  // la lista: per ogni guanto la mano sinistra, lo scudo, le armi delle sue classi e le armi speciali
  // (anche quelle create dal Master nella piega Oggetti: si ricalcola quando cambiano)
  const HANDS = useMemo(() => handEntries({ WEAPONS, WEAPON_CHOICES, TWO_HANDED, ITEMS, armorProf, canTwoHand }), [itemsV]); // eslint-disable-line react-hooks/exhaustive-deps
  // armature speciali con un aspetto: le loro mani (maniche e guanti), per ogni arma di chi le porta
  const ARMOR_HANDS = useMemo(() => Object.entries(ITEMS).filter(([, it]) => it.kind === "armor")
    .map(([id, it]) => ({ id, it, entries: armorHandEntries(id, it, { WEAPONS, WEAPON_CHOICES, TWO_HANDED, gearUsers, armorProf, canTwoHand }) })), [itemsV]); // eslint-disable-line react-hooks/exhaustive-deps
  const ALL_HANDS = useMemo(() => [...HANDS, ...ARMOR_HANDS.flatMap((a) => a.entries)], [HANDS, ARMOR_HANDS]);
  const [tiles, setTiles] = useState({});
  const [busy, setBusy] = useState("");
  // idea per le tessere: una per dungeon (prima era una sola per tutti)
  const [ideas, setIdeas] = useState({});
  const [front, setFront] = useState(null); // {done, total, failed}
  const [handsDone, setHandsDone] = useState("");
  const [part, setPart] = useState(() => { try { return localStorage.getItem("sga_cw_part") || "dungeon"; } catch { return "dungeon"; } });
  const pickPart = (k) => { setPart(k); try { localStorage.setItem("sga_cw_part", k); } catch { /* niente */ } };
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
  // armi create nella piega Oggetti: il loro aspetto è già nell'oggetto
  const lookOf = (item) => tiles[`look_${item}`]?.text || ITEMS[item]?.look || "";
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
    // arco e balestra: anche il fotogramma con la freccia già scoccata (per l'animazione del tiro)
    const empty = isRangedHand(h.base) ? await makeEmpty(image, h.base).catch(() => "") : "";
    await setDoc(doc(db, "dungeon_tiles", idOf(h)), { image, ...(empty ? { empty } : { empty: deleteField() }), updatedAt: serverTimestamp() }, { merge: true });
  };
  const makeEmpty = async (image, base) => {
    const img = await askImage({ prompt: releasedPrompt(base), refs: [await refOnMagenta(image)], refMode: "same", aspectRatio: "4:3" });
    return dataUrlToTransparentDataUrl(img, 480);
  };
  const genEmpty = (h) => run(`empty:${idOf(h)}`, async () => {
    const src = tiles[idOf(h)]?.image;
    if (!src) throw new Error("Prima genera lo sprite.");
    const img = await askImage({ prompt: releasedPrompt(h.base), refs: [await refOnMagenta(src)], refMode: "same", aspectRatio: "4:3" });
    await setDoc(doc(db, "dungeon_tiles", idOf(h)), { empty: await dataUrlToTransparentDataUrl(img, 480), updatedAt: serverTimestamp() }, { merge: true });
  });
  const genHand = (h) => run(`hand:${idOf(h)}`, () => makeHand(h));
  const upHand = (h, file) => run(`hand:${idOf(h)}`, async () => {
    const image = await fitHand(await fileToUrl(file));
    await setDoc(doc(db, "dungeon_tiles", idOf(h)), { image, empty: deleteField(), updatedAt: serverTimestamp() }, { merge: true });
  });
  const handsMissing = HANDS.filter((h) => !tiles[idOf(h)]?.image);
  const tile = (h) => {
    const id = idOf(h), src = tiles[id]?.image;
    return (
      <figure key={id} className="sga-cw-tile">
        {src ? <img src={src} alt={h.name} /> : <span>{h.icon}</span>}
        {src && cut[id] && <em className="sga-cw-cut">⚠ tagliata: rigenerala</em>}
        <figcaption>{h.special ? "" : h.name} <small>{h.off === "mirror" ? (h.base === "pugni" ? "due pugni" : "due pugnali") : h.off === "shield" ? "+ scudo" : h.off === "none" ? "a due mani" : GLOVES[h.baseGlove || h.glove]?.focus ? "+ focus arcano" : "+ mano libera"}</small></figcaption>
        <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genHand(h)}>{busy === `hand:${id}` ? "⏳" : src ? "✨ Rigenera" : "✨ Genera sprite"}</button>
        <label className="adm-btn sga-cw-up">📁 Carica<input type="file" accept="image/png,image/webp" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) upHand(h, file); e.target.value = ""; }} /></label>
        {src && isRangedHand(h.base) && (
          <div className="sga-cw-empty">
            {tiles[id]?.empty ? <img src={tiles[id].empty} alt={`${h.name} dopo il tiro`} /> : <small>manca il fotogramma «scoccato»: senza, la freccia resta sull'arco</small>}
            <button type="button" className="adm-btn" disabled={!!busy} onClick={() => genEmpty(h)}>{busy === `empty:${id}` ? "⏳" : tiles[id]?.empty ? "🏹 Rifai «scoccato»" : "🏹 Genera «scoccato»"}</button>
          </div>
        )}
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
  const genArmorHands = (a) => {
    const todo = a.entries.filter((h) => !tiles[idOf(h)]?.image);
    if (!todo.length || !window.confirm(`Generare ${todo.length} sprite delle mani con «${a.it.name}»? Circa 3 centesimi l'uno di credito Gemini.`)) return;
    run(`armor:${a.id}`, async () => {
      let failed = 0;
      for (let i = 0; i < todo.length; i++) { setHandsDone(`${i}/${todo.length}`); try { await makeHand(todo[i]); } catch { failed++; } }
      setHandsDone("");
      if (failed) alert(`${failed} sprite non generati: riprova con lo stesso tasto.`);
    });
  };
  const dropHand = (h) => setDoc(doc(db, "dungeon_tiles", idOf(h)), { image: deleteField() }, { merge: true }).catch((e) => alert(e.message));
  // armi già salvate tagliate in alto: avviso sulla miniatura
  const [cut, setCut] = useState({});
  useEffect(() => {
    let live = true;
    ALL_HANDS.forEach((h) => {
      const src = tiles[idOf(h)]?.image;
      if (!src) return;
      touchesTop(src).then((v) => { if (live) setCut((m) => (m[idOf(h)] === v ? m : { ...m, [idOf(h)]: v })); }).catch(() => {});
    });
    return () => { live = false; };
  }, [tiles, ALL_HANDS]); // eslint-disable-line react-hooks/exhaustive-deps
  // le prove di prima, senza guanto: non le usa più nessuno
  const ids = new Set(ALL_HANDS.map(idOf));
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

  const tilesDone = dungeons.reduce((n, d) => n + SLOTS.filter(([sl]) => tiles[d.key]?.[sl]).length, 0);
  const PARTS = [
    ["dungeon", "🧱 Dungeon", `${tilesDone}/${dungeons.length * SLOTS.length}`],
    ["armi", "🗡 Armi e mani", `${HANDS.length - handsMissing.length}/${HANDS.length}`],
    ["mostri", "👹 Mostri di fronte", `${monsters.length - missing.length}/${monsters.length}`],
    ["prova", "👁 Anteprima", ""],
  ];
  return (
    <div className="sga-cw">
      <p className="sga-hint">L'art della vista in prima persona. Finché un pezzo manca si usa la riserva disegnata dal codice.</p>
      {/* SOTTO-SCHEDE (2026-11-08): prima dungeon, armi e mostri erano un'unica pagina lunghissima */}
      <div className="sga-subtabs">
        {PARTS.map(([k, l, n]) => (
          <button key={k} type="button" aria-pressed={part === k} className={part === k ? "is-on" : ""} onClick={() => pickPart(k)}>
            {l}{n && <small>{n}</small>}
          </button>
        ))}
      </div>
      {part !== "prova" && <ImageTonePicker />}
      {part === "prova" && <Preview dungeons={dungeons} monsters={monsters} tiles={tiles} />}

      {part === "mostri" && <div className="sga-card">
        <h3 className="sga-h3">Sprite frontali <small>{monsters.length - missing.length} su {monsters.length}</small></h3>
        <p className="sga-hint">I mostri ora si guardano in faccia: serve uno sprite di fronte. L'IA parte dallo sprite che hai già, così resta lo stesso mostro. Si possono fare uno per uno nella scheda del mostro.</p>
        <button type="button" className="adm-btn adm-btn--gold" disabled={!missing.length || !!front} onClick={genFronts}>
          {front ? `⏳ ${front.done}/${front.total}…` : missing.length ? `✨ Genera i frontali mancanti (${missing.length})` : "✓ Tutti i mostri hanno il frontale"}
        </button>
        <div className="sga-cw-fronts">
          {monsters.map((m) => (
            <figure key={m.id} className={`sga-cw-front${m.frontImageUrl ? "" : " is-missing"}`}>
              {m.frontImageUrl ? <img src={m.frontImageUrl} alt={m.name} /> : <span>{m.icon || "👹"}</span>}
              <figcaption>{m.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>}

      {part === "dungeon" && <div className="sga-card">
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
      </div>}

      {part === "armi" && <div className="sga-card">
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
            <details key={glove} className="sga-cw-glove">
              <summary><b>{g.icon} {g.name}</b> <small>{g.classes.map((c) => STORY_CLASSES.find((x) => x.key === c)?.it || c).join(", ")} · {all.filter((h) => tiles[idOf(h)]?.image).length}/{all.length}</small></summary>
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
            </details>
          );
        })}
        <h3 className="sga-h3">Armature speciali <small>maniche e guanti in prima persona</small></h3>
        <p className="sga-hint">Un'armatura con il suo aspetto (piega «⚔ Oggetti») cambia avambracci e guanti di chi la indossa: per ogni arma delle classi che la possono portare serve il suo sprite. Finché manca si vedono i guanti normali della classe.</p>
        {ARMOR_HANDS.map((a) => {
          if (!a.entries.length) return a.it.custom ? <p key={a.id} className="sga-hint">{a.it.icon} <b>{a.it.name}</b>: manca l'aspetto (maniche e guanti), scrivilo nella piega «⚔ Oggetti».</p> : null;
          const done = a.entries.filter((h) => tiles[idOf(h)]?.image).length;
          return (
            <details key={a.id} className="sga-cw-glove">
              <summary><b>{a.it.icon} {a.it.name}</b> <small>{gearUsers(a.it).map((c) => STORY_CLASSES.find((x) => x.key === c)?.it || c).join(", ")} · {done}/{a.entries.length}</small></summary>
              <p className="sga-hint">{a.it.look}</p>
              <button type="button" className="adm-btn adm-btn--gold" disabled={!!busy || done === a.entries.length} onClick={() => genArmorHands(a)}>
                {busy === `armor:${a.id}` ? `⏳ ${handsDone}…` : done < a.entries.length ? `✨ Genera quelli mancanti (${a.entries.length - done})` : "✓ Tutti fatti"}
              </button>
              <div className="sga-cw-tiles">{a.entries.map(tile)}</div>
            </details>
          );
        })}
      </div>}
    </div>
  );
}
