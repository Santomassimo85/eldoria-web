// Regole del combattimento: titoli, effetti, danni e resistenze, classi, livelli, sottoclassi, incantesimi, stati, loadout, dadi e log.
// Estratto da Arena.jsx (2026-10-27): stesso codice, solo spostato.
import DieIcon from "../../components/DieIcon";
import { EFFECT_KIND_KEYS, MALUS_TYPE_MAP, damageMultiplier, malusTypeLabel } from "../../data/arenaDamageTypes";
import { ARENA_SUBCLASSES, arenaClassKey, getSubclassDef, getSubclassEffectFor } from "../../data/arenaSubclasses";
import { currentWeekKey } from "../../data/arenaWeek";
import { ACTION_SURGE_ACTION, ARTIFICER_SPELLS, ARTIFICER_WEAPON_OPTIONS, ASSORBIRE_DANNI_ACTION, ATTACCO_IRRUENTO_PASSIVE, AURA_PROTEZIONE_PASSIVE, BARDIC_INSPIRATION_ACTION, CARICA_PUGNI_ACTION, CHARGE_ACTION, COLPI_KI_PASSIVE, COLPO_BENEDETTO_PASSIVE, COLPO_DIVINO_PASSIVE, CONCENTRAZIONE_ACTION, CRITICO_MIGLIORATO_PASSIVE, CUNNING_ACTION_ACTION, DIFESA_PREDATORE_PASSIVE, DISARM_ACTION, ELUSIONE_PASSIVE, FORGIA_ARMATURA_ACTION, FURIA_BESTIALE_PASSIVE, HUNTER_MARK_ACTION, INFUSIONE_PASSIVE, INNATE_SORCERY_PASSIVE, ISTINTO_SELVAGGIO_PASSIVE, KI_HEALING_ACTION, LAY_OF_HANDS_ACTION, MAGICAL_CUNNING_ACTION, MIGHTY_STRIKE_ACTION, MOVIMENTO_SENZA_ARMATURA_PASSIVE, NOTA_DOLENTE_ACTION, PATTO_DEMONIACO_ACTION, PRESENZA_POSSENTE_PASSIVE, RAGE_ACTION, RANGER_VOLLEY_ACTION, RECUPERO_ARCANO_ACTION, RESISTENZA_FERINA_PASSIVE, RISOLUTEZZA_PASSIVE, SCHIVATA_PRODIGIOSA_PASSIVE, SECOND_WIND_ACTION, SMITE_ACTION, SNEAK_ATTACK_ACTION, STEALTH_ACTION, STUN_STRIKE_ACTION, SURVIVOR_ACTION, TRIBOLI_ACTION, TURBINE_LAME_ACTION, TUTTOFARE_PASSIVE } from "./arenaClassActions";
import { BARD_WEAPON_OPTIONS, CLERIC_WEAPON_OPTIONS, DRUID_WEAPON_OPTIONS, MARTIAL_WEAPONS, MONK_WEAPON_OPTIONS, RANGER_WEAPON_OPTIONS, ROGUE_WEAPON_OPTIONS, SIMPLE_WEAPONS, WEAPON_IS_RANGED, WILD_SHAPES } from "./arenaGear";
import { FONTE_DI_MAGIA_ACTION } from "./arenaMatchFlow";
import { BARD_SPELLS, CLERIC_SPELLS, DRUID_SPELLS, PALADIN_SPELLS, RANGER_SPELLS, SORCERER_SPELLS, WARLOCK_SPELLS, WIZARD_SPELLS } from "./arenaSpells";

// ── TITOLI D'ARENA (assegnati dal Master, attivi solo in Torneo / Arena Campioni) ─
export const ARENA_TITLES = {
  myrhal:     { key: "myrhal",     name: "Campione di Myrhal",   icon: "✨", short: "+1 hit spell (Mago/Stregone)" },
  vulkaros:   { key: "vulkaros",   name: "Campione di Vulkaros", icon: "⚔",  short: "+1 hit arma (Guerriero)" },
  gufoBianco: { key: "gufoBianco", name: "Gufo Bianco",          icon: "🦉", short: "Druido: +1d12 HP in forma selvatica · +1 hit con le spell" },
  spazzaossa: { key: "spazzaossa", name: "Spazzaossa",           icon: "🦴", short: "+1 hit senz'armi o con armi contundenti" },
  // ── Nuova infornata di titoli (≤ +1 hit, niente di troppo potente) ──────────
  ombraDellaNotte:   { key: "ombraDellaNotte",   name: "Ombra della Notte",     icon: "🌑", short: "+1 hit (Ladro/Monaco/Ranger)" },
  furiaSelvaggia:    { key: "furiaSelvaggia",    name: "Furia Selvaggia",       icon: "🪓", short: "+1 hit arma (Barbaro)" },
  giuramentoSacro:   { key: "giuramentoSacro",   name: "Giuramento Sacro",      icon: "⚜", short: "+1 hit arma (Paladino/Chierico)" },
  luceDivina:        { key: "luceDivina",        name: "Luce Divina",           icon: "☀", short: "+1 hit spell (Chierico/Paladino)" },
  cantoDiGuerra:     { key: "cantoDiGuerra",     name: "Canto di Guerra",       icon: "🎵", short: "+1 hit spell (Bardo)" },
  pattoOscuro:       { key: "pattoOscuro",       name: "Patto Oscuro",          icon: "👁", short: "+1 hit spell (Warlock)" },
  ingegnoMeccanico:  { key: "ingegnoMeccanico",  name: "Ingegno Meccanico",     icon: "⚙", short: "+1 hit (Artefice)" },
  cuoreDellaForesta: { key: "cuoreDellaForesta", name: "Cuore della Foresta",   icon: "🌿", short: "+1 hit spell (Druido, no forma selvatica)" },
  occhioDiFalco:     { key: "occhioDiFalco",     name: "Occhio di Falco",       icon: "🎯", short: "+1 hit con armi perforanti" },
  filoDelRasoio:     { key: "filoDelRasoio",     name: "Filo del Rasoio",       icon: "🗡", short: "+1 hit con armi taglienti" },
  signoreTempesta:   { key: "signoreTempesta",   name: "Signore della Tempesta", icon: "⚡", short: "+1d6 danni (fulmine) con spell di fulmine/gelo/acqua" },
};

// Restituisce +1 se il titolo deve attivarsi su questo tiro per colpire, altrimenti 0.
// "Spazzaossa" si attiva su qualsiasi azione non-spell con damageType "contundente"
// (include Pugno/Calcio/Carica di Pugni del Monaco, che sono unarmed-bludgeoning).
export function getTitleHitBonus({ titleKey, classLower, isSpellAction, wildShapeForm, actionDamageType }) {
  if (!titleKey) return 0;
  if (titleKey === "myrhal"     && isSpellAction && (isWizardClass(classLower) || isSorcererClass(classLower))) return 1;
  if (titleKey === "vulkaros"   && !isSpellAction && isFighterClass(classLower)) return 1;
  if (titleKey === "gufoBianco" && isSpellAction && isDruidClass(classLower)) return 1;   // +1 hit spell (l'HP bonus in forma selvatica è gestito in handleWildShape)
  if (titleKey === "spazzaossa" && !isSpellAction && actionDamageType === "contundente") return 1;
  // ── Nuovi titoli ────────────────────────────────────────────────────────────
  if (titleKey === "ombraDellaNotte"   && (isRogueClass(classLower) || isMonkClass(classLower) || isRangerClass(classLower))) return 1;
  if (titleKey === "furiaSelvaggia"    && !isSpellAction && isBarbarianClass(classLower)) return 1;
  if (titleKey === "giuramentoSacro"   && !isSpellAction && (isPaladinClass(classLower) || isClericClass(classLower))) return 1;
  if (titleKey === "luceDivina"        && isSpellAction && (isClericClass(classLower) || isPaladinClass(classLower))) return 1;
  if (titleKey === "cantoDiGuerra"     && isSpellAction && isBardClass(classLower)) return 1;
  if (titleKey === "pattoOscuro"       && isSpellAction && isWarlockClass(classLower)) return 1;
  if (titleKey === "ingegnoMeccanico"  && isArtificerClass(classLower)) return 1;
  if (titleKey === "cuoreDellaForesta" && isSpellAction && isDruidClass(classLower) && !wildShapeForm) return 1;
  if (titleKey === "occhioDiFalco"     && !isSpellAction && actionDamageType === "perforante") return 1;
  if (titleKey === "filoDelRasoio"     && !isSpellAction && actionDamageType === "tagliente") return 1;
  // "signoreTempesta" non dà più +1 colpire: ora aggiunge +1d6 danni da fulmine
  // alle spell di fulmine/gelo/acqua (gestito nel calcolo danni via isStormSpell).
  return 0;
}

// Le spell non hanno un damageType strutturato: l'elemento è nel nome/`info`.
// "Tempesta" = fulmine/tuono OPPURE gelo/acqua → abilita il bonus del titolo
// "Signore della Tempesta" (+1d6 danni da fulmine).
export function isStormSpell(action) {
  const t = `${action?.name || ""} ${action?.info || ""}`.toLowerCase();
  const lightning = /fulmin|saetta|folgor|elettr|tuono|tonante|schianto|frantum|frastorn/.test(t);
  const iceWater  = /gelo|ghiacc|freddo|brina|\bneve\b|gelid|acqua|marea|onda/.test(t);
  return lightning || iceWater;
}

// Invisibilità con durata variabile. `invisibilityTurns` è la fonte di verità; legacy `invisible: true/false` fa da fallback.
export function consumeInvisibility(p) {
  const turns = p.invisibilityTurns ?? (p.invisible ? 1 : 0);
  if (turns > 1) return { invisible: true, invisibilityTurns: turns - 1 };
  return { invisible: false, invisibilityTurns: 0 };
}

// Eagle debuff: aquila del Ranger applica blindDebuff per 3 turni dell'avversario.
// Il timer va decrementato quando il turno del giocatore colpito termina, qualunque azione abbia scelto.
export function tickEagleEnd(p) {
  const newEagle = Math.max(0, (p.eagleDebuffTurns ?? 0) - 1);
  // Buff a turni del lanciatore che scalano a fine turno (gestiti centralmente
  // qui, così bastano i punti che già chiamano tickEagleEnd):
  //  · Scudo della Fede → +X a TUTTI i TS (saveFaithTurns)
  //  · Aiuto            → +X al danno      (aidDmgTurns)
  const newSaveFaith = Math.max(0, (p.saveFaithTurns ?? 0) - 1);
  const newAidDmg    = Math.max(0, (p.aidDmgTurns ?? 0) - 1);
  return {
    eagleDebuffTurns: newEagle,
    blindDebuff: newEagle > 0 ? p.blindDebuff : false,
    saveFaithTurns: newSaveFaith,
    saveFaithBonus: newSaveFaith > 0 ? p.saveFaithBonus : 0,
    aidDmgTurns: newAidDmg,
    aidDmgBonus: newAidDmg > 0 ? p.aidDmgBonus : 0,
    // 🔩 Arma incandescente (Riscaldare Arma / Disarmare): il blocco scala a
    // fine turno del bersaglio QUALUNQUE azione abbia scelto (attacco, magia,
    // abilità, cambio arma, skip…). Centralizzato qui perché tickEagleEnd è
    // chiamato da tutti gli handler di fine turno: così il debuff "viene
    // sempre contato" e scade nei turni previsti, in ogni modalità (PvP/torneo).
    weaponLockTurns: Math.max(0, (p.weaponLockTurns ?? 0) - 1),
  };
}
// Scudo della Fede: +X a TUTTI i tiri salvezza finché saveFaithTurns > 0.
export function readSaveFaithBonus(p) { return (p?.saveFaithTurns ?? 0) > 0 ? (p?.saveFaithBonus ?? 0) : 0; }
// Aiuto: +X al danno di ogni attacco finché aidDmgTurns > 0.
export function readAidDmgBonus(p) { return (p?.aidDmgTurns ?? 0) > 0 ? (p?.aidDmgBonus ?? 0) : 0; }

