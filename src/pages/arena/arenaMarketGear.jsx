// Oggetti della Bottega nel loadout e premi del torneo.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import { DAMAGE_TYPE_MAP, mergeResistMaps } from "../../data/arenaDamageTypes";
import { currentWeekKey } from "../../data/arenaWeek";
import { ARTIFICER_SPELLS } from "./arenaClassActions";
import { SAVE_LABEL, effectsHaveEnemyTarget, marketEffectsInfo, normalizeMarketEffects, primaryToEffect } from "./arenaRules";
import { BARD_SPELLS, CLERIC_SPELLS, DRUID_SPELLS, PALADIN_SPELLS, RANGER_SPELLS, SORCERER_SPELLS, WARLOCK_SPELLS, WIZARD_SPELLS } from "./arenaSpells";

// ── ITEMS ─────────────────────────────────────────────────────────────────────
export const ARENA_ITEMS = [
  { key: "pozione_cura",        name: "Pozione di Cura",        icon: "🧪", info: "Cura 2d12 · azione gratuita (1/turno)",       damage: "2d12" },
  { key: "pozione_cura_media",  name: "Pozione di Cura Media",  icon: "💚", info: "Cura 2d8 · azione gratuita (Bottega Arena)",  damage: "2d8",  shopOnly: true },
  { key: "bomba",               name: "Bomba",                  icon: "💣", info: "2d6 danni al bersaglio · azione gratuita",   damage: "2d6"  },
  { key: "pozione_veleno",      name: "Pozione di Veleno",      icon: "☠",  info: "1d6 veleno al bersaglio il prossimo turno",   damage: "1d6"  },
];

// ── BOTTEGA SETTIMANALE (market Arena) ───────────────────────────────────────
// Gli acquisti settimanali (characters.arenaWeekly) valgono SOLO nei tornei e
// scadono la domenica alle 23:00 (arenaWeek.js): weekKey = lunedì della settimana corrente,
// quindi a settimana nuova gli acquisti vecchi semplicemente non contano più.
// Qui vengono tradotti in pezzi di loadout: azioni (spell/armi/buff/pet),
// bonus CA e consumabili. Le spell sono RIFERIMENTI alle liste di classe già
// esistenti, per cui qualunque vendita del Master è già funzionante nel motore.
export const MARKET_SPELL_LISTS = {
  wizard: WIZARD_SPELLS, sorcerer: SORCERER_SPELLS, warlock: WARLOCK_SPELLS,
  druid: DRUID_SPELLS, cleric: CLERIC_SPELLS, bard: BARD_SPELLS,
  paladin: PALADIN_SPELLS, ranger: RANGER_SPELLS, artificer: ARTIFICER_SPELLS,
};

// Descrizione breve di un acquisto per la scheda "Bottega" del loadout.
export function describeMarketPurchase(pu) {
  const p = pu.payload || {};
  switch (pu.category) {
    case "weapon": {
      const comps = (Array.isArray(p.components) && p.components.length)
        ? p.components
        : [{ dice: `${p.dice || "1d6"}${p.dmgBonus ? `+${p.dmgBonus}` : ""}`, type: p.ranged ? "perforante" : "tagliente" }];
      return "⚔ Arma · " + comps.map(c => `${c.dice}${c.type ? ` ${c.type}` : ""}`).join(" + ");
    }
    case "armor":  return `🛡 Armatura · CA fissa ${p.acFixed ?? p.acBonus ?? 0}`;
    case "spell": {
      const parts = [`📜 ${p.spellName || "Scroll"}`];
      parts.push(`${p.charges || 1} caric${(p.charges || 1) === 1 ? "a" : "he"}`);
      if (p.castStat) parts.push(`usa ${SAVE_LABEL[p.castStat] || p.castStat.toUpperCase()}${p.castStatMin > 0 ? ` ≥ ${p.castStatMin}` : ""}`);
      const cost = p.slotCost || {};
      const costStr = Object.entries(cost).filter(([, n]) => n > 0)
        .map(([l, n]) => `−${n} slot Lv${l}`).join(" · ");
      if (costStr) parts.push(costStr);
      return parts.join(" · ");
    }
    case "pet":    return p.effect === "heal" ? `🐾 Pet · cura ${p.dice || "2d6"}` : `🐾 Pet · ${p.dice || "2d6"} danni`;
    case "item":
      if (p.effect === "buff")   return "🎒 Oggetto · potenziamento temporaneo";
      if (p.effect === "heal")   return `🎒 Oggetto · cura ${p.dice || "2d8"}`;
      if (p.effect === "damage") return `🎒 Oggetto · ${p.dice || "2d8"} danni`;
      return "🎒 Oggetto · resistenza passiva";
    default: return "";
  }
}

