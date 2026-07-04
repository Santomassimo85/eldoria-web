import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { doc, collection, onSnapshot, updateDoc, increment } from "firebase/firestore";
import "../styles/cinematic.css";
import "./ArenaMarket.css";
import AmbientFX from "../components/AmbientFX";
import CineToolbar from "../components/CineToolbar";
import useParallaxScroll from "../hooks/useParallaxScroll";
import { isHiddenChar } from "../data/hiddenPlayers";
import ArenaMarketCatalog, { MARKET_CATEGORIES, marketItemSummary } from "../components/ArenaMarketCatalog";
import { currentWeekKey, weekEndLabel } from "../data/arenaWeek";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/tanagar2.png";

// ── BOTTEGA SETTIMANALE ───────────────────────────────────────────────────────
// I livelli NON si comprano più: tutti i personaggi sono base Lv.3. Il Master
// mette in vetrina le creazioni del catalogo (`arena_market_items.active`);
// i giocatori le comprano con le Monete Arena e le tengono dal momento
// dell'acquisto fino a DOMENICA ORE 24:00 (poi tutto torna base e la vetrina
// si rinnova). Gli acquisti valgono SOLO nei tornei.

export const ARENA_CLASSES = [
  { key: "fighter",   name: "Guerriero",  icon: "⚔️" },
  { key: "barbarian", name: "Barbaro",    icon: "🪓" },
  { key: "paladin",   name: "Paladino",   icon: "🛡️" },
  { key: "rogue",     name: "Ladro",      icon: "🗡️" },
  { key: "ranger",    name: "Ranger",     icon: "🏹" },
  { key: "monk",      name: "Monaco",     icon: "👊" },
  { key: "wizard",    name: "Mago",       icon: "🔮" },
  { key: "sorcerer",  name: "Stregone",   icon: "✨" },
  { key: "warlock",   name: "Warlock",    icon: "🌑" },
  { key: "bard",      name: "Bardo",      icon: "🎵" },
  { key: "cleric",    name: "Chierico",   icon: "⛪" },
  { key: "druid",     name: "Druido",     icon: "🌿" },
  { key: "artificer", name: "Artefice",   icon: "⚙️", hiddenUnlessOwned: "classArtificer" },
];

const CAT_META = Object.fromEntries(MARKET_CATEGORIES.map(c => [c.key, c]));