// Ristorare: rimuove TUTTE le condizioni negative dal personaggio
// (veleno, sanguinamento, svantaggio, controllo, intrappolamento, accecamento,
//  disarmo, e qualsiasi tiro salvezza in sospeso). Non tocca i buff positivi.
export function clearDebuffs(p) {
  return {
    // DoT
    poisonDoT: false, poisonDoTTurns: 0, poisonDoTDice: null, poisonDoTSourceLabel: null, poisonDoTNoun: null, poisonDoTIcon: null,
    bleedDoT: false, bleedDoTTurns: 0, bleedDoTDice: null, bleedDoTSourceLabel: null, bleedDoTNoun: null, bleedDoTIcon: null,
    // Svantaggio / accecamento / disarmo / furtività-debuff
    attackDisadvantageTurns: 0, attackDisadvantageLabel: null, attackDisadvantageIcon: null, attackDisadvantageCls: null,
    blindDebuff: false, eagleDebuffTurns: 0,
    weaponLockTurns: 0, weaponLockNames: null,
    stealthDisadvTurns: 0,
    entangled: false,
    // Controllo
    controlLostTurns: 0,
    pendingControlSave: null, pendingControlDC: null, pendingControlSaveAbility: null,
    // Tiri salvezza in sospeso
    pendingConSave: null, pendingDexSave: null, pendingSaveDot: null,
  };
}
// Etichetta dedicata per il badge di svantaggio: così si distingue "🧊 Congelato",
// "🙈 Cecità", "💫 Sbilanciato", "🪤 Triboli"… anche se il meccanismo (svantaggio
// ai tiri per colpire) è identico. Fallback nel badge: "🌫 Svantaggio".
export function disadvTag(label, icon = "🌫", cls = "is-debuff") {
  return { attackDisadvantageLabel: label, attackDisadvantageIcon: icon, attackDisadvantageCls: cls };
}

// ── EFFETTI COMPONIBILI (Bottega) ──────────────────────────────────────────
// Oggetti e armi possono portare PIÙ effetti insieme (danno, cura, bonus, malus).
// Routing automatico: cura/bonus → chi lo usa/impugna (self); danno/malus → nemico.
export const MARKET_BUFF_LABEL = { hit: "colpire", dmg: "danno", ac: "CA", ts: "TS", adv: "vantaggio" };
// Patch di un bonus a sé stessi (instantaneo), per tipo.
export function buffPatchFor(buffType, amount, turns) {
  const amt = Math.max(1, parseInt(amount, 10) || 1);
  const tn  = Math.max(1, parseInt(turns, 10) || 1);
  switch (buffType) {
    case "ac":  return { shieldSkillTurns: tn, shieldSkillBonus: amt };
    case "ts":  return { saveFaithTurns: tn, saveFaithBonus: amt };
    case "dmg": return { aidDmgTurns: tn, aidDmgBonus: amt };
    case "hit": return { magicDetectActive: amt, magicDetectAttacks: tn };
    case "adv": return { selfAdvTurns: tn }; // vantaggio ai prossimi N attacchi
    default:    return {};
  }
}
// Patch di un malus sul bersaglio, per tipo (riusata da oggetti/armi/regole).
export function malusPatchFor(mt, dice, turns, p) {
  const tn = Math.max(1, parseInt(turns, 10) || 1);
  const dc = dice || "1d6";
  switch (mt) {
    case "disadvantage": return { attackDisadvantageTurns: Math.max(p?.attackDisadvantageTurns ?? 0, tn), ...disadvTag("Svantaggio") };
    case "freeze":       return { attackDisadvantageTurns: Math.max(p?.attackDisadvantageTurns ?? 0, 1), ...disadvTag("Congelato", "🧊", "is-frost") };
    case "bleed":        return { bleedDoT: true, bleedDoTTurns: Math.max(p?.bleedDoTTurns ?? 0, tn), bleedDoTDice: dc, bleedDoTSourceLabel: "sanguinamento", bleedDoTNoun: "sanguinante", bleedDoTIcon: "🩸" };
    case "poison":       return { poisonDoT: true, poisonDoTTurns: Math.max(p?.poisonDoTTurns ?? 0, tn), poisonDoTDice: dc, poisonDoTSourceLabel: "veleno", poisonDoTNoun: "avvelenato", poisonDoTIcon: "☠" };
    case "burn":         return { poisonDoT: true, poisonDoTTurns: Math.max(p?.poisonDoTTurns ?? 0, tn), poisonDoTDice: dc, poisonDoTSourceLabel: "bruciatura", poisonDoTNoun: "in fiamme", poisonDoTIcon: "🔥" };
    // Stordito = stesso meccanismo del controllo (salta i suoi turni).
    case "stun":         return { controlLostTurns: Math.max(p?.controlLostTurns ?? 0, tn) };
    // Disarmato = arma arroventata: bloccate le armi impugnate adesso (può cambiare arma).
    case "disarm":       return { weaponLockTurns: Math.max(p?.weaponLockTurns ?? 0, tn), weaponLockNames: p?.equippedWeaponNames || [] };
    // Accecato = cecità dell'aquila del Ranger (−3 al colpire, scala a fine turno).
    case "blind":        return { blindDebuff: true, eagleDebuffTurns: Math.max(p?.eagleDebuffTurns ?? 0, tn) };
    default:             return {};
  }
}
// Un effetto colpisce il nemico? (danno/malus). Cura/bonus vanno su di sé.
export function effectHitsEnemy(e) { return e && (e.kind === "damage" || e.kind === "malus"); }
// Risucchio vitale: % del danno inflitto (arma/pet: il colpo; oggetto: il suo danno).
export function lifestealPct(e) { return Math.min(100, Math.max(1, parseInt(e?.pct, 10) || 50)); }
export function effectsHaveEnemyTarget(effects) { return (effects || []).some(effectHitsEnemy); }
// Applica una lista di effetti. Ritorna { selfPatch, enemyPatch, selfHeal, enemyDmg, logs }.
// useChance=true (armi): ogni effetto con `chance`<100 tira per attivarsi.
// dealt = danno già inflitto dal colpo che porta gli effetti (per il risucchio).
export function applyMarketEffects(effects, selfP, enemyP, useChance, dealt = 0) {
  let selfPatch = {}, enemyPatch = {}, selfHeal = 0, enemyDmg = 0;
  const logs = [];
  const steals = [];
  for (const e of (effects || [])) {
    if (!e || !e.kind) continue;
    if (useChance && e.chance != null && e.chance < 100 && (Math.random() * 100) >= e.chance) continue;
    if (e.kind === "lifesteal") { steals.push(lifestealPct(e)); continue; }
    if (e.kind === "cleanse") {
      selfPatch = { ...selfPatch, ...clearDebuffs(selfP) };
      logs.push("✨ malus rimossi");
      continue;
    }
    if (e.kind === "heal") {
      const { total } = rollDmg(e.dice || "2d8"); selfHeal += total; logs.push(`💚 +${total} HP`);
    } else if (e.kind === "damage") {
      const { total } = rollDmg(e.dice || "2d6"); enemyDmg += total; logs.push(`💥 ${total} danni`);
    } else if (e.kind === "buff") {
      selfPatch = { ...selfPatch, ...buffPatchFor(e.buffType, e.buffAmount, e.buffTurns) };
      logs.push(`✨ +${e.buffAmount} ${MARKET_BUFF_LABEL[e.buffType] || "bonus"} ${Math.max(1, e.buffTurns || 1)}t`);
    } else if (e.kind === "malus") {
      enemyPatch = { ...enemyPatch, ...malusPatchFor(e.malusType, e.malusDice, e.malusTurns, { ...enemyP, ...enemyPatch }) };
      logs.push(`${MALUS_TYPE_MAP[e.malusType]?.icon || "☠"} ${malusTypeLabel(e.malusType)}`);
    }
  }
  // Il risucchio si calcola alla fine, sul danno del colpo + quello degli effetti.
  for (const pct of steals) {
    const base = Math.max(0, (dealt || 0) + enemyDmg);
    const heal = Math.floor(base * pct / 100);
    if (heal > 0) { selfHeal += heal; logs.push(`🩸 risucchia ${heal} HP`); }
  }
  return { selfPatch, enemyPatch, selfHeal, enemyDmg, logs };
}
// Converte l'effetto primario di un oggetto Bottega nella forma {kind,...} (null = resist/passivo).
export function primaryToEffect(p) {
  switch (p.effect) {
    case "heal":   return { kind: "heal", dice: p.dice || "2d8" };
    case "damage": return { kind: "damage", dice: p.dice || "2d6" };
    case "buff":   return { kind: "buff", buffType: p.buffType || "hit", buffAmount: p.buffAmount || 1, buffTurns: p.buffTurns || 3 };
    case "malus":  return { kind: "malus", malusType: p.malusType || "disadvantage", malusDice: p.malusDice || "1d6", malusTurns: p.malusTurns || 2 };
    default:       return null; // resist → passivo, non on-use
  }
}
export function normalizeMarketEffects(arr) {
  return (Array.isArray(arr) ? arr : []).filter(e => e && EFFECT_KIND_KEYS.includes(e.kind));
}
export function marketEffectsInfo(effects) {
  return (effects || []).map(e => {
    if (e.kind === "heal")   return `cura ${e.dice || "2d8"}`;
    if (e.kind === "damage") return `${e.dice || "2d6"} danni`;
    if (e.kind === "buff")   return `+${e.buffAmount || 1} ${MARKET_BUFF_LABEL[e.buffType] || "bonus"} ${Math.max(1, e.buffTurns || 1)}t`;
    if (e.kind === "malus")  return `${malusTypeLabel(e.malusType)}${e.chance != null && e.chance < 100 ? ` ${e.chance}%` : ""}`;
    if (e.kind === "lifesteal") return `risucchio ${lifestealPct(e)}%${e.chance != null && e.chance < 100 ? ` ${e.chance}%` : ""}`;
    if (e.kind === "cleanse") return "purifica";
    return "";
  }).filter(Boolean).join(" · ");
}

// Quanti debuff attivi ha il personaggio (per loggare se Ristorare ha pulito qualcosa).
export function countDebuffs(p) {
  let n = 0;
  if (p?.poisonDoT) n++;
  if (p?.bleedDoT) n++;
  if ((p?.attackDisadvantageTurns ?? 0) > 0) n++;
  if (p?.blindDebuff || (p?.eagleDebuffTurns ?? 0) > 0) n++;
  if ((p?.weaponLockTurns ?? 0) > 0) n++;
  if ((p?.stealthDisadvTurns ?? 0) > 0) n++;
  if (p?.entangled) n++;
  if ((p?.controlLostTurns ?? 0) > 0 || p?.pendingControlSave) n++;
  if (p?.pendingConSave || p?.pendingDexSave || p?.pendingSaveDot) n++;
  return n;
}

// Modificatori di danno del DIFENSORE (chokepoint unico chiamato a ogni colpo):
//  • Barbaro in Furia: metà danni da armi/skill, −25% dagli incantesimi.
//  • Ladro · Schivata Prodigiosa (Lv5): −25% ai danni fisici (non incantesimi).
//  • Elusione (Monaco/Ladro Lv7): −50% ai danni da incantesimo.
// Le riduzioni si applicano in sequenza (moltiplicative).
export function applyDefenderDamageMods(rawDmg, defenderSnap, defenderMatchPlayer, isSpell, bypassPhysicalReduction = false) {
  if (rawDmg <= 0) return rawDmg;
  let dmg = rawDmg;
  const defClass = (defenderSnap?.class || "").toLowerCase();
  const lv = getSnapLevel(defenderSnap);
  // Monaco · Colpi Ki (Lv6): i colpi in mischia ignorano le riduzioni ai danni fisici.
  const physReduction = !bypassPhysicalReduction;
  const defSubEff = getSubclassEffect(defenderSnap);
  // Barbaro · Totem (Orso): in Furia dimezza ANCHE i danni da incantesimo (oltre ai fisici).
  const totemBear = !!defSubEff.rageAllResist;
  // Barbaro in Furia: danni da incantesimo −25% sempre (−50% col Totem Orso). Danni fisici
  // −25% di base, −50% dal Lv6 (Resistenza Ferina) o col Totem Orso.
  if (["barbarian","barbaro"].some(c => defClass.includes(c)) && (defenderMatchPlayer?.rageTurns ?? 0) > 0) {
    dmg = isSpell ? Math.floor(dmg * (totemBear ? 0.5 : 0.75))
        : !physReduction ? dmg
        : (lv >= 6 || totemBear) ? Math.floor(dmg / 2)
        : Math.floor(dmg * 0.75);
  }
  // Ladro · Schivata Prodigiosa (Lv5): danni fisici −25%
  if (!isSpell && physReduction && isRogueClass(defClass) && lv >= 5) dmg = Math.floor(dmg * 0.75);
  // Elusione (Monaco/Ladro Lv7): danni da incantesimo −50%
  if (isSpell && lv >= 7 && (isMonkClass(defClass) || isRogueClass(defClass))) dmg = Math.floor(dmg * 0.5);
  // Sottoclasse · resistenza agli incantesimi (Mago Abiurazione, Stregone Draconica,
  //   Warlock Immondo/Abissale): riduce i danni da incantesimo subiti.
  if (isSpell && (defSubEff.spellResist || 0) > 0) dmg = Math.floor(dmg * (1 - defSubEff.spellResist));
  // Ranger · Difesa del Predatore (Lv7): mentre il Marchio del Cacciatore è attivo, −2 danni subiti.
  if (isRangerClass(defClass) && lv >= 7 && (defenderMatchPlayer?.hunterMarkTurns ?? 0) > 0) dmg = dmg - 2;
  return Math.max(1, dmg);
}

