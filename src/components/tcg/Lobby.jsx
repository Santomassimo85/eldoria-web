/* ============================================================
   Lobby — PvP matchmaking. Live challenge list, create / accept,
   "waiting for opponent" with cancel, online count.
   Before a challenge is created or accepted we open ClassPicker
   so the player picks a klass + via in base ai colori del proprio
   mazzo (2026-05-21: niente più starter lockedClass).
   ============================================================ */
import React, { useEffect, useState, useRef } from "react";
import {
  watchLobby, createChallenge, cancelChallenge, acceptChallenge,
} from "../../tcg/net.js";
import ClassPicker from "./ClassPicker.jsx";

function timeAgo(ts) {
  const ms = ts && ts.toMillis ? Date.now() - ts.toMillis() : 0;
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s fa`;
  return `${Math.floor(s / 60)}m fa`;
}

export default function Lobby({
  user, name, deck, cover, onEnterMatch, onBack,
}) {
  const [open, setOpen] = useState([]);
  const [online, setOnline] = useState(0);
  const [myChallengeId, setMyChallengeId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // class+via picker state — { mode: "create" | "accept", target?: m }
  const [picking, setPicking] = useState(null);
  const myIdRef = useRef(null);

  useEffect(() => {
    const unsub = watchLobby(user.uid, ({ open, mine, online, error }) => {
      setOpen(open);
      setOnline(online);
      if (error) setErr("Connessione alla lobby non riuscita.");
      // auto-enter once someone accepts my challenge / I'm in a match
      if (mine) onEnterMatch(mine.id);
      // detect my own open challenge still alive
      const stillMine =
        myIdRef.current && open.some((m) => m.id === myIdRef.current);
      if (!stillMine && myIdRef.current && !mine) {
        // it was accepted (became active->handled by `mine`) or expired
      }
    });
    return unsub;
  }, [user.uid, onEnterMatch]);

  /* Two-step flows: open the picker first, then commit the actual
     network action with the chosen via. */
  const handleCreate = () => setPicking({ mode: "create" });
  const handleAccept = (m) => setPicking({ mode: "accept", target: m });

  const confirmPick = async (classChoice) => {
    if (!picking) return;
    const mode = picking.mode;
    const target = picking.target;
    setPicking(null);
    setBusy(true);
    setErr("");
    try {
      if (mode === "create") {
        const id = await createChallenge(user.uid, name, deck, cover, classChoice);
        myIdRef.current = id;
        setMyChallengeId(id);
      } else {
        const id = await acceptChallenge(target, user.uid, name, deck, cover, classChoice);
        if (id) onEnterMatch(id);
        else setErr("Sfida non più disponibile.");
      }
    } catch {
      setErr(mode === "create"
        ? "Impossibile creare la sfida."
        : "Impossibile accettare la sfida.");
    }
    setBusy(false);
  };

  const handleCancel = async () => {
    if (myChallengeId) await cancelChallenge(myChallengeId);
    myIdRef.current = null;
    setMyChallengeId(null);
  };

  if (picking) {
    return (
      <ClassPicker
        deck={deck}
        onConfirm={confirmPick}
        onBack={() => setPicking(null)}
      />
    );
  }

  if (myChallengeId) {
    return (
      <div className="tcg-lobby tcg-waiting">
        <div className="tcg-waiting__spinner" />
        <h2>In attesa di un avversario…</h2>
        <p>La tua sfida è visibile nella lobby.</p>
        <button className="tcg-btn" onClick={handleCancel}>
          Annulla sfida
        </button>
      </div>
    );
  }

  const others = open.filter(
    (m) => m.challenger && m.challenger.uid !== user.uid
  );

  return (
    <div className="tcg-lobby">
      <div className="tcg-lobby__head">
        <button className="tcg-btn tcg-btn--ghost" onClick={onBack}>
          ‹ Indietro
        </button>
        <span className="tcg-lobby__online">🟢 {online} online</span>
      </div>

      <h2 className="tcg-lobby__title">Sfide aperte</h2>
      {err && <p className="tcg-lobby__err">{err}</p>}

      <div className="tcg-lobby__list">
        {others.length === 0 && (
          <p className="tcg-lobby__empty">
            Nessuna sfida aperta. Creane una tu!
          </p>
        )}
        {others.map((m) => (
          <div className="tcg-challenge" key={m.id}>
            <div>
              <span className="tcg-challenge__name">
                ⚔️ {m.challenger.name}
              </span>
              <span className="tcg-challenge__time">
                {timeAgo(m.createdAt)}
              </span>
            </div>
            <button
              className="tcg-btn tcg-btn--primary"
              disabled={busy}
              onClick={() => handleAccept(m)}
            >
              Accetta
            </button>
          </div>
        ))}
      </div>

      <button
        className="tcg-btn tcg-btn--primary tcg-lobby__create"
        disabled={busy}
        onClick={handleCreate}
      >
        + Crea una sfida
      </button>
    </div>
  );
}
