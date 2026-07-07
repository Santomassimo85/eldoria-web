import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { isHiddenChar } from "../data/hiddenPlayers";
import "./admin.css";
import "./WorldBossAdmin.css";

import { isDmUser } from "../utils/dmAccess";

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

  if (!currentUser || !isDmUser(currentUser.email)) {
    return <div className="denied">Accesso Negato.</div>;
  }

  return (
    <section className="adm" style={{ "--cine-accent": "#7a2e1a", "--cine-accent-2": "#b8362a" }}>
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
              {battleBg && <button className="adm-btn adm-btn--danger wbs-mini-btn" onClick={removeBattleBg}>✖ Rimuovi</button>}
            </div>
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
                    <button className="adm-btn adm-btn--ghost wbs-mini-btn" onClick={() => minionFileRefs.current[m.id]?.click()}>📁</button>
                  </div>
                  <div className="wbs-slot">
                    <span className="wbs-slot-label">Morto</span>
                    {m.deadSpriteUrl
                      ? <img src={m.deadSpriteUrl} alt="" className="wbs-sprite wbs-sprite--mini" style={{ filter: "grayscale(0.5)" }} />
                      : <div className="wbs-sprite-ph" style={{ height: 70 }}>💀</div>}
                    <input ref={(el) => { minionDeadFileRefs.current[m.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => loadMinionSprite(e.target.files[0], m.id, "deadSpriteUrl")} />
                    <button className="adm-btn adm-btn--ghost wbs-mini-btn" onClick={() => minionDeadFileRefs.current[m.id]?.click()}>💀</button>
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
        <div className="wbs-grid">
          {characters.map((char) => (
            <div key={char.id} className="wbs-card">
              <div className="wbs-card-head">
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