// ── DANNO TIPIZZATO + RESISTENZE (Bottega) ─────────────────────────────────
// Applica le resistenze del bersaglio PER TIPO di danno, PRIMA delle riduzioni
// di classe (applyDefenderDamageMods). L'arma può avere componenti elementali
// extra (`action.extraDamage: [{dice,type}]`) oltre al danno primario fisico.
//   • primaryRaw: danno primario già calcolato (dado+mod+bonus, ×crit).
//   • Il tipo primario (action.damageType) conta come "tagliente/…"; le
//     resistenze del bersaglio (snap.marketResist) lo riducono. Gli incantesimi
//     NON portano un tipo strutturato → nessuna resistenza tipizzata sul primario.
//   • Ogni componente extra è tirato ora, ×crit, e ridotto per il suo tipo.
// Ritorna { total, parts } dove parts elenca i componenti elementali applicati.
// Tipo di danno di un incantesimo (le spell non hanno damageType strutturato):
// dal campo se c'è, altrimenti dal testo "Lv1 · Fuoco", "Trucchetto · Necrotico"…
export function spellDamageType(action) {
  if (!action) return null;
  if (action.damageType) return action.damageType;
  const hay = `${action.info || ""} ${action.name || ""}`.toLowerCase();
  if (/fuoc|fiamm|brucia|incener|infern|meteora|brac|rogo|ardent/.test(hay)) return "fuoco";
  if (/fredd|ghiacc|\bgelo\b|gelid|congel|brina|glacial/.test(hay))         return "freddo";
  if (/fulmin|saett|folgor|elettr/.test(hay))                                  return "fulmine";
  if (/tuono|tonant|boato|fragore/.test(hay))                                  return "tuono";
  if (/acid/.test(hay))                                                        return "acido";
  if (/velen|tossic/.test(hay))                                                return "veleno";
  if (/necrot|vampir|drena/.test(hay))                                         return "necrotico";
  if (/radiant|sacr|divin|\bluce\b|solare/.test(hay))                          return "radiante";
  if (/psichic|mental/.test(hay))                                              return "psichico";
  if (/\bforza\b/.test(hay))                                                   return "forza";
  return null;
}
// Moltiplicatore di resistenza (Bottega) per il danno di un incantesimo.
// Danno nel tempo (poisonDoT): la bruciatura è fuoco, il resto veleno.
export function dotResistMult(snap, matchPlayer) {
  const isBurn = matchPlayer?.poisonDoTIcon === "🔥" || matchPlayer?.poisonDoTSourceLabel === "bruciatura";
  return damageMultiplier(isBurn ? "fuoco" : "veleno", snap?.marketResist || {});
}
export function spellResistMult(action, defenderSnap) {
  const t = spellDamageType(action);
  return t ? damageMultiplier(t, defenderSnap?.marketResist || {}) : 1;
}
export function applyTypedDamage(primaryRaw, action, critMult, defenderSnap, isSpell, fallbackType = null) {
  const resist = defenderSnap?.marketResist || {};
  // Incantesimi: il tipo si ricava dal testo (prima nessuna resistenza scattava).
  // Abilità con l'arma senza tipo: quello dell'arma (fallbackType).
  const primaryType = isSpell ? spellDamageType(action) : (action?.damageType || fallbackType || null);
  const primaryMult = primaryType ? damageMultiplier(primaryType, resist) : 1;
  let total = primaryRaw * primaryMult;
  let resisted = primaryMult < 1; // resistenza/immunità sul tipo primario
  const parts = [];
  for (const comp of (action?.extraDamage || [])) {
    if (!comp?.dice) continue;
    const rolled = Math.round((rollDamageFormula(comp.dice) || 0) * (critMult || 1));
    if (rolled <= 0) continue;
    const mult = damageMultiplier(comp.type, resist);
    if (mult < 1) resisted = true;
    const fin  = Math.round(rolled * mult);
    total += fin;
    parts.push({ type: comp.type, amount: fin, raw: rolled, resisted: mult !== 1 });
  }
  return { total: Math.max(0, Math.round(total)), parts, resisted };
}

// ── RESISTENZE / REGOLE ELEMENTALI BASE ────────────────────────────────────
// Regole del mondo valide in TUTTI i fight dell'Arena (sfide, IA, tornei):
//  • Senza armatura → +1 iniziativa.
//  • Armatura pesante vs spell fulmine/tuono → chi ti attacca tira per colpire
//    a vantaggio e tu tiri i TS a svantaggio contro quel tipo.
//  • Fuoco su armatura di pelle/leggera o forma animale (druido) → probabilità
//    di "Bruciatura" (in fiamme 2 turni, DoT).
//  • Freddo → probabilità di "Congelato" (svantaggio al prossimo tiro per colpire).
export const ELEM_BURN_CHANCE   = 0.25;   // fuoco → Bruciatura
export const ELEM_FREEZE_CHANCE = 0.25;   // freddo → Congelato
export const ELEM_BURN_TURNS    = 2;
export const ELEM_BURN_DICE     = "1d4";
export const _ELEM_KEYS = ["fuoco", "freddo", "fulmine", "tuono"];

// Elemento di un'azione. Le armi/skill possono avere `damageType` strutturato;
// le spell no → si deduce dal testo (`info`/nome). Fallback: componenti extra.
export function actionElement(action) {
  if (!action) return null;
  if (_ELEM_KEYS.includes(action.damageType)) return action.damageType;
  const hay = `${action.info || ""} ${action.name || ""}`.toLowerCase();
  if (/fuoc|fiamm|brucia|incener|infern|meteora|brac|rogo|ardent/.test(hay)) return "fuoco";
  if (/fredd|ghiacc|\bgelo\b|congel|brina|glacial/.test(hay))               return "freddo";
  if (/fulmin|saett|folgor|elettr/.test(hay))                                return "fulmine";
  if (/tuono|tonant|boato|fragore/.test(hay))                                return "tuono";
  for (const c of (action.extraDamage || [])) if (_ELEM_KEYS.includes(c?.type)) return c.type;
  return null;
}

// Classe di peso dell'armatura equipaggiata, letta dallo snapshot.selectedArmor.
export function isHeavyArmor(snap) { return snap?.selectedArmor?.maxDex === 0; }
export function isLightArmor(snap) { const a = snap?.selectedArmor; return !!a && !a.unarmoredDefense && a.maxDex === 99; }
export function isNoArmor(snap)    { const a = snap?.selectedArmor; return a ? a.unarmoredDefense === true : !hasMarketFixedArmor(snap); }
// Armatura della Bottega a CA fissa: il loadout la accetta solo al posto di
// un'armatura base, quindi uno snapshot di giocatore senza selectedArmor ce l'ha.
export function hasMarketFixedArmor(snap) { return !!snap && !snap.selectedArmor && snap.stats?.ac != null && !snap.isAi; }
// Abilità che colpiscono con l'arma (Carica, Attacco Poderoso, Turbine di Lame…)
// non hanno un tipo di danno: prendono quello dell'arma impugnata, così le
// resistenze fisiche della Bottega valgono anche su di loro (2026-10-21).
export function physicalFallbackType(action, attackerSnap, attackerMP) {
  if (!action || action.damageType) return null;
  const physical = action.type === "weapon" || ["str", "dex"].includes(action.statKey);
  if (!physical) return null;
  const acts = attackerSnap?.selectedActions || [];
  const held = attackerMP?.equippedWeaponNames?.[0];
  const w = acts.find(a => a?.type === "weapon" && a.name === held && a.damageType)
    || acts.find(a => a?.type === "weapon" && a.damageType);
  return w?.damageType || "contundente";
}
// Vulnerabile al fuoco: armatura leggera/di pelle, oppure druido in forma animale.
export function isFireVulnerable(snap, matchPlayer) { return isLightArmor(snap) || !!matchPlayer?.wildShape; }
// L'attaccante tira per colpire a vantaggio se il bersaglio è in armatura pesante
// e l'azione è di tipo fulmine/tuono.
export function heavyElemAttackAdv(action, defenderSnap) {
  const el = actionElement(action);
  return (el === "fulmine" || el === "tuono") && isHeavyArmor(defenderSnap);
}

// Applica le regole elementali "on hit" al bersaglio colpito da danno.
// Ritorna { patch, note }: `patch` va fuso nel patch del difensore, `note` è
// una riga di log (o null). La Bruciatura riusa lo slot DoT del veleno (come il
// Mephit di Fiamma); il Congelato riusa lo svantaggio ai tiri per colpire.
export function elementalOnHitStatus(action, isSpell, defenderSnap, defMatchPlayer, damage, isHit) {
  if (!isHit || damage <= 0 || !isSpell) return { patch: {}, note: null };
  const el = actionElement(action);
  if (el === "fuoco" && isFireVulnerable(defenderSnap, defMatchPlayer) && Math.random() < ELEM_BURN_CHANCE) {
    return {
      patch: {
        poisonDoT: true,
        poisonDoTTurns: Math.max(defMatchPlayer?.poisonDoTTurns ?? 0, ELEM_BURN_TURNS),
        poisonDoTDice: ELEM_BURN_DICE,
        poisonDoTSourceLabel: "bruciatura",
        poisonDoTNoun: "in fiamme",
        poisonDoTIcon: "🔥",
      },
      note: "🔥 prende fuoco — Bruciatura!",
    };
  }
  if (el === "freddo" && Math.random() < ELEM_FREEZE_CHANCE) {
    return {
      patch: {
        attackDisadvantageTurns: Math.max(defMatchPlayer?.attackDisadvantageTurns ?? 0, 1),
        ...disadvTag("Congelato", "🧊", "is-frost"),
      },
      note: "🧊 Congelato — svantaggio al prossimo tiro per colpire!",
    };
  }
  return { patch: {}, note: null };
}

// Titoli cumulativi: legge l'array `arenaTitles` e fa fallback al legacy `arenaTitle` singolo.
export function getCharTitles(ch) {
  if (!ch) return [];
  if (Array.isArray(ch.arenaTitles)) return ch.arenaTitles.filter(Boolean);
  if (ch.arenaTitle) return [ch.arenaTitle];
  return [];
}
export function getSnapTitles(snap) {
  if (!snap) return [];
  if (Array.isArray(snap.titles)) return snap.titles.filter(Boolean);
  if (snap.title) return [snap.title];
  return [];
}

// ── CLASSI ───────────────────────────────────────────────────────────────────
export const PHYSICAL_CLASSES = ["fighter","guerriero","warrior","rogue","ladro","paladin","paladino","ranger","cacciatore","barbarian","barbaro","monk","monaco"];
export const CASTER_CLASSES   = ["wizard","mago","sorcerer","stregone","warlock","bard","bardo","cleric","chierico","druid","druido"];

