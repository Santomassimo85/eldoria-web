// src/components/ArenaSubclassOffer.jsx — "Equipaggiarla subito?" (2026-10-16)
// Chi compra una sottoclasse ed è già iscritto al torneo con quella classe si
// sente chiedere se montarla SUBITO nel suo assetto (snapshot del torneo).
//   • Sì        → snapshotWithSubclass (CA, passive, abilità).
//   • No        → snap.subclassDeclined = chiave: non lo si chiede più; resta
//                 sceglibile al ri-equipaggiamento delle pause Bottega.
//   • Più tardi → chiusa per questa visita, si richiede alla prossima.
// Mai durante un suo match di torneo in corso (subclassToMount lo esclude).
// Montato in Bottega (subito dopo l'acquisto) e in Arena (se non ha risposto).
import React, { useState } from "react";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { currentWeekKey } from "../data/arenaWeek";
import { arenaClassKey, getSubclassDef, snapshotWithSubclass, subclassToMount } from "../data/arenaSubclasses";
import "./ArenaSubclassOffer.css";

export default function ArenaSubclassOffer({ arenaMeta, uid, arenaWeekly }) {
  const [later, setLater] = useState(null);   // chiave rimandata in questa visita
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const key = subclassToMount(arenaMeta, uid, arenaWeekly, currentWeekKey());
  if (!key || later === key) return null;
  const snap = arenaMeta.characterSnapshots[uid];
  const def = getSubclassDef(arenaClassKey(snap.class), key);
  if (!def) return null;
  const ca = def.effect?.ca || 0;
  const acNow = (snap.stats?.ac ?? 10) - (snap.subclassAc || 0);

  const answer = async (accept) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await runTransaction(db, async (tx) => {
        const mref = doc(db, "arena_meta", "global");
        const ms = await tx.get(mref);
        const cs = await tx.get(doc(db, "characters", uid));
        if (!ms.exists() || !cs.exists()) return;
        const meta = ms.data();
        const k = subclassToMount(meta, uid, cs.data().arenaWeekly, currentWeekKey());
        if (!k) return;
        const cur = meta.characterSnapshots[uid];
        const next = accept ? snapshotWithSubclass(cur, k) : { ...cur, subclassDeclined: k };
        if (next) tx.update(mref, { [`characterSnapshots.${uid}`]: next });
      });
    } catch (e) {
      console.warn("[arena] sottoclasse:", e);
      setErr("Non sono riuscito a salvare, riprova.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="aso-velo" role="dialog" aria-modal="true" aria-labelledby="aso-titolo">
      <div className="aso-box">
        <span className="aso-kicker">Sottoclasse comprata</span>
        <h3 id="aso-titolo" className="aso-titolo"><span aria-hidden="true">{def.icon}</span> {def.name}</h3>
        <p className="aso-desc">{def.desc}</p>
        <ul className="aso-lista">
          {(def.actions || []).map(a => (
            <li key={a.name}><span aria-hidden="true">{a.icon}</span> <b>{a.name}</b> — {String(a.info || "").replace(/^Passiva · /, "")}</li>
          ))}
        </ul>
        {ca > 0 && <p className="aso-ca">🛡 CA {acNow} → <b>{acNow + ca}</b></p>}
        <p className="aso-domanda">Vuoi equipaggiarla subito nel tuo assetto del torneo?</p>
        {err && <p className="aso-err">{err}</p>}
        <div className="aso-azioni">
          <button type="button" className="aso-si" disabled={busy} onClick={() => answer(true)}>⚔ Sì, equipaggiala</button>
          <button type="button" className="aso-no" disabled={busy} onClick={() => answer(false)}>No, resto con la classe base</button>
          <button type="button" className="aso-dopo" disabled={busy} onClick={() => setLater(key)}>Più tardi</button>
        </div>
        <p className="aso-nota">Se dici di no puoi sempre sceglierla nelle pause Bottega, con "Aggiorna il mio assetto".</p>
      </div>
    </div>
  );
}
