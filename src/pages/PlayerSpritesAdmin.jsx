import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, addDoc, deleteDoc } from "firebase/firestore";
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
  const [minions, setMinions] = useState([]);
  const minionFileRefs     = useRef({});
  const minionDeadFileRefs = useRef({});

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

      {/* ── Minion / Nemici minori (libreria riusabile nei Boss Fight) ── */}
      <div className="boss-card" style={{ maxWidth: 920, margin: "0 auto 24px", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9 }}>
            👹 Nemici minori (Minion)
          </h3>
          <button className="btn-edit" onClick={addMinion}>＋ Nuovo minion</button>
        </div>
        <p style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>
          Carica qui sprite e stat dei nemici minori: li potrai poi scegliere e piazzare nel Boss Fight tattico.
        </p>
        {minions.length === 0 && <p style={{ opacity: 0.4, fontSize: 12 }}>Nessun minion. Aggiungine uno.</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {minions.map((m) => (
            <div key={m.id} style={{ border: "1px solid rgba(0,0,0,0.2)", borderRadius: 8, padding: 10, width: 250, background: "rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 8 }}>
                {/* live */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 8, opacity: 0.6, fontFamily: "monospace" }}>VIVO</span>
                  {m.spriteUrl
                    ? <img src={m.spriteUrl} alt={m.name} style={{ imageRendering: "pixelated", maxHeight: 70, mixBlendMode: "multiply" }} />
                    : <div style={{ fontSize: 24, opacity: 0.25 }}>👹</div>}
                  <input ref={(el) => { minionFileRefs.current[m.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => loadMinionSprite(e.target.files[0], m.id, "spriteUrl")} />
                  <button className="btn-edit" style={{ fontSize: 9, padding: "2px 6px" }} onClick={() => minionFileRefs.current[m.id]?.click()}>📁</button>
                </div>
                {/* dead */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 8, opacity: 0.6, fontFamily: "monospace" }}>MORTO</span>
                  {m.deadSpriteUrl
                    ? <img src={m.deadSpriteUrl} alt="" style={{ imageRendering: "pixelated", maxHeight: 70, mixBlendMode: "multiply", filter: "grayscale(0.5)" }} />
                    : <div style={{ fontSize: 24, opacity: 0.25 }}>💀</div>}
                  <input ref={(el) => { minionDeadFileRefs.current[m.id] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => loadMinionSprite(e.target.files[0], m.id, "deadSpriteUrl")} />
                  <button className="btn-edit" style={{ fontSize: 9, padding: "2px 6px" }} onClick={() => minionDeadFileRefs.current[m.id]?.click()}>💀</button>
                </div>
              </div>
              <input value={m.name || ""} onChange={(e) => patchMinion(m.id, { name: e.target.value })}
                placeholder="Nome" style={{ width: "100%", marginBottom: 6, fontWeight: 700 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 11 }}>
                <label>HP<input type="number" value={m.hp ?? 12} onChange={(e) => patchMinion(m.id, { hp: +e.target.value })} style={{ width: "100%" }} /></label>
                <label>CA<input type="number" value={m.ac ?? 11} onChange={(e) => patchMinion(m.id, { ac: +e.target.value })} style={{ width: "100%" }} /></label>
                <label>DEX<input type="number" value={m.dex ?? 1} onChange={(e) => patchMinion(m.id, { dex: +e.target.value })} style={{ width: "100%" }} /></label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 4, fontSize: 11, marginTop: 4 }}>
                <label>Att.<input value={m.atkName || "Attacco"} onChange={(e) => patchMinion(m.id, { atkName: e.target.value })} style={{ width: "100%" }} /></label>
                <label>Dadi<input value={m.atkDice || "1d6"} onChange={(e) => patchMinion(m.id, { atkDice: e.target.value })} style={{ width: "100%" }} /></label>
                <label>+colpire<input type="number" value={m.atkBonus ?? 2} onChange={(e) => patchMinion(m.id, { atkBonus: +e.target.value })} style={{ width: "100%" }} /></label>
                <label>Gittata<input type="number" value={m.atkRange ?? 1} onChange={(e) => patchMinion(m.id, { atkRange: +e.target.value })} style={{ width: "100%" }} /></label>
              </div>
              <button className="btn-delete btn-admin-danger" style={{ fontSize: 10, padding: "3px 7px", marginTop: 8, width: "100%" }} onClick={() => removeMinion(m.id)}>✖ Elimina</button>
            </div>
          ))}
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
