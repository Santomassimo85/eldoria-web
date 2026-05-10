import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  arrayRemove,
  arrayUnion,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./pgSheetEditor.css";
import { PET_SPECIES, RARITY_LABEL, RARITY_COLOR, EGG_ICON } from "../data/petSpecies";
import { PET_MOVES, TYPE_ICON, TYPE_LABEL, diceLabel } from "../data/petMoves";
import PetAvatar from "../components/PetAvatar";
import { PET_ITEMS } from "../data/petItems";
import { rollHatchSpecies, newPetFromSpecies, petStatsAtLevel, levelFromExp, expForLevel, petUnlockedMoves, petNextLockedMove, petEffectiveHp, petNextHealTickIn, awardPetPoints, applyItemToPet } from "../utils/pet";

export default function PgSheetEditor() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, "characters", currentUser.uid), (snap) => {
      if (snap.exists()) setCharData(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const handleRoll = async (action) => {
  if (!charData || !action) return;

  const d20 = Math.floor(Math.random() * 20) + 1;
  const bonusToHit = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
  const hitTotal = d20 + bonusToHit;
  const isCritical = d20 === 20;

  let finalDamage = 0;
  let allDiceDetails = [];

  const formulaParts = (action.damage && action.damage !== "0" 
    ? action.damage 
    : "1d4"
  ).split("+").map((p) => p.trim());

  formulaParts.forEach((part) => {
    if (part.includes("d")) {
      const [num, sides] = part.split("d").map((n) => parseInt(n) || 1);
      let partTotal = 0;
      let rolls = [];
      for (let i = 0; i < num; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        partTotal += r;
        rolls.push(r);
      }
      finalDamage += partTotal;
      allDiceDetails.push(`${num}d${sides}(${rolls.join("+")})`);
    } else {
      const bonus = parseInt(part) || 0;
      finalDamage += bonus;
      if (bonus !== 0) allDiceDetails.push(`+${bonus}`);
    }
  });

  if (isCritical) finalDamage *= 2;

  // 🔍 DEBUG LOG — vedi in console se i danni sono corretti
  console.log("=== TIRO AZIONE ===");
  console.log(`Azione: ${action.name}`);
  console.log(`Categoria: ${action.category}`);
  console.log(`Formula danno (da Firestore): ${action.damage}`);
  console.log(`d20: ${d20} + bonus colpo: ${bonusToHit} = ${hitTotal}`);
  console.log(`Dadi tirati: ${allDiceDetails.join(" ")}`);
  console.log(`Danno finale: ${finalDamage}${isCritical ? " (CRITICO x2!)" : ""}`);
  console.log("===================");

  try {
    await addDoc(collection(db, "rolls"), {
      characterName: charData.name,
      itemName: action.name,
      toHit: hitTotal,
      damageDealt: finalDamage,
      diceResults: allDiceDetails.join(" "),
      timestamp: serverTimestamp(),
      uid: currentUser.uid,
    });
  } catch (err) {
    console.error(err);
  }
};

  // ── Daily-login point award (1/day) ───────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    awardPetPoints(currentUser.uid, "daily_login");
  }, [currentUser]);

  if (loading) return <div className="pgs-loading">Caricamento scheda...</div>;

  return (
    <div className="pgs-page">
      <h1 className="pgs-title">Scheda Personaggio</h1>
      <div className="pgs-divider"><span className="pgs-divider-icon">📜</span></div>

      {charData ? (
        <>
          <CharHeader data={charData} />
          <PetSection data={charData} uid={currentUser.uid} />
          <CharActions data={charData} onRoll={handleRoll} />
        </>
      ) : (
        <div className="pgs-empty">
          Nessun dato personaggio trovato.
        </div>
      )}
    </div>
  );
}