export function isFullCaster(cls)    { return ["wizard","mago","sorcerer","stregone","warlock"].some(c => cls.includes(c)); }
export function isWizardClass(cls)   { return ["wizard","mago"].some(c => cls.includes(c)); }
export function isSorcererClass(cls) { return ["sorcerer","stregone"].some(c => cls.includes(c)); }
export function isWarlockClass(cls)  { return ["warlock"].some(c => cls.includes(c)); }
export function isDruidClass(cls)    { return ["druid","druido"].some(c => cls.includes(c)); }
export function isPaladinClass(cls)  { return ["paladin","paladino"].some(c => cls.includes(c)); }
export function isClericClass(cls)   { return ["cleric","chierico"].some(c => cls.includes(c)); }
export function isBardClass(cls)     { return ["bard","bardo"].some(c => cls.includes(c)); }
export function isFighterClass(cls)  { return ["fighter","guerriero","warrior"].some(c => cls.includes(c)); }
export function isRogueBardClass(cls){ return ["rogue","ladro","bard","bardo"].some(c => cls.includes(c)); }
// Caratteristica da incantatore usata per CD dei TS e bonus magici, per classe:
//   INT → Mago · SAG → Chierico, Druido, Ranger · CAR → Bardo, Paladino, Stregone, Warlock
export function getSpellcastingAbility(cls) {
  // CAR: Bardo, Paladino, Stregone, Warlock
  if (["bard","bardo","warlock","sorcerer","stregone","paladin","paladino"].some(c => cls.includes(c))) return "cha";
  // SAG: Chierico, Druido, Ranger
  if (["cleric","chierico","druid","druido","ranger","cacciatore"].some(c => cls.includes(c))) return "wis";
  // INT: Mago (+ default per classi senza incantesimi a TS)
  return "int";
}
// Spell mod del caster (INT/SAG/CAR a seconda della classe).
export function getSpellMod(snap) {
  const cls = (snap?.class || "").toLowerCase();
  const key = getSpellcastingAbility(cls);
  return snap?.stats?.[key] ?? 0;
}
// Bonus di competenza (D&D) in base al livello della classe principale del caster:
// +2 (liv 1-4), +3 (5-8), +4 (9-12)… Default liv 1 → +2 se manca classLevels.
export function getProficiencyBonus(snap) {
  const classKey = getClassKey(snap?.class);
  const level    = snap?.classLevels?.[classKey] ?? 3;
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}
// Livello della classe attiva letto dallo snapshot (default Lv.3).
export function getSnapLevel(snap) {
  const classKey = getClassKey(snap?.class);
  return snap?.classLevels?.[classKey] ?? 3;
}
// ── FASCE DI LIVELLO DEI TORNEI ──────────────────────────────────────────────
// Il Master sceglie una fascia quando apre le iscrizioni: si può partecipare SOLO
// con le classi il cui livello rientra nella fascia (le altre sono annerite/non
// selezionabili). Fasce strette (3 livelli l'una), a partire da Lv.3 perché
// nell'Arena si parte da lì. Salvata su arena_meta/global come `levelBracket`
// (chiave); null = tutti i livelli.
export const ARENA_LEVEL_BRACKETS = [
  { key: "3-5",   label: "Lv 3-5",   lo: 3,  hi: 5  },
  { key: "6-8",   label: "Lv 6-8",   lo: 6,  hi: 8  },
  { key: "9-11",  label: "Lv 9-11",  lo: 9,  hi: 11 },
  { key: "12-14", label: "Lv 12-14", lo: 12, hi: 14 },
  { key: "15-17", label: "Lv 15-17", lo: 15, hi: 17 },
  { key: "18-20", label: "Lv 18-20", lo: 18, hi: 20 },
];
export function getArenaBracket(key) { return ARENA_LEVEL_BRACKETS.find(b => b.key === key) || null; }
// Livello di una classe per un personaggio (default 3, come nel resto dell'Arena).
export function classLevelFor(cls, classLevels) { return classLevels?.[getClassKey(cls)] ?? 3; }
// Una classe è ammessa se il suo livello rientra nella fascia scelta (o se non c'è fascia).
export function classInBracket(cls, classLevels, bracketKey) {
  const b = getArenaBracket(bracketKey);
  if (!b) return true;
  const lvl = classLevelFor(cls, classLevels);
  return lvl >= b.lo && lvl <= b.hi;
}
// Effetto della sottoclasse scelta, letto dallo snapshot (snap.subclass = chiave opzione).
export function getSubclassEffect(snap) {
  return getSubclassEffectFor(getClassKey(snap?.class), snap?.subclass);
}
// Ritorsione del difensore: quella della sottoclasse, altrimenti le Spine
// dell'armatura della Bottega (stesse regole: mischia, primo colpo del turno).
export function defenderRetaliate(snap) {
  const eff = getSubclassEffect(snap);
  if (eff.retaliate) return eff;
  return snap?.marketRetaliate ? { retaliate: snap.marketRetaliate, retaliateLabel: "🌵 Spine" } : eff;
}
// Sottoclasse comprata in Bottega QUESTA settimana per la classe (chiave o null).
// Vive in characters.arenaWeekly.subclasses = { [classKey]: subclassKey }.
export function ownedSubclassKey(arenaWeekly, cls) {
  if (!arenaWeekly || arenaWeekly.weekKey !== currentWeekKey() || !cls) return null;
  const ck = getClassKey(cls);
  const key = arenaWeekly.subclasses?.[ck];
  return getSubclassDef(ck, key) ? key : null;
}
// Sottoclassi selezionabili nel loadout, per contesto:
//   torneo      → solo quella comprata in Bottega questa settimana per la classe
//   sfide libere (IA e tra amici) → tutte e due, già sbloccate e gratis
//   riserve     → nessuna
export function selectableSubclasses(context, arenaWeekly, cls) {
  const ck = getClassKey(cls);
  if (!cls) return [];
  if (context === "fun") return ARENA_SUBCLASSES[ck]?.options || [];
  if (context === "tournament") {
    const own = ownedSubclassKey(arenaWeekly, cls);
    const def = own ? getSubclassDef(ck, own) : null;
    return def ? [def] : [];
  }
  return [];
}
// Sottoclasse · soglia del critico (Guerriero Campione: 18-20). Mai peggiore della base.
export function subclassCritThreshold(snap, base) {
  const r = getSubclassEffect(snap).critRange;
  return r ? Math.min(base, r) : base;
}
// Sottoclasse · bonus ai tiri per COLPIRE con armi a distanza (Guerriero "tiratore",
// Ranger "arco"). Vale solo se l'azione è un attacco con arma a distanza.
export function subclassRangedHit(snap, action, isSpell) {
  if (isSpell || !action || action.type !== "weapon" || !WEAPON_IS_RANGED(action)) return 0;
  return getSubclassEffect(snap).rangedHit || 0;
}
// Sottoclasse · "primo colpo" contro un bersaglio a PF pieni (apertura del duello):
//   Ladro "assassino" (vantaggio + critico se va a segno), Monaco "ombra" (vantaggio).
// Deterministico e senza stato: usa i PF correnti del difensore (pieni = non ancora colpito).
export function subclassFirstStrike(attackerSnap, isSpell, defMatchPlayer, defenderSnap) {
  if (isSpell) return { adv: false, crit: false };
  const eff = getSubclassEffect(attackerSnap);
  if (!eff.firstStrikeAdv) return { adv: false, crit: false };
  const maxHp = defMatchPlayer?.maxHp ?? defenderSnap?.stats?.maxHp ?? 0;
  const full  = maxHp > 0 && (defMatchPlayer?.hp ?? 0) >= maxHp;
  return { adv: full, crit: full && !!eff.assassinate };
}
// Sottoclasse (Fase 2) · dado bonus ai danni + Ondata Selvaggia. Restituisce { bonus, tag }.
//   weaponBonusDie (Artefice "artigliere") / spellBonusDie (Artefice "alchimista"):
//     dado extra ai danni con arma / incantesimo. wildSurge (Stregone "selvaggia"):
//     ogni incantesimo a segno ha 1 su 4 di scatenare un'ondata (+2d6).
export function subclassDamageDice(attackerSnap, isSpell) {
  const eff = getSubclassEffect(attackerSnap);
  let bonus = 0; const tags = [];
  const die = isSpell ? eff.spellBonusDie : eff.weaponBonusDie;
  if (die) { const r = rollDmg(die); bonus += r.total; tags.push(`🎲${die}=${r.total}`); }
  if (isSpell && eff.wildSurge && (Math.floor(Math.random() * 4) + 1) === 1) {
    const r = rollDmg("2d6"); bonus += r.total; tags.push(`🎲ondata+${r.total}`);
  }
  return { bonus, tag: tags.join(" ") };
}
// Sottoclasse (Fase 2) · Presagio (Mago "divinazione"): l'attaccante tira a SVANTAGGIO
//   quando colpisce un divinatore a PF pieni (il primo colpo "previsto" del duello).
export function subclassForesightDisadv(defenderSnap, defMatchPlayer) {
  const eff = getSubclassEffect(defenderSnap);
  if (!eff.foresight) return false;
  const maxHp = defMatchPlayer?.maxHp ?? defenderSnap?.stats?.maxHp ?? 0;
  return maxHp > 0 && (defMatchPlayer?.hp ?? 0) >= maxHp;
}
// Modificatore del tiro salvezza del DIFENSORE, con Aura di Protezione del
// Paladino (Lv6): +CAR ai propri tiri salvezza (passiva).
export function defenderSaveMod(snap, ability) {
  const base = snap?.stats?.[ability] ?? 0;
  const cls = (snap?.class || "").toLowerCase();
  // Paladino · Aura di Protezione (Lv6): +CAR a tutti i tiri salvezza.
  if (isPaladinClass(cls) && getSnapLevel(snap) >= 6) return base + (snap?.stats?.cha ?? 0);
  // Bardo · Tuttofare (Lv2): +1 a tutti i tiri salvezza.
  if (isBardClass(cls) && getSnapLevel(snap) >= 2) return base + 1;
  // Guerriero · Risolutezza (Lv7): +2 a tutti i tiri salvezza.
  if (isFighterClass(cls) && getSnapLevel(snap) >= 7) return base + 2;
  return base;
}
// ── SCALING PER LIVELLO DI SKILL/CARICHE (Arena_class_progress.txt H4) ────────
// Attacco Furtivo (Ladro): dadi bonus per livello — 2d6@4 · 3d6@8 · 4d6@11 · 5d6@16 · 6d6@19.
export function sneakAttackDice(level) {
  const lv = Math.max(3, level ?? 3);
  if (lv >= 19) return "6d6";
  if (lv >= 16) return "5d6";
  if (lv >= 11) return "4d6";
  if (lv >= 8)  return "3d6";
  if (lv >= 4)  return "2d6";
  return "1d6";
}
// Furia (Barbaro): bonus al danno per livello — +2 · +3@4 · +4@9 · +6@16.
export function rageDamageBonus(level) {
  const lv = Math.max(3, level ?? 3);
  if (lv >= 16) return 6;
  if (lv >= 9)  return 4;
  if (lv >= 4)  return 3;
  return 2;
}
// Colpo Benedetto (Chierico Lv5): aggiunge 1 dado alla formula — "8d6"→"9d6",
// "10d6+40"→"11d6+40". Incrementa solo il primo blocco NdM.
export function addOneDie(diceStr) {
  if (!diceStr || typeof diceStr !== "string") return diceStr;
  return diceStr.replace(/(\d+)\s*d\s*(\d+)/i, (_, n, f) => `${parseInt(n, 10) + 1}d${f}`);
}
// Se lo snapshot è un Chierico Lv5+, applica Colpo Benedetto alla formula (cure/danni spell).
export function clericBlessedDice(diceStr, snap) {
  const cls = (snap?.class || "").toLowerCase();
  return (isClericClass(cls) && getSnapLevel(snap) >= 5) ? addOneDie(diceStr) : diceStr;
}
// Furia Bestiale (Barbaro Lv3): in Furia +1 danno per ogni 25% di PF mancanti (0..4).
export function beastRageDamageBonus(snap, matchPlayer) {
  const cls = (snap?.class || "").toLowerCase();
  if (!(isBarbarianClass(cls) && getSnapLevel(snap) >= 3)) return 0;
  if ((matchPlayer?.rageTurns ?? 0) <= 0) return 0;
  const maxHp = snap?.stats?.maxHp ?? matchPlayer?.maxHp ?? matchPlayer?.hp ?? 1;
  const hp = matchPlayer?.hp ?? maxHp;
  const missing = Math.max(0, 1 - hp / Math.max(1, maxHp));
  return Math.min(4, Math.floor(missing * 4));
}
// Chierico · Colpo Divino (Lv8): +1d8 radiante ai colpi con arma (non incantesimi).
export function divineStrikeBonus(snap, isSpell) {
  if (isSpell) return 0;
  const cls = (snap?.class || "").toLowerCase();
  if (!(isClericClass(cls) && getSnapLevel(snap) >= 8)) return 0;
  return rollDmg("1d8").total;
}
// Barbaro · Attacco Irruento (Lv2): mentre è in Furia colpisce con più foga (+2 al
// colpire) ma abbassa la guardia (−2 CA, applicato in getEffectiveAc). Player + IA.
// Berserker · Frenesia: chi l'ha usata, a Furia finita, è sfinito (svantaggio agli
// attacchi) fino alla fine del suo prossimo turno d'attacco.
export function frenzyExhausted(p) {
  return !!p?.frenzySpent && (p?.rageTurns ?? 0) <= 0;
}
export function recklessRaging(snap, matchPlayer) {
  const cls = (snap?.class || "").toLowerCase();
  return isBarbarianClass(cls) && getSnapLevel(snap) >= 2 && (matchPlayer?.rageTurns ?? 0) > 0;
}
// Artefice · Infusione (Lv2): potenziamento permanente dell'arma (+1 al colpire e +1 al danno).
export function infusionWeaponBonus(snap) {
  const cls = (snap?.class || "").toLowerCase();
  return (isArtificerClass(cls) && getSnapLevel(snap) >= 2) ? 1 : 0;
}
// Guerriero · Risolutezza (Lv7): fermezza incrollabile → +2 a tutti i tiri salvezza (in defenderSaveMod).
// Monaco · Colpi Ki (Lv6): i colpi in mischia contano come magici e ignorano le
// riduzioni ai danni fisici (Furia, Schivata Prodigiosa, Resistenza Ferina).
export function kiStrikesBypass(snap, isSpell) {
  if (isSpell) return false;
  const cls = (snap?.class || "").toLowerCase();
  return isMonkClass(cls) && getSnapLevel(snap) >= 6;
}
// Barbaro ribilanciato (2026-10-28): gli snapshot salvati prima hanno ancora le
// abilità vecchie (Furia 4 cariche, Turbine 2d10 a un tiro, Attacco Poderoso
// attacco + vantaggio 3 turni). Le riscrive con le regole nuove, conservando le
// cariche scalate per livello. Chiamata sugli snapshot appena letti da Firestore.
export function migrateBarbarianAction(a) {
  if (!a || typeof a !== "object") return a;
  if (a.special === "rage" && (a.maxUses ?? 0) > 2) {
    return { ...a, maxUses: 2, info: String(a.info || "").replace(/\d+ cariche/, "2 cariche") };
  }
  if (a.name === "Turbine di Lame" && !a.multiHit) {
    const uses = a.maxUses ?? 2;
    return { ...a, damage: "2×1d6", multiHit: 2, perHitDamage: "1d6", info: `2 attacchi · ognuno tira per colpire e fa 1d6+FOR · ${uses} cariche` };
  }
  if (a.name === "Attacco Poderoso" && a.special !== "mighty_strike") {
    const { grantsAdvTurns: _old, ...rest } = a; // eslint-disable-line no-unused-vars
    return { ...rest, hitBonus: 0, damage: "—", statKey: null, type: "skill",
      special: "mighty_strike", bonusAction: true, maxUses: a.maxUses ?? 2,
      info: `Bonus Action · vantaggio al prossimo attacco di questo turno · ${a.maxUses ?? 2} cariche` };
  }
  return a;
}
export function migrateArenaSnapshots(snaps) {
  if (!snaps || typeof snaps !== "object") return snaps;
  let changed = false;
  const out = {};
  for (const [k, sn] of Object.entries(snaps)) {
    const acts = sn?.selectedActions;
    if (Array.isArray(acts) && acts.some(a => a && (a.special === "rage" || a.name === "Turbine di Lame" || a.name === "Attacco Poderoso"))) {
      const next = acts.map(migrateBarbarianAction);
      if (next.some((a, i) => a !== acts[i])) { out[k] = { ...sn, selectedActions: next }; changed = true; continue; }
    }
    out[k] = sn;
  }
  return changed ? out : snaps;
}
// Applica a un'azione automatica lo scaling per livello di cariche/danno (Lv4-8).
// Usato al momento dell'iscrizione, così i valori scalati entrano nello snapshot
// e tutto il resto (UI cariche, danno in combattimento) li legge da lì.
export function scaleActionForLevel(action, level, chaScore) {
  const lv = Math.max(3, level ?? 3);
  const a = { ...action };
  if (a.special === "bardic_inspiration") {
    // Fonte d'Ispirazione (Bardo Lv5): +1 carica di Ispirazione.
    a.maxUses = Math.max(1, chaScore ?? 1) + (lv >= 5 ? 1 : 0);
    if (lv >= 5) a.info = `${a.info || "Ispirazione"} · +1 carica (Fonte d'Ispirazione)`;
    return a;
  }
  if (a.special === "smite") {
    const uses = 2 + (lv >= 4 ? 1 : 0) + (lv >= 8 ? 1 : 0);
    const dice = lv >= 19 ? "3d8" : "2d8";
    a.maxUses = uses; a.damage = dice; a.info = `Attacca con arma +${dice} · ${uses} cariche`; return a;
  }
  if (a.special === "sneak_attack") {
    const dice = sneakAttackDice(lv);
    a.damage = dice; a.info = `Arma+${dice}+DES · ${a.maxUses} cariche`; return a;
  }
  if (a.special === "hunter_mark") {
    a.maxUses = 2 + (lv >= 4 ? 1 : 0);
    a.info = `Bonus action · +3 ai tiri per colpire per 3 turni · ${a.maxUses} cariche`; return a;
  }
  if (a.name === "Carica")             { a.maxUses = 3 + (lv >= 6 ? 1 : 0); a.info = `2d6+FOR · ${a.maxUses} cariche`; return a; }
  if (a.name === "Disarmare")          { a.maxUses = 2 + (lv >= 8 ? 1 : 0); return a; }
  if (a.special === "rage")            { a.info = `Bonus Action · +${rageDamageBonus(lv)} danno armi per 3 turni · ${a.maxUses} cariche`; return a; }
  if (a.special === "turbine_lame")    { a.maxUses = 2 + (lv >= 8 ? 1 : 0); a.info = `2 attacchi · ognuno tira per colpire e fa 1d6+FOR · ${a.maxUses} cariche`; return a; }
  if (a.special === "concentrate_buff"){ a.maxUses = 2 + (lv >= 8 ? 1 : 0); return a; }
  return a;
}
// ── PUNTI CARATTERISTICA (ASI) — vedi Arena_class_progress.txt §2E ────────────
// A ogni livello-ASI il player riceve +2 punti da distribuire alle caratteristiche.
// Livelli-ASI standard: 4·8·12·16·19. Eccezioni: Guerriero +6/+14, Ladro +10.
// Si parte da Lv.3, quindi il primo ASI ottenibile è quello del Lv.4.
export const ASI_LEVELS_DEFAULT = [4, 8, 12, 16, 19];
export const ASI_LEVELS_BY_CLASS = {
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue:   [4, 8, 10, 12, 16, 19],
};
export const ASI_POINTS_PER_LEVEL = 2;
// Punti caratteristica maturati da UNA classe al suo livello attuale (default Lv.3).
export function getAsiPoints(classKey, level) {
  const lv = Math.max(3, level ?? 3);
  const levels = ASI_LEVELS_BY_CLASS[classKey] || ASI_LEVELS_DEFAULT;
  return levels.filter(l => l <= lv).length * ASI_POINTS_PER_LEVEL;
}
// CD TS = 8 + competenza + mod caratteristica principale del caster
// (CAR stregone/warlock/bardo/paladino, INT mago, SAG chierico/druido).
// Formula uniforme per tutti gli incantesimi con TS (controllo, DoT, danno).
export function getSpellSaveDC(snap) { return 8 + getProficiencyBonus(snap) + getSpellMod(snap); }
// Un incantesimo a danno usa il TS al posto del tiro per colpire.
// Eccezioni: spell con `special` (control/heal/buff/etc.) e quelle marcate auto-hit (hitBonus ≥ 20, es. Dardo Incantato).
export function isSaveDamageSpell(action) {
  if (!action || action.type !== "spell") return false;
  if (action.special) return false;
  if (!action.damage || action.damage === "—") return false;
  if ((action.hitBonus ?? 0) >= 20) return false;
  return true;
}
// Determina l'abilità del TS dalla descrizione (es. "TS SAG", "TS COS"). Default: SAG.
export function parseSpellSaveAbility(action) {
  const info = (action?.info || "").toUpperCase();
  if (info.includes("TS FOR")) return "str";
  if (info.includes("TS DES")) return "dex";
  if (info.includes("TS COS")) return "con";
  if (info.includes("TS INT")) return "int";
  if (info.includes("TS CAR")) return "cha";
  return "wis";
}
// Caratteristica del TS per gli incantesimi a DANNO: il bersaglio tira la stat
// dell'INCANTESIMO (non quella del lanciatore, che serve solo per la CD).
// Priorità: etichetta "TS XXX" esplicita → tipo di danno → DES di default.
// Convenzione: veleno/necrotico = Costituzione · tutto il resto = Destrezza.
export function damageSpellSaveAbility(action) {
  const info = (action?.info || "").toUpperCase();
  if (action?.saveAbility) return action.saveAbility;
  if (info.includes("TS FOR")) return "str";
  if (info.includes("TS DES")) return "dex";
  if (info.includes("TS COS")) return "con";
  if (info.includes("TS INT")) return "int";
  if (info.includes("TS CAR")) return "cha";
  if (info.includes("TS SAG")) return "wis";
  if (/VELENO|NECROTICO/.test(info)) return "con";
  return "dex";
}
export const SAVE_LABEL = { str: "FOR", dex: "DES", con: "COS", int: "INT", wis: "SAG", cha: "CAR" };

