// ── Premi del login quotidiano (2026-10-18) ─────────────────────────────────
// All'apertura dell'app (e al ritorno in primo piano in un giorno nuovo) chiede
// al server di contare il login di oggi (callable loginDaily). Se è il primo
// login del giorno compare il popup con il conto del mese e il premio; i login
// già contati non mostrano niente. Mai agli inattivi. Il Master principale lo
// vede a OGNI apertura dell'app (una volta per sessione del browser), anche se
// il login di oggi è già contato, per vedere com'è: il conto e il premio sono
// quelli veri del suo personaggio.
// `LoginTrack` = la fila delle tappe, usata anche nel pannello dell'avatar.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import { serverNow } from "../data/serverClock";
import { craftDayKey } from "../data/craftingWeek";
import { holdGate } from "../utils/popupGate";
import { loginState, milestones, monthLabel, romeMonthKey } from "../data/loginRewards";
import "./LoginRewards.css";

const doneKey = (uid, day) => `login_daily_${uid}_${day}`;
const masterSeenKey = (uid) => `login_popup_master_${uid}`;

export function LoginTrack({ count, month, compact = false, fresh = 0 }) {
  const { steps, next, won } = loginState({ month, count }, month);
  return (
    <div className={`lrw-track${compact ? " lrw-track--compact" : ""}`}>
      <ol className="lrw-steps">
        {steps.map((s) => (
          <li
            key={s.n}
            className={`lrw-step${s.done ? " is-done" : ""}${s.big ? " is-big" : ""}${s.nice ? " is-nice" : ""}${fresh === s.n ? " is-fresh" : ""}`}
            title={`${s.n}° login: ${s.amount} Corone${s.done ? " · vinto" : ""}`}
          >
            <span className="lrw-step-n">{s.big ? "👑" : s.done ? "✓" : s.n}</span>
            <span className="lrw-step-amt">{s.amount}</span>
          </li>
        ))}
      </ol>
      <p className="lrw-sum">
        {count} login a {monthLabel(month)} · <b>{won}</b> Corone vinte
        {next
          ? <> · {next.big ? "👑 gran premio" : "prossimo premio"} al {next.n}° login (<b>{next.amount}</b>), ne mancano {next.n - count}</>
          : <> · tutti i premi del mese presi!</>}
      </p>
    </div>
  );
}

export default function LoginRewardPopup() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [res, setRes] = useState(null);
  const releaseRef = useRef(null);

  // DEV: ?loginPopup=5 mostra il popup del 5° login (per vederne l'aspetto, non scrive niente).
  useEffect(() => {
    const n = import.meta.env.DEV && Number(new URLSearchParams(window.location.search).get("loginPopup"));
    if (!n) return;
    const month = romeMonthKey();
    const step = milestones(month).find((m) => m.n === n);
    setRes({ count: n, month, amount: step?.amount || 0, big: !!step?.big, nice: !!step?.nice });
  }, []);

  useEffect(() => {
    if (!uid) return;
    const master = isMainMaster(currentUser?.email);
    let alive = true;
    const release = () => { releaseRef.current?.(); releaseRef.current = null; };
    const check = async () => {
      if (releaseRef.current) return; // già in corso
      releaseRef.current = holdGate();
      try {
        if (master) {
          try { if (sessionStorage.getItem(masterSeenKey(uid))) { release(); return; } } catch { /* storage bloccato */ }
        }
        const d = craftDayKey(await serverNow());
        if (!master) {
          try { if (localStorage.getItem(doneKey(uid, d))) { release(); return; } } catch { /* storage bloccato */ }
        }
        const s = await getDoc(doc(db, "characters", uid));
        if (!alive || !s.exists()) { release(); return; }
        const c = s.data();
        if (!master && (!c.name || isHiddenChar({ ...c, id: uid }))) { release(); return; }
        if (!master && c.loginRewards?.lastDay === d) { try { localStorage.setItem(doneKey(uid, d), "1"); } catch { /* niente */ } release(); return; }
        const { data } = await httpsCallable(functions, "loginDaily")();
        try { localStorage.setItem(doneKey(uid, data.day), "1"); } catch { /* niente */ }
        if (master) try { sessionStorage.setItem(masterSeenKey(uid), "1"); } catch { /* niente */ }
        if (!alive) { release(); return; }
        if (data.already) {
          if (!master) { release(); return; }
          // Master: login già contato oggi, mostra il popup col conto attuale (premio già preso)
          const step = milestones(data.month).find((m) => m.n === data.count);
          setRes({ ...data, amount: 0, big: false, nice: false, already: true, stepAmount: step?.amount || 0 });
          return;
        }
        // Punti pet del login (Rifugio dei Pet, 2026-10-31): 1 al giorno.
        import("../utils/pet").then(({ awardPetPoints }) => awardPetPoints(uid, "daily_login")).catch(() => {});
        setRes(data); // il cancello si apre alla chiusura del popup
      } catch {
        release(); // niente rete o niente server: si riprova alla prossima apertura
      }
    };
    check();
    const onVis = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); release(); };
  }, [uid, currentUser?.email]);

  const close = () => { setRes(null); releaseRef.current?.(); releaseRef.current = null; };

  useEffect(() => {
    if (!res) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [res]);

  if (!res) return null;
  const { count, month, amount, big, nice, already, stepAmount } = res;
  const { next } = loginState({ month, count }, month);

  return createPortal(
    <div className="lrw-popup" role="dialog" aria-modal="true" aria-labelledby="lrw-title" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`lrw-card${big ? " is-big" : nice ? " is-nice" : ""}`}>
        <span className="lrw-kicker">Bentornato a Eldoria</span>
        <h2 id="lrw-title">{big ? "👑 Gran premio del mese!" : `🗓 ${count}° login di ${monthLabel(month)}`}</h2>
        {already ? (
          <p className="lrw-noprize">
            Il login di oggi è già contato{stepAmount ? <> (premio di <b>{stepAmount}</b> Corone già riscosso)</> : ""}.
            {next && <> Al {next.n}° login ne arrivano <b>{next.amount}</b>.</>}
          </p>
        ) : amount > 0 ? (
          <p className="lrw-prize">
            <span className="lrw-prize-n">+{amount}</span>
            <span className="lrw-prize-l">Corone del Mercato Nero</span>
          </p>
        ) : (
          <p className="lrw-noprize">
            Oggi niente Corone, ma il login conta.
            {next && <> Al {next.n}° login ne arrivano <b>{next.amount}</b>.</>}
          </p>
        )}
        <LoginTrack count={count} month={month} fresh={amount ? count : 0} />
        <button type="button" className="lrw-ok" onClick={close} autoFocus>
          {amount ? "Riscuoti" : "Continua"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
