import { useState, useEffect } from "react";
import "./PetAvatar.css";

/* Shared avatar for pet species. Renders <img> when species.image is set
   and the file actually loads; otherwise falls back to the emoji icon.
   Pass through className/style so call-sites keep their layout rules. */
export default function PetAvatar({ species, size, className = "", style }) {
  const [failed, setFailed] = useState(false);

  // Reset fallback if the species (and therefore image src) changes.
  useEffect(() => { setFailed(false); }, [species?.image, species?.key]);

  if (!species) return null;

  const sizingStyle = size ? { width: size, height: size, fontSize: size * 0.6 } : null;
  const merged = { ...sizingStyle, ...style };

  if (!species.image || failed) {
    return (
      <span className={`pet-avatar pet-avatar--emoji ${className}`} style={merged}>
        {species.icon}
      </span>
    );
  }
  return (
    <img
      src={species.image}
      alt={species.name}
      className={`pet-avatar pet-avatar--img ${className}`}
      style={merged}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
