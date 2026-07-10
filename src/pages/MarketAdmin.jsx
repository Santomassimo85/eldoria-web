import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { db, storage } from "../firebase";
import "./admin.css";
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { ref as storageRef, uploadBytes, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import HtmlToolbar from "../components/HtmlToolbar";
import DateTimePicker from "../components/DateTimePicker";
import { createMarketItem } from "../utils/itemTemplates";
import {
  EMPTY_FOUNDRY, resolveFoundryType,
  FOUNDRY_TYPES, FOUNDRY_DAMAGE_TYPES, FOUNDRY_ACTION_TYPES,
  FOUNDRY_WEAPON_PROPS, FOUNDRY_ARMOR_TYPES, FOUNDRY_ABILITIES,
} from "../utils/foundryMap";
import { PET_ITEMS, ITEMS_ORDER } from "../data/petItems";
import { EGG_ICON, RARITY_LABEL } from "../data/petSpecies";
import { TCG_CARDS, TCG_CARD_LIST } from "../data/tcgCards";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const CO_MASTER_EMAILS = ["ripperti96@gmail.com"];
const canAccessMarket = (email) => email === MASTER_EMAIL || CO_MASTER_EMAILS.includes(email);
const RARITIES = ["Comune", "Non comune", "Rara", "Molto rara", "Leggendaria", "Artefatto"];
// Livelli Ratto (allineati a Mercato.jsx)
const RATTO_LEVELS_ADMIN = [
  { lv: 0, name: "Estraneo" },
  { lv: 1, name: "Simpatizzante" },
  { lv: 2, name: "Informatore" },
  { lv: 3, name: "Ricettatore" },
  { lv: 4, name: "Veterano" },
  { lv: 5, name: "Ombra di Obia" },
];
// Rank usato per ordinare (canonico + legacy). Più basso = più comune.
const RARITY_RANK = {
  "Comune": 0,
  "Non comune": 1,
  "Rara": 2,        "Raro": 2,
  "Molto rara": 3,  "Magico": 3, "Epico": 3,
  "Leggendaria": 4, "Leggendario": 4,
  "Artefatto": 5,
};
const ITEM_TYPES = [
  "Arma", "Armatura", "Accessori", "Artefatto Magico",
  "Pozioni", "Pergamene", "Reagenti", "Varie",
  // PET SYSTEM — hidden while disabled
  // "Uovo Pet", "Oggetto Pet",
  "Pacchetto Carte", "Carta TCG",
];

/* Pet-listing helpers — restricted to the rarities/items that already
   exist elsewhere in the game so we never invent new payloads. */
const ADMIN_EGG_RARITIES = ["common", "rare", "epic", "legendary"];
const EGG_FLAVOR = {
  common:    "🥚 Uovo Comune · 80% comuni · 18% rari · ~2% epici · 0.05% leggendari.",
  rare:      "🥚 Uovo Raro · 50% comuni · 42% rari · ~8% epici · 0.2% leggendari.",
  epic:      "🥚 Uovo Epico · 25% comuni · 50% rari · ~24% epici · 1% leggendari.",
  legendary: "🥚 Uovo Leggendario · 20% rari · 55% epici · 25% leggendari · nessun comune.",
};
const EGG_MARKET_RARITY = {
  common:    "Non comune",
  rare:      "Rara",
  epic:      "Molto rara",
  legendary: "Leggendaria",
};

/* TCG market helpers — packs come in two rarities × six elements.
   Single cards are restricted to epic/legendary on purpose: commons and
   rares are pack-only, so the rarest creatures stay as the named lots. */
const TCG_PACK_RARITIES = ["epic", "legendary"];
const TCG_PACK_RARITY_LABEL = { epic: "Epico", legendary: "Leggendario" };
const TCG_PACK_MARKET_RARITY = { epic: "Molto rara", legendary: "Leggendaria" };
const TCG_CARD_MARKET_RARITY = { epic: "Molto rara", legendary: "Leggendaria" };
const TCG_ELEMENTS = ["fire", "water", "earth", "air", "light", "dark"];
const TCG_ELEMENT_LABEL = {
  fire:  "Fuoco",  water: "Acqua", earth: "Terra",
  air:   "Aria",   light: "Luce",  dark:  "Oscurità",
};
const TCG_ELEMENT_ICON = {
  fire: "🔥", water: "💧", earth: "🌿",
  air:  "🌪", light: "✨", dark:  "🌑",
};

const TCG_PACK_FLAVOR = (rarity, element) =>
  `${TCG_ELEMENT_ICON[element]} Pacchetto ${TCG_PACK_RARITY_LABEL[rarity]} · ` +
  `contiene carte ${rarity === "legendary" ? "rare e leggendarie" : "rare ed epiche"} ` +
  `dell'elemento ${TCG_ELEMENT_LABEL[element]}.`;

const TCG_EPIC_LEGENDARY_CARDS = TCG_CARD_LIST
  .filter(c => c.rarity === "epic" || c.rarity === "legendary")
  .sort((a, b) => {
    const elA = TCG_ELEMENTS.indexOf(a.element);
    const elB = TCG_ELEMENTS.indexOf(b.element);
    if (elA !== elB) return elA - elB;
    if (a.rarity !== b.rarity) return a.rarity === "legendary" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

/* Render an emoji as a small SVG and return a data URI. Used so the
   form's image-required check passes naturally when the admin picks
   a pet-payload item without uploading a custom artwork. */
function emojiToDataUri(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fef9c3"/><text x="50" y="68" font-size="64" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Suggested price ranges per rarity (matches public/mercato-nero-pricing.html)
const RARITY_PRICE = {
  "Comune":      { min: 5,   max: 15,  color: "#9ca3af" },
  "Non comune":  { min: 20,  max: 50,  color: "#22c55e" },
  "Rara":        { min: 60,  max: 120, color: "#3b82f6" },
  "Molto rara":  { min: 150, max: 280, color: "#a855f7" },
  "Leggendaria": { min: 350, max: 600, color: "#f97316" },
  "Artefatto":   { min: 800, max: null,color: "#ef4444" },
  // Legacy mappings — for items created before the rarity rename
  "Raro":         { min: 60,  max: 120, color: "#3b82f6" },
  "Magico":       { min: 150, max: 280, color: "#a855f7" },
  "Epico":        { min: 150, max: 280, color: "#a855f7" },
  "Leggendario":  { min: 350, max: 600, color: "#f97316" },
};

// Status of a price relative to the rarity range: "below" | "ok" | "above" | "unknown"
function priceStatus(price, rarity) {
  const range = RARITY_PRICE[rarity];
  if (!range || price == null || price === "" || isNaN(price)) return "unknown";
  const p = Number(price);
  if (p === 0) return "unknown";
  if (range.max == null) return p >= range.min ? "ok" : "below";
  if (p < range.min) return "below";
  if (p > range.max) return "above";
  return "ok";
}

function formatRange(rarity) {
  const r = RARITY_PRICE[rarity];
  if (!r) return null;
  return r.max == null ? `${r.min}+ Corone` : `${r.min}–${r.max} Corone`;
}

const initialFormData = {
  name: "", type: "Arma", class: "Comune", saleType: "auction",
  startingBid: "", endDate: "", description: "", img: "", minLevel: 0,
  // Pet-payload fields — only populated when type is "Uovo Pet" or "Oggetto Pet"
  petRarity: "common",
  petItemKey: "",
  // TCG-payload fields — only populated when type is "Pacchetto Carte" or "Carta TCG"
  tcgPackRarity: "epic",
  tcgPackElement: "fire",
  tcgCardId: "",
  // SET-payload fields — l'oggetto può far parte di un set tematico
  inSet: false,
  setName: "",
  setSize: 5,
  setBonuses: [], // [{ pieces: 2, effect: "STR +1" }, ...]
  // FOUNDRY — dati di combattimento facoltativi per l'import su Foundry
  foundry: { ...EMPTY_FOUNDRY },
};

const formatEndDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const formatTimeLeft = (iso) => {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return { text: "Scaduta", expired: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return { text: `${d}g ${h}h`, expired: false };
  if (h > 0) return { text: `${h}h ${m}m`, expired: false };
  return { text: `${m}m`, expired: false };
};

// Inline price editor — saves on blur or Enter, shows ✓ briefly on success.
function QuickPriceEdit({ item, disabled }) {
  const initial = String(item.startingBid ?? item.price ?? 0);
  const [val, setVal] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  // Re-sync when the item's price changes from outside (e.g. another tab).
  useEffect(() => { setVal(initial); /* eslint-disable-next-line */ }, [initial]);

  const commit = async () => {
    if (saving || disabled) return;
    const next = Number(val);
    if (!Number.isFinite(next) || next < 0) { setVal(initial); return; }
    if (next === Number(initial)) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "items", item.id), { startingBid: next, price: next });
      setSavedAt(Date.now());
    } catch (err) {
      console.error("Quick price save failed:", err);
      setVal(initial);
    } finally {
      setSaving(false);
    }
  };

  const justSaved = savedAt && (Date.now() - savedAt < 1500);

  // Live suggestion based on the typed value vs. the item's rarity range
  const range = RARITY_PRICE[item.class];
  const status = priceStatus(val, item.class);
  const rangeLabel = formatRange(item.class);
  const tone = range?.color || "#888";

  return (
    <span className="mkadm-inv-price-edit-wrap" onClick={(e) => e.stopPropagation()}>
      <span className="mkadm-inv-price-edit">
        <span className="mkadm-inv-price-prefix">Base</span>
        <input
          type="number"
          min="0"
          step="1"
          value={val}
          disabled={disabled || saving}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setVal(initial); e.target.blur(); } }}
          className={`mkadm-inv-price-input price-${status}`}
          style={{ borderColor: status === "ok" ? tone : status === "below" ? "#d97706" : status === "above" ? "#dc2626" : undefined }}
          aria-label="Prezzo base"
          title={rangeLabel ? `Range ${item.class}: ${rangeLabel}` : ""}
        />
        <span className="mkadm-inv-price-suffix">Corone {saving ? "…" : justSaved ? "✓" : ""}</span>
      </span>
      {rangeLabel && (
        <span
          className={`mkadm-price-chip status-${status}`}
          style={{ color: tone, borderColor: tone + "66" }}
          title={`Range consigliato per ${item.class}`}
        >
          {status === "ok"     ? "✓ "
          : status === "below" ? "↓ "
          : status === "above" ? "↑ "
          : "💡 "}
          {rangeLabel}
        </span>
      )}
    </span>
  );
}