export default function ArenaMarket() {
  useParallaxScroll();
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [arenaMeta, setArenaMeta] = useState(null);
  const [message, setMessage] = useState(null);
  const [marketItems, setMarketItems] = useState([]);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(null); // null | "classes" | "items"

  const isMaster = currentUser?.email === MASTER_EMAIL;

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, "characters", currentUser.uid), snap => {
      if (snap.exists()) setCharData(snap.data());
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "arena_meta", "global"), snap => {
      if (snap.exists()) setArenaMeta(snap.data());
    });
    return () => unsub();
  }, []);

  // Catalogo del Master: in vetrina solo gli articoli attivi.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "arena_market_items"), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || ""));
      setMarketItems(list);
    });
    return () => unsub();
  }, []);

  const coins      = charData?.arenaCoins ?? 0;
  const buffs      = charData?.arenaBuffs ?? {};

  // ── Settimana corrente: acquisti validi fino a domenica ore 24:00 ──────────
  const weekKey = currentWeekKey();
  const weekly  = (charData?.arenaWeekly?.weekKey === weekKey) ? charData.arenaWeekly : { weekKey, purchases: [] };
  const weeklyPurchases = weekly.purchases || [];
  const ownedQty = (itemId) => weeklyPurchases.find(p => p.itemId === itemId)?.qty ?? 0;

  const vetrinaItems = marketItems.filter(it => it.active);

  // ── Ricerca: classi + vetrina ──
  const q = query.trim().toLowerCase();
  const ownedClasses = ARENA_CLASSES.filter(cls => !cls.hiddenUnlessOwned || (buffs[cls.hiddenUnlessOwned] ?? 0) > 0);
  const filteredClasses = ownedClasses.filter(cls => !q || cls.name.toLowerCase().includes(q));
  const filteredItems = vetrinaItems.filter(it => !q || `${it.name} ${it.description || ""} ${marketItemSummary(it)}`.toLowerCase().includes(q));
  const showClasses = activeCat !== "items";
  const showItems   = activeCat !== "classes";
  const showInfo    = activeCat == null && q === "";
  const resultCount = (showClasses ? filteredClasses.length : 0) + (showItems ? filteredItems.length : 0);

  const showMsg = (text, type = "ok") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  // ── Acquisto settimanale ────────────────────────────────────────────────────
  const buyMarketItem = async (item) => {
    if (!currentUser || !charData) return;
    if (coins < item.price) { showMsg("Monete insufficienti.", "err"); return; }
    const maxPerWeek = Math.max(1, item.maxPerWeek ?? 1);
    const cur = ownedQty(item.id);
    if (cur >= maxPerWeek) { showMsg("Hai già raggiunto il massimo per questa settimana.", "err"); return; }

    // L'acquisto viene FOTOGRAFATO (payload incluso): anche se il Master poi
    // modifica o toglie l'articolo dal catalogo, quanto comprato resta valido
    // fino alla scadenza della settimana.
    const existing = weeklyPurchases.find(p => p.itemId === item.id);
    const purchases = existing
      ? weeklyPurchases.map(p => p.itemId === item.id ? { ...p, qty: (p.qty || 1) + 1 } : p)
      : [...weeklyPurchases, {
          itemId: item.id,
          name: item.name,
          icon: item.icon || CAT_META[item.category]?.icon || "🎁",
          category: item.category,
          price: item.price,
          maxPerWeek,
          payload: item.payload || {},
          qty: 1,
          boughtAt: new Date().toISOString(),
        }];

    await updateDoc(doc(db, "characters", currentUser.uid), {
      arenaCoins: increment(-item.price),
      arenaWeekly: { weekKey, purchases },
    });
    showMsg(`Acquistato: ${item.name}! Valido fino a ${weekEndLabel(weekKey)} · solo tornei.`);
  };

  if (!currentUser) {
    return (
      <div className="cine-page am-page" style={{ "--cine-accent": "#8a0e0e", "--cine-accent-2": "#c0392b" }}>
        <p className="am-login-notice">Accedi per visitare la Bottega dell'Arena.</p>
      </div>
    );
  }

  return (
    <div className="cine-page am-page cine-compact" style={{ "--cine-accent": "#8a0e0e", "--cine-accent-2": "#c0392b" }}>
      <AmbientFX variant="fire" />
      {/* ── HERO ASIMMETRICO: immagine full-bleed + placca-bottega a sinistra ── */}
      <section className="am-hero" aria-label="Bottega dell'Arena">
        <div className="am-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="am-hero-wash" aria-hidden="true" />
        <div className="am-hero-plate">
          <span className="am-hero-seal">⚔ Arena dei Campioni</span>
          <h1 className="am-hero-title">Bottega<br />dell'Arena</h1>
          <p className="am-hero-tagline">La vetrina cambia ogni settimana: ciò che compri vale fino a domenica sera, solo nei tornei.</p>
          <dl className="am-hero-stats">
            <div><dt>Monete Arena</dt><dd>🪙 {coins}</dd></div>
            <div><dt>Scadenza acquisti</dt><dd>⏳ {weekEndLabel(weekKey)}</dd></div>
          </dl>
        </div>
      </section>

      {/* ── RICERCA ── */}
      <CineToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Cerca una classe o un articolo in vetrina…"
        chips={[{ key: "classes", label: "⚔ Classi" }, { key: "items", label: "🛍 Vetrina" }]}
        activeChip={activeCat}
        onChip={setActiveCat}
        allLabel="Tutto"
        count={resultCount}
        countNoun={resultCount === 1 ? "risultato" : "risultati"}
      />

      <div className="cine-wrap am-body">
      {message && (
        <div className={`am-message ${message.type === "err" ? "am-message--err" : ""}`}>
          {message.text}
        </div>
      )}

      {/* ── CLASSI ARENA (solo informativo: tutte base Lv.3) ── */}
      {showClasses && (
      <div className="am-classes-section">
        <h3 className="am-how-title">Classi Arena</h3>
        <p className="am-classes-sub">
          Tutti combattono con le <strong>classi base al Livello 3</strong>: niente livelli, niente archetipi.
          L'unico modo per potenziarsi è la <strong>vetrina settimanale</strong> qui sotto.
        </p>
        {filteredClasses.length === 0 ? (
          <p className="cine-empty">Nessuna classe corrisponde alla ricerca.</p>
        ) : (
        <div className="am-classes-grid">
          {filteredClasses.map(cls => (
            <div key={cls.key} className="am-class-card">
              <div className="am-class-icon">{cls.icon}</div>
              <div className="am-class-name">{cls.name}</div>
              <div className="am-class-level">Lv. 3</div>
            </div>
          ))}
        </div>
        )}
      </div>
      )}

      {showInfo && (<>
      <div className="am-how am-class-manual">
        <h3 className="am-how-title">📖 Come funziona la Bottega Settimanale</h3>
        <ul className="am-how-list" style={{ marginBottom: "12px" }}>
          <li>🗓 Ogni settimana il Master rinnova la <strong>vetrina</strong>: oggetti, incantesimi, armi, armature e pet.</li>
          <li>🪙 Compri con le <strong>Monete Arena</strong>. Ogni articolo può avere un <strong>massimo di acquisti a settimana</strong>.</li>
          <li>⏳ Tutto ciò che compri vale <strong>dal momento dell'acquisto fino a domenica alle 24:00</strong>. Il lunedì torni <strong>base</strong> (classi Lv.3) e puoi comprare le novità.</li>
          <li>🏟 Gli acquisti funzionano <strong>solo nei tornei</strong>: nelle Sfide Libere e contro l'IA si combatte col kit base.</li>
          <li>🎒 <strong>Oggetti</strong>: azione gratuita, 1 per turno (cure, danni o bonus temporanei).</li>
          <li>✨ <strong>Incantesimi</strong>: si aggiungono alle tue azioni con le loro cariche, anche fuori dalla tua classe.</li>
          <li>⚔️ <strong>Armi e armature</strong>: si aggiungono al tuo equipaggiamento e alla tua CA.</li>
          <li>🐾 <strong>Pet</strong>: agiscono come <strong>azione bonus</strong> nel tuo turno, con un numero massimo di usi per fight.</li>
        </ul>
        <p className="am-manual-note">ℹ️ Le abilità e gli incantesimi base della tua classe restano sempre tuoi: la Bottega aggiunge, non sostituisce.</p>
      </div>

      <div className="am-how">
        <h3 className="am-how-title">Come guadagnare Monete Arena</h3>
        <ul className="am-how-list">
          <li>🪙 <strong>+5 MA</strong> per ogni fight di torneo disputato</li>
          <li>🪙 <strong>+7 MA</strong> per ogni round vinto</li>
          <li>🪙 <strong>+30 MA</strong> se vinci il torneo</li>
          <li>🎲 Le <strong>scommesse</strong> vinte pagano il doppio della puntata</li>
        </ul>
      </div>

      <div className="am-how am-bets-section">
        <h3 className="am-how-title">🎲 Scommesse Arena</h3>
        <p className="am-classes-sub" style={{ marginBottom: "10px" }}>
          Le scommesse usano <strong>Monete Arena (MA)</strong>. Puoi scommettere su singoli fight o sul vincitore del torneo.
          Le scommesse chiudono quando un combattente scende sotto il <strong>50% HP</strong>.
        </p>
        <div className="am-bet-tables">
          <div className="am-bet-table">
            <div className="am-bet-table-title">⚔️ Fight singolo — x2 (max 1 MA)</div>
            <div className="am-bet-rows">
              <div className="am-bet-row"><span className="am-bet-stake">1 MA</span><span className="am-bet-arrow">→</span><span className="am-bet-win">2 MA</span><span className="am-bet-profit">+1 MA</span></div>
            </div>
          </div>
          <div className="am-bet-table">
            <div className="am-bet-table-title">🏆 Vincitore torneo — x2 (max 3 MA)</div>
            <div className="am-bet-rows">
              <div className="am-bet-row"><span className="am-bet-stake">1 MA</span><span className="am-bet-arrow">→</span><span className="am-bet-win">2 MA</span><span className="am-bet-profit">+1 MA</span></div>
              <div className="am-bet-row"><span className="am-bet-stake">2 MA</span><span className="am-bet-arrow">→</span><span className="am-bet-win">4 MA</span><span className="am-bet-profit">+2 MA</span></div>
              <div className="am-bet-row"><span className="am-bet-stake">3 MA</span><span className="am-bet-arrow">→</span><span className="am-bet-win">6 MA</span><span className="am-bet-profit">+3 MA</span></div>
            </div>
          </div>
        </div>
      </div>
      </>)}
      </div>

      {showItems && (<>
      {/* ── RUBRICA: Vetrina della settimana ── */}
      <div className="am-rubric">
        <span className="am-rubric-eyebrow">Armeria del Campione</span>
        <h2 className="am-rubric-title">Vetrina della Settimana</h2>
        <p className="am-rubric-sub">Gli acquisti valgono fino a <strong>{weekEndLabel(weekKey)}</strong> · solo nei tornei.</p>
      </div>

      <div className="cine-wrap am-body">

      {/* ── I MIEI ACQUISTI ── */}
      {weeklyPurchases.length > 0 && (
        <div className="am-weekly-owned">
          <h3 className="am-how-title">🎒 I tuoi acquisti della settimana</h3>
          <div className="am-weekly-owned-list">
            {weeklyPurchases.map(p => (
              <div key={p.itemId} className="am-weekly-owned-row">
                <span className="am-weekly-owned-icon">{p.icon}</span>
                <span className="am-weekly-owned-name">{p.name}{(p.qty || 1) > 1 ? ` ×${p.qty}` : ""}</span>
                <span className="am-weekly-owned-cat">{CAT_META[p.category]?.icon} {CAT_META[p.category]?.label}</span>
              </div>
            ))}
          </div>
          <p className="am-manual-note">⏳ Validi fino a <strong>{weekEndLabel(weekKey)}</strong>, poi tornerai al kit base. Solo tornei.</p>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <p className="cine-empty">{q ? "Nessun articolo corrisponde alla ricerca." : "La vetrina di questa settimana è ancora vuota: torna a trovarci!"}</p>
      ) : (
      <div className="am-grid">
        {filteredItems.map(item => {
          const maxPerWeek = Math.max(1, item.maxPerWeek ?? 1);
          const owned = ownedQty(item.id);
          const maxed = owned >= maxPerWeek;
          const canAfford = coins >= item.price;
          const cat = CAT_META[item.category];
          return (
            <div key={item.id} className={`am-card ${maxed ? "am-card--maxed" : canAfford ? "am-card--affordable" : ""}`}>
              <div className="am-card-cat">{cat?.icon} {cat?.label}</div>
              <div className="am-card-icon">{item.icon}</div>
              <div className="am-card-name">{item.name}</div>
              <div className="am-card-desc">{item.description || marketItemSummary(item)}</div>
              <div className="am-card-price">
                <span className="am-coin-icon">🪙</span>
                <span>{item.price} MA</span>
                {maxPerWeek > 1 && <span className="am-card-max"> · max {maxPerWeek}/sett.</span>}
              </div>
              {owned > 0 && (
                <div className="am-owned-badge">
                  {maxed ? `✔ Tuo (${owned}/${maxPerWeek})` : `Hai: ${owned}/${maxPerWeek}`}
                </div>
              )}
              <button
                className="am-buy-btn"
                onClick={() => buyMarketItem(item)}
                disabled={maxed || !canAfford}
              >
                {maxed ? "Massimo settimanale" : !canAfford ? "Monete insufficienti" : "Acquista"}
              </button>
            </div>
          );
        })}
      </div>
      )}

      {isMaster && <ArenaMarketCatalog />}
      {isMaster && <MasterCoinPanel />}
      </div>
      </>)}
    </div>
  );
}

