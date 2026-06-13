/* ============================================================
   ClassPanel — XP bar, level badge, spell-slot indicator and
   Ultimate button for a player who has a class assigned.
   Renders NOTHING when the player has no class (PvP backward
   compat). One panel per player.
   ============================================================ */
import React, { useState } from "react";
import {
  CLASS_LABEL, CLASS_ICON, CLASS_VIE,
  LEVEL_THRESHOLDS, MAX_LEVEL, rewardAt,
  isMulticlass, classLabelOf, classIconOf, MULTICLASS_DEF,
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

export default function ClassPanel({
  player, isMe, onActivateUltimate, canUseUlt, ultBlockedReason,
}) {
  // Player-controlled flag to expand the rewards drawer. Toggled with a
  // click or long-press on a level badge so the player can re-read what
  // each level unlocked at any point during the match.
  const [perksOpen, setPerksOpen] = useState(false);
  if (!player || !player.klass || !player.via) return null;
  const isMC = isMulticlass(player.klass);
  const vieMap = CLASS_VIE[player.klass] || {};
  const viaDef = vieMap[player.via];
  const element = viaDef?.element || (isMC ? (MULTICLASS_DEF[player.klass]?.elements?.[0] || "natura") : "natura");
  const elColor = ELEMENT_PIP[element] || "#888";
  const elName  = ELEMENT_LABEL[element] || element;
  const klassLabel = classLabelOf(player.klass);
  const klassIcon  = classIconOf(player.klass);
  const viaLabel   = isMC ? "Multiclasse" : (viaDef?.label || player.via);
  const { pct, label } = xpProgress(player.level, player.xp);
  const hasUlt = !!(player.perks && player.perks.ultimateId);
  const ultUsed = !!(player.perks && player.perks.ultimateUsed);
  const ultActive = !!(player.perks && player.perks.ultimateActive);
  // Pull the lv5 reward to surface its NAME on the button (instead of
  // just "ULTIMATE" — players were clicking blind).
  const ultReward = hasUlt ? rewardAt(player.klass, player.via, 5) : null;
  // Concrete list of perks already earned: levelHistory is appended by
  // the engine every time applyReward fires, so we always know which
  // bonuses are LIVE on the board. Each row also carries the full
  // description (looked up via rewardAt) — players were missing this.
  const earnedPerks = (player.levelHistory || []).map((h) => {
    const r = rewardAt(player.klass, player.via, h.level);
    return {
      level: h.level,
      name:  r?.name        || h.name,
      icon:  r?.icon        || h.icon || "⭐",
      desc:  r?.description || "",
    };
  });

  return (
    <div
      className={`tcg-class ${isMe ? "tcg-class--me" : "tcg-class--foe"}`}
      style={{ "--el": elColor }}
    >
      <div className="tcg-class__head">
        <span className="tcg-class__ico" title={klassLabel}>
          {klassIcon}
        </span>
        <span className="tcg-class__txt">
          <b className="tcg-class__klass">{klassLabel}</b>
          <span className="tcg-class__via" title={`Elemento: ${elName}`}>
            {viaLabel}
          </span>
        </span>
        {/* Clicking the level badge toggles the "perks earned" drawer
            (player side only). Hover/long-press shows a quick summary. */}
        <button
          type="button"
          className={`tcg-class__lvl ${isMe ? "is-clickable" : ""} ${
            perksOpen ? "is-open" : ""
          }`}
          title={
            isMe
              ? `Livello ${player.level} — tocca per vedere i perk ottenuti`
              : `Livello ${player.level}`
          }
          onClick={() => isMe && setPerksOpen((v) => !v)}
        >
          Lv {player.level}
          {isMe && earnedPerks.length > 0 && (
            <span className="tcg-class__lvl-chev" aria-hidden="true">
              {perksOpen ? "▴" : "▾"}
            </span>
          )}
        </button>
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

      {/* Always-visible row of "earned perk" chips for the player. Each
          chip shows the level badge + icon + name, with the full rule
          description in the title attribute. The drawer below expands
          into a readable list on click — replaces the disappearing
          level-up toast that players were missing. */}
      {isMe && earnedPerks.length > 0 && (
        <div className="tcg-class__perks">
          <div className="tcg-class__chips">
            {earnedPerks.map((p) => (
              <button
                key={p.level}
                type="button"
                className="tcg-class__chip"
                title={`Lv ${p.level} — ${p.name}\n${p.desc}`}
                onClick={() => setPerksOpen(true)}
              >
                <span className="tcg-class__chip-lvl">L{p.level}</span>
                <span className="tcg-class__chip-ico">{p.icon}</span>
                <span className="tcg-class__chip-name">{p.name}</span>
              </button>
            ))}
          </div>
          {perksOpen && (
            <div className="tcg-class__drawer">
              <div className="tcg-class__drawer-head">
                <b>Perk attivi</b>
                <button
                  type="button"
                  className="tcg-class__drawer-x"
                  onClick={() => setPerksOpen(false)}
                  aria-label="Chiudi"
                >
                  ✕
                </button>
              </div>
              {earnedPerks.map((p) => (
                <div key={p.level} className="tcg-class__perk">
                  <div className="tcg-class__perk-head">
                    <span className="tcg-class__perk-lvl">Lv {p.level}</span>
                    <span className="tcg-class__perk-ico">{p.icon}</span>
                    <b className="tcg-class__perk-name">{p.name}</b>
                  </div>
                  {p.desc && (
                    <div className="tcg-class__perk-desc">{p.desc}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ultimate button — visible only at lv5 (when the perk is granted).
          Now shows the actual name + a "perché non posso" sub-label when
          disabled, so the click never leaves the player guessing. */}
      {isMe && hasUlt && (
        <div className="tcg-ult-wrap">
          <button
            type="button"
            className={`tcg-ult ${ultActive ? "is-active" : ""} ${
              ultUsed && !ultActive ? "is-used" : ""
            }`}
            disabled={!canUseUlt}
            onClick={onActivateUltimate}
            title={
              ultUsed
                ? "Hai già usato la tua ultimate in questa partita."
                : !canUseUlt
                ? (ultBlockedReason || "Non puoi usare l'ultimate adesso.")
                : ultReward
                  ? `${ultReward.name} — ${ultReward.description}`
                  : "Attiva la tua ULTIMATE (1 sola volta per partita)"
            }
          >
            <span className="tcg-ult__lbl">
              {ultReward
                ? `${ultReward.icon || "⭐"} ${ultReward.name}`
                : "⭐ ULTIMATE"}
            </span>
            {ultUsed && <span className="tcg-ult__sub">già usata</span>}
            {!ultUsed && !canUseUlt && (
              <span className="tcg-ult__sub">{ultBlockedReason || "non disponibile"}</span>
            )}
            {ultActive && <span className="tcg-ult__sub">attiva!</span>}
          </button>
        </div>
      )}
    </div>
  );
}