// Edit inline del livello Ratto richiesto (0-5). Stesso pattern di QuickPriceEdit.
function QuickRattoEdit({ item, disabled }) {
  const initial = String(item.minLevel ?? 0);
  const [val, setVal] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => { setVal(initial); /* eslint-disable-next-line */ }, [initial]);

  const commit = async () => {
    if (saving || disabled) return;
    const next = Number(val);
    if (!Number.isFinite(next) || next < 0 || next > 5) { setVal(initial); return; }
    if (next === Number(initial)) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "items", item.id), { minLevel: next });
      setSavedAt(Date.now());
    } catch (err) {
      console.error("Quick minLevel save failed:", err);
      setVal(initial);
    } finally {
      setSaving(false);
    }
  };

  const justSaved = savedAt && (Date.now() - savedAt < 1500);
  const lvName = RATTO_LEVELS_ADMIN.find(l => l.lv === Number(val))?.name || "—";

  return (
    <span className="mkadm-inv-price-edit-wrap" onClick={(e) => e.stopPropagation()}>
      <span className="mkadm-inv-price-edit mkadm-inv-ratto-edit">
        <span className="mkadm-inv-price-prefix">🐀 Lv</span>
        <input
          type="number"
          min="0"
          max="5"
          step="1"
          value={val}
          disabled={disabled || saving}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setVal(initial); e.target.blur(); } }}
          className="mkadm-inv-price-input mkadm-inv-ratto-input"
          aria-label="Livello Ratto minimo"
          title="Livello Ratto richiesto (0–5)"
        />
        <span className="mkadm-inv-price-suffix">
          {lvName}{saving ? " …" : justSaved ? " ✓" : ""}
        </span>
      </span>
    </span>
  );
}

