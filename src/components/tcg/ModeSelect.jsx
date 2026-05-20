/* Menu hub — Gioca (IA / Online), Negozio, Mazzo, Collezione, Manuale */
import React, { useState } from "react";

function MasterReset({ onMasterReset }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const click = async () => {
    if (!armed) {
      setArmed(true);
      setMsg("");
      setTimeout(() => setArmed(false), 5000);
      return;
    }
    setBusy(true);
    const res = await onMasterReset();
    setBusy(false);
    setArmed(false);
    setMsg(
      res?.ok
        ? `Azzerati ${res.count} profili. Tutti rifaranno la scelta iniziale.`
        : "Reset non riuscito."
    );
  };

  return (
    <div className="tcg-master">
      <button
        className={`tcg-btn ${armed ? "tcg-btn--danger" : "tcg-btn--ghost"}`}
        disabled={busy}
        onClick={click}
      >
        {busy
          ? "Azzeramento…"
          : armed
          ? "⚠️ Conferma: azzera TUTTI"
          : "🗝️ Reset TCG (master)"}
      </button>
      {msg && <span className="tcg-master__msg">{msg}</span>}
    </div>
  );
}

export default function ModeSelect({
  loggedIn,
  isMaster = false,
  coins = 0,
  onPickAi,
  onPickPvp,
  onShop,
  onDeck,
  onCollection,
  onManual,
  onMasterReset,
}) {
  return (
    <div className="tcg-menu">
      <div className="tcg-menu__head">
        <div>
          <h1 className="tcg-title">Cronache di Exanthia</h1>
          <p className="tcg-subtitle">Il gioco di carte dei Regni</p>
        </div>
        {loggedIn && (
          <div className="tcg-menu__coins" title="Monete TCG">
            🪙 {coins}
          </div>
        )}
      </div>

      <div className="tcg-menu__grid">
        <button className="tcg-tile tcg-tile--ai" onClick={onPickAi}>
          <span className="tcg-tile__icon">🐉</span>
          <span className="tcg-tile__title">Gioca contro l'IA</span>
          <span className="tcg-tile__desc">Partita immediata col tuo mazzo.</span>
        </button>

        <button
          className="tcg-tile tcg-tile--pvp"
          onClick={onPickPvp}
          disabled={!loggedIn}
        >
          <span className="tcg-tile__icon">⚔️</span>
          <span className="tcg-tile__title">Gioca online</span>
          <span className="tcg-tile__desc">
            {loggedIn ? "Sfida un altro giocatore." : "Accedi per giocare online."}
          </span>
        </button>

        <button
          className="tcg-tile"
          onClick={onDeck}
          disabled={!loggedIn}
        >
          <span className="tcg-tile__icon">🛠️</span>
          <span className="tcg-tile__title">Mazzo</span>
          <span className="tcg-tile__desc">
            {loggedIn ? "Costruisci e salva il tuo mazzo." : "Accedi per costruire."}
          </span>
        </button>

        <button
          className="tcg-tile"
          onClick={onShop}
          disabled={!loggedIn}
        >
          <span className="tcg-tile__icon">🏪</span>
          <span className="tcg-tile__title">Negozio</span>
          <span className="tcg-tile__desc">
            {loggedIn ? "Apri pacchetti di carte." : "Accedi per il negozio."}
          </span>
        </button>

        <button
          className="tcg-tile"
          onClick={onCollection}
          disabled={!loggedIn}
        >
          <span className="tcg-tile__icon">📚</span>
          <span className="tcg-tile__title">Collezione</span>
          <span className="tcg-tile__desc">
            {loggedIn ? "Le tue carte e statistiche." : "Accedi per la collezione."}
          </span>
        </button>

        <button className="tcg-tile" onClick={onManual}>
          <span className="tcg-tile__icon">📖</span>
          <span className="tcg-tile__title">Manuale</span>
          <span className="tcg-tile__desc">Come si gioca, passo per passo.</span>
        </button>
      </div>

      {isMaster && <MasterReset onMasterReset={onMasterReset} />}

      <p className="tcg-menu__foot">
        30 PV · mazzo da 60 · mano max 7 · mana di colore (terre)
      </p>
    </div>
  );
}