// `selectedIds` (Set di itemId) filtra gli acquisti da equipaggiare: solo quelli
// che il giocatore ha scelto nel loadout. Se assente → nessun filtro (tutti).
export function resolveMarketGear(arenaWeekly, selectedIds) {
  if (!arenaWeekly || arenaWeekly.weekKey !== currentWeekKey()) return null;
  let purchases = arenaWeekly.purchases || [];
  if (selectedIds) purchases = purchases.filter(p => selectedIds.has(p.itemId));
  if (!purchases.length) return null;
  const gear = { acBonus: 0, fixedAc: null, actions: [], consumables: [], resist: {}, retaliate: null };
  purchases.forEach(pu => {
    const p = pu.payload || {};
    const qty = Math.max(1, pu.qty || 1);
    switch (pu.category) {
      case "armor": {
        // Armatura della Bottega = CA FISSA (sostituisce l'armatura base, non
        // si somma nulla). Solo una può essere equipaggiata (esclusività in UI).
        // Vecchie armature con solo acBonus: sotto 10 è un BONUS (+N), non una CA
        // fissa (prima "+2" diventava CA 2).
        const legacyBonus = p.acFixed == null && (p.acBonus ?? 0) > 0 && p.acBonus < 10;
        if (legacyBonus) { gear.acBonus += p.acBonus; if (p.resist) mergeResistMaps(gear.resist, p.resist); break; }
        const fx = p.acFixed ?? p.acBonus ?? 12;
        gear.fixedAc = gear.fixedAc == null ? fx : Math.max(gear.fixedAc, fx);
        if (p.resist) mergeResistMaps(gear.resist, p.resist);
        if (p.retaliate) gear.retaliate = p.retaliate; // Spine: danno a chi ti colpisce in mischia
        break;
      }
      case "weapon": {
        // Componenti di danno tipizzati: nuovo schema `components:[{dice,type}]`,
        // con fallback all'arma legacy `{dice,dmgBonus,ranged}` (un solo tipo).
        const comps = (Array.isArray(p.components) && p.components.length)
          ? p.components.filter(c => c && c.dice)
          : [{ dice: `${p.dice || "1d6"}${p.dmgBonus ? `+${p.dmgBonus}` : ""}`, type: p.ranged ? "perforante" : "tagliente" }];
        const [primary, ...extra] = comps;
        const compLabel = comps.map(c => `${c.dice} ${DAMAGE_TYPE_MAP[c.type]?.label || c.type}`).join(" + ");
        // Effetti all'impatto: malus al nemico / bonus a sé, ognuno con la sua probabilità.
        const onHit = normalizeMarketEffects(p.onHit).map(e => ({ ...e, chance: e.chance != null ? e.chance : 100 }));
        const onHitInfo = onHit.length ? ` · impatto: ${marketEffectsInfo(onHit)}` : "";
        gear.actions.push({
          name: pu.name, type: "weapon", icon: pu.icon || "⚔",
          hitBonus: 3 + (p.hitBonus || 0),
          damage: primary.dice,
          statKey: p.ranged ? "dex" : "str",
          twoHanded: !!p.twoHanded, ranged: !!p.ranged,
          damageType: primary.type,
          extraDamage: extra.map(c => ({ dice: c.dice, type: c.type })),
          ...(onHit.length ? { onHit } : {}),
          info: `Bottega settimanale · ${compLabel}${onHitInfo}`,
          fromMarket: true,
        });
        break;
      }
      case "spell": {
        // Spell scroll: cariche e caratteristica di lancio decise dal Master.
        const sp = (MARKET_SPELL_LISTS[p.spellClass] || []).find(s => s.name === p.spellName);
        if (sp) gear.actions.push({
          ...sp,
          maxUses: Math.max(1, (p.charges || sp.maxUses || 1)) * qty,
          ...(p.castStat ? { statKey: p.castStat } : {}),
          fromMarket: true, isScroll: true,
        });
        break;
      }
      case "item": {
        // Oggetti che concedono resistenze passive (sempre attive nel torneo).
        if (p.resist) mergeResistMaps(gear.resist, p.resist);
        const uses = Math.max(1, p.uses || 1) * qty;
        const extras = normalizeMarketEffects(p.extras);
        // BONUS puro senza extra → resta un'abilità attivabile (comportamento storico).
        if (p.effect === "buff" && extras.length === 0 && p.buffType !== "adv") {
          const amt = p.buffAmount || 1;
          const turns = (p.buffTurns | 0) > 0 ? (p.buffTurns | 0) : 99; // 0 = tutto il fight
          const base = {
            name: pu.name, type: "skill", icon: pu.icon || "🎒",
            hitBonus: 0, damage: "—", statKey: null,
            maxUses: uses, fromMarket: true,
          };
          if (p.buffType === "ac") {
            gear.actions.push({ ...base, special: "shield_buff", shieldBuffBonus: amt, shieldBuffTurns: turns, info: `Bottega · +${amt} CA per ${turns} turni` });
          } else if (p.buffType === "ts") {
            gear.actions.push({ ...base, special: "save_faith", saveFaithBonus: amt, saveFaithTurns: turns, info: `Bottega · +${amt} a tutti i TS per ${turns} turni` });
          } else if (p.buffType === "dmg") {
            gear.actions.push({ ...base, special: "dmg_buff", aidDmgBonus: amt, aidDmgTurns: turns, info: `Bottega · +${amt} al danno per ${turns} turni` });
          } else {
            gear.actions.push({ ...base, special: "magic_detect", buffBonus: amt, buffAttacks: turns, info: `Bottega · +${amt} ai prossimi ${turns} attacchi` });
          }
        } else {
          // Effetto primario (cura/danno/malus/bonus) + eventuali extra → consumabile
          // MULTI-EFFETTO applicato all'uso (azione gratuita). Resist resta passivo.
          const effects = [primaryToEffect(p), ...extras].filter(Boolean);
          if (effects.length) {
            gear.consumables.push({
              key: `mk_${pu.itemId}`, name: pu.name, icon: pu.icon || "🎒",
              effects, uses,
              needsTarget: effectsHaveEnemyTarget(effects),
              info: `${marketEffectsInfo(effects)} · azione gratuita (Bottega)`,
            });
          }
        }
        // effect "resist"/assente senza effetti → solo resistenza passiva (già aggregata sopra)
        break;
      }
      case "pet": {
        // Effetti all'impatto del pet (solo pet da danno): malus al nemico / bonus a sé.
        const petOnHit = p.effect === "heal" ? [] : normalizeMarketEffects(p.onHit).map(e => ({ ...e, chance: e.chance != null ? e.chance : 100 }));
        const petOnHitInfo = petOnHit.length ? ` · impatto: ${marketEffectsInfo(petOnHit)}` : "";
        gear.actions.push({
          name: pu.name, type: "skill", special: "pet_market", bonusAction: true,
          icon: pu.icon || "🐾", hitBonus: p.hitBonus || 0, statKey: null,
          damage: p.dice || "2d6", autoHit: !!p.autoHit,
          petEffect: p.effect === "heal" ? "heal" : "damage",
          ...(petOnHit.length ? { onHit: petOnHit } : {}),
          maxUses: Math.max(1, p.uses || 1) * qty, fromMarket: true,
          info: p.effect === "heal"
            ? `Bonus action · cura ${p.dice || "2d6"}`
            : `Bonus action · ${p.dice || "2d6"} danni${p.autoHit ? " auto-hit" : ""}${petOnHitInfo}`,
        });
        break;
      }
      default:
        break;
    }
  });
  return (gear.acBonus || gear.fixedAc != null || gear.actions.length || gear.consumables.length || Object.keys(gear.resist).length || gear.retaliate) ? gear : null;
}

