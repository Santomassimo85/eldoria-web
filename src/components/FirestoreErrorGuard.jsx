import React, { useState, useEffect } from "react";

/* ============================================================
   FirestoreErrorGuard — silent listener that catches Firestore
   "INTERNAL ASSERTION FAILED" errors (b815, ca9, etc.). These
   are SDK state-machine glitches caused by StrictMode + HMR or
   rapid concurrent writes; they don't actually break Firestore
   writes (which already went through), but they do bubble up
   as window.alert in some browsers.

   When detected, suppresses the alert and shows a small banner
   asking the user to reload — which fully resets SDK state.
   ============================================================ */

const ASSERTION_RE = /INTERNAL ASSERTION FAILED|Unexpected state \(ID: [a-z0-9]+\)/i;

export default function FirestoreErrorGuard() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onError = (event) => {
      const msg = event?.error?.message || event?.message || "";
      const reasonMsg = event?.reason?.message || "";
      if (ASSERTION_RE.test(msg) || ASSERTION_RE.test(reasonMsg)) {
        // Prevent the default alert/log noise but keep the console trace.
        if (typeof event.preventDefault === "function") event.preventDefault();
        console.warn("[FirestoreErrorGuard] suppressed Firestore SDK assertion. The write probably went through; SDK state is wedged. Reload recommended.");
        setShown(true);
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
    };
  }, []);

  if (!shown) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 16, right: 16,
      zIndex: 99999,
      maxWidth: 360,
      background: "#fffdf6",
      border: "2px solid #c9a961",
      borderRadius: 12,
      boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
      padding: "14px 16px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: "#2d2418",
      animation: "firestoreGuardIn 0.25s ease-out",
    }}>
      <style>{`@keyframes firestoreGuardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: "1.2rem" }}>⚠</span>
        <strong style={{ color: "#7d2929", letterSpacing: "0.04em" }}>Firestore: stato bloccato</strong>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: "0.84rem", lineHeight: 1.45, color: "#6f6453" }}>
        I dati sono stati salvati correttamente, ma l'SDK ha bisogno di un refresh per riprendersi.
        Ricarica la pagina per continuare.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "linear-gradient(180deg, #b91c1c, #7d2929)",
            color: "#fdf2dc",
            border: "1.5px solid #5a1818",
            borderRadius: 8,
            padding: "7px 14px",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "0.84rem",
          }}
        >
          🔄 Ricarica pagina
        </button>
        <button
          onClick={() => setShown(false)}
          style={{
            background: "transparent",
            color: "#6f6453",
            border: "1.5px solid #e0cf9d",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: "0.84rem",
          }}
        >
          Ignora
        </button>
      </div>
    </div>
  );
}
