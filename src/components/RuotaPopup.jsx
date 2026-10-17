// ── Popup della Ruota all'apertura dell'app (2026-10-17) ─────────────────────
// Se il giocatore oggi non ha ancora girato, all'apertura dell'app la ruota
// compare in primo piano. Girata la ruota non riappare fino al giorno dopo
// (lo dice `characters.ruota.lastDay`, scritto dal server). Chiusa con "Più
// tardi" non torna nella stessa sessione, ma alla prossima apertura sì.
// Mai al Master principale (gira senza limiti), mai agli inattivi, mai su /ruota.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { isHiddenChar } from "../data/hiddenPlayers";
import { serverNow } from "../data/serverClock";
import { craftDayKey } from "../data/craftingWeek";
import { RuotaGioco } from "../pages/RuotaExanthia";

const seenKey = (uid, day) => `ruota_popup_${uid}_${day}`;

export default function RuotaPopup() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");

  useEffect(() => {
    if (!uid || isMainMaster(currentUser?.email)) return;
    let alive = true;
    (async () => {
      try {
        const t = await serverNow();
        const d = craftDayKey(t);
        try { if (sessionStorage.getItem(seenKey(uid, d))) return; } catch { /* storage bloccato */ }
        const s = await getDoc(doc(db, "characters", uid));
        if (!alive || !s.exists()) return;
        const c = s.data();
        if (!c.name || isHiddenChar({ ...c, id: uid })) return;
        if (c.ruota?.lastDay === d) return;
        setDay(d);
        setOpen(true);
      } catch { /* niente rete o niente ora del server: niente popup */ }
    })();
    return () => { alive = false; };
  }, [uid, currentUser?.email]);

  const close = () => {
    try { sessionStorage.setItem(seenKey(uid, day), "1"); } catch { /* niente */ }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || pathname === "/ruota") return null;

  return createPortal(
    <div className="rex-popup" role="dialog" aria-modal="true" aria-labelledby="rex-popup-title">
      <div className="rex-popup-card">
        <header className="rex-popup-head">
          <span className="rex-popup-kicker">Il giro di oggi ti aspetta</span>
          <h2 id="rex-popup-title">🎡 La Ruota di Exanthia</h2>
        </header>
        <RuotaGioco popup onClose={close} />
      </div>
    </div>,
    document.body,
  );
}
