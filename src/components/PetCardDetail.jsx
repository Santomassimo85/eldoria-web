/* ============================================================
   PET CARD DETAIL — TCG-style overlay used by PetHub & PetArena
   Click-outside or ✕ to close. Reads everything off the pet
   object + PET_SPECIES catalog, so it's the same look anywhere.
   ============================================================ */
import "../pages/PetHub.css"; // .ph-detail-*, .ph-stat-*, .ph-meta-chip styles
import PetAvatar from "./PetAvatar";
import {
  PET_SPECIES, RARITY_COLOR, RARITY_LABEL,
} from "../data/petSpecies";
import { TYPE_ICON, TYPE_LABEL, diceLabel } from "../data/petMoves";
import {
  levelFromExp, petStatsAtLevel, petUnlockedMoves, petNextLockedMove,
} from "../utils/pet";

/* Tiny stat tile — kept in this file so both PetHub & PetArena
   can render the detail without depending on each other. */
function DetailStat({ icon, label, value, bonus, hint }) {
  return (
    <div className="ph-stat-cell" title={hint || undefined}>
      <div className="ph-stat-icon">{icon}</div>
      <div className="ph-stat-label">{label}</div>
      <div className="ph-stat-value">
        {value}
        {bonus ? <span className="ph-stat-bonus"> (+{bonus})</span> : null}
      </div>
    </div>
  );
}

export default function PetCardDetail({ pet, onClose }) {
  if (!pet) return null;
  const sp = PET_SPECIES[pet.speciesKey];
  if (!sp) return null;
  const lvl   = levelFromExp(pet.exp || 0);
  const stats = petStatsAtLevel(pet.speciesKey, lvl, pet.bonusStats);
  const moves = petUnlockedMoves(pet);
  const nextLocked = petNextLockedMove({ ...pet, level: lvl });
  const ageDays = pet.hatchedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(pet.hatchedAt).getTime()) / 86400000))
    : null;
  const totalPA = moves.reduce((sum, m) => sum + (m.maxUses == null ? 0 : m.maxUses), 0);
  const b = pet.bonusStats || {};

  return (
    <div className="ph-detail-overlay" onClick={onClose}>
      <div
        className={`ph-detail-card ph-detail-card--${sp.type} ph-detail-card--rarity-${sp.rarity}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={`Scheda compagno · ${pet.nickname}`}
      >
        <button
          type="button"
          className="ph-detail-close"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ✕
        </button>

        <div className="ph-detail-head">
          <div className="ph-detail-name">{pet.nickname}</div>
          <div className="ph-detail-level" title="Livello del compagno">Lv {lvl}</div>
        </div>
        <div className="ph-detail-species"><em>{sp.name}</em></div>

        <div className={`ph-detail-art ph-detail-art--${sp.type}`}>
          <PetAvatar species={sp} className="ph-detail-art-img" />
        </div>

        <div className="ph-detail-chips">
          <span className={`ph-meta-chip ph-type-chip ph-type-chip--${sp.type}`}>
            {TYPE_ICON[sp.type]} {TYPE_LABEL[sp.type]}
          </span>
          <span
            className={`ph-meta-chip ph-rarity-chip ph-rarity-chip--${sp.rarity}`}
            style={{ borderColor: RARITY_COLOR[sp.rarity], color: RARITY_COLOR[sp.rarity] }}
          >
            ★ {RARITY_LABEL[sp.rarity]}
          </span>
        </div>

        <p className="ph-detail-flavor">{sp.desc || "—"}</p>

        <div className="ph-detail-stats">
          <DetailStat icon="❤️" label="PF max"  value={stats.hp}              bonus={b.hp} />
          <DetailStat icon="🛡"  label="CA"      value={stats.ac}              bonus={b.ac} />
          <DetailStat icon="🎯" label="+Colpo"   value={`+${stats.atkBonus}`}  bonus={b.atk} />
          <DetailStat icon="⚡" label="SPD"      value={stats.spd}             bonus={b.spd} />
          <DetailStat icon="⭐" label="Prof"     value={`+${stats.profBonus}`} />
          <DetailStat icon="🔥" label="PA tot."  value={totalPA} hint="azioni/skill per scontro" />
          <DetailStat icon="🏆" label="Vittorie" value={pet.wins   || 0} />
          <DetailStat icon="💀" label="Sconfitte" value={pet.losses || 0} />
          {ageDays != null && (
            <DetailStat icon="🥚" label="Età" value={ageDays === 0 ? "oggi" : `${ageDays}g`} />
          )}
        </div>

        <div className="ph-detail-moves">
          <h4 className="ph-detail-moves-title">⚔ Mosse conosciute</h4>
          <ul className="ph-detail-moves-list">
            {moves.map(m => {
              const dice    = m.damageDice ? diceLabel(m.damageDice) : null;
              const usesLbl = m.maxUses == null ? "∞" : `${m.maxUses} PA`;
              return (
                <li key={m.id} className={`ph-detail-move ph-detail-move--${m.type}`}>
                  <div className="ph-detail-move-head">
                    <span className="ph-detail-move-icon">{m.icon}</span>
                    <span className="ph-detail-move-name">{m.name}</span>
                    <span className="ph-detail-move-uses">{usesLbl}</span>
                  </div>
                  <div className="ph-detail-move-meta">
                    <span>{TYPE_ICON[m.type]} {TYPE_LABEL[m.type]}</span>
                    {dice && <span className="ph-detail-move-dice">{dice}</span>}
                    {(m.toHit || 0) !== 0 && (
                      <span>{m.toHit > 0 ? "+" : ""}{m.toHit} colpo</span>
                    )}
                  </div>
                  <div className="ph-detail-move-desc">{m.desc}</div>
                </li>
              );
            })}
            {nextLocked && (
              <li className="ph-detail-move ph-detail-move--locked">
                🔒 Si sblocca al <strong>Lv {nextLocked.unlockLevel}</strong> · {nextLocked.name}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
