// ── Arena · Cronache dei match ───────────────────────────────────────────────
// Rilettura completa dei match conclusi (salvati in arena_chronicles da
// src/utils/arenaChronicle.js). Ogni giocatore vede le sue ultime 8; il Master
// può vederle tutte. Ogni riga porta la traccia dei PF (❤ prima → dopo), così
// si capisce sempre chi ha perso vita e perché.
import React, { useEffect, useMemo, useState } from "react";
import { CHRONICLE_KEEP, loadChronicles, loadAllChronicles } from "../utils/arenaChronicle";
import { hpTraceParts } from "../utils/arenaIntegrity";
import "./ArenaChronicles.css";

const KIND_LABEL = {
  fun: "Sfida libera",
  final: "Finale del torneo",
  group: "Torneo · girone",
  tournament: "Torneo",
};

const fmtWhen = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const fmtTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;
};

// Chip "❤ Nome 52 → 34 (−18)" di una voce con traccia PF.
export function HpTrace({ entry, players }) {
  const parts = hpTraceParts(entry, players);
  if (!parts.length) return null;
  return (
    <span className="achr-hp">
      {parts.map(p => (
        <span key={p.id} className={`achr-hp-chip ${p.delta < 0 ? "is-down" : "is-up"}`}>
          ❤ {p.name} {p.from} → {p.to} <b>({p.delta > 0 ? "+" : "−"}{Math.abs(p.delta)})</b>
        </span>
      ))}
    </span>
  );
}

function ChronicleEntry({ entry, index, players, viewerUid, renderText, detail }) {
  const obj = entry && typeof entry === "object" ? entry : null;
  const main = renderText(entry, viewerUid);
  // Dettaglio dei tiri: la versione dell'attaccante ha la scomposizione completa.
  const shown = typeof main === "string" ? main : null;
  const extra = detail && obj?.att && obj.att !== (obj.pub || "") && obj.att !== shown ? obj.att : null;
  const ts = fmtTime(obj?.ts);
  return (
    <li className={`achr-line${obj?.audit ? " is-audit" : ""}${obj?.hp ? " has-hp" : ""}`}>
      <span className="achr-n">{index + 1}</span>
      <div className="achr-body">
        <p className="achr-text">
          {ts && <span className="achr-ts">{ts}</span>}
          {main}
        </p>
        {extra && <p className="achr-detail">🎲 {renderText(extra, null)}</p>}
        <HpTrace entry={obj} players={players} />
      </div>
    </li>
  );
}

function ChronicleCard({ c, viewerUid, renderText, keepLeft, open, onToggle }) {
  const [detail, setDetail] = useState(false);
  const players = c.players || [];
  const logs = Array.isArray(c.logs) ? c.logs : [];
  const me = players.find(p => p.id === viewerUid);
  const result = !me ? null : c.winner === viewerUid ? "win" : c.winner ? "loss" : "draw";
  return (
    <article className={`achr-card${open ? " is-open" : ""}${result ? ` is-${result}` : ""}`}>
      <button type="button" className="achr-head" onClick={onToggle} aria-expanded={open}>
        <span className="achr-kind">{KIND_LABEL[c.kind] || "Match"}{c.ai ? " · contro l'IA" : ""}</span>
        <span className="achr-vs">
          {players.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <i className="achr-vs-sep">VS</i>}
              <span className={`achr-fighter${p.id === c.winner ? " is-winner" : ""}`}>
                {p.id === c.winner ? "👑 " : ""}{p.name}
                <small>{p.hpEnd ?? "?"}/{p.maxHp ?? "?"} PF</small>
              </span>
            </React.Fragment>
          ))}
        </span>
        <span className="achr-meta">
          {result === "win" && <b className="achr-res is-win">Vittoria</b>}
          {result === "loss" && <b className="achr-res is-loss">Sconfitta</b>}
          <span>{fmtWhen(c.finishedAt)}</span>
          <span>{logs.length} eventi</span>
          {keepLeft != null && (
            <span className="achr-keep" title="Le cronache si conservano per i tuoi prossimi 7 match, poi si cancellano">
              {keepLeft > 0 ? `resta per altri ${keepLeft} match` : "la prossima la sostituisce"}
            </span>
          )}
        </span>
        <span className="achr-chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="achr-log">
          <label className="achr-detail-toggle">
            <input type="checkbox" checked={detail} onChange={e => setDetail(e.target.checked)} />
            Mostra il dettaglio dei tiri
          </label>
          <ol className="achr-lines">
            {logs.map((l, i) => (
              <ChronicleEntry key={i} entry={l} index={i} players={players}
                viewerUid={viewerUid} renderText={renderText} detail={detail} />
            ))}
          </ol>
          {logs.length === 0 && <p className="achr-empty">— Nessun evento registrato —</p>}
        </div>
      )}
    </article>
  );
}

export default function ArenaChronicles({ currentUid, isMaster, renderText }) {
  const [scope, setScope] = useState("mine");
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    const load = scope === "all" && isMaster ? loadAllChronicles() : loadChronicles(currentUid);
    load.then(r => { if (alive) setList(r); })
      .catch(e => { if (alive) { setErr(e?.message || String(e)); setList([]); } });
    return () => { alive = false; };
  }, [scope, currentUid, isMaster]);

  // Posizione nelle MIE ultime 8 → per quanti match resta ancora.
  const myOrder = useMemo(() => {
    const mine = (list || []).filter(c => (c.keepFor || []).includes(currentUid));
    return new Map(mine.map((c, i) => [c.id, CHRONICLE_KEEP - 1 - i]));
  }, [list, currentUid]);

  return (
    <section className="achr">
      <div className="nx-testata">
        <span className="nx-kicker">Archivio del Colosseo</span>
        <h2 className="nx-titolo">Cronache dei Match</h2>
        <p className="nx-sotto">
          Ogni scontro concluso, riga per riga, con i PF di tutti prima e dopo ogni azione.
          Una cronaca resta per i tuoi prossimi {CHRONICLE_KEEP - 1} match, poi si cancella.
        </p>
      </div>

      {isMaster && (
        <div className="achr-scope" role="group" aria-label="Quali cronache">
          <button type="button" aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Le mie</button>
          <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>Tutte</button>
        </div>
      )}

      {err && <p className="achr-err">Non riesco a leggere le cronache: {err}</p>}
      {list === null && <p className="achr-empty">Carico le cronache…</p>}
      {list && list.length === 0 && !err && (
        <p className="achr-empty">Nessuna cronaca ancora: comparirà qui alla fine del tuo prossimo match.</p>
      )}
      <div className="achr-list">
        {(list || []).map(c => (
          <ChronicleCard
            key={c.id}
            c={c}
            viewerUid={currentUid}
            renderText={renderText}
            keepLeft={myOrder.has(c.id) ? myOrder.get(c.id) : null}
            open={openId === c.id}
            onToggle={() => setOpenId(v => (v === c.id ? null : c.id))}
          />
        ))}
      </div>
    </section>
  );
}