export default function MarketAdmin() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [globalCountdown, setGlobalCountdown] = useState("");
  const [marketIsOpen, setMarketIsOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [rattoFilter, setRattoFilter] = useState("all");
  const [setNameFilter, setSetNameFilter] = useState("all"); // "all" | "any" | "none" | "<setName>"
  const [sortBy, setSortBy] = useState("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [descSearchQuery, setDescSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [genName, setGenName] = useState(false);     // IA: generazione nome in corso
  const [genDesc, setGenDesc] = useState(false);     // IA: generazione descrizione in corso
  const [genGdr, setGenGdr] = useState(false);       // IA: generazione oggetto "da GdR" in corso
  const [genError, setGenError] = useState("");      // messaggio errore IA
  const descRef = useRef(null);
  const fileInputRef = useRef(null);

  const genBusy = genName || genDesc || genGdr;

  // ── Tab "Genera con AI": da un prompt → immagine + info + dati Foundry ──
  const [activeTab, setActiveTab] = useState("manual"); // "manual" | "ai"
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiRarity, setAiRarity] = useState("");   // "" = decide l'AI
  const [aiType, setAiType] = useState("");        // "" = decide l'AI
  const [aiStyle, setAiStyle] = useState("olio");  // stile dell'immagine
  const [aiBusy, setAiBusy] = useState("");        // "" | "img" | "info"
  const [aiError, setAiError] = useState("");

  const AI_STYLES = [
    { key: "olio", label: "🖼 Olio" },
    { key: "fumetto", label: "🖋 Fumetto" },
    { key: "acquerello", label: "🎨 Acquerello" },
    { key: "epico", label: "⚔️ Epico" },
    { key: "anime", label: "✨ Anime" },
  ];

  // Carica una data-URL (immagine generata) su Storage e ne torna l'URL pubblico.
  const uploadDataUrlToStorage = async (dataUrl) => {
    const path = `market-items/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const ref = storageRef(storage, path);
    await uploadString(ref, dataUrl, "data_url");
    return await getDownloadURL(ref);
  };

  // Pipeline: prompt → immagine (Gemini) → carica su Storage → info+Foundry
  // (Claude tool use) → compila il form e passa alla scheda per revisione/salvataggio.
  const generateItemFromPrompt = async () => {
    const p = aiPrompt.trim();
    if (!p || aiBusy) return;
    setAiError("");
    // 1) Immagine dal prompt.
    setAiBusy("img");
    let imgUrl = "";
    try {
      const artPrompt = `Oggetto fantasy per gioco di ruolo, isolato al centro su fondale semplice e scuro, resa da inventario/scheda oggetto: ${p}. Nessun personaggio, nessun testo, nessuna scritta, nessuna cornice.`;
      const rImg = await fetch("/api/genera-immagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: artPrompt, stile: aiStyle }),
      });
      const dImg = await rImg.json();
      if (!rImg.ok || dImg.error) throw new Error(dImg.error || "immagine non generata");
      if (!dImg.immagine) throw new Error("Nessuna immagine ricevuta.");
      imgUrl = await uploadDataUrlToStorage(dImg.immagine);
    } catch (err) {
      setAiError(`Immagine non riuscita (l'AI è attiva solo online): ${err.message || err}`);
      setAiBusy("");
      return;
    }
    // 2) Info + dati Foundry coerenti con prompt e immagine.
    setAiBusy("info");
    try {
      const rInfo = await fetch("/api/genera-oggetto-completo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: p, img: imgUrl, rarita: aiRarity || undefined, tipoOggetto: aiType || undefined }),
      });
      const dInfo = await rInfo.json();
      if (!rInfo.ok || dInfo.error) throw new Error(dInfo.error || "info non generate");
      const o = dInfo.oggetto || {};
      setEditId(null);
      setFormData({
        ...initialFormData,
        name: o.name || "",
        type: ITEM_TYPES.includes(o.type) ? o.type : "Arma",
        class: RARITIES.includes(o.class) ? o.class : "Comune",
        description: o.description || "",
        startingBid: o.startingBid != null ? String(o.startingBid) : "",
        img: imgUrl,
        foundry: { ...EMPTY_FOUNDRY, ...(o.foundry || {}) },
      });
      setActiveTab("manual");     // rivedi e salva con il flusso normale
      setAiError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      // L'immagine è già caricata: la tengo nel form così non si perde.
      setFormData((prev) => ({ ...prev, img: imgUrl }));
      setAiError(`Info oggetto non riuscite: ${err.message || err}. L'immagine è pronta nel form: compila i dati a mano.`);
      setActiveTab("manual");
    } finally {
      setAiBusy("");
    }
  };

  // Genera nome / descrizione / oggetto-da-GdR DALL'IMMAGINE (vision).
  // Richiede un'immagine caricata. tipo: "nome" | "descrizione" | "gdr".
  const generaDaImmagine = async (tipo) => {
    if (!formData.img || uploading || genBusy) return;
    setGenError("");
    if (tipo === "nome") setGenName(true);
    else if (tipo === "gdr") setGenGdr(true);
    else setGenDesc(true);
    try {
      const r = await fetch("/api/genera-oggetto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tipo,
          img: formData.img,
          nome: formData.name,
          rarita: formData.class,
          tipoOggetto: formData.type,
        }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "offline");
      if (tipo === "nome" && data.nome) {
        setFormData(prev => ({ ...prev, name: data.nome }));
      } else if ((tipo === "descrizione" || tipo === "gdr") && data.descrizione) {
        setFormData(prev => ({ ...prev, description: data.descrizione }));
      } else {
        throw new Error("Risposta IA vuota.");
      }
    } catch (err) {
      setGenError(
        `Generazione non riuscita (l'IA è attiva solo online). ` +
        (err?.message && err.message !== "offline" ? err.message : "Riprova o scrivi a mano.")
      );
    } finally {
      if (tipo === "nome") setGenName(false);
      else if (tipo === "gdr") setGenGdr(false);
      else setGenDesc(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 40);
      const path = `market-items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      const url = await getDownloadURL(ref);
      setFormData(prev => ({ ...prev, img: url }));
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };

  const handleClearImage = (e) => {
    e?.stopPropagation();
    setFormData(prev => ({ ...prev, img: "" }));
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Eliminare "${item.name}"?`)) return;
    try {
      if (item.img && item.img.includes("firebasestorage.googleapis.com")) {
        try {
          await deleteObject(storageRef(storage, item.img));
        } catch (err) {
          console.warn("Pulizia storage fallita (file forse già eliminato):", err.code);
        }
      }
      await deleteDoc(doc(db, "items", item.id));
    } catch (err) {
      alert("Errore eliminazione: " + err.message);
    }
  };

  const handleDeleteAllItems = async () => {
    if (items.length === 0) {
      alert("Il magazzino è già vuoto.");
      return;
    }
    if (!window.confirm(`⚠️ ELIMINARE TUTTI i ${items.length} oggetti dal mercato? L'operazione è irreversibile.`)) return;
    const phrase = window.prompt('Digita "ELIMINA TUTTO" per confermare la rimozione totale:');
    if (phrase !== "ELIMINA TUTTO") {
      alert("Conferma errata. Operazione annullata.");
      return;
    }
    setLoading(true);
    let failed = 0;
    await Promise.all(items.map(async (item) => {
      try {
        if (item.img && item.img.includes("firebasestorage.googleapis.com")) {
          try {
            await deleteObject(storageRef(storage, item.img));
          } catch (err) {
            console.warn("Pulizia storage fallita per", item.id, err.code);
          }
        }
        await deleteDoc(doc(db, "items", item.id));
      } catch (err) {
        failed++;
        console.error("Errore eliminazione item", item.id, err);
      }
    }));
    setLoading(false);
    if (failed > 0) alert(`Eliminazione completata con ${failed} errori. Controlla la console.`);
    else alert("✅ Tutti gli oggetti sono stati eliminati.");
  };

  useEffect(() => {
    if (!currentUser || !canAccessMarket(currentUser.email)) return;
    const unsubConfig = onSnapshot(doc(db, "settings", "market_config"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setGlobalCountdown(d.nextOpening || "");
        setMarketIsOpen(!!d.isOpen);
      }
    });
    const unsubItems = onSnapshot(collection(db, "items"), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubConfig(); unsubItems(); };
  }, [currentUser]);

  const handleUpdateCountdown = async () => {
    await setDoc(doc(db, "settings", "market_config"), { nextOpening: globalCountdown }, { merge: true });
    alert("✅ Programmazione salvata!");
  };

  const handleToggleMarket = async () => {
    const next = !marketIsOpen;
    const verb = next ? "APRIRE" : "CHIUDERE";
    if (!window.confirm(`${verb} il Mercato Nero? Tutti i giocatori riceveranno una notifica push.`)) return;
    await setDoc(doc(db, "settings", "market_config"), { isOpen: next }, { merge: true });
  };

  const handleEditInit = (item) => {
    setEditId(item.id);
    setFormData({
      ...initialFormData,
      ...item,
      saleType: "auction",
      endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 16) : "",
      // Surface the pet-payload into the form-level selectors so the
      // admin sees the right sub-option when editing a pet listing.
      petRarity: item.petPayload?.kind === "egg" ? item.petPayload.rarity : "common",
      petItemKey: item.petPayload?.kind === "petItem" ? item.petPayload.itemKey : "",
      // Same idea for TCG listings.
      tcgPackRarity: item.tcgPayload?.kind === "cardPack" ? item.tcgPayload.rarity : "epic",
      tcgPackElement: item.tcgPayload?.kind === "cardPack" ? item.tcgPayload.element : "fire",
      tcgCardId: item.tcgPayload?.kind === "tcgCard" ? item.tcgPayload.cardId : "",
      // Set payload: riapro i campi se l'item è già parte di un set
      inSet: !!item.setPayload,
      setName: item.setPayload?.name || "",
      setSize: item.setPayload?.size || 5,
      setBonuses: Array.isArray(item.setPayload?.bonuses)
        ? item.setPayload.bonuses.map(b => ({ pieces: Number(b.pieces) || 1, effect: String(b.effect || "") }))
        : [],
      // Riporta i dati Foundry (merge coi default per non perdere nuovi campi)
      foundry: { ...EMPTY_FOUNDRY, ...(item.foundry || {}) },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setFormData(initialFormData);
  };

  /* When the admin switches to a pet-payload type, prime the sub-selector
     and auto-fill name/description/class/image from the chosen template. */
  const handleTypeChange = (newType) => {
    if (newType === "Uovo Pet") {
      const rarity = formData.petRarity || "common";
      setFormData(prev => ({
        ...prev,
        type: newType,
        petRarity: rarity,
        petItemKey: "",
        name: `Uovo ${RARITY_LABEL[rarity]}`,
        description: EGG_FLAVOR[rarity],
        class: EGG_MARKET_RARITY[rarity],
        img: prev.img || emojiToDataUri(EGG_ICON[rarity] || "🥚"),
      }));
    } else if (newType === "Oggetto Pet") {
      const firstKey = formData.petItemKey || ITEMS_ORDER[0];
      const it = PET_ITEMS[firstKey];
      setFormData(prev => ({
        ...prev,
        type: newType,
        petItemKey: firstKey,
        petRarity: "common",
        name: it?.name || "",
        description: it ? `${it.icon} ${it.desc}` : "",
        class: "Non comune",
        img: prev.img || (it ? emojiToDataUri(it.icon) : ""),
      }));
    } else if (newType === "Pacchetto Carte") {
      const rarity = formData.tcgPackRarity || "epic";
      const element = formData.tcgPackElement || "fire";
      setFormData(prev => ({
        ...prev,
        type: newType,
        tcgPackRarity: rarity,
        tcgPackElement: element,
        tcgCardId: "",
        name: `Pacchetto ${TCG_PACK_RARITY_LABEL[rarity]} · ${TCG_ELEMENT_LABEL[element]}`,
        description: TCG_PACK_FLAVOR(rarity, element),
        class: TCG_PACK_MARKET_RARITY[rarity],
        img: prev.img || emojiToDataUri(TCG_ELEMENT_ICON[element]),
      }));
    } else if (newType === "Carta TCG") {
      const cardId = formData.tcgCardId || TCG_EPIC_LEGENDARY_CARDS[0]?.id || "";
      const card = TCG_CARDS[cardId];
      setFormData(prev => ({
        ...prev,
        type: newType,
        tcgCardId: cardId,
        tcgPackRarity: "epic",
        name: card?.name || "",
        description: card
          ? `${TCG_ELEMENT_ICON[card.element]} ${card.name} — ${card.flavor || ""}`
          : "",
        class: card ? TCG_CARD_MARKET_RARITY[card.rarity] : "Molto rara",
        img: card?.image || prev.img || "",
      }));
    } else {
      setFormData(prev => ({ ...prev, type: newType }));
    }
  };

  const handleEggRarityChange = (rarity) => {
    setFormData(prev => ({
      ...prev,
      petRarity: rarity,
      name: `Uovo ${RARITY_LABEL[rarity]}`,
      description: EGG_FLAVOR[rarity],
      class: EGG_MARKET_RARITY[rarity],
      img: emojiToDataUri(EGG_ICON[rarity] || "🥚"),
    }));
  };

  const handlePetItemKeyChange = (itemKey) => {
    const it = PET_ITEMS[itemKey];
    if (!it) return;
    setFormData(prev => ({
      ...prev,
      petItemKey: itemKey,
      name: it.name,
      description: `${it.icon} ${it.desc}`,
      class: "Non comune",
      img: emojiToDataUri(it.icon),
    }));
  };

  const handleTcgPackChange = (next) => {
    setFormData(prev => {
      const rarity = next.rarity ?? prev.tcgPackRarity;
      const element = next.element ?? prev.tcgPackElement;
      return {
        ...prev,
        tcgPackRarity: rarity,
        tcgPackElement: element,
        name: `Pacchetto ${TCG_PACK_RARITY_LABEL[rarity]} · ${TCG_ELEMENT_LABEL[element]}`,
        description: TCG_PACK_FLAVOR(rarity, element),
        class: TCG_PACK_MARKET_RARITY[rarity],
        img: emojiToDataUri(TCG_ELEMENT_ICON[element]),
      };
    });
  };

  const handleTcgCardIdChange = (cardId) => {
    const card = TCG_CARDS[cardId];
    if (!card) return;
    setFormData(prev => ({
      ...prev,
      tcgCardId: cardId,
      name: card.name,
      description: `${TCG_ELEMENT_ICON[card.element]} ${card.name} — ${card.flavor || ""}`,
      class: TCG_CARD_MARKET_RARITY[card.rarity] || "Molto rara",
      img: card.image || prev.img,
    }));
  };

  // ── Helpers per il set tematico ──
  const handleToggleSet = (checked) => {
    setFormData(prev => ({
      ...prev,
      inSet: checked,
      // alla prima attivazione semino una soglia 2/N vuota così l'admin vede subito la struttura
      setBonuses: checked && prev.setBonuses.length === 0
        ? [{ pieces: 2, effect: "" }]
        : prev.setBonuses,
    }));
  };

  const handleSetBonusChange = (index, field, value) => {
    setFormData(prev => {
      const next = prev.setBonuses.map((b, i) =>
        i === index ? { ...b, [field]: field === "pieces" ? Number(value) || 0 : value } : b
      );
      return { ...prev, setBonuses: next };
    });
  };

  const handleAddSetBonus = () => {
    setFormData(prev => {
      // suggerisco "pieces" del nuovo bonus = max+1, limitato dalla setSize
      const used = prev.setBonuses.map(b => Number(b.pieces) || 0);
      const next = Math.min(prev.setSize || 5, (used.length ? Math.max(...used) : 1) + 1);
      return { ...prev, setBonuses: [...prev.setBonuses, { pieces: next, effect: "" }] };
    });
  };

  const handleRemoveSetBonus = (index) => {
    setFormData(prev => ({
      ...prev,
      setBonuses: prev.setBonuses.filter((_, i) => i !== index),
    }));
  };

  // ── Helpers per i dati Foundry ──
  const setFoundry = (k, v) => setFormData(prev => ({ ...prev, foundry: { ...prev.foundry, [k]: v } }));
  const toggleFoundryProp = (p) => setFormData(prev => {
    const props = prev.foundry?.properties || [];
    return { ...prev, foundry: { ...prev.foundry, properties: props.includes(p) ? props.filter(x => x !== p) : [...props, p] } };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;
    const isPetType = formData.type === "Uovo Pet" || formData.type === "Oggetto Pet";
    const isTcgType = formData.type === "Pacchetto Carte" || formData.type === "Carta TCG";
    if (!isPetType && !isTcgType && !formData.img) {
      alert("Carica un'immagine prima di salvare l'oggetto.");
      return;
    }
    setLoading(true);
    const dataToSubmit = {
      ...formData,
      saleType: "auction",
      startingBid: Number(formData.startingBid || 0)
    };

    /* Attach a petPayload so the buyer-delivery flow knows what to give
       (an egg of a specific rarity vs. a specific consumable item). */
    if (formData.type === "Uovo Pet" && formData.petRarity) {
      dataToSubmit.petPayload = { kind: "egg", rarity: formData.petRarity };
    } else if (formData.type === "Oggetto Pet" && formData.petItemKey) {
      dataToSubmit.petPayload = { kind: "petItem", itemKey: formData.petItemKey };
    } else {
      // Clean stray field when editing back from a pet listing to a standard one
      dataToSubmit.petPayload = null;
    }

    /* Same idea for TCG lots: packs carry rarity+element, single cards
       carry the card id. The delivery flow reads tcgPayload to know
       what to drop into the winner's TCG inventory. */
    if (formData.type === "Pacchetto Carte") {
      dataToSubmit.tcgPayload = {
        kind: "cardPack",
        rarity: formData.tcgPackRarity,
        element: formData.tcgPackElement,
      };
    } else if (formData.type === "Carta TCG" && formData.tcgCardId) {
      dataToSubmit.tcgPayload = {
        kind: "tcgCard",
        cardId: formData.tcgCardId,
      };
    } else {
      dataToSubmit.tcgPayload = null;
    }

    // Set payload — costruito solo se l'oggetto è marcato come parte di un set
    if (formData.inSet && formData.setName.trim()) {
      const size = Math.max(2, Number(formData.setSize) || 0);
      const bonuses = (formData.setBonuses || [])
        .map(b => ({
          pieces: Math.max(1, Math.min(size, Number(b.pieces) || 0)),
          effect: String(b.effect || "").trim(),
        }))
        .filter(b => b.effect && b.pieces >= 1)
        .sort((a, b) => a.pieces - b.pieces);
      dataToSubmit.setPayload = {
        name: formData.setName.trim(),
        size,
        bonuses,
      };
    } else {
      dataToSubmit.setPayload = null;
    }

    // Strip transient form-only fields
    delete dataToSubmit.petRarity;
    delete dataToSubmit.petItemKey;
    delete dataToSubmit.tcgPackRarity;
    delete dataToSubmit.tcgPackElement;
    delete dataToSubmit.tcgCardId;
    delete dataToSubmit.inSet;
    delete dataToSubmit.setName;
    delete dataToSubmit.setSize;
    delete dataToSubmit.setBonuses;

    if (editId) {
      await updateDoc(doc(db, "items", editId), dataToSubmit);
      setEditId(null);
    } else {
      await setDoc(doc(collection(db, "items")), createMarketItem(dataToSubmit));
    }
    setFormData(initialFormData);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter(i => !i.isSold && (!i.endDate || new Date(i.endDate) > new Date())).length;
    const sold = items.filter(i => i.isSold).length;
    const expired = items.filter(i => !i.isSold && i.endDate && new Date(i.endDate) <= new Date()).length;
    const bids = items.reduce((s, i) => s + (i.bids ? Object.keys(i.bids).length : 0), 0);
    return { total, active, sold, expired, bids };
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const searchActive = q.length >= 3;
    const dq = descSearchQuery.trim().toLowerCase();
    const descSearchActive = dq.length >= 3;
    // Strip HTML tags ed entità basilari prima del match testuale sulla descrizione.
    const stripHtml = (s) => String(s || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();
    const filtered = items.filter(i => {
      // filtro stato
      if (filter === "active" && !(!i.isSold && (!i.endDate || new Date(i.endDate) > new Date()))) return false;
      if (filter === "sold" && !i.isSold) return false;
      if (filter === "expired" && !(!i.isSold && i.endDate && new Date(i.endDate) <= new Date())) return false;
      // filtro rarità
      if (rarityFilter !== "all") {
        const rank = RARITY_RANK[i.class];
        if (rank !== RARITY_RANK[rarityFilter]) return false;
      }
      // filtro livello Ratto
      if (rattoFilter !== "all") {
        const lvl = Number(i.minLevel) || 0;
        if (lvl !== Number(rattoFilter)) return false;
      }
      // filtro set tematico
      if (setNameFilter !== "all") {
        const sName = String(i.setPayload?.name || "").trim();
        if (setNameFilter === "any" && !sName) return false;
        else if (setNameFilter === "none" && sName) return false;
        else if (setNameFilter !== "any" && setNameFilter !== "none" && sName !== setNameFilter) return false;
      }
      // ricerca per nome (attiva solo da 3+ caratteri)
      if (searchActive && !String(i.name || "").toLowerCase().includes(q)) return false;
      // ricerca nel testo della descrizione (attiva solo da 3+ caratteri, HTML strippato)
      if (descSearchActive && !stripHtml(i.description).includes(dq)) return false;
      return true;
    });

    if (sortBy === "none") return filtered;
    const priceOf = (i) => Number(i.startingBid ?? i.price ?? 0);
    const rankOf = (i) => RARITY_RANK[i.class] ?? -1;
    const rattoOf = (i) => Number(i.minLevel) || 0;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "rarity-desc": return rankOf(b) - rankOf(a);
        case "rarity-asc":  return rankOf(a) - rankOf(b);
        case "price-desc":  return priceOf(b) - priceOf(a);
        case "price-asc":   return priceOf(a) - priceOf(b);
        case "ratto-desc":  return rattoOf(b) - rattoOf(a);
        case "ratto-asc":   return rattoOf(a) - rattoOf(b);
        default: return 0;
      }
    });
    return sorted;
  }, [items, filter, rarityFilter, rattoFilter, setNameFilter, sortBy, searchQuery, descSearchQuery]);

  // Elenco dei set distinti presenti nel magazzino (ordinato alfabeticamente)
  const knownSets = useMemo(() => {
    const names = new Set();
    items.forEach(i => {
      const n = String(i.setPayload?.name || "").trim();
      if (n) names.add(n);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const previewRarityKey = (formData.class || "Comune").replace(/\s/g, "");
  const fdr = formData.foundry || EMPTY_FOUNDRY;
  const fType = resolveFoundryType({ type: formData.type, foundry: formData.foundry });

  if (!currentUser || !canAccessMarket(currentUser.email)) {
    return <p style={{ textAlign: "center", paddingTop: "100px" }}>Accesso negato.</p>;
  }

  return (
    <section className="adm mkadm" style={{ "--cine-accent": "#8a261c", "--cine-accent-2": "#c0392b" }}>
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      {/* ─── HERO STATS BAR ─── */}
      <div className="mkadm-hero">
        <div className="mkadm-hero-titles">
          <span className="adm-eyebrow">⚔ Sottosuolo · Gilda dei Ratti</span>
          <h1 className="mkadm-title">Forgia del Mercato Nero</h1>
          <p className="mkadm-subtitle">Solo aste alla cieca · Crea, modifica e gestisci il magazzino</p>
        </div>
        <div className="mkadm-stats">
          <div className="mkadm-stat"><span>Totale</span><strong>{stats.total}</strong></div>
          <div className="mkadm-stat active"><span>Attive</span><strong>{stats.active}</strong></div>
          <div className="mkadm-stat sold"><span>Vendute</span><strong>{stats.sold}</strong></div>
          <div className="mkadm-stat expired"><span>Scadute</span><strong>{stats.expired}</strong></div>
          <div className="mkadm-stat bids"><span>Offerte</span><strong>{stats.bids}</strong></div>
        </div>
      </div>

      {/* ─── MARKET OPENING CONFIG ─── */}
      <div className="mkadm-config">
        <div className="mkadm-config-icon">⏰</div>
        <div className="mkadm-config-body">
          <label className="mkadm-config-label">Prossima apertura mercato</label>
          <div className="mkadm-config-row">
            <DateTimePicker
              value={globalCountdown}
              onChange={setGlobalCountdown}
              presets="opening"
              placeholder="Seleziona apertura"
            />
            <button onClick={handleUpdateCountdown} className="mkadm-btn-save">Salva</button>
          </div>
          <div className="mkadm-config-row" style={{ marginTop: 12, alignItems: "center" }}>
            <span className={`mkadm-market-status ${marketIsOpen ? "open" : "closed"}`}>
              {marketIsOpen ? "🟢 Mercato APERTO" : "🔴 Mercato CHIUSO"}
            </span>
            <button
              onClick={handleToggleMarket}
              className={marketIsOpen ? "mkadm-btn-close" : "mkadm-btn-save"}
              title="Invia notifica push a tutti i giocatori"
            >
              {marketIsOpen ? "Chiudi mercato" : "Apri mercato"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── SCHEDE: Crea a mano · Genera con AI ─── */}
      <div className="mkadm-tabs" role="tablist" aria-label="Modalità di creazione oggetto">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "manual"}
          className={`mkadm-tab${activeTab === "manual" ? " is-active" : ""}`}
          onClick={() => setActiveTab("manual")}
        >
          ✍️ Crea a mano
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ai"}
          className={`mkadm-tab${activeTab === "ai" ? " is-active" : ""}`}
          onClick={() => setActiveTab("ai")}
        >
          ✨ Genera con AI
        </button>
      </div>

      {/* ─── EDITOR + LIVE PREVIEW ─── */}
      <div className="mkadm-workshop">
        {activeTab === "ai" && (
          <div className="mkadm-editor mkadm-ai">
            <div className="mkadm-editor-head">
              <h2>✨ Genera oggetto con l'AI</h2>
            </div>
            <p className="mkadm-ai-intro">
              Descrivi l'oggetto: l'AI ne <strong>disegna l'immagine</strong> e ne genera <strong>scheda e dati Foundry</strong>
              (nome, rarità, tipo, descrizione, danni/CA…), pronti per il fetch. Poi rivedi e salvi come un normale oggetto.
            </p>

            <div className="mkadm-field">
              <label>Descrivi l'oggetto (prompt)</label>
              <textarea
                className="admin-field-textarea"
                rows="4"
                placeholder="Es. Una spada lunga élfica intrisa di ghiaccio eterno, elsa d'argento con rune blu che pulsano di gelo…"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={!!aiBusy}
              />
            </div>

            <div className="mkadm-field-row">
              <div className="mkadm-field">
                <label>Rarità (facolt.)</label>
                <select className="admin-field-select" value={aiRarity} onChange={(e) => setAiRarity(e.target.value)} disabled={!!aiBusy}>
                  <option value="">Decide l'AI</option>
                  {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="mkadm-field">
                <label>Tipo (facolt.)</label>
                <select className="admin-field-select" value={aiType} onChange={(e) => setAiType(e.target.value)} disabled={!!aiBusy}>
                  <option value="">Decide l'AI</option>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="mkadm-field">
              <label>Stile immagine</label>
              <div className="mkadm-ai-styles">
                {AI_STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`mkadm-foundry-chip ${aiStyle === s.key ? "on" : ""}`}
                    onClick={() => setAiStyle(s.key)}
                    disabled={!!aiBusy}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="mkadm-btn-primary mkadm-ai-go"
              onClick={generateItemFromPrompt}
              disabled={!aiPrompt.trim() || !!aiBusy}
            >
              {aiBusy === "img" ? "🎨 Disegno l'immagine…" : aiBusy === "info" ? "⚒ Scrivo scheda e dati Foundry…" : "✨ Genera oggetto"}
            </button>
            {aiError && <p className="mkadm-gen-error">{aiError}</p>}
            <p className="mkadm-ai-note">
              Al termine passi automaticamente alla scheda <em>Crea a mano</em> con tutto compilato: controlla, ritocca e premi <strong>Crea oggetto</strong>.
            </p>
          </div>
        )}

        {activeTab === "manual" && (
        <div className="mkadm-editor">
          <div className="mkadm-editor-head">
            <h2>{editId ? "✎ Modifica oggetto" : "✨ Nuovo oggetto"}</h2>
            {editId && <span className="mkadm-edit-tag">Editing #{editId.slice(0, 6)}</span>}
          </div>

          <form onSubmit={handleSubmit} className="mkadm-form">
            <div className="mkadm-field">
              <div className="mkadm-label-row">
                <label>Nome oggetto</label>
                <button
                  type="button"
                  className="mkadm-gen-btn"
                  onClick={() => generaDaImmagine("nome")}
                  disabled={!formData.img || uploading || genBusy}
                  title={formData.img ? "Genera il nome dall'immagine" : "Carica prima un'immagine"}
                >
                  {genName ? "✦ Genero…" : "✦ Genera nome"}
                </button>
              </div>
              <input
                className="admin-field-input"
                placeholder="Es. Spada del Tramonto"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="mkadm-field-row">
              <div className="mkadm-field">
                <label>Rarità</label>
                <select
                  className="admin-field-select"
                  required
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                >
                  {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="mkadm-field">
                <label>Tipo</label>
                <select
                  className="admin-field-select"
                  required
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* ── Pet-payload sub-selector ── */}
            {formData.type === "Uovo Pet" && (
              <div className="mkadm-field">
                <label>Rarità dell'uovo (dal catalogo Pet)</label>
                <select
                  className="admin-field-select"
                  required
                  value={formData.petRarity}
                  onChange={(e) => handleEggRarityChange(e.target.value)}
                >
                  {ADMIN_EGG_RARITIES.map(r => (
                    <option key={r} value={r}>
                      {EGG_ICON[r] || "🥚"} Uovo {RARITY_LABEL[r]}
                    </option>
                  ))}
                </select>
                <p className="mkadm-price-hint" style={{ color: "#7c3aed", borderColor: "#a78bfa55" }}>
                  <span className="mkadm-price-hint-icon">🥚</span>
                  <span>
                    Verrà consegnato come <strong>uovo {RARITY_LABEL[formData.petRarity]}</strong> nello zaino del vincitore.
                  </span>
                </p>
              </div>
            )}
            {formData.type === "Oggetto Pet" && (
              <div className="mkadm-field">
                <label>Oggetto Pet (dal catalogo)</label>
                <select
                  className="admin-field-select"
                  required
                  value={formData.petItemKey}
                  onChange={(e) => handlePetItemKeyChange(e.target.value)}
                >
                  {ITEMS_ORDER.map(key => {
                    const it = PET_ITEMS[key];
                    if (!it) return null;
                    return (
                      <option key={key} value={key}>
                        {it.icon} {it.name}
                      </option>
                    );
                  })}
                </select>
                {formData.petItemKey && PET_ITEMS[formData.petItemKey] && (
                  <p className="mkadm-price-hint" style={{ color: "#0d9488", borderColor: "#5eead455" }}>
                    <span className="mkadm-price-hint-icon">{PET_ITEMS[formData.petItemKey].icon}</span>
                    <span>{PET_ITEMS[formData.petItemKey].desc}</span>
                  </p>
                )}
              </div>
            )}
            {formData.type === "Pacchetto Carte" && (
              <div className="mkadm-field-row">
                <div className="mkadm-field">
                  <label>Rarità del pacchetto</label>
                  <select
                    className="admin-field-select"
                    required
                    value={formData.tcgPackRarity}
                    onChange={(e) => handleTcgPackChange({ rarity: e.target.value })}
                  >
                    {TCG_PACK_RARITIES.map(r => (
                      <option key={r} value={r}>
                        {r === "legendary" ? "👑" : "💠"} {TCG_PACK_RARITY_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mkadm-field">
                  <label>Elemento</label>
                  <select
                    className="admin-field-select"
                    required
                    value={formData.tcgPackElement}
                    onChange={(e) => handleTcgPackChange({ element: e.target.value })}
                  >
                    {TCG_ELEMENTS.map(el => (
                      <option key={el} value={el}>
                        {TCG_ELEMENT_ICON[el]} {TCG_ELEMENT_LABEL[el]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mkadm-field" style={{ gridColumn: "1 / -1" }}>
                  <p className="mkadm-price-hint" style={{ color: "#6d28d9", borderColor: "#a78bfa55" }}>
                    <span className="mkadm-price-hint-icon">🎴</span>
                    <span>
                      {TCG_PACK_FLAVOR(formData.tcgPackRarity, formData.tcgPackElement)}
                    </span>
                  </p>
                </div>
              </div>
            )}
            {formData.type === "Carta TCG" && (
              <div className="mkadm-field">
                <label>Carta (solo epiche e leggendarie)</label>
                <select
                  className="admin-field-select"
                  required
                  value={formData.tcgCardId}
                  onChange={(e) => handleTcgCardIdChange(e.target.value)}
                >
                  <option value="" disabled>— Scegli una carta —</option>
                  {TCG_ELEMENTS.map(el => {
                    const cards = TCG_EPIC_LEGENDARY_CARDS.filter(c => c.element === el);
                    if (cards.length === 0) return null;
                    return (
                      <optgroup key={el} label={`${TCG_ELEMENT_ICON[el]} ${TCG_ELEMENT_LABEL[el]}`}>
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.rarity === "legendary" ? "👑" : "💠"} {c.name} · {c.rarity === "legendary" ? "Leggendario" : "Epico"}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {formData.tcgCardId && TCG_CARDS[formData.tcgCardId] && (
                  <p className="mkadm-price-hint" style={{ color: "#b45309", borderColor: "#fcd34d55" }}>
                    <span className="mkadm-price-hint-icon">
                      {TCG_ELEMENT_ICON[TCG_CARDS[formData.tcgCardId].element]}
                    </span>
                    <span>
                      <strong>{TCG_CARDS[formData.tcgCardId].name}</strong>
                      {" — "}
                      {TCG_CARDS[formData.tcgCardId].flavor || "Carta esclusiva del catalogo TCG."}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* ── SET tematico ── */}
            <div className="mkadm-field mkadm-set-toggle-field">
              <label className="mkadm-set-toggle">
                <input
                  type="checkbox"
                  checked={!!formData.inSet}
                  onChange={(e) => handleToggleSet(e.target.checked)}
                />
                <span>⛓ Questo oggetto fa parte di un set</span>
              </label>
            </div>

            {formData.inSet && (
              <div className="mkadm-set-box">
                <div className="mkadm-field-row">
                  <div className="mkadm-field">
                    <label>Nome del set</label>
                    <input
                      className="admin-field-input"
                      placeholder="Es. Set del Drago d'Oro"
                      value={formData.setName}
                      onChange={(e) => setFormData({ ...formData, setName: e.target.value })}
                    />
                  </div>
                  <div className="mkadm-field">
                    <label>Pezzi totali</label>
                    <input
                      className="admin-field-input"
                      type="number"
                      min="2"
                      max="20"
                      value={formData.setSize}
                      onChange={(e) => setFormData({ ...formData, setSize: Math.max(2, Number(e.target.value) || 0) })}
                    />
                  </div>
                </div>

                <div className="mkadm-field">
                  <label>Bonus per soglia</label>
                  {formData.setBonuses.length === 0 && (
                    <p className="mkadm-set-empty">Nessun bonus. Aggiungine uno con il pulsante qui sotto.</p>
                  )}
                  {formData.setBonuses.map((b, idx) => (
                    <div key={idx} className="mkadm-set-bonus-row">
                      <div className="mkadm-set-bonus-pieces">
                        <input
                          className="admin-field-input"
                          type="number"
                          min="1"
                          max={formData.setSize || 20}
                          value={b.pieces}
                          onChange={(e) => handleSetBonusChange(idx, "pieces", e.target.value)}
                          aria-label="Pezzi necessari"
                        />
                        <span className="mkadm-set-bonus-frac">/ {formData.setSize}</span>
                      </div>
                      <input
                        className="admin-field-input mkadm-set-bonus-effect"
                        type="text"
                        placeholder="Es. STR +1, Resistenza al fuoco, Immortalità…"
                        value={b.effect}
                        onChange={(e) => handleSetBonusChange(idx, "effect", e.target.value)}
                      />
                      <button
                        type="button"
                        className="mkadm-set-bonus-remove"
                        onClick={() => handleRemoveSetBonus(idx)}
                        title="Rimuovi bonus"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="mkadm-set-bonus-add"
                    onClick={handleAddSetBonus}
                  >
                    ＋ Aggiungi bonus
                  </button>
                </div>

                {formData.setName && formData.setBonuses.some(b => b.effect.trim()) && (
                  <p className="mkadm-price-hint" style={{ color: "#7c3aed", borderColor: "#a78bfa55" }}>
                    <span className="mkadm-price-hint-icon">⛓</span>
                    <span>
                      <strong>{formData.setName}</strong> ({formData.setSize} pezzi) ·{" "}
                      {[...formData.setBonuses]
                        .filter(b => b.effect.trim())
                        .sort((a, b) => a.pieces - b.pieces)
                        .map(b => `${b.pieces}/${formData.setSize} ${b.effect.trim()}`)
                        .join(" · ")}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="mkadm-field-row">
              <div className="mkadm-field">
                <label>Base d'asta (Corone)</label>
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="0"
                  required
                  value={formData.startingBid}
                  onChange={(e) => setFormData({ ...formData, startingBid: e.target.value })}
                />
                {(() => {
                  const range = formatRange(formData.class);
                  if (!range) return null;
                  const status = priceStatus(formData.startingBid, formData.class);
                  const tone = RARITY_PRICE[formData.class]?.color || "#888";
                  const icon = status === "ok" ? "✓" : status === "below" ? "↓" : status === "above" ? "↑" : "💡";
                  const label = status === "ok"     ? `${formData.class}: prezzo nel range`
                              : status === "below"  ? `Sotto il range ${formData.class.toLowerCase()}`
                              : status === "above"  ? `Sopra il range ${formData.class.toLowerCase()}`
                              : `Suggerito per ${formData.class}`;
                  return (
                    <div className="mkadm-price-hint" style={{ color: tone, borderColor: tone + "55" }}>
                      <span className="mkadm-price-hint-icon">{icon}</span>
                      <span>{label}: <strong>{range}</strong></span>
                    </div>
                  );
                })()}
              </div>
              <div className="mkadm-field">
                <label>Livello Ratto min</label>
                <input
                  className="admin-field-input"
                  type="number"
                  placeholder="0"
                  required
                  value={formData.minLevel}
                  onChange={(e) => setFormData({ ...formData, minLevel: e.target.value })}
                />
              </div>
            </div>

            <div className="mkadm-field">
              <label>Scadenza asta</label>
              <DateTimePicker
                value={formData.endDate}
                onChange={(v) => setFormData({ ...formData, endDate: v })}
                required
                presets="auction"
                placeholder="Quando scade l'asta?"
              />
            </div>

            <div className="mkadm-field">
              <label>Immagine</label>
              <div
                className={`mkadm-drop ${dragOver ? "drag" : ""} ${uploading ? "loading" : ""} ${formData.img ? "filled" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
                {uploading ? (
                  <div className="mkadm-drop-state">
                    <span className="mkadm-drop-spinner" />
                    <strong>Caricamento in corso…</strong>
                    <small>Attendi qualche istante</small>
                  </div>
                ) : formData.img ? (
                  <div className="mkadm-drop-preview">
                    <img src={formData.img} alt="" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                    <div className="mkadm-drop-overlay">
                      <span>📤 Cambia immagine</span>
                      <button type="button" className="mkadm-drop-clear" onClick={handleClearImage}>✕ Rimuovi</button>
                    </div>
                  </div>
                ) : (
                  <div className="mkadm-drop-state">
                    <span className="mkadm-drop-icon">📥</span>
                    <strong>Trascina qui un'immagine</strong>
                    <small>oppure clicca per selezionarla · max 5MB</small>
                  </div>
                )}
              </div>
              <input
                type="url"
                className="admin-field-input mkadm-img-url"
                placeholder="…oppure incolla un URL diretto"
                value={formData.img}
                onChange={(e) => setFormData({ ...formData, img: e.target.value })}
              />
            </div>

            <div className="mkadm-field">
              <div className="mkadm-label-row">
                <label>Descrizione (HTML consentito)</label>
                <div className="mkadm-gen-group">
                  <button
                    type="button"
                    className="mkadm-gen-btn"
                    onClick={() => generaDaImmagine("descrizione")}
                    disabled={!formData.img || uploading || genBusy}
                    title={formData.img ? "Genera la descrizione dall'immagine" : "Carica prima un'immagine"}
                  >
                    {genDesc ? "✦ Genero…" : "✦ Genera descrizione"}
                  </button>
                  <button
                    type="button"
                    className="mkadm-gen-btn mkadm-gen-btn-gdr"
                    onClick={() => generaDaImmagine("gdr")}
                    disabled={!formData.img || uploading || genBusy}
                    title={formData.img ? "Genera un oggetto simpatico, inutile in combattimento ma utile al GdR" : "Carica prima un'immagine"}
                  >
                    {genGdr ? "🎭 Genero…" : "🎭 Oggetto da GdR"}
                  </button>
                </div>
              </div>
              <HtmlToolbar textAreaRef={descRef} formData={formData} setFormData={setFormData} fieldName="description" />
              <textarea
                ref={descRef}
                className="admin-field-textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows="5"
              />
              {genError && <p className="mkadm-gen-error">{genError}</p>}
            </div>

            {/* ── DATI PER FOUNDRY (import in un clic) ── */}
            <details className="mkadm-foundry">
              <summary className="mkadm-foundry-summary">
                ⚒ Dati per Foundry <small>(facoltativi · per l'import diretto)</small>
              </summary>
              <div className="mkadm-foundry-body">
                <p className="mkadm-foundry-hint">
                  Compila qui i dati di combattimento <strong>una volta sola</strong>: l'oggetto si potrà importare
                  su Foundry in un clic dalla pagina <em>Crea Oggetto → Foundry</em>. I player non vedono questi campi.
                </p>

                <div className="mkadm-field-row">
                  <div className="mkadm-field">
                    <label>Tipo Foundry</label>
                    <select className="admin-field-select" value={fdr.foundryType}
                      onChange={(e) => setFoundry("foundryType", e.target.value)}>
                      <option value="">Automatico (da Tipo: {fType})</option>
                      {FOUNDRY_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="mkadm-field">
                    <label>Peso (lb)</label>
                    <input className="admin-field-input" type="number" value={fdr.weight}
                      onChange={(e) => setFoundry("weight", e.target.value)} placeholder="0" />
                  </div>
                  <div className="mkadm-field">
                    <label>Quantità</label>
                    <input className="admin-field-input" type="number" value={fdr.quantity}
                      onChange={(e) => setFoundry("quantity", e.target.value)} placeholder="1" />
                  </div>
                </div>

                {fType === "weapon" && (<>
                  <div className="mkadm-field-row">
                    <div className="mkadm-field">
                      <label>Tipo d'attacco</label>
                      <select className="admin-field-select" value={fdr.actionType}
                        onChange={(e) => setFoundry("actionType", e.target.value)}>
                        {FOUNDRY_ACTION_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="mkadm-field">
                      <label>Bonus al colpire (+x)</label>
                      <input className="admin-field-input" type="number" value={fdr.attackBonus}
                        onChange={(e) => setFoundry("attackBonus", e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className="mkadm-field-row">
                    <div className="mkadm-field">
                      <label>Danno (formula) *</label>
                      <input className="admin-field-input" value={fdr.damageFormula}
                        onChange={(e) => setFoundry("damageFormula", e.target.value)} placeholder="es. 1d8+1" />
                    </div>
                    <div className="mkadm-field">
                      <label>Tipo di danno</label>
                      <select className="admin-field-select" value={fdr.damageType}
                        onChange={(e) => setFoundry("damageType", e.target.value)}>
                        {FOUNDRY_DAMAGE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mkadm-field-row">
                    <div className="mkadm-field">
                      <label>Danno extra (facolt.)</label>
                      <input className="admin-field-input" value={fdr.damage2Formula}
                        onChange={(e) => setFoundry("damage2Formula", e.target.value)} placeholder="es. 1d6" />
                    </div>
                    <div className="mkadm-field">
                      <label>Tipo danno extra</label>
                      <select className="admin-field-select" value={fdr.damage2Type}
                        onChange={(e) => setFoundry("damage2Type", e.target.value)}>
                        <option value="">—</option>
                        {FOUNDRY_DAMAGE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mkadm-field">
                    <label>Formula versatile (a due mani)</label>
                    <input className="admin-field-input" value={fdr.versatileFormula}
                      onChange={(e) => setFoundry("versatileFormula", e.target.value)} placeholder="es. 1d10" />
                  </div>
                  <div className="mkadm-field">
                    <label>Proprietà</label>
                    <div className="mkadm-foundry-props">
                      {FOUNDRY_WEAPON_PROPS.map(p => (
                        <button type="button" key={p.v}
                          className={`mkadm-foundry-chip ${(fdr.properties || []).includes(p.v) ? "on" : ""}`}
                          onClick={() => toggleFoundryProp(p.v)}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="mkadm-foundry-check">
                    <input type="checkbox" checked={fdr.proficient !== false}
                      onChange={(e) => setFoundry("proficient", e.target.checked)} />
                    Competente con quest'arma
                  </label>
                </>)}

                {fType === "equipment" && (
                  <div className="mkadm-field-row">
                    <div className="mkadm-field">
                      <label>Tipo armatura</label>
                      <select className="admin-field-select" value={fdr.armorType}
                        onChange={(e) => setFoundry("armorType", e.target.value)}>
                        {FOUNDRY_ARMOR_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="mkadm-field">
                      <label>Valore CA</label>
                      <input className="admin-field-input" type="number" value={fdr.armorValue}
                        onChange={(e) => setFoundry("armorValue", e.target.value)} placeholder="es. 14" />
                    </div>
                  </div>
                )}

                {(fType === "weapon" || fType === "consumable") && (
                  <div className="mkadm-field-row">
                    <div className="mkadm-field">
                      <label>Tiro Salvezza (caratt.)</label>
                      <select className="admin-field-select" value={fdr.saveAbility}
                        onChange={(e) => setFoundry("saveAbility", e.target.value)}>
                        {FOUNDRY_ABILITIES.map(a => <option key={a} value={a}>{a ? a.toUpperCase() : "—"}</option>)}
                      </select>
                    </div>
                    <div className="mkadm-field">
                      <label>CD</label>
                      <input className="admin-field-input" type="number" value={fdr.saveDC}
                        onChange={(e) => setFoundry("saveDC", e.target.value)} placeholder="es. 15" />
                    </div>
                  </div>
                )}
              </div>
            </details>

            <div className="mkadm-form-actions">
              <button type="submit" disabled={loading || uploading} className="mkadm-btn-primary">
                {uploading ? "⏳ Upload in corso…" : editId ? "💾 Salva modifiche" : "🪄 Crea oggetto"}
              </button>
              {editId && (
                <button type="button" onClick={handleCancelEdit} className="mkadm-btn-secondary">
                  Annulla
                </button>
              )}
            </div>
          </form>
        </div>
        )}

        {/* LIVE PREVIEW */}
        <aside className="mkadm-preview">
          <div className="mkadm-preview-head">
            <span className="mkadm-preview-label">👁 Anteprima player</span>
            <span className="mkadm-preview-hint">Come apparirà nel mercato</span>
          </div>
          <div className={`mkadm-preview-card rarity-bg-${previewRarityKey}`}>
            <div className="mkadm-preview-img-wrap">
              {formData.img
                ? <img src={formData.img} alt="" className="mkadm-preview-img" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                : <div className="mkadm-preview-placeholder">🖼<small>Nessuna immagine</small></div>}
              <span className={`mkadm-preview-rarity rarity-${previewRarityKey}`}>{formData.class || "Comune"}</span>
            </div>
            <div className="mkadm-preview-body">
              <p className="mkadm-preview-type">{formData.type || "—"}</p>
              <h3 className="mkadm-preview-name">{formData.name || "Nome oggetto"}</h3>
              <p className="mkadm-preview-bid">
                Base d'asta: <strong>{formData.startingBid || 0} Corone</strong>
              </p>
              {formData.endDate && (
                <p className="mkadm-preview-deadline">
                  ⏳ Scade il {formatEndDate(formData.endDate)}
                </p>
              )}
              {formData.description && (
                <div
                  className="mkadm-preview-desc"
                  dangerouslySetInnerHTML={{ __html: formData.description }}
                />
              )}
              {formData.inSet && formData.setName.trim() && (
                <div className="mkadm-preview-set">
                  <div className="mkadm-preview-set-head">
                    ⛓ <strong>{formData.setName}</strong>
                    <small> · {formData.setSize} pezzi</small>
                  </div>
                  <ul className="mkadm-preview-set-list">
                    {[...formData.setBonuses]
                      .filter(b => b.effect.trim())
                      .sort((a, b) => a.pieces - b.pieces)
                      .map((b, i) => (
                        <li key={i}>
                          <span className="mkadm-preview-set-frac">{b.pieces}/{formData.setSize}</span>
                          <span>{b.effect}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ─── INVENTORY ─── */}
      <div className="mkadm-inventory">
        <div className="mkadm-inv-head">
          <h2>📦 Magazzino <small>({visibleItems.length}/{items.length})</small></h2>
          <div className="mkadm-search-wrap">
            <span className="mkadm-search-icon">🔍</span>
            <input
              type="search"
              className="mkadm-search-input"
              placeholder="Cerca per nome (min 3 caratteri)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cerca oggetto per nome"
            />
            {searchQuery && (
              <button
                type="button"
                className="mkadm-search-clear"
                onClick={() => setSearchQuery("")}
                title="Pulisci ricerca"
                aria-label="Pulisci ricerca"
              >
                ✕
              </button>
            )}
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
              <span className="mkadm-search-hint">Servono ancora {3 - searchQuery.trim().length} caratteri</span>
            )}
          </div>

          <div className="mkadm-search-wrap mkadm-search-desc-wrap">
            <span className="mkadm-search-icon">📝</span>
            <input
              type="search"
              className="mkadm-search-input"
              placeholder="Cerca nella descrizione (min 3 caratteri)…"
              value={descSearchQuery}
              onChange={(e) => setDescSearchQuery(e.target.value)}
              aria-label="Cerca testo nella descrizione"
            />
            {descSearchQuery && (
              <button
                type="button"
                className="mkadm-search-clear"
                onClick={() => setDescSearchQuery("")}
                title="Pulisci ricerca descrizione"
                aria-label="Pulisci ricerca descrizione"
              >
                ✕
              </button>
            )}
            {descSearchQuery.trim().length > 0 && descSearchQuery.trim().length < 3 && (
              <span className="mkadm-search-hint">Servono ancora {3 - descSearchQuery.trim().length} caratteri</span>
            )}
          </div>
          <div className="mkadm-filter-tabs">
            {[
              { k: "all", label: "Tutti" },
              { k: "active", label: "Attivi" },
              { k: "sold", label: "Venduti" },
              { k: "expired", label: "Scaduti" },
            ].map(t => (
              <button
                key={t.k}
                className={`mkadm-filter ${filter === t.k ? "on" : ""}`}
                onClick={() => setFilter(t.k)}
              >
                {t.label}
              </button>
            ))}
            <select
              className="mkadm-filter mkadm-filter-select"
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value)}
              title="Filtra per rarità"
            >
              <option value="all">Rarità: tutte</option>
              {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              className="mkadm-filter mkadm-filter-select"
              value={rattoFilter}
              onChange={(e) => setRattoFilter(e.target.value)}
              title="Filtra per livello Ratto minimo"
            >
              <option value="all">Lv Ratto: tutti</option>
              {RATTO_LEVELS_ADMIN.map(l => (
                <option key={l.lv} value={l.lv}>Lv {l.lv} · {l.name}</option>
              ))}
            </select>
            <select
              className="mkadm-filter mkadm-filter-select"
              value={setNameFilter}
              onChange={(e) => setSetNameFilter(e.target.value)}
              title="Filtra per set tematico"
            >
              <option value="all">Set: tutti</option>
              <option value="any">⛓ Solo oggetti in un set</option>
              <option value="none">Senza set</option>
              {knownSets.length > 0 && (
                <optgroup label="Set esistenti">
                  {knownSets.map(name => (
                    <option key={name} value={name}>⛓ {name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <select
              className="mkadm-filter mkadm-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              title="Ordina"
            >
              <option value="none">Ordina: predefinito</option>
              <option value="rarity-desc">Rarità ↓ (alta → bassa)</option>
              <option value="rarity-asc">Rarità ↑ (bassa → alta)</option>
              <option value="price-desc">Prezzo ↓ (alto → basso)</option>
              <option value="price-asc">Prezzo ↑ (basso → alto)</option>
              <option value="ratto-desc">Lv Ratto ↓ (alto → basso)</option>
              <option value="ratto-asc">Lv Ratto ↑ (basso → alto)</option>
            </select>
            <button
              type="button"
              className="mkadm-filter mkadm-filter--danger"
              onClick={handleDeleteAllItems}
              disabled={loading || items.length === 0}
              title="Elimina tutti gli oggetti del mercato"
            >
              🗑 Elimina tutto
            </button>
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <p className="mkadm-empty">Nessun oggetto in questa vista.</p>
        ) : (
          <div className="mkadm-inv-grid">
            {visibleItems.map(item => {
              const rk = (item.class || "Comune").replace(/\s/g, "");
              const tl = formatTimeLeft(item.endDate);
              const bidCount = item.bids ? Object.keys(item.bids).length : 0;
              const isExpired = !item.isSold && tl?.expired;
              return (
                <article key={item.id} className={`mkadm-inv-card rarity-bg-${rk} ${item.isSold ? "is-sold" : ""} ${isExpired ? "is-expired" : ""}`}>
                  <div className="mkadm-inv-thumb-wrap">
                    <img
                      src={item.img || "/assets/placeholder.jpg"}
                      alt={item.name}
                      className="mkadm-inv-thumb"
                    />
                    <span className={`mkadm-inv-rarity rarity-${rk}`}>{item.class || "Comune"}</span>
                    {item.isSold && <div className="mkadm-inv-badge sold">VENDUTO</div>}
                    {isExpired && <div className="mkadm-inv-badge expired">SCADUTA</div>}
                  </div>
                  <div className="mkadm-inv-body">
                    <h4 className="mkadm-inv-name" title={item.name}>{item.name}</h4>
                    <p className="mkadm-inv-type">{item.type}</p>
                    <div className="mkadm-inv-row">
                      <QuickPriceEdit item={item} disabled={item.isSold} />
                      {bidCount > 0 && <span className="mkadm-inv-bids">📢 {bidCount}</span>}
                    </div>
                    <div className="mkadm-inv-row">
                      <QuickRattoEdit item={item} disabled={item.isSold} />
                    </div>
                    {tl && !item.isSold && (
                      <p className={`mkadm-inv-timer ${tl.expired ? "expired" : ""}`}>
                        {tl.expired ? "⛔ Scaduta" : `⏳ ${tl.text}`}
                      </p>
                    )}
                  </div>
                  <div className="mkadm-inv-actions">
                    <button onClick={() => handleEditInit(item)} className="mkadm-icon-btn edit" title="Modifica">✎</button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="mkadm-icon-btn danger"
                      title="Elimina"
                    >
                      🗑
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
