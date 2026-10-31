/* ============================================================
   ReadTracker (2026-10-31): conta una lettura per i punti pet
   (utils/petReads.js) e mostra un indicatore discreto: un cerchietto
   che si riempie e poi "✓ +N punti pet". L'indicatore si vede solo se
   i pet sono visibili (PETS_PUBLIC o Master); il conteggio vale per tutti.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { isMainMaster } from "../utils/roles";
import { useReadTracker } from "../utils/petReads";
import { PETS_PUBLIC } from "../data/petReads";
import "./ReadTracker.css";

const LABEL = { summary: "Lettura", npc: "Scheda", geo: "Luogo", page: "Visita" };

export default function ReadTracker({ kind, id, active = true, targetId, slot = 0 }) {
  const { currentUser } = useAuth();
  const { state, progress, points } = useReadTracker(kind, id, active && !!currentUser, { targetId });
  const show = PETS_PUBLIC || isMainMaster(currentUser?.email);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    setGone(false);
    if (state !== "done") return undefined;
    const t = setTimeout(() => setGone(true), 3500);
    return () => clearTimeout(t);
  }, [state, id]);

  if (!show || gone || !["reading", "finishing", "done"].includes(state)) return null;
  const done = state === "done";
  return (
    <div className={`rt-pill${done ? " is-done" : ""}`} style={{ "--rt-p": progress, "--rt-slot": slot }} role="status" aria-live="polite">
      <span className="rt-ring" aria-hidden="true">{done ? "✓" : ""}</span>
      <span className="rt-text">{done ? `+${points} punti pet` : `${LABEL[kind] || "Lettura"}…`}</span>
    </div>
  );
}
