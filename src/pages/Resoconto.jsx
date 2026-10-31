/* ============================================================
   RESOCONTO (2026-10-31) — /resoconto, dal menu dell'avatar.
   Login del mese (characters.loginRewards, contato dal server), punti
   pet e cosa si è già letto/visitato per prenderli (pet_reads, scritto
   solo dalla function petReadReward) e cosa manca.
   Il Master sceglie di chi vedere il resoconto. Finché il Rifugio dei
   Pet è solo del Master, punti e letture li vede solo lui (PETS_PUBLIC).
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import { LoginTrack } from "../components/LoginRewards";
import { loginState, monthLabel, romeMonthKey } from "../data/loginRewards";
import { READ_PAGES, READ_POINTS, READ_KIND_LABEL } from "../data/petReads";
import "./Resoconto.css";

// Quando il Rifugio dei Pet aprirà a tutti: true.
const PETS_PUBLIC = false;

const fmtDay = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "—");
const stripHtml = (t) => String(t || "").replace(/<[^>]*>/g, " ");

function ReadGroup({ kind, items, done, onlyMissing }) {
  const [open, setOpen] = useState(false);
  const got = items.filter((i) => done.has(`${kind}:${i.id}`));
  const pts = READ_POINTS[kind];
  const shown = onlyMissing ? items.filter((i) => !done.has(`${kind}:${i.id}`)) : items;
  const pct = items.length ? Math.round((got.length / items.length) * 100) : 0;
  return (
    <div className="rc-group">
      <button type="button" className="rc-group-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="rc-group-title">{READ_KIND_LABEL[kind]}</span>
        <span className="rc-group-count">{got.length}/{items.length}</span>
        <span className="rc-bar"><span style={{ width: `${pct}%` }} /></span>
        <span className="rc-group-pts">{got.length * pts} pt presi · {(items.length - got.length) * pts} da prendere</span>
        <span className="rc-group-arrow">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <ul className="rc-list">
          {!shown.length && <li className="rc-empty">Tutto fatto qui.</li>}
          {shown.map((i) => {
            const ok = done.has(`${kind}:${i.id}`);
            return (
              <li key={i.id} className={ok ? "is-done" : ""}>
                <span className="rc-mark" aria-label={ok ? "fatto" : "da fare"}>{ok ? "✓" : "·"}</span>
                <span className="rc-name">{i.label}</span>
                {i.sub && <small>{i.sub}</small>}
                {ok ? <small className="rc-pts">+{pts}</small> : i.to ? <Link to={i.to} className="rc-go">{kind === "page" ? "Visita" : "Leggi"} →</Link> : <small className="rc-pts">{pts} pt</small>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Resoconto() {
  const { currentUser } = useAuth();
  const master = isMainMaster(currentUser?.email);
  const petsVisible = PETS_PUBLIC || master;
  const [chars, setChars] = useState([]);
  const [target, setTarget] = useState(null);
  const [char, setChar] = useState(null);
  const [reads, setReads] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const uid = target || currentUser?.uid;

  // Il Master sceglie il giocatore.
  useEffect(() => {
    if (!master) return;
    getDocs(collection(db, "characters")).then((snap) => {
      setChars(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.name)
        .sort((a, b) => Number(isHiddenChar(a)) - Number(isHiddenChar(b)) || a.name.localeCompare(b.name)));
    });
  }, [master]);

  useEffect(() => {
    if (!uid) return undefined;
    setChar(null);
    return onSnapshot(doc(db, "characters", uid), (s) => setChar(s.exists() ? s.data() : {}));
  }, [uid]);

  useEffect(() => {
    if (!uid || !petsVisible) return undefined;
    return onSnapshot(query(collection(db, "pet_reads"), where("uid", "==", uid)),
      (snap) => setReads(snap.docs.map((d) => d.data())), () => setReads([]));
  }, [uid, petsVisible]);

  // Tutto ciò che si può leggere: cronache, NPC, luoghi, pagine.
  useEffect(() => {
    if (!petsVisible) return;
    Promise.all([
      getDocs(collection(db, "summaries")),
      getDocs(collection(db, "npcs")),
      getDocs(collection(db, "geo_archive")),
    ]).then(([s, n, g]) => {
      const sum = s.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.group || "").localeCompare(String(b.group || "")) || (Number(a.order) || 0) - (Number(b.order) || 0))
        .map((d) => ({ id: d.id, label: d.title || "Senza titolo", sub: d.group || "", to: `/riassunto/${d.id}` }));
      const npc = n.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.name)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ id: d.id, label: d.name, sub: d.linkedCity || stripHtml(d.role).slice(0, 40), to: "/npc" }));
      const geo = g.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.name)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ id: d.id, label: d.name, sub: d.continent || "", to: "/Geo" }));
      const page = READ_PAGES.map((p) => ({ id: p.key, label: p.label, to: p.path }));
      setCatalog({ summary: sum, npc, geo, page });
    }).catch(() => setCatalog({ summary: [], npc: [], geo: [], page: READ_PAGES.map((p) => ({ id: p.key, label: p.label, to: p.path })) }));
  }, [petsVisible]);

  const done = useMemo(() => new Set(reads.map((r) => `${r.kind}:${r.id}`)), [reads]);
  const month = romeMonthKey();
  const lr = char?.loginRewards || {};
  const login = loginState(lr, month);
  const readPts = reads.reduce((a, r) => a + (Number(r.points) || 0), 0);
  const totals = catalog ? Object.entries(catalog).reduce((acc, [k, list]) => {
    acc.all += list.length * READ_POINTS[k];
    acc.got += list.filter((i) => done.has(`${k}:${i.id}`)).length * READ_POINTS[k];
    return acc;
  }, { all: 0, got: 0 }) : null;

  if (!currentUser) return <section className="rc-page"><p>Accedi per vedere il tuo resoconto.</p></section>;

  return (
    <section className="rc-page">
      <header className="rc-head">
        <div>
          <p className="rc-eyebrow">Il tuo cammino</p>
          <h1>Resoconto</h1>
          <p className="rc-sub">Login del mese{petsVisible ? ", punti pet e cosa hai già letto o visitato per prenderli" : ""}.</p>
        </div>
        {char && (
          <div className="rc-who">
            <img src={char.image || "/assets/player/default.png"} alt="" />
            <b>{char.name || "—"}</b>
          </div>
        )}
      </header>

      {master && (
        <label className="rc-pick">
          <span>Resoconto di</span>
          <select value={target || ""} onChange={(e) => setTarget(e.target.value || null)}>
            <option value="">me stesso</option>
            {chars.map((c) => <option key={c.id} value={c.id}>{c.name}{isHiddenChar(c) ? " (inattivo)" : ""}</option>)}
          </select>
        </label>
      )}

      {!char ? <p className="rc-sub">Carico…</p> : (
        <>
          <section className="rc-card">
            <h2>🗓 Login di {monthLabel(month)}</h2>
            <div className="rc-stats">
              <div><b>{login.count}</b><small>login questo mese</small></div>
              <div><b>{lr.logins || 0}</b><small>login in tutto</small></div>
              <div><b>{lr.month === month ? lr.wonMonth || 0 : 0}</b><small>Corone vinte nel mese</small></div>
              <div><b>{lr.wonTotal || 0}</b><small>Corone vinte in tutto</small></div>
            </div>
            <p className="rc-line">Ultimo login: <b>{fmtDay(lr.lastDay)}</b> · {login.next ? <>prossimo premio al <b>{login.next.n}° login</b> (+{login.next.amount} Corone)</> : "tutti i premi del mese presi"}</p>
            <LoginTrack count={login.count} month={month} />
          </section>

          {petsVisible && (
            <>
              <section className="rc-card">
                <h2>🐾 Punti pet</h2>
                <div className="rc-stats">
                  <div><b>{Number(char.petPoints) || 0}</b><small>punti pet ora</small></div>
                  <div><b>{readPts}</b><small>presi con letture e visite</small></div>
                  {totals && <div><b>{totals.all - totals.got}</b><small>ancora da prendere leggendo</small></div>}
                </div>
                {(char.petPointsLedger || []).length > 0 && (
                  <ul className="rc-ledger">
                    {char.petPointsLedger.slice(0, 10).map((l, i) => (
                      <li key={i}><span>{l.label}</span><b>+{l.amount}</b><small>{String(l.ts || "").slice(0, 10)}</small></li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rc-card">
                <div className="rc-card-head">
                  <h2>📚 Letture e visite</h2>
                  <label className="rc-toggle"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Solo quelle da fare</label>
                </div>
                <p className="rc-line">Ogni cronaca, NPC, luogo o pagina dà i punti <b>una volta sola</b>: cronaca {READ_POINTS.summary} pt, NPC {READ_POINTS.npc}, luogo {READ_POINTS.geo}, pagina {READ_POINTS.page}. Conta dopo qualche secondo che l'hai aperta.</p>
                {!catalog ? <p className="rc-sub">Carico l'elenco…</p> : (
                  ["summary", "npc", "geo", "page"].map((k) => (
                    <ReadGroup key={k} kind={k} items={catalog[k]} done={done} onlyMissing={onlyMissing} />
                  ))
                )}
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
