import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { isHiddenChar } from "../data/hiddenPlayers";
import { dataUrlToTransparentDataUrl } from "../utils/aiSprite";
import "./admin.css";
import "./WorldBossAdmin.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// Avatar del PG → data URL ridotto (max 640px, jpeg): è il riferimento visivo che
// passiamo a Gemini così lo sprite somiglia davvero al personaggio.
async function avatarToDataUrl(url) {
  if (/^data:/i.test(url)) return url;
  const resp = await fetch(url);
  const blob = await resp.blob();
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  return cv.toDataURL("image/jpeg", 0.85);
}

// Prompt dello sprite pixel-art dell'eroe (stesso stile di boss e minion in
// WorldBossAdmin): soggetto SOLO su fondo magenta uniforme, che poi togliamo lato
// client con il chroma key. L'avatar allegato dice all'IA com'è fatto il PG.
const heroSpritePrompt = (char, dead) => {
  const who = [char.name, char.race, char.class].filter(Boolean).join(", ");
  return `Pixel art sprite of a single fantasy RPG hero for a tactical RPG game, drawn from the attached reference portrait.
Subject: ${who || "fantasy hero"}. Reproduce faithfully the appearance in the reference: face, hair, skin, colours, clothing/armour style and any distinctive detail. Same character, same outfit.
${dead
    ? "Pose: DEFEATED — the hero lies collapsed on the ground beside a small stone gravestone (tomb), eyes closed, weapon dropped. Muted, sombre colours."
    : "Pose: a SINGLE idle standing pose, full body from head to feet, three-quarter view facing the viewer, relaxed and ready."}
Style: crisp 16-bit pixel art, limited palette, clean hard outlines, NO anti-aliasing, NO blur.
CRITICAL: render the subject ALONE and centered on a SOLID UNIFORM background of pure magenta (#FF00FF, RGB 255,0,255). The background MUST be one flat magenta color — no gradient, no ground shadow, no scenery, no props. No text, no frame, no border. Only the subject on flat magenta.`;
};

// Specchia un'immagine (data URL o URL) sull'asse verticale, pixel per pixel
// (niente smoothing: la pixel art resta nitida). Restituisce un data URL PNG.
const mirrorDataUrl = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  if (!/^data:/.test(src)) img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    try { resolve(canvas.toDataURL("image/png")); } catch (e) { reject(e); }
  };
  img.onerror = () => reject(new Error("immagine non leggibile"));
  img.src = src;
});

