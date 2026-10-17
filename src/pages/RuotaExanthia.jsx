// ── /ruota: La Ruota di Exanthia (2026-10-16) ─────────────────────────────────
// Un giro al giorno, premi in Corone del Mercato Nero (`characters.platinum`).
// Il giorno lo decide l'ora del SERVER (serverClock), non il telefono, e il giro
// si scrive in una transazione PRIMA dell'animazione: ricaricare la pagina a
// ruota in movimento non fa rigirare. Il Master gira "a vuoto" (prova, non conta).
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { doc, increment, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import GlacierHero from "../components/glacier/GlacierHero";
import { serverNow } from "../data/serverClock";
import { craftDayKey } from "../data/craftingWeek";
import {
  SEGMENTS, SEG_GEOM, EMPTY_LINES, WIN_LINES,
  prizeOdds, pickSegment, randInt, rollDice, msToRomeMidnight,
} from "../data/ruotaExanthia";
import "../styles/cinematic.css";
import "./RuotaExanthia.css";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/locanda3.jpg";
const SPIN_MS = 5600;
const R_OUT = 186;
const R_IN = 34;

const pt = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};

function wedgePath(i) {
  const { start, end } = SEG_GEOM[i];
  const [x0, y0] = pt(start, R_OUT);
  const [x1, y1] = pt(end, R_OUT);
  const [x2, y2] = pt(end, R_IN);
  const [x3, y3] = pt(start, R_IN);
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3} Z`;
}

const fmtLeft = (ms) => {
  const m = Math.ceil(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${m % 60} min` : `${m} min`;
};

const resultText = (r) => r.amount
  ? `🎲 ${r.dice}: ${r.rolls.join(" + ")}${r.rolls.length > 1 ? ` = ${r.amount}` : ""} → +${r.amount} Corone`
  : r.label;