// ── MECCANICA UFFICIALE D&D 5e per ogni incantesimo a DANNO (per nome) ─────────
//   cast: "attack"       → tiro per colpire dell'incantatore vs CA del bersaglio
//         "save_half"    → il bersaglio tira il TS: fallisce = danno pieno · supera = metà
//         "save_negate"  → il bersaglio tira il TS: fallisce = danno pieno · supera = nessun danno
//         "auto"         → colpisce sempre, nessun tiro (es. Dardo Incantato / Magic Missile)
//   save: caratteristica del TS del bersaglio (solo per le modalità con TS)
export const SPELL_MECHANICS = {
  // Trucchetti — tiro per colpire
  "Dardo di Fuoco":         { cast: "attack" },
  "Tocco Gelido":           { cast: "attack" },
  "Scossa Folgorante":      { cast: "attack" },
  // Sottoclassi (arenaSubclasses.js)
  "Lama Arcana":            { cast: "attack" },
  "Dardo Scolpito":         { cast: "save_half", save: "dex" },
  "Raggio di Gelo":         { cast: "attack" },
  "Deflagrazione Occulta":  { cast: "attack" },
  "Frusta di Spine":        { cast: "attack" },
  "Produrre Fiamma":        { cast: "attack" },
  // Trucchetti — TS annulla
  "Spruzzo Velenoso":       { cast: "save_negate", save: "con" },
  "Lama Vorticosa":         { cast: "save_negate", save: "dex" },
  "Gelidito":               { cast: "save_negate", save: "con" },
  "Morso di Gelo":          { cast: "save_negate", save: "con" },
  "Infestazione":           { cast: "save_negate", save: "con" },
  "Schianto di Tuono":      { cast: "save_negate", save: "con" },
  "Rintocco Funebre":       { cast: "save_negate", save: "wis" },
  "Rintocco dei Morti":     { cast: "save_negate", save: "wis" },
  "Fiamma Sacra":           { cast: "save_negate", save: "dex" },
  "Parola di Splendore":    { cast: "save_negate", save: "con" },
  // Livello 1
  "Dardo Incantato":        { cast: "auto" },
  "Mani Brucianti":         { cast: "save_half", save: "dex" },
  "Colpo Cromatico":        { cast: "attack" },
  "Onda Tonante":           { cast: "save_half", save: "con" },
  "Braccia di Hadar":       { cast: "save_half", save: "str" },
  "Rappresaglia Infernale": { cast: "save_half", save: "dex" },
  "Coltello di Ghiaccio":   { cast: "attack" },
  "Dardo Guidato":          { cast: "attack" },
  "Infliggi Ferite":        { cast: "attack" },
  "Punizione Travolgente":  { cast: "attack" },
  "Grandine di Spine":      { cast: "attack" },
  // Livello 2
  "Raggio Rovente":         { cast: "attack" },
  "Nube di Pugnali":        { cast: "auto" },
  "Frantumare":             { cast: "save_half", save: "con" },
  "Frastornare":            { cast: "save_half", save: "con" },
  "Tocco Vampirico":        { cast: "attack" },
  "Raggio di Luna":         { cast: "save_half", save: "con" },
  "Lama di Fiamma":         { cast: "attack" },
  "Arma Spirituale":        { cast: "attack" },
  "Punizione Marchiante":   { cast: "attack" },
  // Livello 3
  "Palla di Fuoco":         { cast: "save_half", save: "dex" },
  "Fulmine":                { cast: "save_half", save: "dex" },
};
// Meccanica di un incantesimo a danno: dalla tabella, con fallback "TS annulla".
export function getSpellCast(action) {
  const m = SPELL_MECHANICS[action?.name];
  if (m) return { cast: m.cast, save: m.save || damageSpellSaveAbility(action) };
  return { cast: "save_negate", save: damageSpellSaveAbility(action) };
}
// Bonus al tiro per colpire degli incantesimi = competenza + mod da incantatore.
export function getSpellAttackBonus(snap) { return getProficiencyBonus(snap) + getSpellMod(snap); }
// Etichetta leggibile della meccanica di un incantesimo a danno (loadout/manuale).
export function spellMechanicTag(action) {
  const { cast, save } = getSpellCast(action);
  if (cast === "attack")    return "🎯 Tiro per colpire vs CA";
  if (cast === "auto")      return "✨ Colpisce sempre (no tiro)";
  if (cast === "save_half") return `TS ${SAVE_LABEL[save]} · supera = ½ danni`;
  return `TS ${SAVE_LABEL[save]} · supera = nessun danno`;
}

