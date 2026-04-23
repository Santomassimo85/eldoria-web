import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import "./admin.css";
import "./WorldBossAdmin.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

export default function PlayerSpritesAdmin() {
  const { currentUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [battleBg, setBattleBg] = useState(null);
  const [arenaBg, setArenaBg] = useState(null);
  const bgInputRef = useRef(null);
  const arenaBgInputRef = useRef(null);
  const fileRefs     = useRef({});
  const deadFileRefs = useRef({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      setCharacters(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => c.name)
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      );
    });
    return () => unsub();
  }, []);

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

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <div className="denied">Accesso Negato.</div>;
  }

  return (
    <div className="wb-admin-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>
      <h1 className="admin-page-title">Sprite Personaggi</h1>
      <div className="admin-divider"><span className="admin-divider-icon">🧝</span></div>

      {/* ── Battle Background (World Boss) ── */}
      <div className="boss-card" style={{ maxWidth: 520, margin: "0 auto 32px", padding: "16px 20px" }}>
        <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, marginBottom: 10 }}>
          Sfondo Battaglia (World Boss)
        </h3>
        {battleBg ? (
          <img
            src={battleBg}
            alt="Battle background"
            style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block", marginBottom: 10, border: "2px solid var(--gold)" }}
          />
        ) : (
          <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 28, marginBottom: 10 }}>🌄</div>
        )}
        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => loadBattleBg(e.target.files[0])}
        />
        <div className="boss-actions-admin">
          <button className="btn-edit" onClick={() => bgInputRef.current?.click()}>
            📁 {battleBg ? "Cambia" : "Carica"} Sfondo
          </button>
          {battleBg && (
            <button className="btn-delete btn-admin-danger" onClick={removeBattleBg}>
              ✖ Rimuovi
            </button>
          )}
        </div>
      </div>

      {/* ── Arena Background ── */}
      <div className="boss-card" style={{ maxWidth: 520, margin: "0 auto 32px", padding: "16px 20px" }}>
        <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, marginBottom: 10 }}>
          Sfondo Arena (PvP)
        </h3>
        {arenaBg ? (
          <img
            src={arenaBg}
            alt="Arena background"
            style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block", marginBottom: 10, border: "2px solid var(--gold)" }}
          />
        ) : (
          <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 28, marginBottom: 10 }}>⚔️</div>
        )}
        <input
          ref={arenaBgInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => loadArenaBg(e.target.files[0])}
        />
        <div className="boss-actions-admin">
          <button className="btn-edit" onClick={() => arenaBgInputRef.current?.click()}>
            📁 {arenaBg ? "Cambia" : "Carica"} Sfondo
          </button>
          {arenaBg && (
            <button className="btn-delete btn-admin-danger" onClick={removeArenaBg}>
              ✖ Rimuovi
            </button>
          )}
        </div>
      </div>

      <div className="admin-dashboard-grid wb-boss-grid">
        {characters.map((char) => (
          <div key={char.id} className="boss-card">
            <div className="view-mode">
              <div className="boss-card-header">
                <h3>{char.name}</h3>
                <span className="status-tag" style={{ fontSize: "9px", opacity: 0.7 }}>
                  {char.class || "—"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", padding: "8px 0" }}>
                {/* Sprite Vivo */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, opacity: 0.6, fontFamily: "monospace" }}>VIVO</span>
                  {char.spriteUrl
                    ? <img src={char.spriteUrl} alt={char.name} className="boss-sprite-preview" style={{ imageRendering: "pixelated", mixBlendMode: "multiply", maxHeight: 90 }} />
                    : <div style={{ fontSize: 28, opacity: 0.25 }}>🧍</div>
                  }
                  <input ref={(el) => { fileRefs.current[char.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => loadSprite(e.target.files[0], char.id)} />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-edit" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => fileRefs.current[char.id]?.click()}>
                      📁 {char.spriteUrl ? "Cambia" : "Carica"}
                    </button>
                    {char.spriteUrl && <button className="btn-delete btn-admin-danger" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => removeSprite(char.id)}>✖</button>}
                  </div>
                </div>

                {/* Sprite Morto */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, opacity: 0.6, fontFamily: "monospace" }}>MORTO</span>
                  {char.deadSpriteUrl
                    ? <img src={char.deadSpriteUrl} alt={`${char.name} dead`} className="boss-sprite-preview" style={{ imageRendering: "pixelated", mixBlendMode: "multiply", maxHeight: 90, filter: "grayscale(0.5)" }} />
                    : <div style={{ fontSize: 28, opacity: 0.25 }}>💀</div>
                  }
                  <input ref={(el) => { deadFileRefs.current[char.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => loadDeadSprite(e.target.files[0], char.id)} />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-edit" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => deadFileRefs.current[char.id]?.click()}>
                      💀 {char.deadSpriteUrl ? "Cambia" : "Carica"}
                    </button>
                    {char.deadSpriteUrl && <button className="btn-delete btn-admin-danger" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => removeDeadSprite(char.id)}>✖</button>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
