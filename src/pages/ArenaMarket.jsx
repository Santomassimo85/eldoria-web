import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { doc, collection, onSnapshot, updateDoc, increment } from "firebase/firestore";
import "../styles/cinematic.css";
import "./ArenaMarket.css";
import "./ArenaMarketCatalogo.css";
import AmbientFX from "../components/AmbientFX";
import CineToolbar from "../components/CineToolbar";
import useParallaxScroll from "../hooks/useParallaxScroll";
import { isHiddenChar } from "../data/hiddenPlayers";
import ArenaMarketCatalog, { MARKET_CATEGORIES, marketItemSummary } from "../components/ArenaMarketCatalog";
import { currentWeekKey, weekEndLabel } from "../data/arenaWeek";

const MASTER_EMAIL = "santomassimo85@gmail.com";

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
      {/* Tastino Hub: torna all'Arena (coerente col FAB delle altre viste Arena) */}
      <Link to="/arena" className="am-hub-fab" aria-label="Torna all'Arena" title="Torna all'Arena">
        <span className="am-hub-fab-arrow" aria-hidden="true">‹</span>
        <span className="am-hub-fab-label">Hub</span>
      </Link>
      {/* ── MASTHEAD "CATALOGO D'ASTA": frontespizio tipografico a doppi filetti,
            in dialogo con la Locandina del Colosseo della pagina Arena ── */}
      <header className="amc-mast" aria-label="Bottega dell'Arena">
        <span className="amc-mast-eyebrow">Grande Colosseo · Catalogo d'Asta della Settimana</span>
        <h1 className="amc-mast-title">Bottega dell'Arena</h1>
        <p className="amc-mast-sub">
          La vetrina si rinnova ogni settimana: ciò che compri vale fino a <strong>{weekEndLabel(weekKey)}</strong>, solo nei tornei.
        </p>
        <div className="amc-mast-plates">
          <div className="amc-plate"><span className="amc-plate-lab">Le tue Monete Arena</span><span className="amc-plate-val">🪙 {coins}</span></div>
          <div className="amc-plate"><span className="amc-plate-lab">Scadenza acquisti</span><span className="amc-plate-val">⏳ {weekEndLabel(weekKey)}</span></div>
        </div>
      </header>

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

      {/* ── CLASSI ARENA (fregio informativo: tutte base Lv.3) ── */}
      {showClasses && (
      <div className="amc-classes">
        <div className="amc-sect-head"><span className="amc-sect-rule" aria-hidden="true" />Le Classi del Colosseo<span className="amc-sect-rule" aria-hidden="true" /></div>
        <p className="amc-classes-sub">
          Tutti combattono con le <strong>classi base al Livello 3</strong>: niente livelli, niente archetipi.
          L'unico modo per potenziarsi è la <strong>vetrina settimanale</strong> qui sotto.
        </p>
        {filteredClasses.length === 0 ? (
          <p className="cine-empty">Nessuna classe corrisponde alla ricerca.</p>
        ) : (
        <div className="amc-class-strip">
          {filteredClasses.map(cls => (
            <span key={cls.key} className="amc-class-chip">
              <span className="amc-class-chip-ico">{cls.icon}</span> {cls.name} <em>Lv.3</em>
            </span>
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
          <li>🛒 <strong>Non è tutto equipaggiato in automatico!</strong> All'iscrizione al torneo, nella scheda <strong>«Bottega»</strong> del loadout, scegli tu cosa indossare toccando le <strong>carte viola</strong>. Ciò che non scegli resta a magazzino fino a fine settimana.</li>
          <li>🎒 <strong>Oggetti</strong>: azione gratuita, 1 per turno (cure, danni o bonus temporanei).</li>
          <li>✨ <strong>Incantesimi</strong>: si aggiungono alle tue azioni con le loro cariche, anche fuori dalla tua classe. <strong>Comprando la spell ottieni automaticamente lo slot del suo livello</strong>: puoi lanciarla anche se è di livello alto (non serve sbloccarlo).</li>
          <li>⚔️ <strong>Armi e armature</strong>: si aggiungono al tuo equipaggiamento e alla tua CA (il bonus armatura si vede nell'anteprima CA del loadout).</li>
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
      {/* ── VETRINA A LOTTI: registro d'asta, non più griglia di card ── */}
      <div className="cine-wrap am-body">
      <div className="amc-sect-head amc-sect-head--lots"><span className="amc-sect-rule" aria-hidden="true" />Vetrina della Settimana<span className="amc-sect-rule" aria-hidden="true" /></div>
      <p className="amc-sect-note">Gli acquisti valgono fino a <strong>{weekEndLabel(weekKey)}</strong> · solo nei tornei.</p>

      {/* ── RICEVUTA: i tuoi acquisti della settimana ── */}
      {weeklyPurchases.length > 0 && (
        <div className="amc-receipt">
          <div className="amc-receipt-title">🧾 Ricevuta della settimana</div>
          {weeklyPurchases.map(p => (
            <div key={p.itemId} className="amc-receipt-row">
              <span className="amc-receipt-name">{p.icon} {p.name}</span>
              <span className="amc-receipt-dots" aria-hidden="true" />
              <span className="amc-receipt-qty">{(p.qty || 1) > 1 ? `×${p.qty}` : "✓"}</span>
            </div>
          ))}
          <div className="amc-receipt-foot">⏳ Valida fino a <strong>{weekEndLabel(weekKey)}</strong>, poi si torna al kit base · solo tornei.</div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <p className="cine-empty">{q ? "Nessun articolo corrisponde alla ricerca." : "La vetrina di questa settimana è ancora vuota: torna a trovarci!"}</p>
      ) : (
      <div className="amc-lots">
        {filteredItems.map((item, i) => {
          const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
          const maxPerWeek = Math.max(1, item.maxPerWeek ?? 1);
          const owned = ownedQty(item.id);
          const maxed = owned >= maxPerWeek;
          const canAfford = coins >= item.price;
          const cat = CAT_META[item.category];
          return (
            <div key={item.id} className={`amc-lot ${maxed ? "amc-lot--maxed" : canAfford ? "amc-lot--affordable" : ""}`}>
              <div className="amc-lot-side">
                <span className="amc-lot-num">Lotto {ROMAN[i] || i + 1}</span>
                <span className="amc-lot-icon" aria-hidden="true">{item.icon}</span>
              </div>
              <div className="amc-lot-main">
                <div className="amc-lot-name">
                  {item.name}
                  <span className="amc-lot-cat">{cat?.icon} {cat?.label}</span>
                  {owned > 0 && <span className="amc-lot-owned">{maxed ? `✔ Tuo (${owned}/${maxPerWeek})` : `Hai ${owned}/${maxPerWeek}`}</span>}
                </div>
                <div className="amc-lot-desc">{item.description || marketItemSummary(item)}</div>
              </div>
              <div className="amc-lot-buy">
                <span className="amc-lot-price">🪙 {item.price} MA{maxPerWeek > 1 && <em> · max {maxPerWeek}/sett.</em>}</span>
                <button
                  className="am-buy-btn"
                  onClick={() => buyMarketItem(item)}
                  disabled={maxed || !canAfford}
                >
                  {maxed ? "Massimo settimanale" : !canAfford ? "Monete insufficienti" : "Acquista"}
                </button>
              </div>
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
  const [winsByUid, setWinsByUid] = useState({});
  const [giveAll, setGiveAll] = useState("");   // MA da dare a tutti in un colpo
  const [giving, setGiving] = useState(false);

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

  // Vittorie all'Arena per giocatore (derivate dallo storico tornei).
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "arena_tournament_history"), snap => {
      const m = {};
      snap.docs.forEach(d => { const w = d.data().winnerId; if (w) m[w] = (m[w] || 0) + 1; });
      setWinsByUid(m);
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

  // Rimuove un acquisto settimanale di un giocatore (Master): toglie la riga
  // dagli `arenaWeekly.purchases` della settimana corrente. Non tocca le monete.
  const removeWeeklyPurchase = async (uid, itemId, name) => {
    const char = allChars.find(c => c.uid === uid);
    const aw = char?.arenaWeekly;
    if (!aw || aw.weekKey !== currentWeekKey()) return;
    if (!window.confirm(`Rimuovere "${name}" dagli acquisti della settimana di questo giocatore?`)) return;
    const purchases = (aw.purchases || []).filter(p => p.itemId !== itemId);
    await updateDoc(doc(db, "characters", uid), { arenaWeekly: { weekKey: aw.weekKey, purchases } });
  };

  // ── Dai N Monete Arena a TUTTI ────────────────────────────────────────────
  // Aggiunge (o toglie, se negativo) N MA a ogni giocatore rispetto alle attuali.
  const giveCoinsToAll = async () => {
    const n = parseInt(String(giveAll).trim(), 10);
    if (!Number.isFinite(n) || n === 0) return;
    if (!window.confirm(`${n > 0 ? "Dare" : "Togliere"} ${Math.abs(n)} Monete Arena a TUTTI i ${allChars.length} giocatori?`)) return;
    setGiving(true);
    try {
      for (const ch of allChars) {
        const next = Math.max(0, (ch.arenaCoins ?? 0) + n);
        await updateDoc(doc(db, "characters", ch.uid), { arenaCoins: next });
      }
      setGiveAll("");
    } finally {
      setGiving(false);
    }
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
        <div className="am-give-all">
          <input
            className="am-coin-input am-give-all-input"
            type="text"
            inputMode="numeric"
            placeholder="es. 10 (o -5)"
            value={giveAll}
            onChange={e => setGiveAll(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") giveCoinsToAll(); }}
          />
          <button
            className="am-coin-save am-give-all-btn"
            disabled={giving || !String(giveAll).trim()}
            onClick={giveCoinsToAll}
          >
            {giving ? "⏳ In corso…" : "🪙 Dai MA a TUTTI"}
          </button>
        </div>
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
                <span className="am-coin-wins" title="Vittorie all'Arena">🏆 {winsByUid[ch.uid] || 0}</span>
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

              {/* Acquisti settimanali correnti — il Master può rimuoverli (✕). */}
              {weeklyList.length > 0 && (
                <div className="am-weekly-owned-list am-weekly-owned-list--mp">
                  {weeklyList.map(p => (
                    <button
                      key={p.itemId}
                      className="am-mp-weekly-chip am-mp-weekly-chip--removable"
                      title={`Rimuovi "${p.name}" dagli acquisti della settimana`}
                      onClick={() => removeWeeklyPurchase(ch.uid, p.itemId, p.name)}
                    >
                      {p.icon} {p.name}{(p.qty || 1) > 1 ? ` ×${p.qty}` : ""} <span className="am-mp-weekly-x">✕</span>
                    </button>
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
