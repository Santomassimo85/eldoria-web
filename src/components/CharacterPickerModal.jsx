import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { getCharsForAuth } from "../utils/multiChar";
import "./CharacterPickerModal.css";

export default function CharacterPickerModal() {
  const {
    authUid,
    activeCharId,
    isMultiChar,
    charSelectionPending,
    charPickerOpen,
    closeCharPicker,
    selectCharacter,
  } = useAuth();
  const [profiles, setProfiles] = useState({});

  const chars = isMultiChar ? getCharsForAuth(authUid) : null;

  useEffect(() => {
    const list = isMultiChar ? getCharsForAuth(authUid) : null;
    if (!charPickerOpen || !list) return;
    let alive = true;
    Promise.all(
      list.map(async (c) => {
        try {
          const snap = await getDoc(doc(db, "characters", c.id));
          return [c.id, snap.exists() ? snap.data() : null];
        } catch {
          return [c.id, null];
        }
      })
    ).then((entries) => {
      if (!alive) return;
      const map = {};
      for (const [id, data] of entries) map[id] = data;
      setProfiles(map);
    });
    return () => { alive = false; };
  }, [charPickerOpen, isMultiChar, authUid]);

  useEffect(() => {
    if (!charPickerOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !charSelectionPending) closeCharPicker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [charPickerOpen, charSelectionPending, closeCharPicker]);

  if (!charPickerOpen || !chars) return null;

  return createPortal(
    <div
      className="cpm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !charSelectionPending) closeCharPicker();
      }}
    >
      <div className="cpm-modal">
        <div className="cpm-head">
          <div>
            <p className="cpm-kicker">Selezione Personaggio</p>
            <h2 id="cpm-title" className="cpm-title">
              {charSelectionPending ? "Con quale personaggio entri?" : "Cambia personaggio"}
            </h2>
          </div>
          {!charSelectionPending && (
            <button type="button" className="cpm-close" onClick={closeCharPicker} aria-label="Chiudi">
              ×
            </button>
          )}
        </div>

        <div className="cpm-grid">
          {chars.map((c) => {
            const data = profiles[c.id];
            const isCurrent = activeCharId === c.id;
            const name = data?.name || c.label;
            const meta = [data?.race, data?.class].filter(Boolean).join(" · ") || "Personaggio di Eldoria";
            const img = data?.image || `/assets/player/${c.label}.png`;
            const corone = data?.platinum ?? data?.money ?? 0;

            return (
              <button
                key={c.id}
                type="button"
                className={`cpm-card${isCurrent ? " is-active" : ""}`}
                onClick={() => selectCharacter(c.id)}
              >
                <img
                  src={img}
                  alt={name}
                  className="cpm-avatar"
                  onError={(e) => { e.currentTarget.src = "/assets/player/default.png"; }}
                />
                <div className="cpm-info">
                  <span className="cpm-name">
                    {name}
                    {isCurrent && <span className="cpm-badge">Attivo</span>}
                  </span>
                  <span className="cpm-meta">{meta}</span>
                  <span className="cpm-stats">💰 {corone} Corone</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
