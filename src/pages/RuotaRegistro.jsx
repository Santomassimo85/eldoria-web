// ── Registro della Ruota (solo Master principale, 2026-10-17) ────────────────
// Tutti i giri dei giocatori, divisi fra vittorie e fallimenti. La fonte è
// `ruota_spins` (un doc per giro, scritto dalla function ruotaSpin); i giri
// fatti prima del server (16–17 ottobre) si recuperano da `characters.ruota.log`.
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

const fmtWhen = (e) => {
  const d = e.at ? new Date(e.at) : new Date(e.day + "T12:00:00");
  const day = d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", timeZone: "Europe/Rome" });
  return e.at ? `${day} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}` : day;
};

const prizeText = (e) => e.amount
  ? `+${e.amount} Corone (${e.dice}: ${(e.rolls || []).join("+")})`
  : e.special ? "📸 Foto con il Master" : e.label;

export default function RuotaRegistro({ masterUid }) {
  const [spins, setSpins] = useState([]);
  const [legacy, setLegacy] = useState([]);
  const [who, setWho] = useState("");
  const [mine, setMine] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "ruota_spins"), orderBy("at", "desc"), limit(1000)),
    (s) => setSpins(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => setErr("Registro non leggibile (regole Firestore non ancora pubblicate?)."),
  ), []);

  useEffect(() => {
    getDocs(collection(db, "characters")).then((s) => {
      const out = [];
      s.forEach((d) => {
        const c = d.data();
        (c.ruota?.log || []).forEach((e) => out.push({ ...e, uid: d.id, name: c.name || d.id, legacy: true }));
      });
      setLegacy(out);
    }).catch(() => {});
  }, []);

  const all = useMemo(() => {
    const seen = new Set(spins.map((e) => `${e.uid}|${e.day}`));
    const old = legacy.filter((e) => !seen.has(`${e.uid}|${e.day}`));
    return [...spins, ...old]
      .map((e) => ({ ...e, win: e.amount > 0 || !!e.special }))
      .sort((a, b) => String(b.at || b.day).localeCompare(String(a.at || a.day)));
  }, [spins, legacy]);

  const masterUids = useMemo(() => new Set([masterUid, ...spins.filter((e) => e.master).map((e) => e.uid)]), [spins, masterUid]);
  const players = useMemo(() => {
    const m = new Map();
    all.forEach((e) => { if (!masterUids.has(e.uid)) m.set(e.uid, e.name); });
    return [...m].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [all, masterUids]);

  const list = all.filter((e) => (mine || !masterUids.has(e.uid)) && (!who || e.uid === who));
  const wins = list.filter((e) => e.win);
  const fails = list.filter((e) => !e.win);
  const coins = wins.reduce((t, e) => t + (e.amount || 0), 0);

  const Col = ({ title, rows, cls }) => (
    <div className={`rex-reg-col ${cls}`}>
      <h4>{title} <span>{rows.length}</span></h4>
      {rows.length === 0 ? <p className="rex-note">Nessun giro.</p> : (
        <ul>
          {rows.map((e) => (
            <li key={e.id || `${e.uid}-${e.at || e.day}`}>
              <span className="rex-reg-who">{e.name}{masterUids.has(e.uid) ? " (prova)" : ""}</span>
              <span className="rex-reg-what">{prizeText(e)}</span>
              <span className="rex-reg-when">{fmtWhen(e)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="rex-reg" aria-label="Registro dei giri">
      <h3>🎯 Registro dei giri · solo Master</h3>
      {err && <p className="rex-err">{err}</p>}
      <p className="rex-reg-sum">
        <strong>{list.length}</strong> giri · <strong>{wins.length}</strong> vinti
        {list.length ? ` (${Math.round((wins.length / list.length) * 100)}%)` : ""} · <strong>{coins}</strong> Corone uscite
      </p>
      <div className="rex-reg-tools">
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Giocatore">
          <option value="">Tutti i giocatori</option>
          {players.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <label><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> anche i miei giri di prova</label>
      </div>
      <div className="rex-reg-cols">
        <Col title="🏆 Vittorie" rows={wins} cls="is-win" />
        <Col title="💨 Fallimenti" rows={fails} cls="is-fail" />
      </div>
    </section>
  );
}
