/* ============================================================
   ClassPanel — XP bar, level badge, spell-slot indicator and
   Ultimate button for a player who has a class assigned.
   Renders NOTHING when the player has no class (PvP backward
   compat). One panel per player.
   ============================================================ */
import React from "react";
import {
  CLASS_LABEL, CLASS_ICON, CLASS_VIE,
  LEVEL_THRESHOLDS, MAX_LEVEL,
} from "../../tcg/classes.js";
import { ELEMENT_PIP, ELEMENT_LABEL } from "../../tcg/cards.js";

/* ── XP progress toward the next level (0..1). At MAX_LEVEL the
   bar is full and shows "MAX". ── */
function xpProgress(level, xp) {
  if (level >= MAX_LEVEL) return { pct: 1, label: "MAX" };
  const cur = LEVEL_THRESHOLDS[level];
  const nxt = LEVEL_THRESHOLDS[level + 1];
  const span = Math.max(1, nxt - cur);
  const pct = Math.max(0, Math.min(1, (xp - cur) / span));
  return { pct, label: `${xp - cur} / ${nxt - cur} XP` };
}

/* slot indicator: one capsule per tier (1/2/3), each capsule holds
   one filled "pip" per available slot of that tier. Locked tiers
   render as a greyed-out chain icon. */
function SlotBar({ slots, slotsUnlocked, slotCap }) {
  if (!slots) return null;
  return (
    <div className="tcg-slots" title="Spell slot disponibili (tier 1/2/3)">
      {[1, 2, 3].map((tier) => {
        const unlocked = !!(slotsUnlocked && slotsUnlocked[tier]);
        const have = slots[tier] || 0;
        const cap  = (slotCap && slotCap[tier]) || 2;
        return (
          <div
            key={tier}
            className={`tcg-slots__tier tcg-slots__tier--${tier} ${
              unlocked ? "is-unlocked" : "is-locked"
            }`}
            data-tier={tier}
          >
            <span className="tcg-slots__lvl">L{tier}</span>
            <span className="tcg-slots__pips">
              {unlocked
                ? Array.from({ length: cap }).map((_, i) => (
                    <span
                      key={i}
                      className={`tcg-slots__pip ${i < have ? "is-full" : ""}`}
                    />
                  ))
                : <span className="tcg-slots__lock">🔒</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ClassPanel({ player, isMe, onActivateUltimate, canUseUlt }) {
  if (!player || !player.klass || !player.via) return null;
  const vieMap = CLASS_VIE[player.klass] || {};
  const viaDef = vieMap[player.via];
  const element = viaDef?.element || "natura";
  const elColor = ELEMENT_PIP[element] || "#888";
  const elName  = ELEMENT_LABEL[element] || element;
  const { pct, label } = xpProgress(player.level, player.xp);
  const hasUlt = !!(player.perks && player.perks.ultimateId);
  const ultUsed = !!(player.perks && player.perks.ultimateUsed);
  const ultActive = !!(player.perks && player.perks.ultimateActive);

  return (
    <div
      className={`tcg-class ${isMe ? "tcg-class--me" : "tcg-class--foe"}`}
      style={{ "--el": elColor }}
    >
      <div className="tcg-class__head">
        <span className="tcg-class__ico" title={CLASS_LABEL[player.klass]}>
          {CLASS_ICON[player.klass]}
        </span>
        <span className="tcg-class__txt">
          <b className="tcg-class__klass">{CLASS_LABEL[player.klass]}</b>
          <span className="tcg-class__via" title={`Elemento: ${elName}`}>
            {viaDef?.label || player.via}
          </span>
        </span>
        <span className="tcg-class__lvl" title={`Livello ${player.level}`}>
          Lv {player.level}
        </span>
      </div>

      <div className="tcg-xp" title={label}>
        <span className="tcg-xp__fill" style={{ width: pct * 100 + "%" }} />
        <span className="tcg-xp__num">{label}</span>
      </div>

      <SlotBar
        slots={player.slots}
        slotsUnlocked={player.slotsUnlocked}
        slotCap={player.slotCap}
      />

      {/* Ultimate button — visible only at lv5 (when the perk is granted).
          Disabled once used; pulses while active (one-turn effects). */}
      {isMe && hasUlt && (
        <button
          type="button"
          className={`tcg-ult ${ultActive ? "is-active" : ""} ${
            ultUsed && !ultActive ? "is-used" : ""
          }`}
          disabled={!canUseUlt}
          onClick={onActivateUltimate}
          title={
            ultUsed
              ? "Ultimate già usata"
              : canUseUlt
              ? "Attiva la tua ULTIMATE (1 sola volta per partita)"
              : "Ultimate non disponibile adesso"
          }
        >
          ⭐ ULTIMATE
        </button>
      )}
    </div>
  );
}