// Potenziamenti LEGACY (vecchia Bottega): non più in vendita, ma finché il
// Master non li azzera restano sui personaggi. Da qui può rimuoverli.
const ITEM_FIELDS = [
  { field: "weaponBonus",     label: "Arma +1",              icon: "⚔️" },
  { field: "armorBonus",      label: "Armatura +1",          icon: "🛡️" },
  { field: "healingPotions",  label: "Pozione Cura Media",   icon: "💚" },
  { field: "rangerUniquePet", label: "Drago di Smeraldo",    icon: "🐉" },
  { field: "monkPunchD8",     label: "Pugno Potenziato",     icon: "👊" },
  { field: "classArtificer",  label: "Classe Artefice",      icon: "⚙️" },
  { field: "bardNotaDolente", label: "Nota Dolente",         icon: "⚡" },
];

// Interpreta l'input monete: "+5" / "-3" = relativo alle monete attuali, "10" = assoluto.
// Ritorna il NUOVO totale (mai negativo) oppure null se la stringa non è valida.
function parseCoinInput(raw, current) {
  const s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return null;
  const m = s.match(/^([+-]?)(\d+)$/);
  if (!m) return null;
  const num = parseInt(m[2], 10);
  if (m[1] === "+") return current + num;
  if (m[1] === "-") return Math.max(0, current - num);
  return num; // assoluto
}

