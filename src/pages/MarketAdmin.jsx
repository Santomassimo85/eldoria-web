import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { db, storage } from "../firebase";
import "./admin.css";
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import HtmlToolbar from "../components/HtmlToolbar";
import DateTimePicker from "../components/DateTimePicker";
import { createMarketItem } from "../utils/itemTemplates";
import { PET_ITEMS, ITEMS_ORDER } from "../data/petItems";
import { EGG_ICON, RARITY_LABEL } from "../data/petSpecies";
import { TCG_CARDS, TCG_CARD_LIST } from "../data/tcgCards";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const RARITIES = ["Comune", "Non comune", "Rara", "Molto rara", "Leggendaria", "Artefatto"];
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
  air:  "💨", light: "✨", dark:  "🌑",
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
  return r.max == null ? `${r.min}+ MP` : `${r.min}–${r.max} MP`;
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
        <span className="mkadm-inv-price-suffix">MP {saving ? "…" : justSaved ? "✓" : ""}</span>
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

export default function MarketAdmin() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [globalCountdown, setGlobalCountdown] = useState("");
  const [marketIsOpen, setMarketIsOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const descRef = useRef(null);
  const fileInputRef = useRef(null);

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
    if (!currentUser || currentUser.email !== MASTER_EMAIL) return;
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

    // Strip transient form-only fields
    delete dataToSubmit.petRarity;
    delete dataToSubmit.petItemKey;
    delete dataToSubmit.tcgPackRarity;
    delete dataToSubmit.tcgPackElement;
    delete dataToSubmit.tcgCardId;

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
    return items.filter(i => {
      if (filter === "all") return true;
      if (filter === "active") return !i.isSold && (!i.endDate || new Date(i.endDate) > new Date());
      if (filter === "sold") return i.isSold;
      if (filter === "expired") return !i.isSold && i.endDate && new Date(i.endDate) <= new Date();
      return true;
    });
  }, [items, filter]);

  const previewRarityKey = (formData.class || "Comune").replace(/\s/g, "");

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return <p style={{ textAlign: "center", paddingTop: "100px" }}>Accesso negato.</p>;
  }

  return (
    <section className="admin-market-page mkadm">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard</Link>

      {/* ─── HERO STATS BAR ─── */}
      <div className="mkadm-hero">
        <div className="mkadm-hero-titles">
          <h1 className="mkadm-title">⚔ Forgia del Mercato Nero</h1>
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

      {/* ─── EDITOR + LIVE PREVIEW ─── */}
      <div className="mkadm-workshop">
        <div className="mkadm-editor">
          <div className="mkadm-editor-head">
            <h2>{editId ? "✎ Modifica oggetto" : "✨ Nuovo oggetto"}</h2>
            {editId && <span className="mkadm-edit-tag">Editing #{editId.slice(0, 6)}</span>}
          </div>

          <form onSubmit={handleSubmit} className="mkadm-form">
            <div className="mkadm-field">
              <label>Nome oggetto</label>
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

            <div className="mkadm-field-row">
              <div className="mkadm-field">
                <label>Base d'asta (MP)</label>
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
              <label>Descrizione (HTML consentito)</label>
              <HtmlToolbar textAreaRef={descRef} formData={formData} setFormData={setFormData} fieldName="description" />
              <textarea
                ref={descRef}
                className="admin-field-textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows="5"
              />
            </div>

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
                Base d'asta: <strong>{formData.startingBid || 0} MP</strong>
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
            </div>
          </div>
        </aside>
      </div>

      {/* ─── INVENTORY ─── */}
      <div className="mkadm-inventory">
        <div className="mkadm-inv-head">
          <h2>📦 Magazzino <small>({visibleItems.length}/{items.length})</small></h2>
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