// ── SPELL SCROLL (Bottega) ────────────────────────────────────────────────
// Uno "spell scroll" è una spell della Bottega con: cariche (charges),
// caratteristica di lancio (castStat) e un COSTO in spell slot di classe
// (slotCost = { livello: quantità }) che il giocatore paga SOLO se lo equipaggia.

// Somma degli spell slot persi (per livello) dagli scroll EQUIPAGGIATI.
export function scrollSlotLossFor(purchases, selectedIds) {
  const loss = {};
  (purchases || []).forEach(p => {
    if (p.category !== "spell") return;
    if (selectedIds && !(selectedIds.has ? selectedIds.has(p.itemId) : selectedIds[p.itemId])) return;
    const cost = p.payload?.slotCost || {};
    Object.entries(cost).forEach(([lvl, n]) => { loss[lvl] = (loss[lvl] || 0) + (Number(n) || 0); });
  });
  return loss;
}

// Applica il costo in slot ai limiti spell di CLASSE: per ogni livello sottrae
// gli slot persi (mai sotto 0), aggiorna nonCantripMax e ricalcola maxSpells.
export function applySlotLoss(config, loss) {
  if (!config || !loss || !Object.keys(loss).length) return config;
  const src = config.spellLimits || {};
  const limits = {};
  let maxSpells = 0;
  for (const k of Object.keys(src)) {
    if (k === "nonCantripMax") { limits[k] = src[k]; continue; }
    limits[k] = Math.max(0, (src[k] ?? 0) - (loss[k] || 0));
    maxSpells += limits[k];
  }
  if (limits.nonCantripMax != null) {
    const nonCantripLoss = Object.entries(loss).reduce((s, [l, n]) => s + (Number(l) >= 1 ? n : 0), 0);
    limits.nonCantripMax = Math.max(0, (src.nonCantripMax ?? 0) - nonCantripLoss);
    maxSpells = Math.min(maxSpells, (limits[0] ?? 0) + limits.nonCantripMax);
  }
  return { ...config, spellLimits: limits, maxSpells };
}

