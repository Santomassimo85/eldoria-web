import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, increment, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { EGG_COST, EGG_ICON, RARITY_LABEL, RARITY_COLOR, HATCH_POOLS, PET_SPECIES } from "../data/petSpecies";
import { PET_ITEMS, ITEMS_ORDER } from "../data/petItems";
import { TYPE_ICON, TYPE_LABEL, diceLabel } from "../data/petMoves";
import {
  applyItemToPet,
  levelFromExp,
  expForLevel,
  petStatsAtLevel,
  petEffectiveHp,
  petNextHealTickIn,
  petUnlockedMoves,
  petNextLockedMove,
  PET_POINT_SOURCES,
  rollHatchSpecies,
  newPetFromSpecies,
  awardPetPoints,
} from "../utils/pet";

/* ── Egg tint filters ──
   Same 🥚 emoji for every rarity, recolored via CSS filter so
   the shop shows blue / purple / golden eggs without art assets. */
const EGG_FILTER = {
  common:    "saturate(0.85)",
  rare:      "hue-rotate(190deg) saturate(2.4) brightness(0.95) drop-shadow(0 0 4px #2e7aa8)",
  epic:      "hue-rotate(260deg) saturate(2.4) brightness(0.95) drop-shadow(0 0 4px #7d2929)",
  legendary: "saturate(2.4) brightness(1.15) drop-shadow(0 0 8px #fbbf24) drop-shadow(0 0 14px #f59e0b)",
};

/* ── Earnings catalog config (icons + hints + display order) ──
   Pulls amounts/caps from PET_POINT_SOURCES so the panel stays
   in sync with the actual award logic. */
const POINT_SOURCE_ICONS = {
  pet_battle_win:   "🐲",
  arena_tournament: "🏆",
  arena_round:      "⚔",
  arena_libera:     "🤺",
  daily_login:      "🌅",
  summary_read:     "📜",
  npc_visit:        "👤",
  geo_visit:        "🗺",
  market_bid:       "💰",
};
const POINT_SOURCE_HINTS = {
  pet_battle_win:   "Vinci una sfida nel Pet Arena live",
  arena_tournament: "Vinci la finale del torneo dell'Arena",
  arena_round:      "Vinci un singolo round dell'Arena",
  arena_libera:     "Concludi una Sfida Libera",
  daily_login:      "Apri la scheda PG una volta al giorno",
  summary_read:     "Leggi un riassunto di sessione mai aperto",
  npc_visit:        "Visita l'Archivio NPC",
  geo_visit:        "Visita l'Archivio Geomantico",
  market_bid:       "Fai un'offerta al Mercato Nero",
};
const POINT_SOURCE_ORDER = [
  "arena_tournament", "pet_battle_win", "arena_round",
  "daily_login", "summary_read", "arena_libera",
  "market_bid", "npc_visit", "geo_visit",
];

function formatPointCap(def) {
  if (def?.oncePerKey) return "una volta per risorsa";
  if (def?.dailyCap == null) return "nessun limite";
  if (def?.dailyCap === 1) return "1 al giorno";
  return `max ${def.dailyCap} al giorno`;
}

/* ── Egg hatch MP drop ──
   Very small chance for an egg to contain a few Monete di Platino
   (MP, the premium currency). Chance + amount scale with egg rarity
   so legendary eggs feel rewarding even when the species pull is
   mid-tier. */
const EGG_MP_DROP = {
  common:    { chance: 0.005, min: 5,  max: 10 },
  rare:      { chance: 0.015, min: 5,  max: 15 },
  epic:      { chance: 0.04,  min: 10, max: 20 },
  legendary: { chance: 0.10,  min: 15, max: 25 },
};

function rollEggMpDrop(rarity) {
  const def = EGG_MP_DROP[rarity];
  if (!def) return 0;
  if (Math.random() >= def.chance) return 0;
  return def.min + Math.floor(Math.random() * (def.max - def.min + 1));
}

/* ── Sell-pet refund table ──
   Players can sell unwanted pets back for petPoints. Base by
   rarity + per-level bonus so a leveled pet refunds more than a
   raw hatch — but always less than the egg cost (no farming exploit). */
const SELL_BASE = { common: 5,  rare: 12, epic: 30, legendary: 80 };
const SELL_PER_LVL = { common: 1, rare: 2,  epic: 3,  legendary: 5 };

function petSellValue(rarity, level) {
  const base = SELL_BASE[rarity] ?? 0;
  const perLvl = SELL_PER_LVL[rarity] ?? 0;
  return base + perLvl * Math.max(1, level || 1);
}
import PetAvatar from "../components/PetAvatar";
import PetArena from "./PetArena";
import "./PetHub.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

