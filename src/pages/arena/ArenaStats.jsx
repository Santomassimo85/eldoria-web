// Statistiche, Albo delle gesta e campioni.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

// ── Master tournament class stats ───────────────────────────────────────────
export const CLASS_ICONS = {
  fighter: "⚔", guerriero: "⚔",
  barbarian: "🪓", barbaro: "🪓",
  paladin: "🛡", paladino: "🛡",
  ranger: "🏹", pattugliatore: "🏹",
  monk: "👊", monaco: "👊",
  rogue: "🗡", ladro: "🗡",
  wizard: "🧙", mago: "🧙",
  sorcerer: "🔥", stregone: "🔥",
  warlock: "👁",
  druid: "🌿", druido: "🌿",
  cleric: "✨", chierico: "✨",
  bard: "🎵", bardo: "🎵",
};

// Nome italiano delle classi (solo etichetta a video; la chiave interna resta inglese).
export const CLASS_IT = {
  Fighter: "Guerriero", Barbarian: "Barbaro", Paladin: "Paladino", Ranger: "Ranger",
  Monk: "Monaco", Rogue: "Ladro", Wizard: "Mago", Sorcerer: "Stregone",
  Warlock: "Warlock", Druid: "Druido", Cleric: "Chierico", Bard: "Bardo", Artificer: "Artefice",
};

// Colore per classe (grafici Gesta). Chiave = classe lowercase (IT o EN).
export const CLASS_COLORS = {
  fighter: "#d9463b", guerriero: "#d9463b",
  barbarian: "#8e44ad", barbaro: "#8e44ad",
  paladin: "var(--oro)", paladino: "var(--oro)",
  ranger: "#27ae60", pattugliatore: "#27ae60",
  monk: "#16a085", monaco: "#16a085",
  rogue: "#7f8c8d", ladro: "#7f8c8d",
  wizard: "#2980b9", mago: "#2980b9",
  sorcerer: "#e67e22", stregone: "#e67e22",
  warlock: "#9b59b6",
  druid: "#2ecc71", druido: "#2ecc71",
  cleric: "#f1c40f", chierico: "#f1c40f",
  bard: "#e84393", bardo: "#e84393",
};
export const classColor = (cls) => CLASS_COLORS[(cls || "").toLowerCase().trim()] || "#8a7a4f";
export const capClass   = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Ciambella SVG leggera (nessuna dipendenza): segmenti proporzionali.
export function StatsDonut({ segments, size = 168, thickness = 28, centerNum, centerSub }) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="stats-donut" role="img" aria-label="Distribuzione classi">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={thickness} />
        {total > 0 && segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const seg = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-acc} />
          );
          acc += len;
          return seg;
        })}
      </g>
      <text x="50%" y="46%" textAnchor="middle" className="stats-donut-num">{centerNum}</text>
      {centerSub && <text x="50%" y="61%" textAnchor="middle" className="stats-donut-sub">{centerSub}</text>}
    </svg>
  );
}

export const GESTA_RANGES = [
  { key: "7",   label: "7 giorni",  days: 7 },
  { key: "30",  label: "30 giorni", days: 30 },
  { key: "90",  label: "90 giorni", days: 90 },
  { key: "all", label: "Sempre",    days: null },
];