// Taglia le spell di classe già scelte che eccedono i limiti (dopo aver
// equipaggiato uno scroll che toglie slot): tiene le prime N di ogni livello.
export function trimSpellsToLimits(spells, limits) {
  const seen = {};
  return (spells || []).filter(sp => {
    const lvl = sp.level ?? 0;
    seen[lvl] = seen[lvl] || 0;
    const cap = limits?.[lvl] ?? 0;
    if (seen[lvl] < cap) { seen[lvl]++; return true; }
    return false;
  });
}

// ── PREMI ARENA (strutturati) ────────────────────────────────────────────
// Corone = valuta mercato nero (campo `platinum`), Monete Arena = `arenaCoins`,
// perks = vantaggi sessioni live (testo, assegnati a mano dal Master).
export function prizeTierToStr(t) {
  return {
    crowns: t?.crowns != null && t.crowns !== "" ? String(t.crowns) : "",
    coins:  t?.coins  != null && t.coins  !== "" ? String(t.coins)  : "",
    perks:  t?.perks || "",
  };
}
export function formatPrizeConfig(cfg) {
  if (!cfg) return "";
  const line = (label, t) => {
    if (!t) return null;
    const bits = [];
    if (t.crowns) bits.push(`👑 ${t.crowns}`);
    if (t.coins)  bits.push(`🪙 ${t.coins}`);
    if (t.perks && String(t.perks).trim()) bits.push(String(t.perks).trim());
    return bits.length ? `${label} ${bits.join(" · ")}` : null;
  };
  return [line("🥇", cfg.first), line("🥈", cfg.second), line("🎟", cfg.participant)].filter(Boolean).join("   ");
}