export function isRogueClass(cls)      { return ["rogue","ladro"].some(c => cls.includes(c)); }
export function isRangerClass(cls)     { return ["ranger","cacciatore"].some(c => cls.includes(c)); }
export function isArtificerClass(cls)  { return ["artificer","artefice"].some(c => cls.includes(c)); }
export function isBarbarianClass(cls)  { return ["barbarian","barbaro"].some(c => cls.includes(c)); }
export function isMonkClass(cls)       { return ["monk","monaco"].some(c => cls.includes(c)); }

// Furtività: due contatori indipendenti (vantaggio del Ladro / svantaggio dei nemici).
// Compatibili con il vecchio campo `stealthTurns` tramite fallback.
export function readStealthAdvTurns(p)    { return p?.stealthAdvTurns    ?? p?.stealthTurns ?? 0; }
export function readStealthDisadvTurns(p) { return p?.stealthDisadvTurns ?? p?.stealthTurns ?? 0; }
export function readStealthAnyTurns(p)    { return Math.max(readStealthAdvTurns(p), readStealthDisadvTurns(p)); }

// Numero massimo di azioni per turno: Monaco = 2, Ladro = 2, altrimenti 1.
// +1 se il giocatore ha extraTurnActive (Passo Spedito).
// +1 se Scatto d'Azione è attivo (Guerriero) — concede un'azione extra per questo turno.
export const EXTRA_ATTACK_CLASSES = ["fighter", "barbarian", "paladin", "ranger"];
export function getMaxActionsPerTurn(snap, matchPlayer) {
  if (!snap) return 1;
  const cls = (snap.class || "").toLowerCase();
  let base = 1;
  if (isMonkClass(cls)) base = 2;
  else if (isRogueClass(cls)) base = 2;
  else {
    // Attacco Extra (D&D Lv5) — vedi Arena_class_progress.txt 2D: Guerriero,
    // Barbaro, Paladino e Ranger passano a 2 attacchi dal Lv5. Il Guerriero
    // sale a 3 dal Lv11 e a 4 dal Lv20.
    const classKey = getClassKey(snap.class);
    const level = snap.classLevels?.[classKey] ?? 3;
    if (EXTRA_ATTACK_CLASSES.includes(classKey)) {
      if (level >= 5) base = 2;
      if (classKey === "fighter") {
        if (level >= 11) base = 3;
        if (level >= 20) base = 4;
      }
    }
  }
  // Sottoclasse · Bardo Valore/Spada: Attacco Extra (2 azioni) dal Lv6.
  const subEff = getSubclassEffect(snap);
  if (subEff.bardExtraAttack && isBardClass(cls) && (snap.classLevels?.[getClassKey(snap.class)] ?? 3) >= 6) base = Math.max(base, 2);
  // Sottoclasse · Barbaro Berserker: Frenesia (azione bonus) — un attacco con l'arma in più in questo turno.
  if (matchPlayer?.frenzyAttackPending) base += 1;
  // Druido · Forma di Orso: attacco multiplo naturale (morso + artiglio) → 2 attacchi.
  if (matchPlayer?.wildShape === "bear") base = Math.max(base, 2);
  if (matchPlayer?.extraTurnActive) base += 1;
  if (matchPlayer?.actionSurgeActive) base += 1;
  return base;
}

// ── STAT CONSIGLIATE PER CLASSE (fase di creazione del PG) ──────────────────
// Le stat "chiave" della classe scelta sono evidenziate in verde nella
// schermata di assegnazione punti; ogni stat ha una riga che ne spiega l'uso.
export const STAT_DESCS = {
  str: "Colpire e danno con le armi da mischia pesanti · TS di Forza (Intralciare, prese)",
  dex: "Colpire e danno con armi agili e a distanza · CA con armature leggere/medie · TS di Destrezza (Palla di Fuoco…)",
  con: "Più Punti Ferita · TS di Costituzione (veleni, Frantumare) · CA del Barbaro e dei caster senza armatura",
  int: "Caratteristica da incantatore di Mago e Artefice: CD dei TS e bonus al danno delle spell",
  wis: "Caratteristica da incantatore di Chierico, Druido e Ranger · TS di Saggezza contro i controlli (Sonno, Charme…)",
  cha: "Caratteristica da incantatore di Stregone, Warlock, Bardo e Paladino: CD dei TS e bonus al danno delle spell",
};
export const ARENA_KEY_STATS = {
  fighter:   ["str", "con"],
  barbarian: ["str", "con"],
  paladin:   ["str", "cha"],
  ranger:    ["dex", "wis"],
  monk:      ["dex", "wis"],
  rogue:     ["dex", "con"],
  wizard:    ["int", "con"],
  sorcerer:  ["cha", "con"],
  warlock:   ["cha", "dex"],
  bard:      ["cha", "dex"],
  cleric:    ["wis", "con"],
  druid:     ["wis", "con"],
  artificer: ["int", "dex"],
};

// ── SLOT INCANTESIMO CONDIVISI (Stregone) ───────────────────────────────────
// Come gli spell slot di D&D: i trucchetti sono ILLIMITATI, le spell Lv1 e
// Lv2 attingono a UN pool condiviso di 4 slot per livello (4 lanci totali di
// Lv1 con qualunque mix, idem Lv2). Le altre classi continuano a usare il
// contatore per-incantesimo (actionUsesLeft).
export const SORC_SLOTS_MAX = 4;
export function usesSharedSpellSlots(snap) {
  return isSorcererClass((snap?.class || "").toLowerCase());
}
export function readSpellSlots(matchPlayer, lvl) {
  // I tier alti (3+) hanno poche cariche per non spezzare il PvP 1v1 (doc R6): 1 slot.
  const fallback = lvl >= 3 ? 1 : SORC_SLOTS_MAX;
  return matchPlayer?.spellSlots?.[lvl] ?? fallback;
}
// Usi visibili in UI per un'azione: null = illimitato / nessun contatore.
export function readSpellUsesLeft(matchPlayer, snap, action) {
  if (action?.type === "spell" && !action.isScroll && usesSharedSpellSlots(snap)) {
    const lvl = action.level ?? 0;
    if (lvl === 0) return null;
    return readSpellSlots(matchPlayer, lvl);
  }
  return action?.maxUses !== undefined
    ? (matchPlayer?.actionUsesLeft?.[action.name] ?? action.maxUses)
    : null;
}
// Patch immutabile del consumo: {spellSlots} per lo Stregone (spell con
// livello), {actionUsesLeft} per tutto il resto, {} se illimitato.
export function spendSpellUse(matchPlayer, snap, action) {
  // Le pergamene della Bottega usano le LORO cariche anche per lo Stregone.
  if (action?.type === "spell" && !action.isScroll && usesSharedSpellSlots(snap)) {
    const lvl = action.level ?? 0;
    if (lvl === 0) return {};
    const cur = readSpellSlots(matchPlayer, lvl);
    return { spellSlots: { ...(matchPlayer.spellSlots || {}), [lvl]: Math.max(0, cur - 1) } };
  }
  if (action?.maxUses === undefined) return {};
  const uses = matchPlayer.actionUsesLeft || {};
  return { actionUsesLeft: { ...uses, [action.name]: Math.max(0, (uses[action.name] ?? action.maxUses) - 1) } };
}

// Bonus al tiro per colpire delle spell di buff: Chierico/Paladino sono ridotti a +2.
export function getMagicDetectBonusForClass(cls) {
  const c = (cls || "").toLowerCase();
  return (isClericClass(c) || isPaladinClass(c)) ? 2 : 3;
}
export function getAidBonusForClass(cls) {
  const c = (cls || "").toLowerCase();
  return (isClericClass(c) || isPaladinClass(c)) ? 2 : 4;
}
// Legge il valore numerico del buff, con fallback al default storico (per match già in corso).
export function readActiveBonus(v, legacyDefault) {
  if (typeof v === "number") return v;
  return v ? legacyDefault : 0;
}