/* PetHub — single home for all pet features.
   Tabs: Arena (battles) · Nido (eggs + wallet) · Compagni (roster) · Bottega (shop). */
export default function PetHub() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState("arena");

  /* Daily-login point award — fires once per day per user when they
     open the Pet Hub. Moved here from PgSheetEditor so opening any
     pet-related screen counts toward the bonus. */
  useEffect(() => {
    if (!currentUser) return;
    awardPetPoints(currentUser.uid, "daily_login");
  }, [currentUser]);

  if (!currentUser) {
    return (
      <section className="ph-page">
        <div className="ph-locked">
          <div className="ph-locked-icon">🐉</div>
          <h2>Pet Hub</h2>
          <p>Effettua l'accesso per gestire i tuoi compagni.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ph-page">
      <header className="ph-head">
        <h1 className="ph-title">
          <span className="ph-title-pet">🐉</span>
          <span className="ph-title-text">Pet Hub</span>
          <span className="ph-title-spark">✨</span>
        </h1>
        <p className="ph-sub">Il tuo bestiario magico · sfide, compagni, uova e tesori ✦</p>
      </header>

      <div className="ph-tabs" role="tablist">
        <button
          type="button"
          className={`ph-tab ph-tab--arena ${tab === "arena" ? "ph-tab--active" : ""}`}
          onClick={() => setTab("arena")}
          role="tab"
          aria-selected={tab === "arena"}
        >
          <span className="ph-tab-icon" aria-hidden="true">⚔</span>
          <span className="ph-tab-label">Arena</span>
        </button>
        <button
          type="button"
          className={`ph-tab ph-tab--nido ${tab === "nido" ? "ph-tab--active" : ""}`}
          onClick={() => setTab("nido")}
          role="tab"
          aria-selected={tab === "nido"}
        >
          <span className="ph-tab-icon" aria-hidden="true">🥚</span>
          <span className="ph-tab-label">Nido</span>
        </button>
        <button
          type="button"
          className={`ph-tab ph-tab--compagni ${tab === "compagni" ? "ph-tab--active" : ""}`}
          onClick={() => setTab("compagni")}
          role="tab"
          aria-selected={tab === "compagni"}
        >
          <span className="ph-tab-icon" aria-hidden="true">📜</span>
          <span className="ph-tab-label">Compagni</span>
        </button>
        <button
          type="button"
          className={`ph-tab ph-tab--shop ${tab === "shop" ? "ph-tab--active" : ""}`}
          onClick={() => setTab("shop")}
          role="tab"
          aria-selected={tab === "shop"}
        >
          <span className="ph-tab-icon" aria-hidden="true">🐣</span>
          <span className="ph-tab-label">Bottega</span>
        </button>
      </div>

      <div className="ph-tab-body">
        {tab === "arena"    && <PetArena embedded />}
        {tab === "nido"     && <BestiariaNido uid={currentUser.uid} />}
        {tab === "compagni" && <PetCompagniPanel uid={currentUser.uid} isMaster={currentUser.email === MASTER_EMAIL} />}
        {tab === "shop"     && <BestiariaShop uid={currentUser.uid} />}
      </div>
    </section>
  );
}

/* ============================================================
   BESTIARIA SHOP — eggs + consumables, all paid in petPoints
   ============================================================ */
