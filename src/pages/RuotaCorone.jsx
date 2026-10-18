// ── Corone di tutti (solo Master principale, 2026-10-17) ─────────────────────
// Saldo in diretta di ogni personaggio (`characters.platinum`) + ogni movimento
// registrato dal server in `platinum_log` (function logPlatinumChange), con chi
// l'ha fatto: anche un cambio dalla console del browser compare qui.
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { isHiddenChar } from "../data/hiddenPlayers";

const SOURCE = {
  ruota: "🎡 Ruota",
  login: "🗓 Premio login",
  server: "⚙ Server",
  master: "🎯 Master",
  self: "🙋 dal giocatore stesso",
  other: "👤 da un altro giocatore",
  nologin: "🕳 senza login (macro/console)",
};

const fmtAt = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", timeZone: "Europe/Rome" })} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Rome" })}`;
};

export default function RuotaCorone({ masterUid }) {
  const [chars, setChars] = useState([]);
  const [log, setLog] = useState([]);
  const [who, setWho] = useState("");
  const [onlySus, setOnlySus] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => onSnapshot(collection(db, "characters"), (s) => {
    setChars(s.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .filter((c) => c.uid !== masterUid && c.name));
  }), [masterUid]);

  useEffect(() => onSnapshot(
    query(collection(db, "platinum_log"), orderBy("at", "desc"), limit(400)),
    (s) => setLog(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => setErr("Registro delle Corone non leggibile (regole non ancora pubblicate?)."),
  ), []);

  const dayAgo = Date.now() - 86400000;
  // Gli inattivi (hiddenPlayers) compaiono solo se le loro Corone si sono mosse.
  const rows = useMemo(() => chars.map((c) => {
    const mine = log.filter((e) => e.uid === c.uid);
    if (isHiddenChar({ ...c, id: c.uid }) && !mine.length) return null;
    return {
      ...c,
      plat: Number(c.platinum || 0),
      d24: mine.filter((e) => Date.parse(e.at) > dayAgo).reduce((t, e) => t + (e.delta || 0), 0),
      sus: mine.filter((e) => e.suspicious).length,
      lastAt: mine[0]?.at,
    };
  }).filter(Boolean).sort((a, b) => b.sus - a.sus || b.plat - a.plat), [chars, log, dayAgo]);

  const feed = log.filter((e) => (!who || e.uid === who) && (!onlySus || e.suspicious));
  const susTot = log.filter((e) => e.suspicious).length;

  return (
    <section className="rex-reg rex-crowns" aria-label="Corone di tutti">
      <h3>👑 Corone di tutti · solo Master</h3>
      {err && <p className="rex-err">{err}</p>}
      <p className="rex-reg-sum">
        Saldi in diretta. Ogni cambio, anche fatto a mano dalla console, lo registra il server con chi l'ha fatto.
        {susTot > 0 && <> <strong className="rex-sus-count">⚠ {susTot} aumenti da controllare</strong></>}
      </p>

      <ul className="rex-crowns-list">
        {rows.map((c) => (
          <li key={c.uid}>
            <button type="button" className={`${who === c.uid ? "is-on" : ""}${c.sus ? " is-sus" : ""}`}
              aria-pressed={who === c.uid} onClick={() => setWho(who === c.uid ? "" : c.uid)}>
              <span className="rex-crowns-name">{c.name}{c.sus ? ` ⚠${c.sus}` : ""}</span>
              <strong className="rex-crowns-plat">{c.plat} 👑</strong>
              <span className={`rex-crowns-d ${c.d24 > 0 ? "up" : c.d24 < 0 ? "down" : ""}`}>
                {c.d24 ? `${c.d24 > 0 ? "+" : ""}${c.d24} in 24 h` : "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="rex-reg-tools">
        <span>Movimenti{who ? ` di ${rows.find((r) => r.uid === who)?.name || ""}` : ""}: <strong>{feed.length}</strong></span>
        {who && <button type="button" className="rex-mini" onClick={() => setWho("")}>Tutti</button>}
        <label><input type="checkbox" checked={onlySus} onChange={(e) => setOnlySus(e.target.checked)} /> solo da controllare</label>
      </div>

      {feed.length === 0 ? <p className="rex-note">Nessun movimento registrato{log.length ? " con questi filtri" : " ancora (si registrano da oggi in poi)"}.</p> : (
        <ul className="rex-moves">
          {feed.map((e) => (
            <li key={e.id} className={e.suspicious ? "is-sus" : ""}>
              <span className="rex-move-who">{e.name}</span>
              <strong className={e.delta > 0 ? "up" : "down"}>{e.delta > 0 ? "+" : ""}{e.delta}</strong>
              <span className="rex-move-bal">{e.before} → {e.after}</span>
              <span className="rex-move-src">
                {e.suspicious ? "⚠ " : ""}{SOURCE[e.source] || e.source}
                {e.byName && e.source !== "self" ? ` (${e.byName})` : ""}
                {e.keys?.length ? ` · insieme a: ${e.keys.join(", ")}` : ""}
              </span>
              <span className="rex-move-at">{fmtAt(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
