// src/components/ImageTonePicker.jsx
// Chip "Tono del disegno" (Normale · Serio · Divertente · Horror) da mettere
// accanto a ogni bottone che fa disegnare l'IA. La scelta è condivisa in tutto
// il sito (src/data/imageTone.js): basta passare `tono` a /api/genera-immagine.
import { IMAGE_TONES, useImageTone } from "../data/imageTone";
import "./ImageTonePicker.css";

// `value`/`onChange` = modo controllato (Lo Scriba salva il tono su Firestore,
// perché disegna sul server); senza, usa la scelta condivisa del sito.
export default function ImageTonePicker({ disabled = false, label = "🎭 Tono del disegno", compact = false, value, onChange }) {
  const [shared, setShared] = useImageTone();
  const tono = value || shared;
  const setTono = onChange || setShared;
  return (
    <div className={`imgtone${compact ? " imgtone--compact" : ""}`}>
      {label && <span className="imgtone-label">{label}</span>}
      <div className="imgtone-row" role="radiogroup" aria-label="Tono del disegno">
        {IMAGE_TONES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={tono === t.key}
            className={`imgtone-chip imgtone-chip--${t.key}${tono === t.key ? " is-on" : ""}`}
            onClick={() => setTono(t.key)}
            disabled={disabled}
            title={t.hint}
          >
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
