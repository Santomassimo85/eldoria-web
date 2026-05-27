/* ============================================================
   TCG — Tournament Hub
   ------------------------------------------------------------
   Schermata torneo a eliminazione diretta.

   - Quando "closed" e non sei master: questa schermata non
     dovrebbe nemmeno essere raggiungibile (il tile è nascosto).
   - Quando "open": ti iscrivi (passando dal ClassPicker per
     scegliere classe+via in base ai colori del tuo mazzo) oppure
     ti ritiri se sei già iscritto.
   - Quando "running": vedi il bracket e, se sei in gioco, il
     bottone "Combatti" entra direttamente nella tua partita
     PvP del torneo.
   - Quando "ended": campione mostrato in cima.
   ============================================================ */
import React, { useEffect, useState } from "react";
import ClassPicker from "./ClassPicker.jsx";
import {
  watchTournament, openRegistration, closeRegistration, startTournament,
  advanceRound, resetTournament, ensureTournamentDoc,
  registerPlayer, withdrawPlayer,
  addAiParticipant, removeAiParticipant, isAiUid,
  forceFinishMatch, forceFinishAllPending,
  currentRoundOf, myCurrentMatch, isRegistered,
  totalRoundsFor, roundLabel,
} from "../../tcg/tournament.js";

const STATUS_LABEL = {
  closed:  "Chiuso",
  open:    "Iscrizioni aperte",
  running: "In corso",
  ended:   "Concluso",
};

const STATUS_ICON = {
  closed:  "🛑",
  open:    "🟢",
  running: "⚔️",
  ended:   "👑",
};