function MasterCoinPanel() {
  const [allChars, setAllChars] = useState([]);
  const [editCoins, setEditCoins] = useState({});
  const [playerFilter, setPlayerFilter] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "characters"), snap => {
      const list = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(c => !isHiddenChar({ id: c.uid, name: c.name })); // nascondi i player esclusi
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllChars(list);
    });
    return () => unsub();
  }, []);

  const saveCoins = async (uid) => {
    const char = allChars.find(c => c.uid === uid);
    const cur = char?.arenaCoins ?? 0;
    const val = parseCoinInput(editCoins[uid], cur);
    if (val == null) return;
    await updateDoc(doc(db, "characters", uid), { arenaCoins: val });
    setEditCoins(prev => { const n = { ...prev }; delete n[uid]; return n; });
  };

  const removeItem = async (uid, field) => {
    await updateDoc(doc(db, "characters", uid), { [`arenaBuffs.${field}`]: 0 });
  };

  // ── Reset stagione: azzera le MA e i potenziamenti legacy di TUTTI ─────────
  // (gli acquisti settimanali correnti NON vengono toccati: scadono da soli).
  const resetSeason = async () => {
    if (!window.confirm(`Azzerare le Monete Arena e i potenziamenti VECCHI (Arma +1, Draghetto, ecc.) di TUTTI i ${allChars.length} giocatori? Gli acquisti settimanali in corso non vengono toccati.`)) return;
    setResetting(true);
    try {
      for (const ch of allChars) {
        await updateDoc(doc(db, "characters", ch.uid), { arenaCoins: 0, arenaBuffs: {} });
      }
    } finally {
      setResetting(false);
    }
  };

  const pf = playerFilter.trim().toLowerCase();
  const filteredChars = allChars.filter(ch => !pf || (ch.name || ch.uid).toLowerCase().includes(pf));

  return (
    <div className="am-master-panel">
      <h3 className="am-master-panel-title">🪙 Pannello Master — Giocatori</h3>

      <div className="am-mp-section">
        <input
          className="am-mp-search"
          type="text"
          placeholder="🔍 Cerca giocatore…"
          value={playerFilter}
          onChange={e => setPlayerFilter(e.target.value)}
        />
        <p className="am-master-note">
          Monete: scrivi un numero per <strong>impostarlo</strong>, oppure <code>+N</code> / <code>−N</code> per
          <strong> aggiungere o togliere</strong> rispetto alle attuali (es. <code>+5</code>, <code>-3</code>). Invio per salvare.
        </p>
        <button className="am-coin-save am-season-reset" disabled={resetting} onClick={resetSeason}>
          {resetting ? "⏳ Reset in corso…" : "🧹 Azzera MA + potenziamenti vecchi (TUTTI)"}
        </button>
        <div className="am-coin-list">
          {filteredChars.length === 0 ? (
            <p className="cine-empty" style={{ marginTop: 8 }}>Nessun giocatore trovato.</p>
          ) : filteredChars.map(ch => {
          const buffsData  = ch.arenaBuffs || {};
          const ownedItems = ITEM_FIELDS.filter(it => (buffsData[it.field] ?? 0) > 0);
          const cur        = ch.arenaCoins ?? 0;
          const preview    = parseCoinInput(editCoins[ch.uid], cur);
          const showPrev   = preview != null && preview !== cur;
          const weeklyList = (ch.arenaWeekly?.weekKey === currentWeekKey()) ? (ch.arenaWeekly.purchases || []) : [];

          return (
            <div key={ch.uid} className="am-coin-row am-coin-row--stacked">
              <div className="am-coin-row-top">
                <span className="am-coin-name">{ch.name || ch.uid}</span>
                <span className="am-coin-val">{cur} MA</span>
                <input
                  className="am-coin-input"
                  type="text"
                  inputMode="text"
                  placeholder="es. +5 / -3 / 10"
                  value={editCoins[ch.uid] ?? ""}
                  onChange={e => setEditCoins(prev => ({ ...prev, [ch.uid]: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") saveCoins(ch.uid); }}
                />
                {showPrev && <span className="am-coin-preview">→ {preview} MA</span>}
                <button className="am-coin-save" onClick={() => saveCoins(ch.uid)}>Salva</button>
              </div>

              {/* Acquisti settimanali correnti (sola lettura: scadono da soli) */}
              {weeklyList.length > 0 && (
                <div className="am-weekly-owned-list am-weekly-owned-list--mp">
                  {weeklyList.map(p => (
                    <span key={p.itemId} className="am-mp-weekly-chip" title={`${p.name} · ${p.price} MA`}>
                      {p.icon} {p.name}{(p.qty || 1) > 1 ? ` ×${p.qty}` : ""}
                    </span>
                  ))}
                </div>
              )}

              {ownedItems.length > 0 && (
                <div className="am-owned-items">
                  {ownedItems.map(it => (
                    <button
                      key={it.field}
                      className="am-remove-item-btn"
                      title={`Rimuovi ${it.label} (potenziamento vecchio)`}
                      onClick={() => removeItem(ch.uid, it.field)}
                    >
                      {it.icon} {it.label} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