// ── "Le Mie Gesta": riepilogo statistico del giocatore (classi, vittorie, W/L)
// filtrabile per periodo; il Master può passare alla vista globale (tutti).
// Fonte unica: arena_tournament_history (già in stato del genitore). ──
export function ArenaGestaView({ tournamentHistory, currentUid, isMaster }) {
  const [rangeKey, setRangeKey] = useState("30");
  const [scope, setScope]       = useState("me"); // "me" | "global" (solo master)
  const range = GESTA_RANGES.find(r => r.key === rangeKey) || GESTA_RANGES[1];

  const dataset = useMemo(() => {
    const cutoff = range.days ? Date.now() - range.days * 86400000 : 0;
    return (tournamentHistory || []).filter(t => {
      const ms = t.ts?.toMillis ? t.ts.toMillis() : (t.ts?.seconds ? t.ts.seconds * 1000 : 0);
      return ms >= cutoff;
    });
  }, [tournamentHistory, range.days]);

  // Riepilogo personale
  const me = useMemo(() => {
    let tournaments = 0, won = 0, mW = 0, mL = 0;
    const perClass = {};
    dataset.forEach(t => {
      const p = (t.participants || []).find(x => x.uid === currentUid);
      if (!p) return;
      tournaments++;
      if (t.winnerId === currentUid) won++;
      const w = p.matchWins || 0, l = p.matchLosses || 0;
      mW += w; mL += l;
      const cls = (p.class || "").toLowerCase().trim();
      if (cls) {
        perClass[cls] = perClass[cls] || { uses: 0, wins: 0, losses: 0 };
        perClass[cls].uses++; perClass[cls].wins += w; perClass[cls].losses += l;
      }
    });
    const classes = Object.entries(perClass)
      .map(([cls, v]) => ({ cls, ...v }))
      .sort((a, b) => b.uses - a.uses || b.wins - a.wins);
    const tot = mW + mL;
    return { tournaments, won, mW, mL, winrate: tot ? (mW / tot) * 100 : 0, classes };
  }, [dataset, currentUid]);

  // Aggregato globale (tutti i giocatori) — solo Master
  const glob = useMemo(() => {
    const perClass = {}, perPlayer = {};
    let parts = 0, matches = 0;
    dataset.forEach(t => {
      (t.participants || []).forEach(p => {
        const cls = (p.class || "").toLowerCase().trim();
        const w = p.matchWins || 0, l = p.matchLosses || 0;
        parts++; matches += w + l;
        if (cls) {
          perClass[cls] = perClass[cls] || { uses: 0, wins: 0, matches: 0 };
          perClass[cls].uses++; perClass[cls].wins += w; perClass[cls].matches += w + l;
        }
        if (p.uid) {
          perPlayer[p.uid] = perPlayer[p.uid] || { uid: p.uid, name: p.name || "—", plays: 0, won: 0, mW: 0, mL: 0 };
          perPlayer[p.uid].plays++; perPlayer[p.uid].mW += w; perPlayer[p.uid].mL += l;
        }
      });
      if (t.winnerId && perPlayer[t.winnerId]) perPlayer[t.winnerId].won++;
    });
    const classes = Object.entries(perClass).map(([cls, v]) => ({
      cls, uses: v.uses, wins: v.wins, matches: v.matches,
      usage:   parts ? (v.uses / parts) * 100 : 0,
      winrate: v.matches ? (v.wins / v.matches) * 100 : 0,
    })).sort((a, b) => b.uses - a.uses || b.wins - a.wins);
    const players = Object.values(perPlayer)
      .sort((a, b) => b.won - a.won || b.mW - a.mW).slice(0, 10);
    return { classes, players, tournaments: dataset.length, parts, matches, activePlayers: Object.keys(perPlayer).length };
  }, [dataset]);

  const periodTxt = range.days ? `ultimi ${range.label}` : "di sempre";

  return (
    <div className="arena-gesta">
      <header className="gesta-head">
        <h2 className="gesta-title">{scope === "global" ? "🌍 Gesta di Tutti" : "⚔ Le Mie Gesta"}</h2>
        <p className="gesta-sub">Classi giocate, vittorie e statistiche · {periodTxt}.</p>
      </header>

      <div className="gesta-controls">
        <div className="gesta-ranges" role="tablist" aria-label="Periodo">
          {GESTA_RANGES.map(r => (
            <button key={r.key} type="button"
              className={`gesta-range ${rangeKey === r.key ? "active" : ""}`}
              onClick={() => setRangeKey(r.key)}>{r.label}</button>
          ))}
        </div>
        {isMaster && (
          <div className="gesta-scope" role="tablist" aria-label="Ambito">
            <button type="button" className={`gesta-scope-btn ${scope === "me" ? "active" : ""}`} onClick={() => setScope("me")}>👤 Io</button>
            <button type="button" className={`gesta-scope-btn ${scope === "global" ? "active" : ""}`} onClick={() => setScope("global")}>🌍 Tutti</button>
          </div>
        )}
      </div>

      {scope === "me" ? (
        me.tournaments === 0 ? (
          <p className="gesta-empty">Nessun torneo disputato in questo periodo. Allarga l'intervallo o scendi in campo!</p>
        ) : (
          <>
            <div className="gesta-tiles">
              <div className="gesta-tile"><span className="gt-num">{me.tournaments}</span><span className="gt-lab">Tornei</span></div>
              <div className="gesta-tile gt-gold"><span className="gt-num">{me.won}</span><span className="gt-lab">Tornei vinti</span></div>
              <div className="gesta-tile"><span className="gt-num">{me.mW}</span><span className="gt-lab">Match vinti</span></div>
              <div className="gesta-tile"><span className="gt-num">{me.mL}</span><span className="gt-lab">Match persi</span></div>
              <div className="gesta-tile"><span className="gt-num">{me.winrate.toFixed(0)}%</span><span className="gt-lab">Win rate</span></div>
            </div>

            <div className="gesta-chart-card">
              <h3 className="gesta-card-title">🎭 Le classi che hai giocato</h3>
              <div className="gesta-chart-row">
                <StatsDonut
                  segments={me.classes.map(c => ({ value: c.uses, color: classColor(c.cls) }))}
                  centerNum={me.classes.length}
                  centerSub={me.classes.length === 1 ? "classe" : "classi"}
                />
                <ul className="gesta-legend">
                  {me.classes.map(c => {
                    const tot = c.wins + c.losses;
                    return (
                      <li key={c.cls} className="gesta-legend-row">
                        <span className="gl-dot" style={{ background: classColor(c.cls) }} />
                        <span className="gl-ico">{CLASS_ICONS[c.cls] || "❔"}</span>
                        <span className="gl-name">{capClass(c.cls)}</span>
                        <span className="gl-uses">{c.uses}× {c.uses === 1 ? "torneo" : "tornei"}</span>
                        <span className="gl-wl">{c.wins}V–{c.losses}S{tot ? ` · ${((c.wins / tot) * 100).toFixed(0)}%` : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        )
      ) : (
        glob.parts === 0 ? (
          <p className="gesta-empty">Nessun torneo archiviato in questo periodo.</p>
        ) : (
          <>
            <div className="gesta-tiles">
              <div className="gesta-tile"><span className="gt-num">{glob.tournaments}</span><span className="gt-lab">Tornei</span></div>
              <div className="gesta-tile"><span className="gt-num">{glob.activePlayers}</span><span className="gt-lab">Giocatori</span></div>
              <div className="gesta-tile"><span className="gt-num">{glob.parts}</span><span className="gt-lab">Partecipazioni</span></div>
              <div className="gesta-tile"><span className="gt-num">{glob.matches}</span><span className="gt-lab">Match giocati</span></div>
            </div>

            <div className="gesta-chart-card">
              <h3 className="gesta-card-title">🏹 Classi più usate</h3>
              <div className="gesta-chart-row">
                <StatsDonut
                  segments={glob.classes.map(c => ({ value: c.uses, color: classColor(c.cls) }))}
                  centerNum={glob.parts}
                  centerSub="scelte"
                />
                <ul className="gesta-legend">
                  {glob.classes.map(c => (
                    <li key={c.cls} className="gesta-legend-row">
                      <span className="gl-dot" style={{ background: classColor(c.cls) }} />
                      <span className="gl-ico">{CLASS_ICONS[c.cls] || "❔"}</span>
                      <span className="gl-name">{capClass(c.cls)}</span>
                      <span className="gl-uses">{c.usage.toFixed(0)}% <em>({c.uses})</em></span>
                      <span className="gl-wl">win {c.winrate.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="gesta-chart-card">
              <h3 className="gesta-card-title">📊 Uso e vittorie per classe</h3>
              <div className="class-stats-list">
                {glob.classes.map((row, i) => (
                  <div key={row.cls} className="class-stats-row">
                    <div className="class-stats-rank">#{i + 1}</div>
                    <div className="class-stats-icon">{CLASS_ICONS[row.cls] || "❔"}</div>
                    <div className="class-stats-name">{capClass(row.cls)}</div>
                    <div className="class-stats-bars">
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Uso</span>
                        <div className="class-stats-bar-track"><div className="class-stats-bar-fill usage" style={{ width: `${row.usage}%` }} /></div>
                        <span className="class-stats-bar-val">{row.usage.toFixed(0)}%</span>
                      </div>
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Win</span>
                        <div className="class-stats-bar-track"><div className="class-stats-bar-fill winrate" style={{ width: `${row.winrate}%` }} /></div>
                        <span className="class-stats-bar-val">{row.winrate.toFixed(0)}% <em>({row.wins}/{row.matches})</em></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="gesta-chart-card">
              <h3 className="gesta-card-title">🏆 Giocatori più vincenti</h3>
              <ol className="gesta-players">
                {glob.players.map((p, i) => (
                  <li key={p.uid} className="gesta-player-row">
                    <span className="gp-rank">{i + 1}</span>
                    <span className="gp-name">{p.name}</span>
                    <span className="gp-stat">🏆 {p.won}</span>
                    <span className="gp-stat">⚔ {p.mW}V–{p.mL}S</span>
                    <span className="gp-stat">🎟 {p.plays}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )
      )}
    </div>
  );
}

export function HallOfChampions({ champions, isMaster, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hall-of-champions">
      <button className="hall-toggle" onClick={() => setOpen(v => !v)}>
        {open ? "▲" : "▼"} 🏆 Sala dei Campioni <span className="hall-count">({champions.length})</span>
      </button>
      {open && (
        <div className="hall-body">
          {champions.length === 0 ? (
            <p className="hall-empty">Nessun campione ancora. Vinci un torneo per entrare nella Sala.</p>
          ) : (
            <div className="hall-list">
              {champions.map((c, i) => (
                <div key={c.uid} className="hall-row">
                  <div className="hall-rank">#{i + 1}</div>
                  {c.image ? <img src={c.image} alt="" className="hall-avatar" /> : <div className="hall-avatar placeholder">{CLASS_ICONS[c.class] || "♛"}</div>}
                  <div className="hall-info">
                    <div className="hall-name">{c.name || "Campione"}</div>
                    {c.class && <div className="hall-class">{CLASS_ICONS[c.class] || "❔"} {c.class}</div>}
                  </div>
                  <div className="hall-wins" title={`${c.wins} vittorie`}>
                    <span className="hall-wins-num">{c.wins}</span>
                    <span className="hall-wins-label">{c.wins === 1 ? "vittoria" : "vittorie"}</span>
                  </div>
                  {isMaster && (
                    <button className="hall-remove" title="Rimuovi dalla Sala (solo master)" onClick={() => onRemove(c.uid)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TournamentClassStats({ liveTournament, onSync, forceOpen = false }) {
  /* FIX: P5c — forceOpen renders body unconditionally (used inside modal) */
  const [openState, setOpen] = useState(false);
  const open                  = forceOpen || openState;
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded]   = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  useEffect(() => {
    if (!open) return;
    const unsub = onSnapshot(collection(db, "arena_tournament_history"), (snap) => {
      setHistory(snap.docs.map(d => d.data()));
      setLoaded(true);
    });
    return () => unsub();
  }, [open]);

  const { top, totalTournaments, totalPart, totalMatches, includesLive } = useMemo(() => {
    const perClass = {};
    let totalPartLocal = 0;
    let totalMatchesLocal = 0;
    const dataset = [...history];
    if (liveTournament) dataset.push(liveTournament);
    dataset.forEach(t => {
      (t.participants || []).forEach(p => {
        const cls = (p.class || "").toLowerCase().trim();
        if (!cls) return;
        const played = (p.matchWins ?? 0) + (p.matchLosses ?? 0);
        perClass[cls] = perClass[cls] || { uses: 0, matches: 0, wins: 0 };
        perClass[cls].uses++;
        perClass[cls].matches += played;
        perClass[cls].wins    += (p.matchWins ?? 0);
        totalPartLocal++;
        totalMatchesLocal += played;
      });
    });
    const arr = Object.entries(perClass).map(([cls, v]) => ({
      cls,
      uses:    v.uses,
      matches: v.matches,
      wins:    v.wins,
      usage:   totalPartLocal > 0 ? (v.uses / totalPartLocal) * 100 : 0,
      winrate: v.matches > 0 ? (v.wins / v.matches) * 100 : 0,
    }));
    arr.sort((a, b) => b.uses - a.uses || b.wins - a.wins);
    return {
      top: arr.slice(0, 5),
      totalTournaments: history.length + (liveTournament ? 1 : 0),
      totalPart: totalPartLocal,
      totalMatches: totalMatchesLocal,
      includesLive: !!liveTournament,
    };
  }, [history, liveTournament]);

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  return (
    <div className={`class-stats-section${forceOpen ? " in-modal" : ""}`}>
      {!forceOpen && (
        <button className="class-stats-toggle" onClick={() => setOpen(v => !v)}>
          {open ? "▲" : "▼"} 📊 Statistiche Classi — Torneo / Campioni
        </button>
      )}
      {open && (
        <div className="class-stats-body">
          {!loaded ? (
            <p className="class-stats-empty">Caricamento…</p>
          ) : totalPart === 0 ? (
            <p className="class-stats-empty">Nessun torneo archiviato ancora. Le statistiche compariranno dopo il primo torneo concluso.</p>
          ) : (
            <>
              <div className="class-stats-meta">
                <span>🏆 Tornei {includesLive ? "(incluso quello in corso)" : "archiviati"}: <strong>{totalTournaments}</strong></span>
                <span>👥 Partecipazioni: <strong>{totalPart}</strong></span>
                <span>⚔ Match giocati: <strong>{totalMatches}</strong></span>
                {includesLive && <span className="class-stats-live-badge">🔴 LIVE</span>}
                {onSync && (
                  <button
                    className="class-stats-sync-btn"
                    disabled={syncing}
                    onClick={async () => {
                      setSyncing(true);
                      setSyncMsg(null);
                      const added = await onSync();
                      setSyncing(false);
                      if (added < 0)       setSyncMsg("❌ Errore sync");
                      else if (added === 0) setSyncMsg("✓ Già aggiornate");
                      else                 setSyncMsg(`✓ +${added / 2} match recuperati`);
                      setTimeout(() => setSyncMsg(null), 4000);
                    }}
                    title="Forza sincronizzazione storico match"
                  >
                    {syncing ? "…" : "🔄 Ricalcola"}
                  </button>
                )}
                {syncMsg && <span className="class-stats-sync-msg">{syncMsg}</span>}
              </div>
              <div className="class-stats-list">
                {top.map((row, i) => (
                  <div key={row.cls} className="class-stats-row">
                    <div className="class-stats-rank">#{i + 1}</div>
                    <div className="class-stats-icon">{CLASS_ICONS[row.cls] || "❔"}</div>
                    <div className="class-stats-name">{capitalize(row.cls)}</div>
                    <div className="class-stats-bars">
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Uso</span>
                        <div className="class-stats-bar-track">
                          <div className="class-stats-bar-fill usage" style={{ width: `${row.usage}%` }} />
                        </div>
                        <span className="class-stats-bar-val">{row.usage.toFixed(0)}% <em>({row.uses})</em></span>
                      </div>
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Win</span>
                        <div className="class-stats-bar-track">
                          <div className="class-stats-bar-fill winrate" style={{ width: `${row.winrate}%` }} />
                        </div>
                        <span className="class-stats-bar-val">{row.winrate.toFixed(0)}% <em>({row.wins}/{row.matches})</em></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Statistiche classi Arena Libera (basate su funMatchHistory) ─────────────
export function FunArenaClassStats({ funHistory, currentMatches, isMaster, onReset, forceOpen = false }) {
  /* FIX: P5c — forceOpen renders body unconditionally (used inside modal) */
  const [openState, setOpen] = useState(false);
  const open = forceOpen || openState;
  const [resetting, setResetting] = useState(false);

  const { top, totalMatches, livePending } = useMemo(() => {
    const perClass = {};
    let totalLocal = 0;
    let liveLocal  = 0;

    // History archiviata
    (funHistory || []).forEach(h => {
      const w = h.winnerClass;
      const l = h.loserClass;
      if (w) {
        perClass[w] = perClass[w] || { uses: 0, wins: 0 };
        perClass[w].uses++;
        perClass[w].wins++;
      }
      if (l) {
        perClass[l] = perClass[l] || { uses: 0, wins: 0 };
        perClass[l].uses++;
      }
      if (w || l) totalLocal++;
    });

    // Match fun ancora in arena_meta non ancora archiviati
    const archived = new Set((funHistory || []).map(h => h.matchId));
    (currentMatches || []).forEach(m => {
      if (m.kind !== "fun" || m.status !== "finished" || !m.players || m.players.length < 2) return;
      if (archived.has(m.matchId)) return;
      const winnerP = m.players.find(p => p.id === m.winner);
      const loserP  = m.players.find(p => p.id !== m.winner);
      const w = (winnerP?.class || "").toLowerCase().trim();
      const l = (loserP?.class  || "").toLowerCase().trim();
      if (w) {
        perClass[w] = perClass[w] || { uses: 0, wins: 0 };
        perClass[w].uses++;
        perClass[w].wins++;
      }
      if (l) {
        perClass[l] = perClass[l] || { uses: 0, wins: 0 };
        perClass[l].uses++;
      }
      if (w || l) { totalLocal++; liveLocal++; }
    });

    const arr = Object.entries(perClass).map(([cls, v]) => ({
      cls,
      uses:    v.uses,
      wins:    v.wins,
      usage:   totalLocal > 0 ? (v.uses / (totalLocal * 2)) * 100 : 0,
      winrate: v.uses > 0 ? (v.wins / v.uses) * 100 : 0,
    }));
    arr.sort((a, b) => b.uses - a.uses || b.wins - a.wins);
    return { top: arr.slice(0, 8), totalMatches: totalLocal, livePending: liveLocal };
  }, [funHistory, currentMatches]);

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  return (
    <div className={`class-stats-section fun-class-stats${forceOpen ? " in-modal" : ""}`}>
      {!forceOpen && (
        <button className="class-stats-toggle fun" onClick={() => setOpen(v => !v)}>
          {open ? "▲" : "▼"} 🛡 Statistiche Classi — Arena Libera
        </button>
      )}
      {open && (
        <div className="class-stats-body">
          {totalMatches === 0 ? (
            <p className="class-stats-empty">Nessuna sfida libera conclusa ancora. Le statistiche compariranno dopo la prima sfida finita.</p>
          ) : (
            <>
              <div className="class-stats-meta">
                <span>⚔ Sfide concluse: <strong>{totalMatches}</strong></span>
                {livePending > 0 && <span className="class-stats-live-badge fun">🔴 {livePending} in attesa archivio</span>}
                {isMaster && onReset && (
                  <button
                    className="class-stats-sync-btn fun"
                    disabled={resetting}
                    onClick={async () => {
                      if (!window.confirm("Azzerare lo storico delle Sfide Libere? L'azione non è reversibile.")) return;
                      setResetting(true);
                      await onReset();
                      setResetting(false);
                    }}
                    title="Cancella tutto lo storico Arena Libera"
                  >
                    {resetting ? "…" : "♻ Azzera"}
                  </button>
                )}
              </div>
              <div className="class-stats-list">
                {top.map((row, i) => (
                  <div key={row.cls} className="class-stats-row">
                    <div className="class-stats-rank">#{i + 1}</div>
                    <div className="class-stats-icon">{CLASS_ICONS[row.cls] || "❔"}</div>
                    <div className="class-stats-name">{capitalize(row.cls)}</div>
                    <div className="class-stats-bars">
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Uso</span>
                        <div className="class-stats-bar-track">
                          <div className="class-stats-bar-fill usage fun" style={{ width: `${row.usage}%` }} />
                        </div>
                        <span className="class-stats-bar-val">{row.usage.toFixed(0)}% <em>({row.uses})</em></span>
                      </div>
                      <div className="class-stats-bar-row">
                        <span className="class-stats-bar-label">Win</span>
                        <div className="class-stats-bar-track">
                          <div className="class-stats-bar-fill winrate fun" style={{ width: `${row.winrate}%` }} />
                        </div>
                        <span className="class-stats-bar-val">{row.winrate.toFixed(0)}% <em>({row.wins}/{row.uses})</em></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