export default function Tournament({
  user, name, deck, cover, isMaster, onBack, onEnterMatch, onEnterAiMatch,
}) {
  // undefined = first render (no snapshot ricevuto), null = doc inesistente,
  // object = doc presente. Distingue caricamento da "torneo da creare".
  const [t, setT] = useState(undefined);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const unsub = watchTournament(setT);
    return unsub;
  }, []);

  const reg = isRegistered(t, user?.uid);
  const myMatch = t?.status === "running" ? myCurrentMatch(t, user?.uid) : null;
  const total = totalRoundsFor(Object.keys(t?.participants || {}).length);

  const run = (fn) => async (...args) => {
    setBusy(true); setErr("");
    try { await fn(...args); }
    catch (e) { setErr(e?.message || "Errore."); }
    finally { setBusy(false); }
  };

  /* ---- registration ---- */
  const handleJoin = () => {
    if (!deck || !Array.isArray(deck) || deck.length < 30) {
      setErr("Devi avere un mazzo salvato prima di iscriverti.");
      return;
    }
    setPicking(true);
  };
  const handleWithdraw = run(() => withdrawPlayer(user.uid));
  const onClassConfirm = run(async (cls) => {
    setPicking(false);
    await registerPlayer(user.uid, name, deck, cover, cls);
  });
  const onClassBack = () => setPicking(false);

  if (picking) {
    return (
      <ClassPicker
        deck={deck}
        onConfirm={onClassConfirm}
        onBack={onClassBack}
      />
    );
  }

  /* ---- bottom-aligned header is rendered first ---- */
  const Header = () => (
    <div className="tcg-tourn__head">
      <button className="tcg-btn tcg-btn--ghost" onClick={onBack}>
        ‹ Indietro
      </button>
      <div className="tcg-tourn__title">
        <span className="tcg-tourn__name">{t?.name || "Torneo dei Regni"}</span>
        {t && (
          <span className={`tcg-tourn__status tcg-tourn__status--${t.status}`}>
            {STATUS_ICON[t.status]} {STATUS_LABEL[t.status]}
          </span>
        )}
      </div>
      <span className="tcg-tourn__spacer" />
    </div>
  );

  // Caricamento iniziale: nessun snapshot ricevuto ancora
  if (t === undefined) {
    return (
      <div className="tcg-tourn">
        <Header />
        <div className="tcg-tourn__loading">Caricamento del torneo…</div>
      </div>
    );
  }

  // Snapshot arrivato ma il doc non esiste su Firestore.
  // Master → può crearlo. Player → vede messaggio "non disponibile".
  if (t === null) {
    return (
      <div className="tcg-tourn">
        <Header />
        {err && <div className="tcg-tourn__err">⚠️ {err}</div>}
        {isMaster ? (
          <section className="tcg-tourn__hero tcg-tourn__hero--closed">
            <h2>Torneo non ancora inizializzato</h2>
            <p>
              Crea il documento del torneo per poter aprire le iscrizioni,
              avviare i match e gestire bracket / reset.
            </p>
            <div className="tcg-tourn__cta">
              <button
                className="tcg-btn tcg-btn--primary tcg-tourn__cta-btn"
                disabled={busy}
                onClick={run(() => ensureTournamentDoc())}
              >
                ⚙ Crea torneo
              </button>
            </div>
          </section>
        ) : (
          <section className="tcg-tourn__hero tcg-tourn__hero--closed">
            <h2>Torneo non disponibile</h2>
            <p>
              Il Master non ha ancora aperto un torneo. Torna più tardi:
              le iscrizioni saranno annunciate qui.
            </p>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="tcg-tourn">
      <Header />
      {err && <div className="tcg-tourn__err">⚠️ {err}</div>}

      {/* ───── Champion banner ───── */}
      {t.status === "ended" && t.champion && (
        <div className="tcg-tourn__champion">
          <div className="tcg-tourn__crown">👑</div>
          <div className="tcg-tourn__chname">{t.champion.name}</div>
          <div className="tcg-tourn__chsub">Campione del torneo</div>
        </div>
      )}

      {/* ───── Hero section dipende dallo stato ───── */}
      {t.status === "closed" && (
        <section className="tcg-tourn__hero tcg-tourn__hero--closed">
          <h2>Le porte dell'Arena sono sbarrate</h2>
          <p>
            Il prossimo torneo non è ancora stato annunciato. Tieni d'occhio
            questa stanza: quando il Master aprirà le iscrizioni potrai
            entrare nei combattimenti a eliminazione diretta.
          </p>
        </section>
      )}

      {t.status === "open" && (
        <section className="tcg-tourn__hero tcg-tourn__hero--open">
          <h2>Iscrizioni aperte!</h2>
          <p>
            Iscriviti per scendere in campo nella prossima edizione del
            <em> Torneo dei Regni</em>. Eliminazione diretta: una sconfitta
            e sei fuori.
          </p>
          {user ? (
            reg ? (
              <div className="tcg-tourn__cta">
                <span className="tcg-tourn__badge">
                  ✔ Iscritto come <strong>{name}</strong>
                </span>
                <button
                  className="tcg-btn"
                  disabled={busy}
                  onClick={handleWithdraw}
                >
                  Ritira iscrizione
                </button>
              </div>
            ) : (
              <div className="tcg-tourn__cta">
                <button
                  className="tcg-btn tcg-btn--primary tcg-tourn__cta-btn"
                  disabled={busy}
                  onClick={handleJoin}
                >
                  ⚔ Iscriviti al torneo
                </button>
              </div>
            )
          ) : (
            <p>Devi essere loggato per iscriverti.</p>
          )}
        </section>
      )}

      {t.status === "running" && (() => {
        const cur = currentRoundOf(t);
        const allMatches = cur?.matches || [];
        const pending = allMatches.filter((m) => !m.winnerUid);
        const done = allMatches.filter((m) => m.winnerUid);
        return (
          <section className="tcg-tourn__hero tcg-tourn__hero--running">
            <h2>{roundLabel(t.currentRound, total)} in corso</h2>
            <div className="tcg-tourn__round-progress">
              <span className="tcg-tourn__round-progress-num">
                {done.length} / {allMatches.length}
              </span>
              <span className="tcg-tourn__round-progress-label">
                partite concluse
              </span>
            </div>

            {myMatch ? (
              <MyMatchCard
                tournament={t}
                myUid={user?.uid}
                match={myMatch}
                onEnter={() => {
                  if (myMatch.vsAi) {
                    onEnterAiMatch?.(myMatch);
                  } else {
                    onEnterMatch(myMatch.matchId);
                  }
                }}
              />
            ) : isRegistered(t, user?.uid) ? (
              <p className="tcg-tourn__hero-note">
                Hai concluso il tuo match: in attesa che gli altri finiscano.
              </p>
            ) : (
              <p className="tcg-tourn__hero-note">
                Sei spettatore: i match sono in corso in parallelo, segui il
                bracket qui sotto.
              </p>
            )}

            {/* ── Master view: tutti i match del round corrente con controlli ── */}
            {isMaster && pending.length > 0 && (
              <RoundLiveBoard
                tournament={t}
                pending={pending}
                busy={busy}
                onForce={(entryId, winnerUid) =>
                  run(() => forceFinishMatch(entryId, winnerUid))()
                }
                onForceAll={run(() => forceFinishAllPending())}
              />
            )}
          </section>
        );
      })()}

      {/* ───── Bracket ───── */}
      {(t.status === "running" || t.status === "ended") &&
        t.rounds && t.rounds.length > 0 && (
        <section className="tcg-tourn__bracket-wrap">
          <h3 className="tcg-tourn__h">Tabellone</h3>
          <Bracket tournament={t} myUid={user?.uid} />
        </section>
      )}

      {/* ───── Lista iscritti ───── */}
      {t.status === "open" && (() => {
        const partsArr = Object.values(t.participants || {});
        const count = partsArr.length;
        const odd = count > 0 && count % 2 !== 0;
        return (
          <section className="tcg-tourn__roster">
            <h3 className="tcg-tourn__h">
              Iscritti · {count}
              {odd && (
                <span
                  className="tcg-tourn__parity tcg-tourn__parity--odd"
                  title="Numero dispari: un AI bot riempirà il vuoto all'avvio"
                >
                  · DISPARI
                </span>
              )}
              {!odd && count >= 2 && (
                <span className="tcg-tourn__parity tcg-tourn__parity--even">
                  · PARI ✓
                </span>
              )}
            </h3>
            <div className="tcg-tourn__roster-grid">
              {partsArr.length === 0 && (
                <p className="tcg-tourn__empty">Nessun iscritto, sii il primo!</p>
              )}
              {partsArr.map((p) => {
                const ai = !!p.isAi || isAiUid(p.uid);
                return (
                  <div
                    key={p.uid}
                    className={`tcg-tourn__player${ai ? " tcg-tourn__player--ai" : ""}`}
                  >
                    <span className="tcg-tourn__player-name">
                      {ai ? "🤖 " : ""}{p.name}
                    </span>
                    {p.classChoice && (
                      <span className="tcg-tourn__player-class">
                        {p.classChoice.klass}
                      </span>
                    )}
                    {ai && isMaster && (
                      <button
                        className="tcg-tourn__player-remove"
                        disabled={busy}
                        title="Rimuovi questo AI"
                        onClick={run(() => removeAiParticipant(p.uid))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* ───── Master panel ───── */}
      {isMaster && (
        <MasterPanel
          t={t}
          total={total}
          busy={busy}
          confirmReset={confirmReset}
          setConfirmReset={setConfirmReset}
          onOpen={run(() => openRegistration("Torneo dei Regni"))}
          onClose={run(() => closeRegistration())}
          onStart={run(() => startTournament())}
          onAdvance={run(() => advanceRound())}
          onAddAi={run(() => addAiParticipant())}
          onReset={run(async () => {
            await resetTournament();
            setConfirmReset(false);
          })}
        />
      )}
    </div>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

function MyMatchCard({ tournament, myUid, match, onEnter }) {
  const a = tournament.participants[match.a];
  const b = tournament.participants[match.b];
  const opp = match.a === myUid ? b : a;
  const oppAi = !!(opp?.isAi || isAiUid(match.vsAi ? match.aiUid : (match.a === myUid ? match.b : match.a)));
  return (
    <div className="tcg-tourn__mymatch">
      <div className="tcg-tourn__mymatch-vs">
        <div className="tcg-tourn__mymatch-side tcg-tourn__mymatch-side--me">
          <span className="tcg-tourn__mymatch-name">Tu</span>
        </div>
        <span className="tcg-tourn__vs">VS</span>
        <div className="tcg-tourn__mymatch-side tcg-tourn__mymatch-side--foe">
          <span className="tcg-tourn__mymatch-name">
            {oppAi ? "🤖 " : ""}{opp?.name || "?"}
          </span>
          {opp?.classChoice && (
            <span className="tcg-tourn__mymatch-class">{opp.classChoice.klass}</span>
          )}
        </div>
      </div>
      <button
        className="tcg-btn tcg-btn--primary tcg-tourn__fight"
        onClick={onEnter}
      >
        ⚔ {match.vsAi ? "Combatti l'AI" : "Combatti"}
      </button>
    </div>
  );
}

function Bracket({ tournament, myUid }) {
  const total = totalRoundsFor(Object.keys(tournament.participants || {}).length);
  return (
    <div className="tcg-tourn__bracket">
      {tournament.rounds.map((r) => (
        <div key={r.round} className="tcg-tourn__column">
          <div className="tcg-tourn__col-h">{roundLabel(r.round, total)}</div>
          <div className="tcg-tourn__matches">
            {r.matches.map((m) => (
              <BracketMatch
                key={m.id}
                tournament={tournament}
                match={m}
                myUid={myUid}
              />
            ))}
          </div>
        </div>
      ))}
      {tournament.status === "ended" && tournament.champion && (
        <div className="tcg-tourn__column tcg-tourn__column--champ">
          <div className="tcg-tourn__col-h">Campione</div>
          <div className="tcg-tourn__matches">
            <div className="tcg-tourn__bm tcg-tourn__bm--champ">
              <div className="tcg-tourn__bm-row tcg-tourn__bm-row--winner">
                <span className="tcg-tourn__bm-name">👑 {tournament.champion.name}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BracketMatch({ tournament, match, myUid }) {
  const a = tournament.participants[match.a];
  const b = match.b ? tournament.participants[match.b] : null;
  const winA = match.winnerUid === match.a;
  const winB = match.winnerUid && match.winnerUid === match.b;
  const mine = match.a === myUid || match.b === myUid;
  const isBye = !!match.byeFor && !match.b;
  const aAi = !!(a?.isAi || isAiUid(match.a));
  const bAi = !!(b?.isAi || isAiUid(match.b));
  return (
    <div className={`tcg-tourn__bm${mine ? " is-mine" : ""}${isBye ? " is-bye" : ""}${match.vsAi ? " is-vs-ai" : ""}`}>
      <div className={`tcg-tourn__bm-row${winA ? " tcg-tourn__bm-row--winner" : ""}${!match.winnerUid ? "" : (winA ? "" : " is-loser")}`}>
        <span className="tcg-tourn__bm-name">
          {aAi ? "🤖 " : ""}{a?.name || "—"}
        </span>
        {winA && <span className="tcg-tourn__bm-w">✓</span>}
      </div>
      <div className={`tcg-tourn__bm-row${winB ? " tcg-tourn__bm-row--winner" : ""}${!match.winnerUid ? "" : (winB ? "" : " is-loser")}`}>
        <span className="tcg-tourn__bm-name">
          {isBye ? <em>passa il turno</em> : <>{bAi ? "🤖 " : ""}{b?.name || "—"}</>}
        </span>
        {winB && <span className="tcg-tourn__bm-w">✓</span>}
      </div>
    </div>
  );
}

/* Pannello master visibile durante il round in corso: lista live
   dei match pendenti + bottoni per forzare un vincitore o risolvere
   tutto. Risolve il caso "un giocatore non si presenta e il bracket
   resta bloccato". */
function RoundLiveBoard({ tournament, pending, busy, onForce, onForceAll }) {
  return (
    <div className="tcg-tourn__live-board">
      <div className="tcg-tourn__live-board-head">
        <span className="tcg-tourn__live-board-title">
          🛡 Master · Match pendenti ({pending.length})
        </span>
        <button
          className="tcg-btn tcg-btn--danger"
          disabled={busy}
          onClick={onForceAll}
          title="Sorteggia un vincitore per tutti i match pendenti"
        >
          🎲 Sorteggia tutti
        </button>
      </div>
      <div className="tcg-tourn__live-board-list">
        {pending.map((m) => {
          const a = tournament.participants[m.a];
          const b = tournament.participants[m.b];
          const aLabel = `${a?.isAi ? "🤖 " : ""}${a?.name || "—"}`;
          const bLabel = `${b?.isAi ? "🤖 " : ""}${b?.name || "—"}`;
          return (
            <div key={m.id} className="tcg-tourn__live-row">
              <span className="tcg-tourn__live-row-id">{m.id}</span>
              <button
                className="tcg-tourn__live-row-side"
                disabled={busy}
                onClick={() => onForce(m.id, m.a)}
                title={`Dichiara ${aLabel} vincitore`}
              >
                {aLabel}
              </button>
              <span className="tcg-tourn__live-row-vs">vs</span>
              <button
                className="tcg-tourn__live-row-side"
                disabled={busy}
                onClick={() => onForce(m.id, m.b)}
                title={`Dichiara ${bLabel} vincitore`}
              >
                {bLabel}
              </button>
              <span className="tcg-tourn__live-row-tag">
                {m.vsAi ? "vs AI (locale)" : "PvP"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MasterPanel({
  t, total, busy, confirmReset, setConfirmReset,
  onOpen, onClose, onStart, onAdvance, onReset, onAddAi,
}) {
  const cur = currentRoundOf(t);
  const allDone = cur ? cur.matches.every((m) => !!m.winnerUid) : false;
  const numPlayers = Object.keys(t.participants || {}).length;
  const odd = numPlayers > 0 && numPlayers % 2 !== 0;

  return (
    <section className="tcg-tourn__master">
      <h3 className="tcg-tourn__h">⚙ Pannello Master</h3>
      <div className="tcg-tourn__master-grid">

        {t.status === "closed" && (
          <button className="tcg-btn tcg-btn--primary" disabled={busy} onClick={onOpen}>
            🟢 Apri iscrizioni
          </button>
        )}

        {t.status === "open" && (
          <>
            <div className="tcg-tourn__master-info">
              Iscritti: <strong>{numPlayers}</strong>
              {odd && <span className="tcg-tourn__parity tcg-tourn__parity--odd"> · DISPARI</span>}
              {!odd && numPlayers >= 2 && <span className="tcg-tourn__parity tcg-tourn__parity--even"> · PARI ✓</span>}
            </div>
            <button
              className="tcg-btn"
              disabled={busy}
              onClick={onAddAi}
              title="Aggiunge un AI bot con nome e classe random per riempire un vuoto"
            >
              🤖 Aggiungi AI bot
            </button>
            <button className="tcg-btn" disabled={busy} onClick={onClose}>
              🛑 Chiudi torneo (cancella iscritti)
            </button>
            <button
              className="tcg-btn tcg-btn--primary"
              disabled={busy || numPlayers < 2}
              onClick={onStart}
              title={numPlayers < 2 ? "Servono almeno 2 iscritti" : (odd ? "Un AI verrà aggiunto automaticamente" : "")}
            >
              ⚔ Avvia torneo · {numPlayers} iscritti
            </button>
          </>
        )}

        {t.status === "running" && (
          <>
            <div className="tcg-tourn__master-info">
              {roundLabel(t.currentRound, total)} · {cur ? cur.matches.length : 0} partite
              {allDone ? " · ✅ tutte concluse" : " · in corso"}
            </div>
            <button
              className="tcg-btn tcg-btn--primary"
              disabled={busy || !allDone}
              onClick={onAdvance}
              title={!allDone ? "Aspetta che tutte le partite del round finiscano" : ""}
            >
              ➡ Avanza al prossimo round
            </button>
          </>
        )}

        {(t.status === "ended" || t.status === "running") && (
          <button
            className={`tcg-btn ${confirmReset ? "tcg-btn--danger" : ""}`}
            disabled={busy}
            onClick={() => {
              if (confirmReset) onReset();
              else {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 4000);
              }
            }}
          >
            {confirmReset ? "⚠️ Conferma: resetta tutto" : "♻ Reset torneo"}
          </button>
        )}
      </div>
    </section>
  );
}