// ── Stati di combattimento mostrati come badge sulla card del combattente. ──
// Funzione PURA: deriva tutto dall'oggetto giocatore `p`, così umano e IA
// mostrano sempre gli stessi badge (prima veleno/sanguinamento/save-DoT non
// comparivano affatto sulle card → invisibili nelle battaglie IA).
// Ritorna { key, icon, text, tip, cls }; `cls` sceglie il colore in CSS.
export function getFighterStatuses(p) {
  if (!p) return [];
  const out = [];
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const push = (key, icon, text, cls, tip) => out.push({ key, icon, text, cls, tip: tip || text });

  // ── Danno nel tempo / debuff (mostrati per primi: sono le minacce attive) ──
  if (p.poisonDoT) {
    const icon = p.poisonDoTIcon || "☠";
    const noun = p.poisonDoTSourceLabel || p.poisonDoTNoun || "Veleno";
    const t = p.poisonDoTTurns ?? 1;
    const dice = p.poisonDoTDice || "";
    const isFire = icon === "🔥";
    push("poison", icon, `${cap(noun)} ${t}t`, isFire ? "is-fire" : "is-poison",
      `${cap(noun)} — ${dice ? dice + " danni " : ""}a inizio turno per ${t} turno/i`);
  }
  if (p.bleedDoT) {
    const t = p.bleedDoTTurns ?? 1;
    const dice = p.bleedDoTDice || "";
    push("bleed", p.bleedDoTIcon || "🩸", `${cap(p.bleedDoTSourceLabel || "Sanguinamento")} ${t}t`, "is-bleed",
      `Sanguinamento — ${dice ? dice + " danni " : ""}a inizio turno per ${t} turno/i`);
  }
  if (p.pendingSaveDot) {
    const sd = p.pendingSaveDot;
    push("savedot", "🤢", `TS ${sd.name || "Veleno"}`, "is-poison",
      `Deve superare un Tiro Salvezza o subire ${sd.dice || "2d6"} per ${sd.turns ?? 3} turni`);
  }
  if (p.entangled)                          push("entangled", "🕸", "Intrappolato", "is-control");
  if ((p.controlLostTurns ?? 0) > 0)        push("control", "🌀", `Controllo ${p.controlLostTurns}t`, "is-control", "Sotto controllo: salta il turno");
  if ((p.weaponLockTurns ?? 0) > 0)         push("wlock", "🔩", `Arma Bloccata ${p.weaponLockTurns}t`, "is-control");
  if ((p.attackDisadvantageTurns ?? 0) > 0) {
    // Etichetta/icona dedicate: es. "🧊 Congelato" invece del generico "🌫 Svantaggio".
    const dLabel = p.attackDisadvantageLabel || "Svantaggio";
    const dIcon  = p.attackDisadvantageIcon  || "🌫";
    const dCls   = p.attackDisadvantageCls   || "is-debuff";
    push("disadv", dIcon, `${dLabel} ${p.attackDisadvantageTurns}t`, dCls, `${dLabel} — svantaggio ai tiri per colpire`);
  }
  if (p.blindDebuff)                        push("blind", "🙈", "Accecato −3", "is-debuff");

  // ── Buff difensivi ──
  if ((p.shieldSkillTurns ?? 0) > 0)        push("shield", "🛡", `Scudo +${p.shieldSkillBonus ?? 3} ${p.shieldSkillTurns}t`, "is-shield", `+${p.shieldSkillBonus ?? 3} CA per ${p.shieldSkillTurns} turni`);
  if ((p.defensiveBonus ?? 0) > 0)          push("def", "🛡", `Difensivo +${p.defensiveBonus}`, "is-shield", `+${p.defensiveBonus} CA fino al prossimo turno`);
  if ((p.saveBuffAttacks ?? 0) > 0)         push("savebuff", "🧿", `Difesa Mistica +${p.saveBuffBonus ?? 0}`, "is-shield", `+${p.saveBuffBonus ?? 0} ai TS · ${p.saveBuffAttacks} rimasti`);
  if ((p.saveFaithTurns ?? 0) > 0)          push("savefaith", "✝", `Scudo Fede +${p.saveFaithBonus ?? 2} ${p.saveFaithTurns}t`, "is-shield", `+${p.saveFaithBonus ?? 2} a TUTTI i tiri salvezza per ${p.saveFaithTurns} turni`);
  // ⚠ Volutamente generico: il nemico NON deve sapere che il Monaco sta per assorbire (altrimenti smette di attaccare).
  if (p.absorbDamageNext)                   push("absorb", "🧘", "Posizione difensiva", "is-shield", "Ha assunto una posizione difensiva");

  // ── Buff offensivi / vantaggi ──
  if ((p.selfAdvTurns ?? 0) > 0)            push("selfadv", "🌟", `Vantaggio ${p.selfAdvTurns}t`, "is-buff");
  if (!p.invisible && readStealthAdvTurns(p) > 0) push("stealth", "🥷", `Furtività ${readStealthAdvTurns(p)}t`, "is-buff", "Vantaggio dalla furtività");
  if (p.invisible)                          push("invis", "👻", "Invisibile", "is-buff");
  if (p.weaponPoisoned)                     push("wpoison", "🧪", "Arma Avvelenata", "is-buff", "Prossimo colpo: +1d12 veleno");
  if (p.aidBuff)                            push("aid", "🤝", `Aiuto +${readActiveBonus(p.aidBuff, 4)}`, "is-buff", `+${readActiveBonus(p.aidBuff, 4)} al prossimo tiro per colpire`);
  if ((p.aidDmgTurns ?? 0) > 0)             push("aiddmg", "🤝", `Aiuto +${p.aidDmgBonus ?? 1} dmg ${p.aidDmgTurns}t`, "is-buff", `+${p.aidDmgBonus ?? 1} al danno per ${p.aidDmgTurns} turni`);
  if (frenzyExhausted(p))                   push("frenzy-tired", "🥵", "Sfinito", "is-debuff", "Frenesia: svantaggio agli attacchi per questo turno");
  if (p.mightyStrikePending)               push("mighty", "💪", "Poderoso", "is-rage", "Vantaggio al prossimo attacco di questo turno");
  if (p.frenzyAttackPending)                push("frenzy", "🩸", "Frenesia", "is-rage", "Un attacco con l'arma in più in questo turno (solo dado + mod.)");
  if ((p.rageTurns ?? 0) > 0)               push("rage", "🔥", `Furia +${p.rageBonus ?? 2} ${p.rageTurns}t`, "is-rage", `+${p.rageBonus ?? 2} danni · riduzione danni subiti · ${p.rageTurns} turni`);
  if ((p.hunterMarkTurns ?? 0) > 0)         push("mark", "🎯", `Marchio ${p.hunterMarkTurns}t`, "is-rage", `+3 al colpire per ${p.hunterMarkTurns} turni`);

  // ── Energia / azioni extra ──
  if (p.actionSurgeActive)                  push("surge", "⚡", "Scatto d'Azione", "is-energy", "Azione extra questo turno");
  if (p.extraTurnActive)                    push("extra", "💨", "Passo Spedito", "is-energy", "+1 azione questo turno");

  // ── Magia / concentrazione ──
  if (p.bardicInspirationActive)            push("bard", "🎵", "Ispirazione +1d6", "is-magic", "+1d6 al prossimo tiro");
  if (p.magicDetectActive)                  push("md", "🔮", `Buff Attacco +${readActiveBonus(p.magicDetectActive, 3)}`, "is-magic", `+${readActiveBonus(p.magicDetectActive, 3)} al colpire · ${p.magicDetectAttacks ?? 1} rimasti`);
  if ((p.concentrationTurns ?? 0) > 0)      push("conc", "🧠", `Concentrazione ${p.concentrationTurns}t`, "is-magic");

  // ── Trasformazione ──
  if (p.wildShape) {
    const ws = WILD_SHAPES[p.wildShape];
    push("wild", ws?.icon || "🐾", ws?.name || "Forma Selvatica", "is-wild");
  }

  return out;
}

export function getArmorConfig(cls) {
  if (isSorcererClass(cls))   return { armorCategory: "sorcerer",    canHaveShield: false  };
  if (isWarlockClass(cls))    return { armorCategory: "light",       canHaveShield: false  };
  if (isWizardClass(cls))     return { armorCategory: "sorcerer",    canHaveShield: false  };
  if (isFullCaster(cls))      return { armorCategory: "caster",      canHaveShield: false  };
  if (isDruidClass(cls))      return { armorCategory: "druid",       canHaveShield: "wood" };
  if (isPaladinClass(cls))    return { armorCategory: "heavy",       canHaveShield: true   };
  if (isClericClass(cls))     return { armorCategory: "lightMedium", canHaveShield: true   };
  if (isFighterClass(cls))    return { armorCategory: "heavyFighter", canHaveShield: true  };
  if (isBarbarianClass(cls))  return { armorCategory: "barbarian",   canHaveShield: true   }; // leggere+medie+no armatura, scudo ok
  if (isMonkClass(cls))       return { armorCategory: "monk",        canHaveShield: false  }; // solo senza armatura, 10+DES+SAG
  if (isRogueClass(cls))      return { armorCategory: "light",       canHaveShield: false  };
  if (isRogueBardClass(cls))  return { armorCategory: "light",       canHaveShield: false  };
  if (isRangerClass(cls))     return { armorCategory: "ranger",      canHaveShield: true   };
  if (isArtificerClass(cls))  return { armorCategory: "lightMedium", canHaveShield: true   };
  if (PHYSICAL_CLASSES.some(c => cls.includes(c))) return { armorCategory: "medium", canHaveShield: false };
  if (CASTER_CLASSES.some(c => cls.includes(c)))   return { armorCategory: "caster", canHaveShield: false };
  return { armorCategory: "medium", canHaveShield: false };
}

export function getClassKey(charClass) {
  return arenaClassKey(charClass);
}

export function getHpDice(charClass, classLevels) {
  // Base 7d10 al livello di partenza (Lv3). Ogni livello di classe oltre il 3°
  // aggiunge 1d10 al tiro PF (il bonus COS si applica per dado in rollHp).
  // Vedi Arena_class_progress.txt §0/R1.
  const classKey = getClassKey(charClass);
  const level = Math.max(3, classLevels?.[classKey] ?? 3);
  return { count: 7 + (level - 3), sides: 10 };
}

// spellLimits: { level: maxSelectable } — lv3+ bloccati nell'arena
export const SPELL_LIMITS = {
  wizard:   { 0: 3, 1: 4, 2: 2, 3: 0 },
  sorcerer: { 0: 4, 1: 4, 2: 2, 3: 0 },
  warlock:  { 0: 2, 1: 2, 2: 2, 3: 0 },
  druid:    { 0: 2, 1: 4, 2: 2, 3: 0 },
  cleric:   { 0: 3, 1: 4, 2: 2, 3: 0 },
  bard:     { 0: 0, 1: 4, 2: 2, 3: 0 },
  paladin:  { 0: 0, 1: 2, 2: 1, 3: 0 },
  ranger:   { 0: 0, 1: 3, 2: 0, 3: 0 },
  artificer:{ 0: 2, 1: 3, 2: 0, 3: 0 },
  generic:  { 0: 1, 1: 1, 2: 1, 3: 0 },
};

// Archetipi da incantatore (per lo scaling dei limiti spell col livello).
export const FULL_CASTER_KEYS = ["wizard", "sorcerer", "cleric", "druid", "bard"];
export const HALF_CASTER_KEYS = ["paladin", "ranger", "artificer"];
// Livello di classe che sblocca ogni tier di incantesimo (Arena_class_progress.txt 2B).
export const FULL_CASTER_TIER_UNLOCK = { 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 15, 9: 17 };
export const HALF_CASTER_TIER_UNLOCK = { 2: 5, 3: 9, 4: 13, 5: 17 };
// Warlock: tier 1-5 come Pact Magic, poi Mystic Arcanum (1 carica) ai tier 6-9.
export const WARLOCK_TIER_UNLOCK     = { 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 15, 9: 17 };

// Limiti spell in funzione del livello — vedi Arena_class_progress.txt 2B/R5.
// Regola: si PARTE dal baseline di Lv.3 (SPELL_LIMITS) e si AGGIUNGE salendo,
// non si toglie mai. I tier senza contenuti (es. tier 4 prima del Blocco 2) sono
// automaticamente azzerati dal clamp in finalizeLoadout, quindi qui possiamo
// sbloccarli in anticipo senza rischio di soft-lock.
//   Full caster (Mago/Stregone/Chierico/Druido/Bardo): tier3@Lv5, tier4@Lv7,
//     +1 trucchetto@Lv5, +1 spell Lv1@Lv8.
//   Warlock (Pact Magic): tier3@Lv5, tier4@Lv7.
//   Half caster (Paladino/Ranger/Artefice): tier2@Lv5.
export function spellLimitsForLevel(classKey, level) {
  const base = SPELL_LIMITS[classKey];
  if (!base) return base;
  const lv = Math.max(3, level ?? 3);
  const out = { ...base };
  const hasCantrips = (base[0] ?? 0) > 0;
  const unlock = (map) => { for (const [tier, req] of Object.entries(map)) if (lv >= req) out[tier] = Math.max(out[tier] ?? 0, 1); };
  if (FULL_CASTER_KEYS.includes(classKey)) {
    unlock(FULL_CASTER_TIER_UNLOCK);
    if (lv >= 5 && hasCantrips) out[0] = (base[0] ?? 0) + 1;  // +1 trucchetto
    if (lv >= 7) out[3] = Math.max(out[3] ?? 0, 2);           // 2° incantesimo di tier 3
    if (lv >= 8) out[1] = (base[1] ?? 0) + 1;                 // +1 incantesimo Lv1
    if (lv >= 9) out[2] = (base[2] ?? 0) + 1;                 // +1 incantesimo Lv2
  } else if (classKey === "warlock") {
    unlock(WARLOCK_TIER_UNLOCK);
  } else if (HALF_CASTER_KEYS.includes(classKey)) {
    unlock(HALF_CASTER_TIER_UNLOCK);
  }
  return out;
}

// Rifinitura loadout comune a tutte le classi (hook H1/H2 del doc):
//  1) filtra spell e autoActions per reqLevel (default 1) ≤ livello di classe;
//  2) applica i limiti spell scalati per livello (spellLimitsForLevel);
//  3) CLAMPA ogni tier al numero di spell realmente disponibili di quel tier,
//     così maxSpells non supera mai il contenuto (niente soft-lock in confirmJoin).
export function finalizeLoadout(cfg, classKey, level) {
  const lv = Math.max(3, level ?? 3);
  const spellOptions = (cfg.spellOptions || []).filter(s => (s.reqLevel ?? 1) <= lv);
  const autoActions  = (cfg.autoActions  || []).filter(a => (a.reqLevel ?? 1) <= lv);
  const scaled = spellLimitsForLevel(classKey, lv) || cfg.spellLimits || {};
  const clamped = {};
  let maxSpells = 0;
  for (const k of Object.keys(scaled)) {
    if (k === "nonCantripMax") { clamped[k] = scaled[k]; continue; }
    const tier  = Number(k);
    const avail = spellOptions.filter(s => (s.level ?? 0) === tier).length;
    clamped[k]  = Math.min(scaled[k] ?? 0, avail);
    maxSpells  += clamped[k];
  }
  if (clamped.nonCantripMax != null) {
    maxSpells = Math.min(maxSpells, (clamped[0] ?? 0) + clamped.nonCantripMax);
  }
  return { ...cfg, spellOptions, autoActions, spellLimits: clamped, maxSpells };
}