function CharHeader({ data }) {
  const hpPct = Math.max(0, Math.min(100, (data.stats?.hp / data.stats?.maxHp) * 100));

  return (
    <div className="pgs-card">
      {/* Header */}
      <div className="pgs-header">
        <div className="pgs-avatar-wrap">
          <img
            src={data.image || "/assets/player/default.png"}
            alt={data.name}
            className="pgs-avatar"
          />
          {data.level && (
            <span className="pgs-level-badge">Lv. {data.level}</span>
          )}
        </div>
        <div className="pgs-identity">
          <h2 className="pgs-name">{data.name}</h2>
          {data.class && (
            <span className="pgs-class">{data.class}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="pgs-stats">
        <div className="pgs-hp-block">
          <div className="pgs-hp-labels">
            <span className="pgs-stat-label">Punti Ferita</span>
            <span className="pgs-hp-value">{data.stats?.hp} / {data.stats?.maxHp}</span>
          </div>
          <div className="pgs-hp-bar">
            <div className="pgs-hp-fill" style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        <div className="pgs-stat-pills">
          <div className="pgs-pill">
            <span className="pgs-pill-label">CA</span>
            <span className="pgs-pill-value">🛡️ {data.stats?.ac}</span>
          </div>
          {["str","dex","con","int","wis","cha"].map((s) =>
            data.stats?.[s] !== undefined ? (
              <div key={s} className="pgs-pill">
                <span className="pgs-pill-label">{s.toUpperCase()}</span>
                <span className="pgs-pill-value">
                  {data.stats[s] >= 0 ? "+" : ""}{data.stats[s]}
                </span>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

function CharActions({ data, onRoll }) {
  const weapons   = data.actions?.filter((a) => a.category === "Armi") || [];
  const spells    = data.actions?.filter((a) =>
    a.category?.toLowerCase().includes("livello") || a.category === "Trucchetto"
  ) || [];
  const abilities = data.actions?.filter((a) =>
    a.category === "Abilità" || a.category === "Azione" || a.category === "Feat"
  ) || [];

  if (!weapons.length && !spells.length && !abilities.length) return null;

  return (
    <div className="pgs-card pgs-card--actions">
      <div className="pgs-actions">
        <ActionGroup title="⚔️ Armi" actions={weapons} typeClass="pgs-weapon" onRoll={onRoll} />
        <ActionGroup title="✨ Incantesimi" actions={spells} typeClass="pgs-spell" onRoll={onRoll} />
        <ActionGroup title="🛡️ Abilità & Talenti" actions={abilities} typeClass="pgs-feat" onRoll={onRoll} />
      </div>
    </div>
  );
}

function ActionGroup({ title, actions, typeClass, onRoll }) {
  if (!actions.length) return null;
  return (
    <div className="pgs-action-group">
      <h3 className={`pgs-group-title ${typeClass}-color`}>{title}</h3>
      {actions.map((act, i) => (
        <button
          key={i}
          className={`pgs-action-btn ${typeClass}`}
          onClick={() => onRoll(act)}
        >
          <div className="pgs-action-row">
            <div className="pgs-action-info">
              <span className="pgs-action-name">{act.name}</span>
              <span className="pgs-action-cat">{act.category}</span>
            </div>
            <span className={`pgs-action-dmg ${typeClass}-dmg`}>
              {act.damage && act.damage !== "0" ? act.damage : "Utilizzo"}
            </span>
          </div>
          {act.description && (
            <p className="pgs-action-desc">{act.description}</p>
          )}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   PET SECTION — wallet · eggs · roster
   ============================================================ */
function PetSection({ data, uid }) {
  const points = data.petPoints || 0;
  const eggs   = Array.isArray(data.petEggs) ? data.petEggs : [];
  const pets   = Array.isArray(data.pets) ? data.pets : [];
  const ledger = Array.isArray(data.petPointsLedger) ? data.petPointsLedger : [];
  const inv    = data.petItems || {};

  const [hatching, setHatching] = useState(null); // egg id
  const [hatchResult, setHatchResult] = useState(null); // { species, nickname }
  const [editingPet, setEditingPet] = useState(null);
  const [showLedger, setShowLedger] = useState(false);
  const [itemPickerFor, setItemPickerFor] = useState(null); // pet.id
  const [itemMsg, setItemMsg] = useState(null); // {ok, text}

  const hatchEgg = async (egg) => {
    if (!uid || !egg || hatching) return;
    setHatching(egg.id);
    try {
      const speciesKey = rollHatchSpecies(egg.rarity);
      const newPet = newPetFromSpecies(speciesKey);
      // Mini "shake" delay so the user sees the animation
      await new Promise(r => setTimeout(r, 1100));
      await updateDoc(doc(db, "characters", uid), {
        petEggs: arrayRemove(egg),
        pets: arrayUnion(newPet),
      });
      setHatchResult({ pet: newPet, rarity: egg.rarity });
    } catch (err) {
      console.error("hatch failed:", err);
      alert("Schiusa fallita: " + err.message);
    } finally {
      setHatching(null);
    }
  };

  const renamePet = async (pet, newName) => {
    if (!uid || !pet || !newName) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === pet.nickname) { setEditingPet(null); return; }
    try {
      const updated = pets.map(p => p.id === pet.id ? { ...p, nickname: trimmed } : p);
      await updateDoc(doc(db, "characters", uid), { pets: updated });
      setEditingPet(null);
    } catch (err) {
      console.error("rename failed:", err);
    }
  };

  const releasePet = async (pet) => {
    if (!uid || !pet) return;
    if (!window.confirm(`Liberare ${pet.nickname}? Non potrai più recuperarlo.`)) return;
    try {
      await updateDoc(doc(db, "characters", uid), { pets: arrayRemove(pet) });
    } catch (err) {
      console.error("release failed:", err);
    }
  };

  const useItemOnPet = async (pet, itemKey) => {
    if (!uid || !pet) return;
    const item = PET_ITEMS[itemKey];
    if (!item) return;
    const owned = inv[itemKey] || 0;
    if (owned <= 0) { setItemMsg({ ok: false, text: "Non hai questo oggetto." }); return; }

    const result = applyItemToPet(pet, item);
    if (!result.ok) { setItemMsg({ ok: false, text: result.message }); return; }

    try {
      const updatedPets = pets.map(p => p.id === pet.id ? result.pet : p);
      await updateDoc(doc(db, "characters", uid), {
        pets: updatedPets,
        [`petItems.${itemKey}`]: Math.max(0, owned - 1),
      });
      setItemMsg({ ok: true, text: `${item.icon} ${result.message}` });
      setItemPickerFor(null);
      setTimeout(() => setItemMsg(null), 3000);
    } catch (err) {
      console.error("useItem failed:", err);
      setItemMsg({ ok: false, text: "Operazione fallita." });
    }
  };

  const inventoryEntries = Object.entries(inv).filter(([_, c]) => c > 0);

  return (
    <div className="pet-section">
      <div className="pet-section-head">
        <h2 className="pet-section-title">🐣 Compagni del Bestiario</h2>
        <div className="pet-points-pill" title="Punti accumulati con le tue azioni nel mondo">
          <span className="pet-points-icon">✦</span>
          <span className="pet-points-num">{points}</span>
          <span className="pet-points-lbl">punti</span>
        </div>
        <button type="button" className="pet-ledger-btn" onClick={() => setShowLedger(v => !v)}>
          {showLedger ? "Nascondi log" : "Storia punti"}
        </button>
      </div>

      {showLedger && (
        <div className="pet-ledger">
          {ledger.length === 0 ? (
            <p className="pet-empty">Nessun punto guadagnato ancora.</p>
          ) : ledger.slice(0, 12).map((e, i) => (
            <div key={i} className="pet-ledger-row">
              <span className="pet-ledger-amount">+{e.amount}</span>
              <span className="pet-ledger-label">{e.label}</span>
              <span className="pet-ledger-time">{new Date(e.ts).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
          <p className="pet-empty pet-ledger-hint">
            Guadagni punti con: vittorie all'arena · sfide libere · offerte al mercato · letture (riassunti, NPC, archivio Geomantico) · login giornaliero · vittorie al Pet Arena.
          </p>
        </div>
      )}

      {/* ── Inventory ── */}
      {inventoryEntries.length > 0 && (
        <div className="pet-inventory-block">
          <h3 className="pet-block-title">🎒 Zaino oggetti</h3>
          {itemMsg && (
            <div className={`pet-item-msg ${itemMsg.ok ? "ok" : "err"}`}>{itemMsg.text}</div>
          )}
          <div className="pet-inventory-row">
            {inventoryEntries.map(([key, count]) => {
              const item = PET_ITEMS[key];
              if (!item) return null;
              return (
                <div key={key} className="pet-inv-item" title={item.desc}>
                  <span className="pet-inv-icon">{item.icon}</span>
                  <span className="pet-inv-name">{item.name}</span>
                  <span className="pet-inv-count">×{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Eggs ── */}
      {eggs.length > 0 && (
        <div className="pet-eggs-block">
          <h3 className="pet-block-title">Uova nello zaino</h3>
          <div className="pet-eggs-row">
            {eggs.map(egg => (
              <div key={egg.id} className={`pet-egg pet-egg--${egg.rarity} ${hatching === egg.id ? "shaking" : ""}`}
                   style={{ borderColor: RARITY_COLOR[egg.rarity] }}
                   title={`Uovo ${RARITY_LABEL[egg.rarity]}`}>
                <span className="pet-egg-icon">{EGG_ICON[egg.rarity] || "🥚"}</span>
                <span className="pet-egg-rarity" style={{ color: RARITY_COLOR[egg.rarity] }}>
                  {RARITY_LABEL[egg.rarity]}
                </span>
                <button
                  type="button"
                  className="pet-egg-hatch-btn"
                  disabled={!!hatching}
                  onClick={() => hatchEgg(egg)}
                >
                  {hatching === egg.id ? "Schiusa…" : "Schiudi"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hatch reveal */}
      {hatchResult && (
        <div className="pet-hatch-reveal" onClick={() => setHatchResult(null)}>
          <div className="pet-hatch-card" onClick={e => e.stopPropagation()}>
            <div className="pet-hatch-rarity" style={{ background: RARITY_COLOR[hatchResult.rarity] }}>
              {RARITY_LABEL[hatchResult.rarity]}
            </div>
            <PetAvatar species={PET_SPECIES[hatchResult.pet.speciesKey]} className="pet-hatch-icon" />
            <h3 className="pet-hatch-name">{PET_SPECIES[hatchResult.pet.speciesKey]?.name}</h3>
            <p className="pet-hatch-desc">{PET_SPECIES[hatchResult.pet.speciesKey]?.desc}</p>
            <div className="pet-hatch-type">
              <span>{TYPE_ICON[PET_SPECIES[hatchResult.pet.speciesKey]?.type]}</span>
              <span>{TYPE_LABEL[PET_SPECIES[hatchResult.pet.speciesKey]?.type]}</span>
            </div>
            <button type="button" className="pet-hatch-close" onClick={() => setHatchResult(null)}>
              Aggiungi al roster
            </button>
          </div>
        </div>
      )}

      {/* ── Roster ── */}
      <h3 className="pet-block-title pet-block-title--roster">Compagni</h3>
      {pets.length === 0 && eggs.length === 0 && (
        <p className="pet-empty">
          Nessun compagno ancora. Compra un uovo dalla <strong>Bottega dell'Arena</strong> ▸ <em>Bestiario</em> per iniziare.
        </p>
      )}
      {pets.length === 0 && eggs.length > 0 && (
        <p className="pet-empty">Nessun compagno ancora — schiudi un uovo qui sopra.</p>
      )}
      {pets.length > 0 && (
        <div className="pet-roster">
          {pets.map(pet => {
            const sp = PET_SPECIES[pet.speciesKey];
            if (!sp) return null;
            const lvl = levelFromExp(pet.exp || 0);
            const stats = petStatsAtLevel(pet.speciesKey, lvl, pet.bonusStats);
            const curHp = petEffectiveHp(pet);
            const hpPct = Math.max(0, Math.min(100, (curHp / stats.hp) * 100));
            const nextTickMs = petNextHealTickIn(pet);
            const tickMin = nextTickMs > 0 ? Math.max(1, Math.ceil(nextTickMs / 60000)) : 0;
            const expCur = pet.exp || 0;
            const expBase = expForLevel(lvl);
            const expNext = expForLevel(lvl + 1);
            const expIntoLvl = expCur - expBase;
            const expSpan = Math.max(1, expNext - expBase);
            const expPct = Math.min(100, (expIntoLvl / expSpan) * 100);
            const isResting = pet.restingUntil && new Date(pet.restingUntil) > new Date();
            const moves = petUnlockedMoves(pet);

            return (
              <div key={pet.id} className={`pet-card pet-card--${sp.type}`}>
                <div className="pet-card-head">
                  <PetAvatar
                    species={sp}
                    className="pet-card-icon"
                    style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${RARITY_COLOR[sp.rarity]}33)` }}
                  />

                  <div className="pet-card-info">
                    {editingPet === pet.id ? (
                      <input
                        autoFocus
                        defaultValue={pet.nickname}
                        className="pet-card-name-input"
                        onBlur={(e) => renamePet(pet, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingPet(null); }}
                      />
                    ) : (
                      <h4 className="pet-card-name" onDoubleClick={() => setEditingPet(pet.id)} title="Doppio click per rinominare">
                        {pet.nickname}
                      </h4>
                    )}
                    <div className="pet-card-meta">
                      <span className="pet-meta-pill">Lv {lvl}</span>
                      <span className="pet-meta-pill" style={{ borderColor: RARITY_COLOR[sp.rarity], color: RARITY_COLOR[sp.rarity] }}>{RARITY_LABEL[sp.rarity]}</span>
                      <span className="pet-meta-pill">{TYPE_ICON[sp.type]} {TYPE_LABEL[sp.type]}</span>
                      {isResting && <span className="pet-meta-pill pet-resting">😴 In riposo</span>}
                    </div>
                  </div>
                  <button type="button" className="pet-card-release" title="Libera" onClick={() => releasePet(pet)}>×</button>
                </div>

                <div className="pet-bars">
                  <div className="pet-bar-label">
                    <span>PF{tickMin > 0 && <em className="pet-regen-hint"> · 💚 +1 in {tickMin}m</em>}</span>
                    <span>{curHp} / {stats.hp}</span>
                  </div>
                  <div className="pet-bar-track">
                    <div className="pet-bar-fill pet-bar-fill--hp" style={{ width: `${hpPct}%` }} />
                  </div>
                  <div className="pet-bar-label">
                    <span>EXP</span>
                    <span>{expIntoLvl} / {expSpan}</span>
                  </div>
                  <div className="pet-bar-track">
                    <div className="pet-bar-fill pet-bar-fill--exp" style={{ width: `${expPct}%` }} />
                  </div>
                </div>

                <div className="pet-stats">
                  <span className="pet-stat-pill">🛡 CA <strong>{stats.ac}</strong>{pet.bonusStats?.ac > 0 && <em className="pet-stat-bonus">+{pet.bonusStats.ac}</em>}</span>
                  <span className="pet-stat-pill">🎯 +{stats.atkBonus}{pet.bonusStats?.atk > 0 && <em className="pet-stat-bonus">+{pet.bonusStats.atk}</em>}</span>
                  <span className="pet-stat-pill">⚡ SPD <strong>{stats.spd}</strong>{pet.bonusStats?.spd > 0 && <em className="pet-stat-bonus">+{pet.bonusStats.spd}</em>}</span>
                  <span className="pet-stat-pill">🏆 V <strong>{pet.wins || 0}</strong></span>
                  <span className="pet-stat-pill">💀 S <strong>{pet.losses || 0}</strong></span>
                  {inventoryEntries.length > 0 && (
                    <button type="button" className="pet-use-item-btn" onClick={() => setItemPickerFor(pet.id)}>
                      🎒 Usa oggetto
                    </button>
                  )}
                </div>

                {itemPickerFor === pet.id && (
                  <div className="pet-item-picker">
                    <div className="pet-item-picker-head">
                      <span>Oggetti su <strong>{pet.nickname}</strong></span>
                      <button type="button" className="pet-item-picker-close" onClick={() => setItemPickerFor(null)}>✕</button>
                    </div>
                    <div className="pet-item-picker-grid">
                      {inventoryEntries.map(([key, count]) => {
                        const item = PET_ITEMS[key];
                        if (!item) return null;
                        return (
                          <button
                            key={key}
                            type="button"
                            className="pet-item-pick"
                            onClick={() => useItemOnPet(pet, key)}
                            title={item.desc}
                          >
                            <span className="pet-item-pick-icon">{item.icon}</span>
                            <span className="pet-item-pick-name">{item.name}</span>
                            <span className="pet-item-pick-count">×{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pet-moves">
                  {moves.map(m => {
                    const dice = m.damageDice ? diceLabel(m.damageDice) : null;
                    const tag = dice
                      ? dice
                      : m.effect?.kind === "heal"   ? `+${m.effect.value}♥`
                      : m.effect?.kind === "shield" ? `+${m.effect.value}🛡`
                      : "";
                    return (
                      <span key={m.id} className={`pet-move pet-move--${m.type} pet-move--${m.category}`} title={m.desc}>
                        <span className="pet-move-icon">{m.icon}</span>
                        <span className="pet-move-name">{m.name}</span>
                        {tag && <span className="pet-move-pwr">{tag}</span>}
                      </span>
                    );
                  })}
                  {(() => {
                    const next = petNextLockedMove({ ...pet, level: lvl });
                    if (!next) return null;
                    return (
                      <span className="pet-move pet-move--locked" title={`Sblocca al Lv ${next.unlockLevel}: ${next.name}`}>
                        🔒 Lv {next.unlockLevel}
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
