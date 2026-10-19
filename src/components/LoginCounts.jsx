// ── Login di tutti (Strumenti DM, 2026-10-19) ───────────────────────────────
// Quanti giorni ha aperto l'app ogni giocatore nel mese, con i giorni segnati.
// Fonte: `login_days/{mese}_{uid}` (lo scrive solo la callable loginDaily; la
// legge solo il Master principale). Se la lettura è negata (co-master) si
// ripiega sullo specchio `characters.loginRewards`, che dice solo il mese in corso.
import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { isHiddenChar } from "../data/hiddenPlayers";
import { daysInMonth, milestones, monthLabel, romeMonthKey } from "../data/loginRewards";

const romeDay = (t = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));

export default function LoginCounts() {
  const [chars, setChars] = useState([]);
  const [days, setDays] = useState([]);
  const [denied, setDenied] = useState(false);
  const [month, setMonth] = useState(romeMonthKey());
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => onSnapshot(collection(db, "characters"),
    (s) => setChars(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => console.warn("[login] characters:", e)), []);
  useEffect(() => onSnapshot(collection(db, "login_days"),
    (s) => setDays(s.docs.map((d) => d.data())),
    () => setDenied(true)), []);

  const today = romeDay();
  const curMonth = romeMonthKey();
  const months = useMemo(() => {
    const set = new Set([curMonth, ...days.map((d) => d.month).filter(Boolean)]);
    return [...set].sort().reverse();
  }, [days, curMonth]);

  const rows = useMemo(() => {
    const byUid = new Map(days.filter((d) => d.month === month).map((d) => [d.uid, d]));
    return chars
      .map((c) => {
        const ld = byUid.get(c.id);
        const lr = c.loginRewards || {};
        const mirror = lr.month === month;
        const list = ld?.days || [];
        const count = ld?.count ?? list.length ?? 0;
        return {
          id: c.id,
          name: c.name || ld?.name || c.id,
          hidden: isHiddenChar(c),
          count: ld ? count : mirror ? (lr.count || 0) : 0,
          days: list,
          last: list[list.length - 1] || (mirror ? lr.lastDay : "") || "",
          won: ld ? (ld.won || 0) : mirror ? (lr.wonMonth || 0) : 0,
          total: lr.logins || 0,
          wonTotal: lr.wonTotal || 0,
        };
      })
      .filter((r) => showHidden || !r.hidden || r.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [chars, days, month, showHidden]);

  const nDays = daysInMonth(month);
  const steps = milestones(month);
  const isCur = month === curMonth;
  const todayCount = rows.filter((r) => r.last === today).length;
  const tot = rows.reduce((a, r) => a + r.count, 0);
  const wonTot = rows.reduce((a, r) => a + r.won, 0);
  const nextStep = (n) => steps.find((s) => s.n > n);
  const dayNums = Array.from({ length: nDays }, (_, i) => i + 1);
  const todayNum = isCur ? Number(today.slice(8)) : nDays + 1;

  return (
    <div className="lgc">
      <div className="lgc-bar">
        <label className="lgc-month">
          <span>Mese</span>
          <select className="npcgen-input" value={month} onChange={(e) => setMonth(e.target.value)} disabled={denied}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)} {m.slice(0, 4)}</option>)}
          </select>
        </label>
        <label className="lgc-check">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Mostra anche gli inattivi
        </label>
      </div>
      {denied && <p className="lgc-note">Lo storico dei giorni lo legge solo il Master principale: qui vedi il conto del mese in corso.</p>}

      <div className="lgc-tiles">
        {isCur && <div className="lgc-tile"><b>{todayCount}</b><span>entrati oggi</span></div>}
        <div className="lgc-tile"><b>{tot}</b><span>login nel mese</span></div>
        <div className="lgc-tile"><b>{rows.filter((r) => r.count > 0).length}</b><span>giocatori entrati</span></div>
        <div className="lgc-tile"><b>{wonTot}</b><span>Corone pagate</span></div>
      </div>

      <ul className="lgc-list">
        {rows.map((r) => {
          const nx = nextStep(r.count);
          const set = new Set(r.days.map((d) => Number(d.slice(8))));
          return (
            <li key={r.id} className={"lgc-row" + (r.count === 0 ? " is-zero" : "")}>
              <div className="lgc-head">
                <span className="lgc-name">
                  {r.last === today && isCur && <i className="lgc-dot" title="Entrato oggi" />}
                  {r.name}{r.hidden && <em> · inattivo</em>}
                </span>
                <span className="lgc-count"><b>{r.count}</b>/{nDays}</span>
              </div>
              <div className="lgc-meta">
                <span>Ultimo: {r.last ? `${Number(r.last.slice(8))} ${monthLabel(r.last.slice(0, 7))}` : "—"}</span>
                <span>👑 {r.won} nel mese</span>
                {nx && <span>Prossima tappa: {nx.n}° (+{nx.amount})</span>}
                <span>A vita: {r.total} login · {r.wonTotal} Corone</span>
              </div>
              {!denied && (
                <div className="lgc-days" style={{ gridTemplateColumns: `repeat(${nDays}, 1fr)` }}>
                  {dayNums.map((n) => (
                    <span key={n} title={`${n} ${monthLabel(month)}`}
                      className={"lgc-d" + (set.has(n) ? " on" : "") + (n > todayNum ? " future" : "")} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