// Wrapper: costruisce il loadout grezzo e vi applica reqLevel + scaling limiti
// (finalizeLoadout). Tutte le chiamate esterne continuano a usare getLoadoutConfig.
// ── PG d'Arena salvati: cosa manca al build (2026-10-03) ──
// Il salvataggio prima accettava anche un equipaggiamento a metà (solo armi, o
// un'arma della Bottega che non si salva): ricaricato, il PG non era iscrivibile
// e al giocatore sembrava di non poterlo scegliere. Conta SOLO il kit di classe
// (la Bottega è settimanale e non entra nel salvataggio). [] = completo.
// Ogni voce: { tab, label } con la stessa chiave delle schede del loadout.
export function savedCharMissing(sc) {
  if (!sc?.class) return [{ tab: "weapons", label: "classe" }];
  const cls = String(sc.class).toLowerCase();
  const config = getLoadoutConfig(sc.class, undefined);
  const out = [];
  if (!(sc.weapons || []).length) out.push({ tab: "weapons", label: "1 arma" });
  const spellsLeft = (config?.maxSpells || 0) - (sc.spells || []).length;
  if (spellsLeft > 0) out.push({ tab: "magic", label: `${spellsLeft} incantesim${spellsLeft === 1 ? "o" : "i"}` });
  if (!sc.armor) out.push({ tab: "armor", label: "armatura" });
  if (isRangerClass(cls) && !sc.pet) out.push({ tab: "companion", label: "compagno animale" });
  if (isWarlockClass(cls) && !sc.demon) out.push({ tab: "companion", label: "demone" });
  if (isArtificerClass(cls) && !sc.construct) out.push({ tab: "companion", label: "costrutto" });
  const items = Object.values(sc.itemCounts || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  if (items < 1) out.push({ tab: "items", label: "1 oggetto" });
  return out;
}

export function getLoadoutConfig(charClass, level) {
  const classKey = getClassKey(charClass);
  return finalizeLoadout(getRawLoadoutConfig(charClass, level), classKey, level);
}

export function getRawLoadoutConfig(charClass, level) {
  const cls = (charClass || "").toLowerCase();
  const { armorCategory, canHaveShield } = getArmorConfig(cls);
  const sumLimits = (lim) => Object.values(lim).reduce((a, b) => a + b, 0);
  if (isWizardClass(cls))   return { weaponOptions: SIMPLE_WEAPONS,        spellOptions: WIZARD_SPELLS,   spellLimits: SPELL_LIMITS.wizard,   skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.wizard),   autoActions: [RECUPERO_ARCANO_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isSorcererClass(cls)) return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: SORCERER_SPELLS, spellLimits: SPELL_LIMITS.sorcerer, skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.sorcerer), autoActions: [INNATE_SORCERY_PASSIVE, FONTE_DI_MAGIA_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isWarlockClass(cls))  return { weaponOptions: SIMPLE_WEAPONS,         spellOptions: WARLOCK_SPELLS,  spellLimits: SPELL_LIMITS.warlock,  skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.warlock),  autoActions: [MAGICAL_CUNNING_ACTION, PATTO_DEMONIACO_ACTION], hasWildShape: false, armorCategory, canHaveShield };
  if (isPaladinClass(cls))  return { weaponOptions: MARTIAL_WEAPONS,        spellOptions: PALADIN_SPELLS,  spellLimits: SPELL_LIMITS.paladin,  skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.paladin),  autoActions: [SMITE_ACTION, LAY_OF_HANDS_ACTION, AURA_PROTEZIONE_PASSIVE],  hasWildShape: false, armorCategory, canHaveShield };
  if (isFighterClass(cls))  return { weaponOptions: [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS], spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [SECOND_WIND_ACTION, ACTION_SURGE_ACTION, CHARGE_ACTION, DISARM_ACTION, PRESENZA_POSSENTE_PASSIVE, RISOLUTEZZA_PASSIVE, CRITICO_MIGLIORATO_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (isBarbarianClass(cls))return { weaponOptions: [...SIMPLE_WEAPONS, ...MARTIAL_WEAPONS], spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [RAGE_ACTION, TURBINE_LAME_ACTION, MIGHTY_STRIKE_ACTION, ATTACCO_IRRUENTO_PASSIVE, FURIA_BESTIALE_PASSIVE, RESISTENZA_FERINA_PASSIVE, ISTINTO_SELVAGGIO_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (isClericClass(cls))   return { weaponOptions: CLERIC_WEAPON_OPTIONS,  spellOptions: CLERIC_SPELLS,   spellLimits: SPELL_LIMITS.cleric,   skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.cleric),   autoActions: [COLPO_BENEDETTO_PASSIVE, COLPO_DIVINO_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (isDruidClass(cls))    return { weaponOptions: DRUID_WEAPON_OPTIONS,   spellOptions: DRUID_SPELLS,    spellLimits: SPELL_LIMITS.druid,    skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.druid),    autoActions: [], hasWildShape: true,  armorCategory, canHaveShield };
  if (isBardClass(cls))     return { weaponOptions: BARD_WEAPON_OPTIONS,    spellOptions: BARD_SPELLS,     spellLimits: SPELL_LIMITS.bard,     skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.bard),     autoActions: [BARDIC_INSPIRATION_ACTION, NOTA_DOLENTE_ACTION, TUTTOFARE_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (isMonkClass(cls))     return { weaponOptions: MONK_WEAPON_OPTIONS,     spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 1, maxSpells: 0, autoActions: [CARICA_PUGNI_ACTION, CONCENTRAZIONE_ACTION, ASSORBIRE_DANNI_ACTION, KI_HEALING_ACTION, STUN_STRIKE_ACTION, MOVIMENTO_SENZA_ARMATURA_PASSIVE, COLPI_KI_PASSIVE, ELUSIONE_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (isRogueClass(cls))    return { weaponOptions: ROGUE_WEAPON_OPTIONS,   spellOptions: [],              spellLimits: {},                    skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [SNEAK_ATTACK_ACTION, STEALTH_ACTION, TRIBOLI_ACTION, CUNNING_ACTION_ACTION, SCHIVATA_PRODIGIOSA_PASSIVE, ELUSIONE_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (isRangerClass(cls))   return { weaponOptions: RANGER_WEAPON_OPTIONS,  spellOptions: RANGER_SPELLS,   spellLimits: SPELL_LIMITS.ranger,   skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.ranger),   autoActions: [HUNTER_MARK_ACTION, SURVIVOR_ACTION, RANGER_VOLLEY_ACTION, DIFESA_PREDATORE_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (isArtificerClass(cls))return { weaponOptions: ARTIFICER_WEAPON_OPTIONS, spellOptions: ARTIFICER_SPELLS, spellLimits: SPELL_LIMITS.artificer, skillOptions: [], maxWeapons: 2, maxSpells: sumLimits(SPELL_LIMITS.artificer), autoActions: [FORGIA_ARMATURA_ACTION, INFUSIONE_PASSIVE], hasWildShape: false, armorCategory, canHaveShield };
  if (PHYSICAL_CLASSES.some(k => cls.includes(k))) return { weaponOptions: MARTIAL_WEAPONS, spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  if (CASTER_CLASSES.some(k => cls.includes(k)))   return { weaponOptions: SIMPLE_WEAPONS, spellOptions: WIZARD_SPELLS, spellLimits: SPELL_LIMITS.generic, skillOptions: [], maxWeapons: 1, maxSpells: sumLimits(SPELL_LIMITS.generic), autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
  return { weaponOptions: MARTIAL_WEAPONS, spellOptions: [], spellLimits: {}, skillOptions: [], maxWeapons: 2, maxSpells: 0, autoActions: [], hasWildShape: false, armorCategory, canHaveShield };
}

// ── DAMAGE ROLLER ─────────────────────────────────────────────────────────────
export function rollDamageFormula(formula) {
  return rollDmg(formula).total;
}

// Returns { total, rolls } where rolls is a display string like "(3+5)=8"
export function rollDmg(formula, opts = {}) {
  // opts.rerollMax: ritira UNA volta ogni dado il cui risultato è <= rerollMax
  //   (Paladino "Arma Grande": reroll di 1-2 sui dadi delle armi a due mani).
  const rerollMax = opts.rerollMax || 0;
  if (!formula) return { total: 0, rolls: "0" };
  const str = String(formula).trim();
  if (!str || str === "0" || str === "—") return { total: 0, rolls: "0" };
  if (!isNaN(Number(str))) return { total: Number(str), rolls: String(str) };
  let total = 0;
  const parts = [];
  const normalized = str.replace(/-/g, "+-");
  const tokens = normalized.split("+").map(p => p.trim()).filter(p => p !== "");
  for (const token of tokens) {
    const negative = token.startsWith("-");
    const abs = negative ? token.slice(1) : token;
    if (abs.includes("d")) {
      const [numStr, sidesStr] = abs.split("d");
      const num   = parseInt(numStr)  || 1;
      const sides = parseInt(sidesStr) || 1;
      const diceRolls = [];
      let rolled = 0;
      for (let i = 0; i < num; i++) {
        let r = Math.floor(Math.random() * sides) + 1;
        if (rerollMax > 0 && r <= rerollMax) r = Math.floor(Math.random() * sides) + 1;
        diceRolls.push(r);
        rolled += r;
      }
      total += negative ? -rolled : rolled;
      const diceStr = diceRolls.length === 1
        ? `${diceRolls[0]}`
        : `(${diceRolls.join("+")}=${rolled})`;
      parts.push(negative ? `-${diceStr}` : diceStr);
    } else {
      const val = parseInt(abs) || 0;
      total += negative ? -val : val;
      if (val !== 0) parts.push(negative ? `-${val}` : `+${val}`);
    }
  }
  return { total: Math.max(0, total), rolls: parts.join(" ") };
}

// ── LOG DISPLAY ───────────────────────────────────────────────────────────────
// I log di attacco sono oggetti { pub, att, def, attId, defId }; il resto sono stringhe.
export function displayLog(log, viewerUid) {
  if (!log) return '';
  if (typeof log === 'string') return log;
  // Molte voci hanno solo `pub`: senza ripiego chi attacca o subisce vedeva una riga VUOTA.
  if (log.attId === viewerUid && log.att) return log.att;
  if (log.defId === viewerUid && log.def) return log.def;
  return log.pub || log.att || log.def || '';
}
// Pausa fra il colpo mortale e il popup Hai vinto / Hai perso.
export const FIGHT_RESULT_DELAY_MS = 2600;
export function logPubText(log) {
  if (!log) return '';
  if (typeof log === 'string') return log;
  return log.pub || log.att || log.def || '';
}

// Sostituisce ogni 🎲 nel testo del log con l'icona poliedrica giusta. Il tipo di
// dado è dedotto dal formato NdM scritto subito dopo il 🎲 (es. `🎲d20=…`,
// `[🎲2d6=…]`); dove il formato non c'è (solo i numeri tirati), usa un dado
// generico (d6). Ritorna una stringa se non c'è alcun 🎲, altrimenti un array di
// nodi (testo + <DieIcon>).
export const STD_DICE = new Set([4, 6, 8, 10, 12, 20]);
export function renderLogWithDice(text) {
  if (typeof text !== 'string' || text.indexOf('🎲') === -1) return text;
  const segs = text.split('🎲');
  const out = [segs[0]];
  for (let i = 1; i < segs.length; i++) {
    const after = segs[i];
    const m = /^\s*\(?\s*\d*d(\d+)/.exec(after);
    const n = m ? parseInt(m[1], 10) : 6;
    out.push(<DieIcon key={`die-${i}`} sides={STD_DICE.has(n) ? n : 6} />);
    out.push(after);
  }
  return out;
}