export default function RuotaExanthia() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const isMaster = isMainMaster(currentUser?.email);
  const [charData, setCharData] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState(null);     // esito appena rivelato in questa visita
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);       // server − dispositivo
  const timerRef = useRef(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "characters", uid), (s) => setCharData(s.exists() ? s.data() : {}));
  }, [uid]);

  useEffect(() => {
    serverNow().then((t) => setOffset(t.getTime() - Date.now())).catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => { clearInterval(id); clearTimeout(timerRef.current); };
  }, []);

  const srvNow = new Date(now + offset);
  const today = craftDayKey(srvNow);
  const ruota = charData?.ruota || {};
  const usedToday = !isMaster && ruota.lastDay === today;
  const hasChar = charData && Object.keys(charData).length > 0;
  const odds = useMemo(() => prizeOdds(), []);
  const last = ruota.last && ruota.lastDay === today ? ruota.last : null;
  // Mentre gira non si svela l'esito già scritto su Firestore.
  const result = spinning ? null : (shown || last);

  const spinTo = (idx, after) => {
    const { center: c, span } = SEG_GEOM[idx];
    const jitter = (randInt(1000) / 1000 - 0.5) * (span * 0.7);
    const cur = ((rotation % 360) + 360) % 360;
    const target = ((-c - cur) % 360 + 360) % 360;
    setRotation(rotation + 360 * 6 + target + jitter);
    setSpinning(true);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    timerRef.current = setTimeout(() => { setSpinning(false); after(); }, reduce ? 900 : SPIN_MS + 150);
  };

  const pick = () => {
    const idx = pickSegment();
    const seg = SEGMENTS[idx];
    const roll = seg.dice ? rollDice(seg.dice) : { rolls: [], total: 0 };
    return {
      idx,
      key: seg.key,
      dice: seg.dice ? seg.label.replace(" Corone", "") : null,
      label: seg.label || seg.short,
      special: !!seg.special,
      rolls: roll.rolls,
      amount: roll.total,
      tier: seg.tier,
      line: seg.dice || seg.special ? WIN_LINES[seg.tier] : EMPTY_LINES[randInt(EMPTY_LINES.length)],
    };
  };

  const spin = async () => {
    if (spinning || !uid) return;
    setErr(""); setShown(null);
    try {
      const t = await serverNow();                // fail-closed: niente ora vera, niente giro
      const day = craftDayKey(t);
      const r = await runTransaction(db, async (tx) => {
        const ref = doc(db, "characters", uid);
        const s = await tx.get(ref);
        if (!s.exists()) throw new Error("nochar");
        const cur = s.data().ruota || {};
        // Il Master gira senza limiti, ma le Corone le prende anche lui (per provare).
        if (!isMaster && cur.lastDay === day) throw new Error("used");
        const res = pick();
        const entry = { day, at: t.toISOString(), label: res.label, dice: res.dice, rolls: res.rolls, amount: res.amount, special: res.special };
        tx.update(ref, {
          ruota: {
            lastDay: day,
            lastAt: serverTimestamp(),
            last: { ...res, day },
            spins: (cur.spins || 0) + 1,
            won: (cur.won || 0) + res.amount,
            foto: (cur.foto || 0) + (res.key === "foto" ? 1 : 0),
            log: [entry, ...(cur.log || [])].slice(0, 10),
          },
          ...(res.amount ? { platinum: increment(res.amount) } : {}),
        });
        return res;
      });
      spinTo(r.idx, () => setShown(isMaster ? { ...r, prova: true } : r));
    } catch (e) {
      setErr(e.message === "used" ? "Hai già girato la ruota oggi. Riprova domani."
        : e.message === "nochar" ? "Ti serve un personaggio per girare la ruota."
        : "La ruota si è inceppata (connessione?). Riprova tra poco.");
    }
  };

  const left = msToRomeMidnight(srvNow);

  return (
    <section className="cine-page rex-page" style={{ "--cine-accent": "var(--oro)", "--cine-accent-2": "var(--el)" }}>
      <GlacierHero
        id="rex-top"
        ariaLabel="La Ruota di Exanthia"
        image={HERO_IMAGE}
        eyebrow="Gilda · il gioco del destino"
        title={<>La Ruota di Exanthia</>}
        seal="🎡 Un giro al giorno"
        tagline="Si dice che la ruota sia stata vinta a dadi da un mercante che non ha mai più perso. Si dice anche che quel mercante sia morto povero."
        actions={<>
          <a href="#rex-ruota" className="gl-cta">🎡 Alla ruota</a>
          <Link to="/mercato" className="gl-cta gl-cta--ghost">👑 Spendi al Mercato Nero</Link>
        </>}
      />

      <div className="rex-wrap" id="rex-ruota">
        <div className="rex-stage">
          <div className="rex-pointer" aria-hidden="true" />
          <svg
            className={`rex-wheel${spinning ? " is-spinning" : ""}`}
            viewBox="-200 -200 400 400"
            style={{ transform: `rotate(${rotation}deg)` }}
            role="img"
            aria-label={`Ruota con ${SEGMENTS.length} spicchi`}
          >
            <circle r="198" className="rex-rim" />
            {SEGMENTS.map((s, i) => (
              <g key={i} className={`rex-seg rex-seg--t${s.tier}${!s.dice && !s.special && i % 2 ? " is-alt" : ""}${result && !spinning && result.idx === i ? " is-hit" : ""}`}>
                <path d={wedgePath(i)} />
                {SEG_GEOM[i].center > 180
                  // metà sinistra: scritta girata, così non si legge a testa in giù
                  ? <text transform={`rotate(${SEG_GEOM[i].center + 90})`} x={-(R_OUT - 8)} y="4" textAnchor="start">{s.short}</text>
                  : <text transform={`rotate(${SEG_GEOM[i].center - 90})`} x={R_OUT - 8} y="4" textAnchor="end">{s.short}</text>}
              </g>
            ))}
            {SEG_GEOM.map((g, i) => {
              const [x, y] = pt(g.end, 192);
              return <circle key={`p${i}`} cx={x} cy={y} r="3.2" className="rex-peg" />;
            })}
            <circle r={R_IN} className="rex-hub" />
            <text className="rex-hub-txt" y="7" textAnchor="middle">E</text>
          </svg>
        </div>

        <div className="rex-panel">
          {!uid ? (
            <p className="rex-note">Accedi con il tuo personaggio per girare la ruota.</p>
          ) : (
            <>
              <button
                type="button"
                className="rex-go"
                onClick={spin}
                disabled={spinning || usedToday || (!isMaster && charData && !hasChar)}
              >
                {spinning ? "La ruota gira…" : usedToday ? "Hai già girato oggi" : isMaster ? "🎡 Gira (prova del Master)" : "🎡 Gira la ruota"}
              </button>
              {isMaster && <p className="rex-note">Da Master giri senza limiti, e le Corone vinte finiscono nella tua borsa (per provare).</p>}
              {usedToday && !spinning && <p className="rex-note">⏳ Nuovo giro tra <strong>{fmtLeft(left)}</strong>, a mezzanotte.</p>}
              {err && <p className="rex-err">{err}</p>}

              {result && (
                <div className={`rex-result rex-result--t${result.tier}`} role="status">
                  <span className="rex-result-kicker">{result.prova ? "Prova del Master" : "Il responso di oggi"}</span>
                  <strong className="rex-result-main">{result.amount ? `+${result.amount} Corone` : result.label}</strong>
                  {result.amount > 0 && <span className="rex-result-dice">{resultText(result)}</span>}
                  <p>{result.line}</p>
                </div>
              )}

              {hasChar && (
                <p className="rex-purse">👑 Corone nella borsa: <strong>{Number(charData.platinum || 0)}</strong>
                  {ruota.spins ? <> · {ruota.spins} giri, {ruota.won || 0} Corone vinte in tutto</> : null}
                </p>
              )}
            </>
          )}

          <div className="rex-odds">
            <h3>I premi della ruota</h3>
            <ul>
              {odds.rows.map((p) => (
                <li key={p.key} className={`rex-odd rex-odd--t${p.tier}`}>
                  <span>{p.label}</span>
                  <span>{p.special ? "uno spicchio sottile" : `${p.slots} ${p.slots === 1 ? "spicchio" : "spicchi"}`} · {p.pct < 2 ? p.pct.toFixed(1).replace(".", ",") : Math.round(p.pct)}%</span>
                </li>
              ))}
              <li className="rex-odd rex-odd--t0">
                <span>Niente (Riprova domani)</span>
                <span>{odds.emptySlots} spicchi · {Math.round(odds.emptyPct)}%</span>
              </li>
            </ul>
            <p className="rex-note">Un giro al giorno, si azzera a mezzanotte (ora italiana). Le Corone vanno subito nella borsa del Mercato Nero.</p>
          </div>

          {ruota.log?.length > 0 && (
            <div className="rex-log">
              <h3>I tuoi ultimi giri</h3>
              <ul>
                {ruota.log.slice(0, 7).map((e, i) => (
                  <li key={i}>
                    <span>{new Date(e.day + "T12:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                    <span className={e.amount || e.special ? "is-win" : ""}>{e.amount ? `+${e.amount} Corone (${e.dice}: ${e.rolls.join("+")})` : e.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