function BestiariaShop({ uid }) {
  const [charData, setCharData] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "characters", uid), s => {
      if (s.exists()) setCharData(s.data());
    });
    return () => unsub();
  }, [uid]);

  const showMsg = (text, type = "ok") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const petPoints = charData?.petPoints ?? 0;

  const buyEgg = async (rarity) => {
    if (!charData) return;
    const cost = EGG_COST[rarity];
    if (!cost) return;
    if (petPoints < cost) { showMsg("Punti Bestiario insufficienti.", "err"); return; }
    const egg = {
      id: `egg-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
      rarity,
      acquiredAt: new Date().toISOString(),
    };
    try {
      await updateDoc(doc(db, "characters", uid), {
        petPoints: increment(-cost),
        petEggs: arrayUnion(egg),
      });
      showMsg(`Uovo ${RARITY_LABEL[rarity]} aggiunto al tuo zaino!`);
    } catch (err) {
      console.error("buyEgg failed:", err);
      showMsg("Acquisto fallito.", "err");
    }
  };

  const buyPetItem = async (itemKey) => {
    if (!charData) return;
    const item = PET_ITEMS[itemKey];
    if (!item) return;
    if (petPoints < item.cost) { showMsg("Punti Bestiario insufficienti.", "err"); return; }
    try {
      await updateDoc(doc(db, "characters", uid), {
        petPoints: increment(-item.cost),
        [`petItems.${itemKey}`]: increment(1),
      });
      showMsg(`${item.icon} ${item.name} aggiunto al tuo zaino!`);
    } catch (err) {
      console.error("buyPetItem failed:", err);
      showMsg("Acquisto fallito.", "err");
    }
  };

  return (
    <div className="ph-shop">
      {message && (
        <div className={`ph-msg ${message.type === "err" ? "ph-msg--err" : ""}`}>
          {message.text}
        </div>
      )}

      <div className="ph-shop-balance">
        <span>✦</span>
        <strong>{petPoints}</strong>
        <span>punti Bestiario</span>
      </div>
      <p className="ph-shop-blurb">
        I Punti Bestiario si guadagnano esplorando: vittorie all'arena, offerte al Mercato Nero,
        riassunti letti, archivi consultati, login giornaliero. Schiudi le uova nella tua scheda PG.
      </p>

      {/* How to earn points */}
      <h3 className="ph-shop-title">💰 Come guadagnare punti</h3>
      <p className="ph-shop-sub">Tutti i modi per ottenere ✦ Punti Bestiario nel regno di Eldoria.</p>
      <div className="ph-earnings-grid">
        {POINT_SOURCE_ORDER.map(key => {
          const def = PET_POINT_SOURCES[key];
          if (!def) return null;
          const cap = formatPointCap(def);
          const capped = def.dailyCap != null || def.oncePerKey;
          return (
            <div key={key} className={`ph-earning ${capped ? "ph-earning--capped" : "ph-earning--free"}`}>
              <div className="ph-earning-head">
                <span className="ph-earning-icon">{POINT_SOURCE_ICONS[key] || "✦"}</span>
                <span className="ph-earning-amount">+{def.amount} ✦</span>
              </div>
              <div className="ph-earning-label">{def.label}</div>
              <div className="ph-earning-hint">{POINT_SOURCE_HINTS[key]}</div>
              <div className="ph-earning-cap">{cap}</div>
            </div>
          );
        })}
      </div>

      {/* Eggs */}
      <h3 className="ph-shop-title">🐣 Uova di Compagno</h3>
      <div className="ph-eggs-grid">
        {["common", "rare", "epic", "legendary"].map(rarity => {
          const cost = EGG_COST[rarity];
          const canAfford = petPoints >= cost;
          const pool = HATCH_POOLS[rarity] || [];
          const epicSpecies = pool
            .filter(p => PET_SPECIES[p.key]?.rarity === "epic")
            .map(p => PET_SPECIES[p.key]);
          const legendarySpecies = pool
            .filter(p => PET_SPECIES[p.key]?.rarity === "legendary")
            .map(p => PET_SPECIES[p.key]);
          return (
            <div key={rarity} className={`ph-egg-card ph-egg-card--${rarity}`} style={{ borderColor: RARITY_COLOR[rarity] }}>
              <div className="ph-egg-icon" style={{ filter: EGG_FILTER[rarity] }}>{EGG_ICON[rarity]}</div>
              <div className="ph-egg-rarity" style={{ color: RARITY_COLOR[rarity] }}>
                Uovo {RARITY_LABEL[rarity]}
              </div>
              <div className="ph-egg-cost">{cost} ✦</div>
              <p className="ph-egg-flavor">
                {rarity === "common"    && "80% comuni · 18% rari · ~2% epici · 0.05% leggendari"}
                {rarity === "rare"      && "50% comuni · 42% rari · ~8% epici · 0.2% leggendari"}
                {rarity === "epic"      && "25% comuni · 50% rari · ~24% epici · 1% leggendari"}
                {rarity === "legendary" && "30% rari · 60% epici · 10% leggendari · nessun comune"}
              </p>
              {epicSpecies.length > 0 && (
                <p className="ph-egg-epic-tease" title={epicSpecies.map(s => s.name).join(", ")}>
                  Possibili epici: {epicSpecies.map(s => s.icon).join(" ")}
                </p>
              )}
              {legendarySpecies.length > 0 && (
                <p className="ph-egg-legendary-tease" title={legendarySpecies.map(s => s.name).join(", ")}>
                  ✦ Leggendari: {legendarySpecies.map(s => s.icon).join(" ")} ✦
                </p>
              )}
              <button
                type="button"
                className="ph-egg-buy-btn"
                disabled={!canAfford}
                onClick={() => buyEgg(rarity)}
              >
                {canAfford ? "Acquista" : `Mancano ${cost - petPoints}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Items */}
      <h3 className="ph-shop-title">🎒 Oggetti per i compagni</h3>
      <p className="ph-shop-sub">Pozioni, tonici e caramelle per curare, allenare e potenziare i tuoi compagni. Si usano dalla scheda PG.</p>
      <div className="ph-items-grid">
        {ITEMS_ORDER.map(key => {
          const item = PET_ITEMS[key];
          if (!item) return null;
          const owned = (charData?.petItems || {})[key] || 0;
          const canAfford = petPoints >= item.cost;
          return (
            <div key={key} className="ph-item-card">
              <div className="ph-item-icon">{item.icon}</div>
              <div className="ph-item-name">{item.name}</div>
              <div className="ph-item-desc">{item.desc}</div>
              <div className="ph-item-row">
                <span className="ph-item-cost">{item.cost} ✦</span>
                {owned > 0 && <span className="ph-item-owned">posseduti: {owned}</span>}
              </div>
              <button
                type="button"
                className="ph-item-buy"
                disabled={!canAfford}
                onClick={() => buyPetItem(key)}
              >
                {canAfford ? "Compra" : `Mancano ${item.cost - petPoints}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   BESTIARIA NIDO — wallet · point ledger · egg incubator
   Egg hatching + the points balance live here (moved out of
   PgSheetEditor). The roster is in the Compagni tab.
   ============================================================ */
function BestiariaNido({ uid }) {
  const [charData, setCharData] = useState(null);
  const [hatching, setHatching] = useState(null);     // egg id currently incubating
  const [hatchResult, setHatchResult] = useState(null); // { pet, rarity } reveal modal
  const [showLedger, setShowLedger] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "characters", uid), s => {
      if (s.exists()) setCharData(s.data());
    });
    return () => unsub();
  }, [uid]);

  const showMsg = (text, ok = true) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 3000);
  };

  const points = charData?.petPoints || 0;
  const eggs   = Array.isArray(charData?.petEggs) ? charData.petEggs : [];
  const ledger = Array.isArray(charData?.petPointsLedger) ? charData.petPointsLedger : [];

  const hatchEgg = async (egg) => {
    if (!uid || !egg || hatching) return;
    setHatching(egg.id);
    try {
      const speciesKey = rollHatchSpecies(egg.rarity);
      const newPet = newPetFromSpecies(speciesKey);
      const mpFound = rollEggMpDrop(egg.rarity);
      // Mini "shake" pause so the player sees the animation before the reveal
      await new Promise(r => setTimeout(r, 1100));
      const patch = {
        petEggs: arrayRemove(egg),
        pets: arrayUnion(newPet),
      };
      if (mpFound > 0) patch.platinum = increment(mpFound);
      await updateDoc(doc(db, "characters", uid), patch);
      setHatchResult({ pet: newPet, rarity: egg.rarity, mpFound });
    } catch (err) {
      console.error("hatch failed:", err);
      showMsg("Schiusa fallita: " + err.message, false);
    } finally {
      setHatching(null);
    }
  };

  return (
    <div className="ph-nido">
      {message && (
        <div className={`ph-msg ${message.ok ? "" : "ph-msg--err"}`}>{message.text}</div>
      )}

      {/* Wallet + ledger toggle */}
      <div className="ph-nido-head">
        <div className="ph-shop-balance">
          <span>✦</span>
          <strong>{points}</strong>
          <span>punti Bestiario</span>
        </div>
        <button
          type="button"
          className="ph-btn ph-nido-ledger-btn"
          onClick={() => setShowLedger(v => !v)}
        >
          {showLedger ? "Nascondi log" : "Storia punti"}
        </button>
      </div>

      {showLedger && (
        <div className="ph-nido-ledger">
          {ledger.length === 0 ? (
            <p className="ph-nido-empty">Nessun punto guadagnato ancora.</p>
          ) : ledger.slice(0, 12).map((e, i) => (
            <div key={i} className="ph-nido-ledger-row">
              <span className="ph-nido-ledger-amount">+{e.amount}</span>
              <span className="ph-nido-ledger-label">{e.label}</span>
              <span className="ph-nido-ledger-time">
                {new Date(e.ts).toLocaleString("it-IT", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          ))}
          <p className="ph-nido-empty ph-nido-ledger-hint">
            Guadagni punti con: vittorie all'arena · sfide libere · offerte al mercato · letture (riassunti, NPC, archivio Geomantico) · login giornaliero · vittorie al Pet Arena.
          </p>
        </div>
      )}

      <h3 className="ph-shop-title">🥚 Le tue uova</h3>

      {eggs.length === 0 ? (
        <p className="ph-nido-empty">
          Nessun uovo nello zaino. Compra uova nella <strong>Bottega</strong> e schiudile qui per scoprire quale compagno spunterà.
        </p>
      ) : (
        <div className="ph-nido-eggs">
          {eggs.map(egg => (
            <div
              key={egg.id}
              className={`ph-nido-egg ph-nido-egg--${egg.rarity} ${hatching === egg.id ? "ph-nido-egg--shaking" : ""}`}
            >
              <span className="ph-nido-egg-icon" style={{ filter: EGG_FILTER[egg.rarity] }}>{EGG_ICON[egg.rarity] || "🥚"}</span>
              <span className="ph-nido-egg-rarity">
                Uovo {RARITY_LABEL[egg.rarity]}
              </span>
              <button
                type="button"
                className="ph-egg-buy-btn"
                disabled={!!hatching}
                onClick={() => hatchEgg(egg)}
              >
                {hatching === egg.id ? "Schiusa…" : "Schiudi"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hatch reveal modal */}
      {hatchResult && (
        <div className="ph-hatch-overlay" onClick={() => setHatchResult(null)}>
          <div
            className={`ph-hatch-card ph-hatch-card--${hatchResult.rarity}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="ph-hatch-rarity">
              {RARITY_LABEL[hatchResult.rarity]}
            </div>
            <PetAvatar
              species={PET_SPECIES[hatchResult.pet.speciesKey]}
              className="ph-hatch-avatar"
            />
            <h3 className="ph-hatch-name">
              {PET_SPECIES[hatchResult.pet.speciesKey]?.name}
            </h3>
            <p className="ph-hatch-desc">
              {PET_SPECIES[hatchResult.pet.speciesKey]?.desc}
            </p>
            <div className="ph-hatch-type">
              <span>{TYPE_ICON[PET_SPECIES[hatchResult.pet.speciesKey]?.type]}</span>
              <span>{TYPE_LABEL[PET_SPECIES[hatchResult.pet.speciesKey]?.type]}</span>
            </div>
            {hatchResult.mpFound > 0 && (
              <div className="ph-hatch-mp">
                <span className="ph-hatch-mp-icon">🪙</span>
                <span>
                  Hai trovato <strong>{hatchResult.mpFound} MP</strong> dentro l'uovo!
                </span>
              </div>
            )}
            <button
              type="button"
              className="ph-egg-buy-btn ph-hatch-close"
              onClick={() => setHatchResult(null)}
            >
              Aggiungi al roster
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Small reusable stat tile used in the Compagni panel. */
function PetStatsLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="ph-stats-legend">
      <button
        type="button"
        className="ph-stats-legend-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {open ? "▼" : "▶"} ❔ Cosa significano le statistiche dei compagni?
      </button>
      {open && (
        <div className="ph-stats-legend-body">
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">❤️ PF max</span>
            <span>Punti Ferita massimi. +2 per livello. Salire di livello ripristina tutti i PF al massimo.</span>
          </div>
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">🛡 CA</span>
            <span>Classe Armatura. L'attaccante tira <code>d20 + Colpo</code> e deve eguagliare o superare la CA per colpire. +1 ogni 4 livelli.</span>
          </div>
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">🎯 +Colpo</span>
            <span>Bonus al tiro per colpire. Sommato al d20 di ogni attacco. +1 ogni 2 livelli oltre alla base specie.</span>
          </div>
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">⚡ SPD</span>
            <span>Velocità. Chi è più veloce attacca per primo nel round. +1 ogni 3 livelli.</span>
          </div>
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">⭐ Prof</span>
            <span>Bonus competenza. Sommato ai dadi di danno (es. <code>1d6+Prof</code>). +2 a Lv1-4, +3 a Lv5-8, +4 a Lv9+.</span>
          </div>
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">🔥 PA tot.</span>
            <span>Punti Azione totali per scontro: somma degli usi di tutte le skill a uso limitato. Gli attacchi base sono illimitati.</span>
          </div>
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">🎲 d20</span>
            <span>Nat <b>20</b> = colpo critico (doppi dadi di danno). Nat <b>1</b> = fallimento critico (manca a prescindere dalla CA).</span>
          </div>
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">🌟 ×1.5 / 💤 ×0.5</span>
            <span>Moltiplicatore di tipo. Fire&gt;Earth&gt;Air&gt;Water&gt;Fire (super-efficace ×1.5, poco efficace ×0.5). Luce ⇄ Tenebre.</span>
          </div>
          <div className="ph-stats-legend-row">
            <span className="ph-stat-key">💚 Bonus</span>
            <span>Il numero verde accanto a una stat (es. <code>16 +2</code>) è il bonus permanente da oggetti consumati. Si somma alla stat di base.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ icon, label, value, bonus, hint }) {
  return (
    <div className="ph-stat-cell" title={hint || ""}>
      <div className="ph-stat-icon">{icon}</div>
      <div className="ph-stat-body">
        <div className="ph-stat-label">{label}</div>
        <div className="ph-stat-value">
          {value}
          {bonus > 0 && <em className="ph-stat-bonus">+{bonus}</em>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PET COMPAGNI PANEL — full character sheet for each pet:
   stats (HP / CA / +ATK / SPD / Prof), EXP bar, mosse with
   damage dice and per-battle action points, plus the heal
   bag for using items on pets.
   ============================================================ */
function PetCompagniPanel({ uid, isMaster }) {
  const [charData, setCharData] = useState(null);
  const [pickerFor, setPickerFor] = useState(null); // pet.id
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "characters", uid), s => {
      if (s.exists()) setCharData(s.data());
    });
    return () => unsub();
  }, [uid]);

  const showMsg = (text, ok = true) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 3000);
  };

  const pets = Array.isArray(charData?.pets) ? charData.pets : [];
  const inv = charData?.petItems || {};
  const inventoryEntries = Object.entries(inv).filter(([, c]) => c > 0);

  const deletePet = async (pet) => {
    if (!isMaster) return;
    if (!window.confirm(
      `Eliminare definitivamente "${pet.nickname}" dal tuo roster?\n\nQuesta operazione non si può annullare.`
    )) return;
    try {
      const newPets = pets.filter(p => p.id !== pet.id);
      await updateDoc(doc(db, "characters", uid), { pets: newPets });
      showMsg(`🗑 "${pet.nickname}" rimosso dal roster.`);
    } catch (err) {
      console.error("deletePet failed:", err);
      showMsg("Eliminazione fallita.", false);
    }
  };

  const deleteAllPets = async () => {
    if (!isMaster) return;
    if (pets.length === 0) return;
    // Two-step confirm: a yes/no then a typed phrase. Without the second
    // step a stray Enter on the first dialog wipes the whole roster.
    if (!window.confirm(
      `Eliminare TUTTI i ${pets.length} compagni dal tuo roster?\n\nQuesta operazione non si può annullare.`
    )) return;
    const phrase = window.prompt(
      `Per confermare scrivi: ELIMINA TUTTO`
    );
    if (phrase !== "ELIMINA TUTTO") {
      showMsg("Conferma non valida — operazione annullata.", false);
      return;
    }
    try {
      await updateDoc(doc(db, "characters", uid), { pets: [] });
      showMsg(`🗑 Roster azzerato (${pets.length} compagni rimossi).`);
    } catch (err) {
      console.error("deleteAllPets failed:", err);
      showMsg("Eliminazione fallita.", false);
    }
  };

  const sellPet = async (pet) => {
    if (!uid || !pet) return;
    const sp = PET_SPECIES[pet.speciesKey];
    if (!sp) return;
    const lvl = levelFromExp(pet.exp || 0);
    const refund = petSellValue(sp.rarity, lvl);
    if (!window.confirm(
      `Vendere "${pet.nickname}" (Lv ${lvl} · ${RARITY_LABEL[sp.rarity]})?\n\n` +
      `Riceverai ${refund} ✦ Punti Bestiario.\n` +
      `Questa operazione non si può annullare.`
    )) return;
    try {
      const newPets = pets.filter(p => p.id !== pet.id);
      await updateDoc(doc(db, "characters", uid), {
        pets: newPets,
        petPoints: increment(refund),
      });
      showMsg(`💰 "${pet.nickname}" venduto · +${refund} ✦`);
    } catch (err) {
      console.error("sellPet failed:", err);
      showMsg("Vendita fallita.", false);
    }
  };

  const applyItem = async (pet, itemKey) => {
    const item = PET_ITEMS[itemKey];
    if (!item) return;
    const owned = inv[itemKey] || 0;
    if (owned <= 0) { showMsg("Non hai questo oggetto.", false); return; }
    const result = applyItemToPet(pet, item);
    if (!result.ok) { showMsg(result.message, false); return; }
    try {
      const updated = pets.map(p => p.id === pet.id ? result.pet : p);
      await updateDoc(doc(db, "characters", uid), {
        pets: updated,
        [`petItems.${itemKey}`]: Math.max(0, owned - 1),
      });
      showMsg(`${item.icon} ${result.message}`);
      setPickerFor(null);
    } catch (err) {
      console.error("applyItem failed:", err);
      showMsg("Operazione fallita.", false);
    }
  };

  if (pets.length === 0) {
    return (
      <div className="ph-care-empty">
        <div className="ph-care-empty-icon">🐣</div>
        <p>Non hai ancora compagni nel roster.</p>
        <p className="ph-care-empty-sub">Compra un uovo nella <strong>Bottega</strong> e schiudi nella tua scheda PG.</p>
      </div>
    );
  }

  return (
    <div className="ph-care">
      {message && (
        <div className={`ph-msg ${message.ok ? "" : "ph-msg--err"}`}>{message.text}</div>
      )}

      <PetStatsLegend />

      {isMaster && pets.length > 0 && (
        <div className="ph-master-toolbar">
          <button
            type="button"
            className="ph-master-del-all-btn"
            onClick={deleteAllPets}
            title="Master · elimina TUTTI i compagni dal tuo roster"
          >
            🗑 Elimina tutti i miei compagni ({pets.length})
          </button>
        </div>
      )}

      <div className="ph-care-bag">
        <span className="ph-care-bag-label">🎒 Zaino</span>
        {inventoryEntries.length === 0 ? (
          <span className="ph-care-bag-empty">Nessun oggetto. Comprane in Bottega.</span>
        ) : (
          inventoryEntries.map(([key, count]) => {
            const item = PET_ITEMS[key];
            if (!item) return null;
            return (
              <span key={key} className="ph-care-bag-pill" title={item.desc}>
                {item.icon} {item.name} ×{count}
              </span>
            );
          })
        )}
      </div>

      <div className="ph-care-grid">
        {pets.map(pet => {
          const sp = PET_SPECIES[pet.speciesKey];
          if (!sp) return null;
          const lvl = levelFromExp(pet.exp || 0);
          const stats = petStatsAtLevel(pet.speciesKey, lvl, pet.bonusStats);
          const curHp = petEffectiveHp(pet);
          const hpPct = Math.max(0, Math.min(100, (curHp / stats.hp) * 100));
          const resting = pet.restingUntil && new Date(pet.restingUntil) > new Date();
          const restMin = resting ? Math.ceil((new Date(pet.restingUntil) - new Date()) / 60000) : 0;
          const nextTickMs = petNextHealTickIn(pet);
          const tickMin = nextTickMs > 0 ? Math.max(1, Math.ceil(nextTickMs / 60000)) : 0;

          // EXP progress to next level
          const expCur = pet.exp || 0;
          const expBase = expForLevel(lvl);
          const expNext = expForLevel(lvl + 1);
          const expIntoLvl = expCur - expBase;
          const expSpan = Math.max(1, expNext - expBase);
          const expPct = Math.min(100, (expIntoLvl / expSpan) * 100);

          // Bonus stats from items (permanent buffs)
          const b = pet.bonusStats || {};
          const moves = petUnlockedMoves(pet);
          const nextLocked = petNextLockedMove({ ...pet, level: lvl });

          // Total per-battle action points across all skills (mana-equivalent)
          const totalPA = moves.reduce(
            (sum, m) => sum + (m.maxUses == null ? 0 : m.maxUses),
            0
          );

          // "Età" — days since hatched
          const ageDays = pet.hatchedAt
            ? Math.max(0, Math.floor((Date.now() - new Date(pet.hatchedAt).getTime()) / 86400000))
            : null;

          const isOpen = pickerFor === pet.id;

          return (
            <div
              key={pet.id}
              className={`ph-care-card ph-care-card--${sp.type} ph-care-card--rarity-${sp.rarity}`}
            >
              {/* ── Header ────────────────────────── */}
              <div className="ph-care-card-head">
                <PetAvatar species={sp} className="ph-care-avatar" />
                <div className="ph-care-card-info">
                  <div className="ph-care-card-name">{pet.nickname}</div>
                  <div className="ph-care-card-meta">
                    <span className="ph-meta-chip">Lv {lvl}</span>
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
                </div>
                {isMaster && (
                  <button
                    type="button"
                    className="ph-master-del-btn"
                    onClick={() => deletePet(pet)}
                    title="Master · elimina questo compagno dal roster"
                  >
                    🗑
                  </button>
                )}
              </div>

              {/* ── Bars: PF + EXP ────────────────── */}
              <div className="ph-bar-block">
                <div className="ph-care-bar-label">
                  <span>PF {curHp} / {stats.hp}{tickMin > 0 && <em className="ph-tick"> · 💚 +1 in {tickMin}m</em>}</span>
                  {resting && <span className="ph-care-resting">😴 {restMin}m</span>}
                </div>
                <div className="ph-care-bar-track">
                  <div className="ph-care-bar-fill" style={{ width: `${hpPct}%` }} />
                </div>

                <div className="ph-care-bar-label">
                  <span>EXP {expIntoLvl} / {expSpan}</span>
                  <span className="ph-exp-total">tot. {expCur}</span>
                </div>
                <div className="ph-care-bar-track ph-care-bar-track--exp">
                  <div className="ph-exp-fill" style={{ width: `${expPct}%` }} />
                </div>
              </div>

              {/* ── Stats grid ─────────────────────── */}
              <div className="ph-stats-grid">
                <StatCell icon="❤️" label="PF max" value={stats.hp} bonus={b.hp} />
                <StatCell icon="🛡" label="CA" value={stats.ac} bonus={b.ac} />
                <StatCell icon="🎯" label="+Colpo" value={`+${stats.atkBonus}`} bonus={b.atk} />
                <StatCell icon="⚡" label="SPD" value={stats.spd} bonus={b.spd} />
                <StatCell icon="⭐" label="Prof" value={`+${stats.profBonus}`} />
                <StatCell icon="🔥" label="PA tot." value={totalPA} hint="azioni/skill per scontro" />
                <StatCell icon="🏆" label="Vittorie" value={pet.wins || 0} />
                <StatCell icon="💀" label="Sconfitte" value={pet.losses || 0} />
                {ageDays != null && <StatCell icon="🥚" label="Età" value={ageDays === 0 ? "oggi" : `${ageDays}g`} />}
              </div>

              {/* ── Mosse ──────────────────────────── */}
              <div className="ph-moves-block">
                <h4 className="ph-moves-title">⚔ Mosse</h4>
                <div className="ph-moves-list">
                  {moves.map(m => {
                    const dice = m.damageDice ? diceLabel(m.damageDice) : null;
                    const effTag =
                      m.effect?.kind === "heal"   ? `♥+${m.effect.value}` :
                      m.effect?.kind === "shield" ? `🛡+${m.effect.value}` :
                      m.effect?.kind === "poison" ? `☠${m.effect.value}/t` :
                      null;
                    const usesLabel = m.maxUses == null ? "∞" : `${m.maxUses} PA`;
                    return (
                      <div
                        key={m.id}
                        className={`ph-move ph-move--${m.type} ph-move--${m.category}`}
                        title={m.desc}
                      >
                        <div className="ph-move-row">
                          <span className="ph-move-icon">{m.icon}</span>
                          <span className="ph-move-name">{m.name}</span>
                          <span className="ph-move-cat">
                            {m.category === "skill" ? "skill" : "attacco"}
                          </span>
                        </div>
                        <div className="ph-move-row ph-move-row--meta">
                          <span className="ph-move-type">{TYPE_ICON[m.type]} {TYPE_LABEL[m.type]}</span>
                          {dice && <span className="ph-move-dice">{dice}</span>}
                          {effTag && <span className="ph-move-eff">{effTag}</span>}
                          {(m.toHit || 0) !== 0 && (
                            <span className="ph-move-hit">{m.toHit > 0 ? "+" : ""}{m.toHit} colpo</span>
                          )}
                          <span className="ph-move-uses">{usesLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                  {nextLocked && (
                    <div className="ph-move ph-move--locked" title={`Sblocca al Lv ${nextLocked.unlockLevel}: ${nextLocked.name}`}>
                      🔒 Lv {nextLocked.unlockLevel} · {nextLocked.name}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Actions: use item + sell ─────── */}
              <div className="ph-care-actions">
                <button
                  type="button"
                  className="ph-care-use-btn"
                  onClick={() => setPickerFor(isOpen ? null : pet.id)}
                  disabled={inventoryEntries.length === 0}
                >
                  {isOpen ? "✕ Chiudi" : "🎒 Usa oggetto"}
                </button>
                <button
                  type="button"
                  className="ph-care-sell-btn"
                  onClick={() => sellPet(pet)}
                  title={`Vendi questo compagno per ${petSellValue(sp.rarity, lvl)} ✦`}
                >
                  💰 Vendi · {petSellValue(sp.rarity, lvl)} ✦
                </button>
              </div>

              {isOpen && (
                <div className="ph-care-picker">
                  {inventoryEntries.length === 0 ? (
                    <div className="ph-care-picker-empty">Nessun oggetto disponibile.</div>
                  ) : (
                    inventoryEntries.map(([key, count]) => {
                      const item = PET_ITEMS[key];
                      if (!item) return null;
                      return (
                        <button
                          key={key}
                          type="button"
                          className="ph-care-pick"
                          title={item.desc}
                          onClick={() => applyItem(pet, key)}
                        >
                          <span className="ph-care-pick-icon">{item.icon}</span>
                          <span className="ph-care-pick-name">{item.name}</span>
                          <span className="ph-care-pick-count">×{count}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
