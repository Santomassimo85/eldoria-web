import React, { useState, useEffect } from "react";

export default function TimerDisplay({ expiryDate }) {
  const [timeLeft, setTimeLeft] = useState("");

 useEffect(() => {
    if (!expiryDate) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(expiryDate).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("TEMPO SCADUTO");
        return;
      }

      const h = Math.floor((diff / (1000 * 60 * 60)));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${h}h ${m}m ${s}s`);
    };

    updateTimer(); // Esegui subito
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiryDate]);

  return <span className="timer-countdown-text">{timeLeft}</span>;
}