export default function PlayerSpritesAdmin() {
  const { currentUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [battleBg, setBattleBg] = useState(null);
  const [arenaBg, setArenaBg] = useState(null);
  const bgInputRef = useRef(null);
  const arenaBgInputRef = useRef(null);
  const fileRefs     = useRef({});
  const deadFileRefs = useRef({});
  const [minions, setMinions] = useState([]);
  const minionFileRefs     = useRef({});
  const minionDeadFileRefs = useRef({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      setCharacters(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => c.name && !isHiddenChar(c))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      );
    });
    return () => unsub();
  }, []);

  // Minion template library (reuses the open `player_sprites` collection).
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "player_sprites"), (snap) => {
      setMinions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const addMinion = () =>
    addDoc(collection(db, "player_sprites"), {
      name: "Nuovo nemico", hp: 12, ac: 11, dex: 1,
      atkName: "Attacco", atkDice: "1d6", atkBonus: 2, atkRange: 1,
    });
  const patchMinion = (id, patch) => updateDoc(doc(db, "player_sprites", id), patch);
  const removeMinion = (id) => deleteDoc(doc(db, "player_sprites", id));

  // Compress an image and store it on a minion template doc (field = spriteUrl/deadSpriteUrl).
  const loadMinionSprite = (file, id, field) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const MAX_PX = 256;
        const scale = img.width > MAX_PX ? MAX_PX / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        await updateDoc(doc(db, "player_sprites", id), { [field]: canvas.toDataURL("image/png") });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    getDoc(doc(db, "battle_meta", "turn_tracker")).then((snap) => {
      if (snap.exists()) setBattleBg(snap.data().battleBg || null);
    });
    getDoc(doc(db, "arena_meta", "global")).then((snap) => {
      if (snap.exists()) setArenaBg(snap.data().battleBg || null);
    });
  }, []);

  const loadSprite = (file, charId) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        // Keep pixel art at native size up to 256px, use PNG to preserve sharp pixels
        const MAX_PX = 256;
        const scale = img.width > MAX_PX ? MAX_PX / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/png");
        await updateDoc(doc(db, "characters", charId), { spriteUrl: compressed });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ⇆ Gira: specchia lo sprite (sinistra ↔ destra) e lo risalva al suo posto.
  // Si gira l'IMMAGINE, non un'impostazione: vale ovunque lo sprite si usi.
  const [flipBusy, setFlipBusy] = useState({});
  const flipSprite = async (col, id, field, src) => {
    const key = `${id}:${field}`;
    if (!src || flipBusy[key]) return;
    setFlipBusy((b) => ({ ...b, [key]: true }));
    try {
      const flipped = await mirrorDataUrl(src);
      await updateDoc(doc(db, col, id), { [field]: flipped });
    } catch (e) {
      alert("Non riesco a girare lo sprite: " + (e.message || e));
    } finally {
      setFlipBusy((b) => ({ ...b, [key]: false }));
    }
  };
  const FlipBtn = ({ col, id, field, src }) => src ? (
    <button className="adm-btn adm-btn--ghost wbs-mini-btn" disabled={!!flipBusy[`${id}:${field}`]}
      title="Specchia lo sprite: se guarda a destra lo fa guardare a sinistra, e viceversa"
      onClick={() => flipSprite(col, id, field, src)}>{flipBusy[`${id}:${field}`] ? "⏳" : "⇆ Gira"}</button>
  ) : null;

  const removeSprite = async (charId) => {
    await updateDoc(doc(db, "characters", charId), { spriteUrl: "" });
  };

  const loadDeadSprite = (file, charId) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const MAX_PX = 256;
        const scale = img.width > MAX_PX ? MAX_PX / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        await updateDoc(doc(db, "characters", charId), { deadSpriteUrl: canvas.toDataURL("image/png") });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeDeadSprite = async (charId) => {
    await updateDoc(doc(db, "characters", charId), { deadSpriteUrl: "" });
  };

  // ── Sprite dall'avatar con Gemini ──
  // Una richiesta per volta per slot (`genBusy["<id>:vivo"]`). Il PNG trasparente
  // finisce nel doc del PG come un caricamento a mano (data URL ≤ 256px).
  const [genBusy, setGenBusy] = useState({});
  const generateHeroSprite = async (char, dead) => {
    const key = `${char.id}:${dead ? "morto" : "vivo"}`;
    if (genBusy[key]) return;
    if (!char.image) { alert(`${char.name} non ha un avatar: caricalo dalla scheda PG, poi riprova.`); return; }
    const field = dead ? "deadSpriteUrl" : "spriteUrl";
    if (char[field] && !window.confirm(`Sostituire lo sprite ${dead ? "da morto" : "vivo"} di ${char.name} con uno generato dall'avatar?`)) return;
    setGenBusy((s) => ({ ...s, [key]: true }));
    try {
      const ref = await avatarToDataUrl(char.image);
      const r = await fetch("/api/genera-immagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: heroSpritePrompt(char, dead),
          refs: [ref],
          characters: [{ name: char.name, race: char.race, class: char.class }],
        }),
      });
      const data = await r.json();
      if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
      const png = await dataUrlToTransparentDataUrl(data.immagine, 256);
      await updateDoc(doc(db, "characters", char.id), { [field]: png });
    } catch (e) {
      alert("Generazione sprite fallita: " + (e.message || e));
    } finally {
      setGenBusy((s) => ({ ...s, [key]: false }));
    }
  };

  const loadBattleBg = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const MAX_W = 1280;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.72);
        await setDoc(doc(db, "battle_meta", "turn_tracker"), { battleBg: compressed }, { merge: true });
        setBattleBg(compressed);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ── Sfondo del World Boss con l'IA (2026-10-03) ──
  // Parte dal boss ATTIVO (nome + descrizione) e da un'idea facoltativa del
  // Master; Gemini lo disegna in 16:9 e pixel art, con il terreno libero in
  // basso (lì stanno boss ed eroi). Salvato come un caricamento a mano.
  const [activeBoss, setActiveBoss] = useState(null);
  useEffect(() => onSnapshot(collection(db, "bosses"), (snap) => {
    const b = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((x) => x.isActive);
    setActiveBoss(b || null);
  }), []);
  const [bgIdea, setBgIdea] = useState("");
  const [bgBusy, setBgBusy] = useState(false);
  const generateBattleBg = async () => {
    if (bgBusy) return;
    if (!activeBoss && !bgIdea.trim()) { alert("Nessun boss attivo: scrivi tu che luogo disegnare, oppure risveglia un boss in DM Admin → World Boss."); return; }
    if (battleBg && !window.confirm("Sostituire lo sfondo attuale del World Boss con uno generato dall'IA?")) return;
    setBgBusy(true);
    try {
      const desc = String(activeBoss?.description || "").replace(/\s+/g, " ").slice(0, 600);
      const prompt = `Wide 16:9 background scene for a turn-based fantasy RPG boss battle, detailed 16-bit pixel art, cinematic lighting, dark and atmospheric.
${activeBoss ? `This is the lair / battlefield of the boss "${activeBoss.name}".${desc ? ` About the boss: ${desc}` : ""}` : ""}
${bgIdea.trim() ? `Setting requested by the game master (follow it closely): ${bgIdea.trim()}` : "Invent a fitting, memorable place that matches the boss's nature and powers."}
Composition: open, mostly flat ground across the lower third (the boss will stand on the left and the heroes on the right, drawn on top of this image), the scenery and points of interest in the upper two thirds.
EMPTY SCENE: no characters, no creatures, no monsters, no people, no text, no UI, no frame, no border.`;
      const r = await fetch("/api/genera-immagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, aspectRatio: "16:9" }),
      });
      const data = await r.json();
      if (!r.ok || data.error || !data.immagine) throw new Error(data.error || "Nessuna immagine ricevuta.");
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("immagine non leggibile")); i.src = data.immagine; });
      const MAX_W = 1280;
      const scale = img.width > MAX_W ? MAX_W / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL("image/jpeg", 0.72);
      await setDoc(doc(db, "battle_meta", "turn_tracker"), { battleBg: compressed }, { merge: true });
      setBattleBg(compressed);
    } catch (e) {
      alert("Generazione sfondo fallita: " + (e.message || e));
    } finally {
      setBgBusy(false);
    }
  };

  const removeBattleBg = async () => {
    await setDoc(doc(db, "battle_meta", "turn_tracker"), { battleBg: "" }, { merge: true });
    setBattleBg(null);
  };

  const loadArenaBg = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const MAX_W = 1280;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.72);
        await setDoc(doc(db, "arena_meta", "global"), { battleBg: compressed }, { merge: true });
        setArenaBg(compressed);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeArenaBg = async () => {
    await setDoc(doc(db, "arena_meta", "global"), { battleBg: "" }, { merge: true });
    setArenaBg(null);
  };

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied">Accesso Negato.</div>;
  }

  return (
    <section className="adm" style={{ "--cine-accent": "#f87171", "--cine-accent-2": "#fb923c" }}>
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">🧝 Armeria degli Sprite</span>
          <h1 className="adm-title">Sprite Personaggi</h1>
          <p className="adm-sub">Sprite di eroi e nemici minori, e sfondi delle arene del Boss Fight.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Eroi</span><strong>{characters.length}</strong></div>
          <div className="adm-stat"><span>Minion</span><strong>{minions.length}</strong></div>
        </div>
      </div>

      {/* ── Sfondi ── */}
      <div className="adm-panel" style={{ marginBottom: 18 }}>
        <div className="adm-panel-head"><h2 className="adm-panel-title">🌄 Sfondi di battaglia</h2></div>
        <div className="wbs-bg-grid">
          {/* Battle BG */}
          <div>
            <label className="adm-label" style={{ display: "block", marginBottom: 8 }}>Sfondo Battaglia (World Boss)</label>
            {battleBg
              ? <img src={battleBg} alt="Battle background" className="wbs-bg-preview" />
              : <div className="wbs-bg-empty">🌄</div>}
            <input ref={bgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadBattleBg(e.target.files[0])} />
            <div className="adm-btn-row">
              <button className="adm-btn adm-btn--gold wbs-mini-btn" onClick={() => bgInputRef.current?.click()}>📁 {battleBg ? "Cambia" : "Carica"}</button>
              <button className="adm-btn wbs-mini-btn wbs-ai-btn" disabled={bgBusy} onClick={generateBattleBg}
                title="Gemini disegna lo sfondo partendo dal boss attivo e dalla tua idea">{bgBusy ? "⏳ Disegno…" : "✨ Genera con l'IA"}</button>
              {battleBg && <button className="adm-btn adm-btn--danger wbs-mini-btn" onClick={removeBattleBg}>✖ Rimuovi</button>}
            </div>
            <textarea className="wbs-in wbs-bg-idea" rows={2} value={bgIdea} onChange={(e) => setBgIdea(e.target.value)}
              placeholder={activeBoss ? `Idea (facoltativa) per la tana di ${activeBoss.name}: es. "cripta allagata, luce di torce verdi"` : "Nessun boss attivo: scrivi tu il luogo da disegnare"} />
            <small className="wb-ai-hint">{activeBoss ? <>Parte da <strong>{activeBoss.name}</strong> (boss attivo) e dalla tua idea. </> : null}Esce panoramico, in pixel art, col terreno libero in basso per boss ed eroi.</small>
          </div>
          {/* Arena BG */}
          <div>
            <label className="adm-label" style={{ display: "block", marginBottom: 8 }}>Sfondo Arena (PvP)</label>
            {arenaBg
              ? <img src={arenaBg} alt="Arena background" className="wbs-bg-preview" />
              : <div className="wbs-bg-empty">⚔️</div>}
            <input ref={arenaBgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => loadArenaBg(e.target.files[0])} />
            <div className="adm-btn-row">
              <button className="adm-btn adm-btn--gold wbs-mini-btn" onClick={() => arenaBgInputRef.current?.click()}>📁 {arenaBg ? "Cambia" : "Carica"}</button>
              {arenaBg && <button className="adm-btn adm-btn--danger wbs-mini-btn" onClick={removeArenaBg}>✖ Rimuovi</button>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Minion ── */}
      <div className="adm-panel" style={{ marginBottom: 18 }}>
        <div className="adm-panel-head">
          <h2 className="adm-panel-title">👹 Nemici minori <span style={{ opacity: .6, fontWeight: 400 }}>({minions.length})</span></h2>
          <button className="adm-btn adm-btn--primary wbs-mini-btn" onClick={addMinion}>＋ Nuovo minion</button>
        </div>
        <p className="adm-sub" style={{ margin: "0 0 14px" }}>Sprite e statistiche dei nemici minori da piazzare nel Boss Fight tattico.</p>
        {minions.length === 0 ? (
          <p className="adm-empty">Nessun minion. Aggiungine uno.</p>
        ) : (
          <div className="wbs-grid">
            {minions.map((m) => (
              <div key={m.id} className="wbs-card">
                <div className="wbs-slots">
                  <div className="wbs-slot">
                    <span className="wbs-slot-label">Vivo</span>
                    {m.spriteUrl
                      ? <img src={m.spriteUrl} alt={m.name} className="wbs-sprite wbs-sprite--mini" />
                      : <div className="wbs-sprite-ph" style={{ height: 70 }}>👹</div>}
                    <input ref={(el) => { minionFileRefs.current[m.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => loadMinionSprite(e.target.files[0], m.id, "spriteUrl")} />
                    <div className="adm-btn-row">
                      <button className="adm-btn adm-btn--ghost wbs-mini-btn" onClick={() => minionFileRefs.current[m.id]?.click()}>📁</button>
                      <FlipBtn col="player_sprites" id={m.id} field="spriteUrl" src={m.spriteUrl} />
                    </div>
                  </div>
                  <div className="wbs-slot">
                    <span className="wbs-slot-label">Morto</span>
                    {m.deadSpriteUrl
                      ? <img src={m.deadSpriteUrl} alt="" className="wbs-sprite wbs-sprite--mini" style={{ filter: "grayscale(0.5)" }} />
                      : <div className="wbs-sprite-ph" style={{ height: 70 }}>💀</div>}
                    <input ref={(el) => { minionDeadFileRefs.current[m.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => loadMinionSprite(e.target.files[0], m.id, "deadSpriteUrl")} />
                    <div className="adm-btn-row">
                      <button className="adm-btn adm-btn--ghost wbs-mini-btn" onClick={() => minionDeadFileRefs.current[m.id]?.click()}>💀</button>
                      <FlipBtn col="player_sprites" id={m.id} field="deadSpriteUrl" src={m.deadSpriteUrl} />
                    </div>
                  </div>
                </div>
                <input className="wbs-in wbs-name" value={m.name || ""} onChange={(e) => patchMinion(m.id, { name: e.target.value })} placeholder="Nome" />
                <div className="wbs-fields">
                  <label>HP<input className="wbs-in" type="number" value={m.hp ?? 12} onChange={(e) => patchMinion(m.id, { hp: +e.target.value })} /></label>
                  <label>CA<input className="wbs-in" type="number" value={m.ac ?? 11} onChange={(e) => patchMinion(m.id, { ac: +e.target.value })} /></label>
                  <label>DEX<input className="wbs-in" type="number" value={m.dex ?? 1} onChange={(e) => patchMinion(m.id, { dex: +e.target.value })} /></label>
                </div>
                <div className="wbs-fields2">
                  <label>Att.<input className="wbs-in" value={m.atkName || "Attacco"} onChange={(e) => patchMinion(m.id, { atkName: e.target.value })} /></label>
                  <label>Dadi<input className="wbs-in" value={m.atkDice || "1d6"} onChange={(e) => patchMinion(m.id, { atkDice: e.target.value })} /></label>
                  <label>+colpire<input className="wbs-in" type="number" value={m.atkBonus ?? 2} onChange={(e) => patchMinion(m.id, { atkBonus: +e.target.value })} /></label>
                  <label>Gittata<input className="wbs-in" type="number" value={m.atkRange ?? 1} onChange={(e) => patchMinion(m.id, { atkRange: +e.target.value })} /></label>
                </div>
                <button className="adm-btn adm-btn--danger wbs-mini-btn" style={{ marginTop: 10, width: "100%" }} onClick={() => removeMinion(m.id)}>✖ Elimina</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sprite eroi ── */}
      <div className="adm-panel">
        <div className="adm-panel-head"><h2 className="adm-panel-title">🧍 Sprite degli eroi</h2></div>
        <small className="wb-ai-hint">✨ <strong>Genera</strong> = Gemini disegna lo sprite pixel-art partendo dall'<strong>avatar</strong> del PG (fondo rimosso, come boss e minion). Serve un avatar sulla scheda. <strong>⇆ Gira</strong> = specchia lo sprite: nel fight gli eroi stanno a destra, quindi devono guardare a <strong>sinistra</strong>, verso il boss (l'anteprima qui è identica alla battaglia).</small>
        <div className="wbs-grid">
          {characters.map((char) => (
            <div key={char.id} className="wbs-card">
              <div className="wbs-card-head">
                {char.image
                  ? <img src={char.image} alt="" className="wbs-avatar" title="Avatar usato come riferimento" />
                  : <span className="wbs-avatar wbs-avatar--none" title="Nessun avatar">?</span>}
                <h3 className="wbs-card-name">{char.name}</h3>
                <span className="wbs-card-tag">{char.class || "—"}</span>
              </div>
              <div className="wbs-slots">
                {/* Vivo */}
                <div className="wbs-slot">
                  <span className="wbs-slot-label">Vivo</span>
                  {char.spriteUrl
                    ? <img src={char.spriteUrl} alt={char.name} className="wbs-sprite" />
                    : <div className="wbs-sprite-ph">🧍</div>}
                  <input ref={(el) => { fileRefs.current[char.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => loadSprite(e.target.files[0], char.id)} />
                  <div className="adm-btn-row">
                    <button className="adm-btn adm-btn--gold wbs-mini-btn" onClick={() => fileRefs.current[char.id]?.click()}>📁 {char.spriteUrl ? "Cambia" : "Carica"}</button>
                    <button className="adm-btn wbs-mini-btn wbs-ai-btn" disabled={!!genBusy[`${char.id}:vivo`] || !char.image}
                      title={char.image ? "Genera lo sprite dall'avatar con Gemini" : "Serve un avatar sulla scheda PG"}
                      onClick={() => generateHeroSprite(char, false)}>{genBusy[`${char.id}:vivo`] ? "⏳ Disegno…" : "✨ Genera"}</button>
                    <FlipBtn col="characters" id={char.id} field="spriteUrl" src={char.spriteUrl} />
                    {char.spriteUrl && <button className="adm-btn adm-btn--danger wbs-mini-btn" onClick={() => removeSprite(char.id)}>✖</button>}
                  </div>
                </div>
                {/* Morto */}
                <div className="wbs-slot">
                  <span className="wbs-slot-label">Morto</span>
                  {char.deadSpriteUrl
                    ? <img src={char.deadSpriteUrl} alt={`${char.name} dead`} className="wbs-sprite" style={{ filter: "grayscale(0.5)" }} />
                    : <div className="wbs-sprite-ph">💀</div>}
                  <input ref={(el) => { deadFileRefs.current[char.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => loadDeadSprite(e.target.files[0], char.id)} />
                  <div className="adm-btn-row">
                    <button className="adm-btn adm-btn--gold wbs-mini-btn" onClick={() => deadFileRefs.current[char.id]?.click()}>💀 {char.deadSpriteUrl ? "Cambia" : "Carica"}</button>
                    <button className="adm-btn wbs-mini-btn wbs-ai-btn" disabled={!!genBusy[`${char.id}:morto`] || !char.image}
                      title={char.image ? "Genera la tomba dall'avatar con Gemini" : "Serve un avatar sulla scheda PG"}
                      onClick={() => generateHeroSprite(char, true)}>{genBusy[`${char.id}:morto`] ? "⏳ Disegno…" : "✨ Genera"}</button>
                    <FlipBtn col="characters" id={char.id} field="deadSpriteUrl" src={char.deadSpriteUrl} />
                    {char.deadSpriteUrl && <button className="adm-btn adm-btn--danger wbs-mini-btn" onClick={() => removeDeadSprite(char.id)}>✖</button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
