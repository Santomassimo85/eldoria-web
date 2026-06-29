import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { doc, collection, onSnapshot, updateDoc, setDoc, increment } from "firebase/firestore";
import "../styles/cinematic.css";
import "./ArenaMarket.css";
import AmbientFX from "../components/AmbientFX";
import CineToolbar from "../components/CineToolbar";
import useParallaxScroll from "../hooks/useParallaxScroll";
import { isHiddenChar } from "../data/hiddenPlayers";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/tanagar2.png";

const SHOP_ITEMS = [
  {
    key: "pozione_cura_media",
    name: "Pozione di Cura Media",
    description: "Ogni acquisto fornisce 10 cariche (10 pozioni): nel fight ciascuna cura 2d8 PF. Le cariche non usate in un fight restano disponibili.",
    icon: "💚",
    price: 3,
    field: "healingPotions",
    addAmount: 10,
    max: 90,
  },
  {
    key: "arma_plus1",
    name: "Arma +1",
    description: "+1 ai tiri per colpire e +1 ai danni con arma. Permanente.",
    icon: "⚔️",
    price: 6,
    field: "weaponBonus",
    max: 1,
  },
  {
    key: "armatura_plus1",
    name: "Armatura +1",
    description: "+1 alla Classe Armatura per tutta la durata del torneo.",
    icon: "🛡️",
    price: 6,
    field: "armorBonus",
    max: 1,
  },
  {
    key: "ranger_unique_pet",
    name: "Draghetto di Smeraldo (Ranger)",
    description: "Compagno unico: 2d6 danni auto-hit · 2 cariche. Disponibile come 4° pet nel loadout Ranger.",
    icon: "🐉",
    price: 150,
    field: "rangerUniquePet",
    max: 1,
  },
  {
    key: "monk_punch_d8",
    name: "Pugno Potenziato (Monaco)",
    description: "Sostituisce il Pugno del Monaco: infligge 3d4+DES invece di 2d4+DES. Permanente.",
    icon: "👊",
    price: 100,
    field: "monkPunchD8",
    max: 1,
  },
  {
    key: "bard_nota_dolente",
    name: "Nota Dolente (Bardo)",
    description: "Sblocca l'abilità Nota Dolente: 3d6 danni da fulmine + vantaggio al bardo per 2 turni · 2 cariche per fight. In combattimento è disponibile solo al Bardo.",
    icon: "⚡",
    price: 400,
    field: "bardNotaDolente",
    max: 1,
  },
  {
    key: "class_artificer",
    name: "Classe: Artefice",
    description: "Sblocca la classe Artefice (rifle, pistola, costrutti, Forgia Armatura). Visibile solo a chi l'ha acquistata.",
    icon: "⚙️",
    price: 200,
    field: "classArtificer",
    max: 1,
  },
];

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

const LEVEL_UP_KEY = "level_up_cost";
const LEVEL_UP_DEFAULT = 10;

// Livelli-ASI (punti caratteristica) — coerenti con Arena.jsx / Arena_class_progress.txt §2E.
const ASI_LEVELS_DEFAULT = [4, 8, 12, 16, 19];
const ASI_LEVELS_BY_CLASS = {
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue:   [4, 8, 10, 12, 16, 19],
};

// ── MANUALE: progressione di livello per classe (Lv 1→20) ────────────────────
// SOLO informativo: cosa sblocca ogni classe salendo di livello. Non è
// acquistabile né funzionale da qui — serve a far capire ai player cosa otterranno.
// 🎯 = punti caratteristica (ASI). Indice 0 = Lv 1.
const CLASS_PROGRESSION = {
  fighter: [
    "Secondo Respiro (cura) e Carica (2d6+FOR)",
    "Scatto d'Azione: un'azione extra nel turno",
    "Stile di Combattimento: Difesa / Duellante / Tiratore",
    "🎯 +2 punti caratteristica · Disarmare il nemico",
    "Attacco Extra: 2 attacchi per turno",
    "🎯 +2 punti caratteristica · Presenza Possente (ritira l'1 a colpire)",
    "Risolutezza: ritira un tiro salvezza fallito (1/fight)",
    "🎯 +2 punti caratteristica · più cariche alle abilità",
    "Indomito: la prima volta che cadi a 0 PF resti a 1 (1/fight)",
    "Secondo Stile di Combattimento",
    "Attacco Extra: 3 attacchi per turno",
    "🎯 +2 punti caratteristica · Critico Migliorato (critico con 19-20)",
    "Colpo Stordente: TS o il nemico salta un turno",
    "🎯 +2 punti caratteristica · Disarmare migliorato",
    "Critico Superiore: critico con 18-19-20",
    "🎯 +2 punti caratteristica",
    "Colpo d'Ascia Devastante: 6d6+FOR, ignora metà CA",
    "Sopravvissuto: ti curi a inizio turno sotto metà PF",
    "🎯 +2 punti caratteristica",
    "Attacco Extra: 4 attacchi per turno",
  ],
  barbarian: [
    "Furia (+danno per turni) e Attacco Poderoso",
    "Attacco Irruento: colpisci con vantaggio rischiando",
    "Furia Bestiale: più danno quanto più sei ferito",
    "🎯 +2 punti caratteristica · Furia +3 al danno",
    "Attacco Extra: 2 attacchi per turno · Turbine di Lame",
    "Resistenza Ferina: in Furia dimezzi i danni fisici",
    "Istinto Selvaggio: vantaggio all'iniziativa",
    "🎯 +2 punti caratteristica · +1 carica Turbine di Lame",
    "Furia +4 al danno · 5 cariche di Furia",
    "Urlo di Guerra: indebolisce i tiri del nemico",
    "Furia Implacabile: resti a 1 PF con un TS COS",
    "🎯 +2 punti caratteristica · più cariche",
    "Turbine di Lame: 3 colpi",
    "Caccia Spietata: +danno contro nemici sotto metà PF",
    "Furia Persistente: non scade finché ci sono nemici",
    "🎯 +2 punti caratteristica · Furia +6 al danno",
    "6 cariche di Furia · più cariche skill",
    "Forza Indomabile: ritiri i TS FOR/COS falliti",
    "🎯 +2 punti caratteristica · Attacco Poderoso 3d8",
    "Campione Primordiale: inizi già in Furia, +3 danno",
  ],
  monk: [
    "Carica di Pugni · 2 attacchi base",
    "Concentrazione (+danno) · Difesa senza armatura (+1 CA)",
    "Deviare Colpi: riduci il prossimo colpo subìto",
    "🎯 +2 punti caratteristica · Assorbire Danni",
    "Colpo Stordente (TS o salta turno) · Carica di Pugni 3 colpi",
    "Cura Ki · i pugni contano come magici",
    "Elusione: TS DES superato = nessun danno",
    "🎯 +2 punti caratteristica · +1 carica Concentrazione",
    "Carica di Pugni 4 colpi · +1 carica Cura Ki",
    "Purezza del Corpo: immune a veleno e sanguinamento",
    "Raffica Tempestosa: 3 attacchi a mani nude in un'azione",
    "🎯 +2 punti caratteristica · più cariche ki",
    "Lingua di Sole e Luna: i colpi ignorano le resistenze",
    "Anima di Diamante: ritiri un TS fallito a turno",
    "Cura Ki 2d8+SAG",
    "🎯 +2 punti caratteristica",
    "Palmo Tremante: 6d10 ritardati con TS COS",
    "Corpo Vuoto: invisibile e resistente per 1 turno (1/fight)",
    "🎯 +2 punti caratteristica · Raffica +1 colpo",
    "Perfezione Interiore: recuperi una carica ki a inizio turno",
  ],
  rogue: [
    "Attacco Furtivo (1d6) · 2 azioni base",
    "Furtività (vantaggio) · Azione Scaltra (azione extra)",
    "Triboli · Maestria (Inganno o Agilità)",
    "🎯 +2 punti caratteristica · Attacco Furtivo 2d6",
    "Schivata Prodigiosa: dimezzi un colpo a turno",
    "+1 carica Attacco Furtivo · seconda Maestria",
    "Elusione: TS DES superato = nessun danno",
    "🎯 +2 punti caratteristica · Attacco Furtivo 3d6",
    "Colpo Mortale: esecuzione sotto il 20% PF",
    "🎯 +2 punti caratteristica · Talento Affidabile",
    "Attacco Furtivo 4d6 · +1 carica Triboli",
    "🎯 +2 punti caratteristica · +1 carica Azione Scaltra",
    "Schivata Migliorata: schivi due volte a turno",
    "Veleno da Lama: +2d6 veleno per 3 colpi",
    "Sensi Acuti: non puoi essere colto di sorpresa né accecato",
    "🎯 +2 punti caratteristica · Attacco Furtivo 5d6",
    "+1 carica Colpo Mortale · soglia esecuzione 25% PF",
    "Elusività: i nemici non hanno mai vantaggio su di te",
    "🎯 +2 punti caratteristica · Attacco Furtivo 6d6",
    "Colpo di Fortuna: trasformi un mancato in critico (1/fight)",
  ],
  paladin: [
    "Smite Divino · Lay of Hands (cura dalla pozza)",
    "Incantesimi tier 1 · Stile di Combattimento",
    "Salute Divina (immune a malattia/veleno) · Giuramento",
    "🎯 +2 punti caratteristica · +1 carica Smite",
    "Attacco Extra: 2 attacchi · Incantesimi tier 2",
    "Aura di Protezione: +CAR ai tuoi tiri salvezza",
    "Aura del Giuramento",
    "🎯 +2 punti caratteristica · +1 carica Smite",
    "Incantesimi tier 3 · Smite Tremante (TS o salta turno)",
    "Aura di Coraggio: immune a paura e controllo mentale",
    "Smite Migliorato: +1d8 radiante a ogni colpo",
    "🎯 +2 punti caratteristica · Lay of Hands più grande",
    "Incantesimi tier 4",
    "Tocco Purificante: Lay of Hands rimuove un debuff",
    "Aure potenziate",
    "🎯 +2 punti caratteristica · più cariche",
    "Incantesimi tier 5",
    "Aure sempre attive",
    "🎯 +2 punti caratteristica · Smite 3d8",
    "Avatar del Giuramento: forma potenziata (1/fight)",
  ],
  ranger: [
    "Marchio del Cacciatore · Compagno Animale",
    "Incantesimi tier 1 · Stile di Combattimento",
    "Archetipo: Cacciatore o Maestro di Bestie",
    "🎯 +2 punti caratteristica · +1 carica Marchio",
    "Attacco Extra: 2 attacchi · Incantesimi tier 2",
    "+1 carica pet · Marchio dura più a lungo",
    "Difesa del Predatore: meno danni col bersaglio marchiato",
    "🎯 +2 punti caratteristica · +1 carica pet",
    "Incantesimi tier 3 · Raffica di Frecce",
    "Mimetismo: parti furtivo a inizio fight",
    "Marchio Furioso: bonus aumentato e si sposta da solo",
    "🎯 +2 punti caratteristica · +1 carica Raffica",
    "Incantesimi tier 4",
    "Svanire: non bersagliabile per 1 turno (1/fight)",
    "Pet Superiore: il compagno raddoppia i danni",
    "🎯 +2 punti caratteristica",
    "Incantesimi tier 5",
    "Sensi Ferini: immune ad accecamento e furtività nemica",
    "🎯 +2 punti caratteristica · Marchio +1d10",
    "Nemico Mortale: critico 19-20 e ignori metà CA sul marchiato",
  ],
  wizard: [
    "Incantesimi tier 1 · Recupero Arcano",
    "Tradizione Arcana: Evocazione / Abiurazione / Divinazione",
    "Incantesimi tier 2",
    "🎯 +2 punti caratteristica · +1 trucchetto",
    "Incantesimi tier 3 (Palla di Fuoco, Fulmine…)",
    "Bonus avanzato della tua scuola",
    "Incantesimi tier 4",
    "🎯 +2 punti caratteristica · +1 carica incantesimi",
    "Incantesimi tier 5",
    "Maestria Trucchetti: i trucchetti fanno più danno",
    "Incantesimi tier 6",
    "🎯 +2 punti caratteristica · +1 incantesimo noto",
    "Incantesimi tier 7",
    "Bonus finale della tua scuola",
    "Incantesimi tier 8",
    "🎯 +2 punti caratteristica",
    "Incantesimi tier 9 (Meteora, Parola del Potere…)",
    "Maestria Incantesimi: un incantesimo a costo zero",
    "🎯 +2 punti caratteristica · +1 incantesimo alto",
    "Firma Magica: 2 incantesimi a cariche illimitate",
  ],
  sorcerer: [
    "Incantesimi tier 1 · Stregoneria Innata · Fonte di Magia",
    "Origine: Draconica o Magia Selvaggia",
    "Incantesimi tier 2 · Metamagia: Spell Gemella",
    "🎯 +2 punti caratteristica · +1 trucchetto",
    "Incantesimi tier 3 · Metamagia: Spell Potenziata",
    "Bonus avanzato d'Origine",
    "Incantesimi tier 4",
    "🎯 +2 punti caratteristica · +1 carica Fonte di Magia",
    "Incantesimi tier 5",
    "Metamagia: Spell Rapida (lancio come bonus action)",
    "Incantesimi tier 6",
    "🎯 +2 punti caratteristica · +1 carica metamagia",
    "Incantesimi tier 7",
    "Bonus finale d'Origine",
    "Incantesimi tier 8",
    "🎯 +2 punti caratteristica",
    "Incantesimi tier 9",
    "Restauro Stregonesco: recuperi cariche col tempo",
    "🎯 +2 punti caratteristica · +1 incantesimo alto",
    "Restauro Arcano: inizi con cariche extra",
  ],
  warlock: [
    "Incantesimi tier 1 · Astuzia Magica · Patto Demoniaco",
    "Suppliche Occulte (a scelta)",
    "Dono del Patto: Lama / Tomo / Catena",
    "🎯 +2 punti caratteristica · +1 trucchetto",
    "Incantesimi tier 3 · (Patto della Lama) Attacco Extra",
    "Seconda Supplica",
    "Incantesimi tier 4",
    "🎯 +2 punti caratteristica · +1 carica Patto Demoniaco",
    "Incantesimi tier 5",
    "Terza Supplica",
    "Arcano Mistico: un incantesimo tier 6 (1/fight)",
    "🎯 +2 punti caratteristica · +1 carica demone",
    "Arcano Mistico: tier 7 (1/fight)",
    "Potere supremo del tuo Patto",
    "Arcano Mistico: tier 8 (1/fight)",
    "🎯 +2 punti caratteristica",
    "Arcano Mistico: tier 9 (1/fight)",
    "+1 carica Astuzia Magica",
    "🎯 +2 punti caratteristica · Patto Demoniaco potenziato",
    "Maestro Occulto: ricarichi tutti gli incantesimi bassi (1/fight)",
  ],
  cleric: [
    "Incantesimi tier 1 (cura, danno radiante/necrotico)",
    "Incanalare Divinità: Dominio Vita / Guerra / Morte",
    "Incantesimi tier 2",
    "🎯 +2 punti caratteristica · +1 trucchetto",
    "Incantesimi tier 3 · cure e danni potenziati",
    "Bonus di Dominio · +1 carica Incanalare",
    "Incantesimi tier 4",
    "🎯 +2 punti caratteristica · Colpo Divino (+1d8 radiante)",
    "Incantesimi tier 5",
    "Intervento Divino: effetto miracoloso casuale",
    "Incantesimi tier 6",
    "🎯 +2 punti caratteristica · +1 carica Incanalare",
    "Incantesimi tier 7",
    "Bonus finale di Dominio",
    "Incantesimi tier 8",
    "🎯 +2 punti caratteristica",
    "Incantesimi tier 9",
    "Incanalare Divinità a uso illimitato",
    "🎯 +2 punti caratteristica · +1 incantesimo alto",
    "Intervento Divino garantito (1/fight)",
  ],
  druid: [
    "Incantesimi tier 1",
    "Forma Selvatica · Circolo: Terra o Luna",
    "Incantesimi tier 2",
    "🎯 +2 punti caratteristica · Forma Selvatica migliorata",
    "Incantesimi tier 3",
    "Bonus di Circolo",
    "Incantesimi tier 4",
    "🎯 +2 punti caratteristica · +1 carica Forma Selvatica",
    "Incantesimi tier 5",
    "Anima Selvatica: immune a veleno/malattia",
    "Incantesimi tier 6",
    "🎯 +2 punti caratteristica · +1 carica incantesimi",
    "Incantesimi tier 7",
    "Bonus finale di Circolo",
    "Incantesimi tier 8",
    "🎯 +2 punti caratteristica",
    "Incantesimi tier 9",
    "Forma Selvatica a cariche illimitate",
    "🎯 +2 punti caratteristica · +1 incantesimo alto",
    "Arcidruido: Forma Selvatica gratis, trucchetti illimitati",
  ],
  bard: [
    "Ispirazione Bardica (cariche = CAR)",
    "Tuttofare: +1 a tutti i tiri",
    "Incantesimi tier 2 · Collegio: Sapienza / Valore / Spada",
    "🎯 +2 punti caratteristica · +1 carica Ispirazione",
    "Fonte d'Ispirazione (ricarica) · Incantesimi tier 3",
    "Bonus di Collegio · Nota Dolente (se sbloccata)",
    "Incantesimi tier 4",
    "🎯 +2 punti caratteristica · Ispirazione 1d8",
    "Incantesimi tier 5 · Canto del Riposo (cura)",
    "Magia Segreta: 2 incantesimi di altre classi · Ispirazione 1d10",
    "Incantesimi tier 6",
    "🎯 +2 punti caratteristica · +1 carica incantesimi",
    "Incantesimi tier 7",
    "Bonus finale di Collegio",
    "Incantesimi tier 8 · Ispirazione 1d12",
    "🎯 +2 punti caratteristica",
    "Incantesimi tier 9",
    "Più cariche di Magia Segreta",
    "🎯 +2 punti caratteristica · +1 incantesimo alto",
    "Ispirazione Superiore: cariche piene a ogni fight",
  ],
  artificer: [
    "Incantesimi tier 1 e trucchetti · Forgia Armatura",
    "Infusione: potenzia la tua arma",
    "Costrutto (golem/serpente) · Specialista: Alchimista / Artigliere / Battaglia",
    "🎯 +2 punti caratteristica · +1 carica Forgia Armatura",
    "Incantesimi tier 2 · Attacco Extra o +1 costrutto",
    "Bonus di specializzazione",
    "Spruzzo di Schegge: l'arma da fuoco colpisce ad area",
    "🎯 +2 punti caratteristica · +1 carica Infusione",
    "Incantesimi tier 3",
    "Maestro di Infusioni: 2 infusioni insieme",
    "Oggetto Mirabile: effetto a scelta (cura/scudo/danno)",
    "🎯 +2 punti caratteristica · +1 carica costrutto",
    "Incantesimi tier 4",
    "Bonus finale di specializzazione",
    "Costrutto Superiore: raddoppia i danni",
    "🎯 +2 punti caratteristica",
    "Incantesimi tier 5",
    "Genio Magico: 4 infusioni",
    "🎯 +2 punti caratteristica · +1 carica Oggetto Mirabile",
    "Soul of Artifice: il costrutto ti rialza a 1 PF (1/fight)",
  ],
};

export default function ArenaMarket() {
  useParallaxScroll();
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [arenaMeta, setArenaMeta] = useState(null);
  const [message, setMessage] = useState(null);
  const [customPrices, setCustomPrices] = useState({});
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

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "arena_config", "shop"), snap => {
      if (snap.exists()) setCustomPrices(snap.data().prices ?? {});
    });
    return () => unsub();
  }, []);

  const effectiveItems = SHOP_ITEMS.map(item => ({
    ...item,
    price: customPrices[item.key] ?? item.price,
  }));

  const levelUpCost = customPrices[LEVEL_UP_KEY] ?? LEVEL_UP_DEFAULT;
  const coins    = charData?.arenaCoins ?? 0;
  const buffs    = charData?.arenaBuffs ?? {};
  const classLvls = charData?.classLevels ?? {};

  // ── Ricerca: classi + potenziamenti ──
  const q = query.trim().toLowerCase();
  const ownedClasses = ARENA_CLASSES.filter(cls => !cls.hiddenUnlessOwned || (buffs[cls.hiddenUnlessOwned] ?? 0) > 0);
  const filteredClasses = ownedClasses.filter(cls => !q || cls.name.toLowerCase().includes(q));
  const filteredItems = effectiveItems.filter(it => !q || `${it.name} ${it.description}`.toLowerCase().includes(q));
  const showClasses = activeCat !== "items";
  const showItems   = activeCat !== "classes";
  const showInfo    = activeCat == null && q === "";
  const resultCount = (showClasses ? filteredClasses.length : 0) + (showItems ? filteredItems.length : 0);

  const showMsg = (text, type = "ok") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const buyItem = async (item) => {
    if (!currentUser || !charData) return;
    if (coins < item.price) { showMsg("Monete insufficienti.", "err"); return; }
    const currentVal = buffs[item.field] ?? 0;
    if (currentVal >= item.max) { showMsg("Hai già questo potenziamento al massimo.", "err"); return; }
    const updates = {
      arenaCoins: increment(-item.price),
      [`arenaBuffs.${item.field}`]: increment(item.addAmount ?? 1),
    };
    await updateDoc(doc(db, "characters", currentUser.uid), updates);
    showMsg(`Acquistato: ${item.name}!`);
  };

  const levelUpClass = async (cls) => {
    if (!currentUser || !charData) return;
    if (coins < levelUpCost) { showMsg("Monete Arena insufficienti.", "err"); return; }
    const currentLv = classLvls[cls.key] ?? 3;
    const newLv = currentLv + 1;
    await updateDoc(doc(db, "characters", currentUser.uid), {
      arenaCoins: increment(-levelUpCost),
      [`classLevels.${cls.key}`]: newLv,
    });
    // PF (+1 dado) e punti caratteristica si applicano alla creazione del PG nell'Arena.
    const asiLevels = ASI_LEVELS_BY_CLASS[cls.key] || ASI_LEVELS_DEFAULT;
    const gotAsi = asiLevels.includes(newLv);
    showMsg(`${cls.name} → Lv.${newLv}! +1 dado PF${gotAsi ? " · +2 punti caratteristica" : ""} (si applicano creando il PG nell'Arena)`);
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
          <p className="am-hero-tagline">Spendi le tue Monete Arena per potenziamenti esclusivi.</p>
          <dl className="am-hero-stats">
            <div><dt>Monete Arena</dt><dd>🪙 {coins}</dd></div>
          </dl>
        </div>
      </section>

      {/* ── RICERCA ── */}
      <CineToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Cerca una classe o un potenziamento…"
        chips={[{ key: "classes", label: "⚔ Classi" }, { key: "items", label: "🛡 Potenziamenti" }]}
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

      {/* ── CLASSI ARENA ── */}
      {showClasses && (
      <div className="am-classes-section">
        <h3 className="am-how-title">Classi Arena</h3>
        <p className="am-classes-sub">
          Ogni classe parte da <strong>Lv.3</strong> — salire di livello costa <strong>{levelUpCost} MA</strong>. Ogni livello sblocca, in base alla classe, <strong>incantesimi, abilità, passive e punti caratteristica</strong> (vedi il <strong>Manuale delle Classi</strong> più in basso), oltre a <strong>+1 dado PF (1d10)+COS</strong> al tiro dei Punti Vita in fase di creazione del PG. Ogni classe ha una progressione separata.
        </p>
        {filteredClasses.length === 0 ? (
          <p className="cine-empty">Nessuna classe corrisponde alla ricerca.</p>
        ) : (
        <div className="am-classes-grid">
          {filteredClasses.map(cls => {
            const lv = classLvls[cls.key] ?? 3;
            const canAfford = coins >= levelUpCost;
            return (
              <div key={cls.key} className={`am-class-card ${canAfford ? "am-class-card--affordable" : ""}`}>
                <div className="am-class-icon">{cls.icon}</div>
                <div className="am-class-name">{cls.name}</div>
                <div className="am-class-level">Lv. {lv}</div>
                <button
                  className="am-class-lvup-btn"
                  disabled={!canAfford}
                  onClick={() => levelUpClass(cls)}
                  title={canAfford ? `Sali a Lv.${lv + 1} (${levelUpCost} MA)` : "Monete insufficienti"}
                >
                  ▲ Lv. Up
                </button>
              </div>
            );
          })}
        </div>
        )}
      </div>
      )}

      {showInfo && (<>
      <div className="am-how am-class-manual">
        <h3 className="am-how-title">📖 Manuale delle Classi — Progressione (Lv 3→20)</h3>
        <p className="am-classes-sub" style={{ marginBottom: "10px" }}>
          Tutti i personaggi partono da <strong>Livello 3</strong>. Salire di livello sblocca, a seconda della classe,
          <strong> incantesimi di tier superiore, abilità attive, passive</strong> e <strong>punti caratteristica</strong>.
          Ogni classe ha la <strong>sua progressione separata</strong>: livelli e sblocchi di una classe non valgono per le altre.
        </p>
        <ul className="am-how-list" style={{ marginBottom: "12px" }}>
          <li>🎯 <strong>Punti caratteristica</strong>: ai livelli <strong>4, 8, 12, 16, 19</strong> ricevi <strong>+2 punti</strong> da assegnare (+2 a una caratteristica oppure +1 a due). Il <strong>Guerriero</strong> li riceve anche a 6 e 14, il <strong>Ladro</strong> anche a 10.</li>
          <li>📈 <strong>Bonus di competenza</strong>: +2 (Lv 1-4) · +3 (5-8) · +4 (9-12) · +5 (13-16) · +6 (17-20).</li>
          <li>✨ <strong>Incantesimi</strong>: i lanciatori sbloccano tier sempre più alti man mano che salgono.</li>
        </ul>
        <p className="am-manual-note">ℹ️ Le capacità ai livelli più alti vengono introdotte in modo graduale.</p>
        <div className="am-manual-classes">
          {ownedClasses.map(cls => (
            <details key={cls.key} className="am-manual-class">
              <summary className="am-manual-class-summary">
                <span className="am-manual-class-icon">{cls.icon}</span>
                <span className="am-manual-class-name">{cls.name}</span>
                <span className="am-manual-class-hint">Lv 1→20 ▾</span>
              </summary>
              <ol className="am-manual-levels">
                {(CLASS_PROGRESSION[cls.key] || []).map((txt, i) => {
                  const isAsi = txt.startsWith("🎯");
                  return (
                    <li key={i} className={`am-manual-level ${isAsi ? "am-manual-level--asi" : ""}`}>
                      <span className="am-manual-lv">Lv {i + 1}</span>
                      <span className="am-manual-lv-txt">{txt}</span>
                    </li>
                  );
                })}
              </ol>
            </details>
          ))}
        </div>
      </div>

      <div className="am-how">
        <h3 className="am-how-title">Come guadagnare Monete Arena</h3>
        <ul className="am-how-list">
          <li>🪙 <strong>+1 MA</strong> per aver partecipato a un torneo</li>
          <li>🪙 <strong>+2 MA</strong> per ogni round vinto</li>
          <li>🪙 <strong>+5 MA</strong> se vinci il torneo</li>
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
      {/* ── RUBRICA: Potenziamenti ── */}
      <div className="am-rubric">
        <span className="am-rubric-eyebrow">Armeria del Campione</span>
        <h2 className="am-rubric-title">Potenziamenti</h2>
        <p className="am-rubric-sub">Pozioni, armi e doni unici per dominare l'Arena.</p>
      </div>

      <div className="cine-wrap am-body">
      {filteredItems.length === 0 ? (
        <p className="cine-empty">Nessun potenziamento corrisponde alla ricerca.</p>
      ) : (
      <div className="am-grid">
        {filteredItems.map(item => {
          const owned = buffs[item.field] ?? 0;
          const maxed = owned >= item.max;
          const canAfford = coins >= item.price;
          return (
            <div key={item.key} className={`am-card ${maxed ? "am-card--maxed" : canAfford ? "am-card--affordable" : ""}`}>
              <div className="am-card-icon">{item.icon}</div>
              <div className="am-card-name">{item.name}</div>
              <div className="am-card-desc">{item.description}</div>
              <div className="am-card-price">
                <span className="am-coin-icon">🪙</span>
                <span>{item.price} MA</span>
              </div>
              {owned > 0 && (
                <div className="am-owned-badge">
                  {maxed ? "✔ Posseduto" : `Hai: ${owned}`}
                </div>
              )}
              <button
                className="am-buy-btn"
                onClick={() => buyItem(item)}
                disabled={maxed || !canAfford}
              >
                {maxed ? "Già acquistato" : !canAfford ? "Monete insufficienti" : "Acquista"}
              </button>
            </div>
          );
        })}
      </div>
      )}

      {isMaster && <MasterCoinPanel effectiveItems={effectiveItems} levelUpCost={levelUpCost} arenaMeta={arenaMeta} />}
      </div>
      </>)}
    </div>
  );
}

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

function MasterCoinPanel({ effectiveItems, levelUpCost, arenaMeta }) {
  const [allChars, setAllChars] = useState([]);
  const [editCoins, setEditCoins] = useState({});
  const [editPrices, setEditPrices] = useState({});
  const [editLevels, setEditLevels] = useState({});
  const [expanded, setExpanded] = useState({});
  const [tab, setTab] = useState("players");      // "players" | "prices"
  const [playerFilter, setPlayerFilter] = useState("");

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

  const savePrice = async (key) => {
    const val = parseInt(editPrices[key], 10);
    if (isNaN(val) || val < 0) return;
    await setDoc(doc(db, "arena_config", "shop"), { prices: { [key]: val } }, { merge: true });
    setEditPrices(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const saveClassLevel = async (uid, classKey) => {
    const inputKey = `${uid}_${classKey}`;
    const val = parseInt(editLevels[inputKey], 10);
    if (isNaN(val) || val < 3) return;
    await updateDoc(doc(db, "characters", uid), { [`classLevels.${classKey}`]: val });
    setEditLevels(prev => { const n = { ...prev }; delete n[inputKey]; return n; });
  };

  const levelDownClass = async (uid, cls) => {
    const char = allChars.find(c => c.uid === uid);
    if (!char) return;
    const currentLv = (char.classLevels ?? {})[cls.key] ?? 3;
    if (currentLv <= 3) return;
    // I PF e i punti caratteristica derivano dal livello in fase di creazione PG,
    // quindi basta abbassare il livello: niente più bonus piatto da scalare.
    await updateDoc(doc(db, "characters", uid), {
      [`classLevels.${cls.key}`]: currentLv - 1,
    });
  };

  const pf = playerFilter.trim().toLowerCase();
  const filteredChars = allChars.filter(ch => !pf || (ch.name || ch.uid).toLowerCase().includes(pf));

  return (
    <div className="am-master-panel">
      <h3 className="am-master-panel-title">🪙 Pannello Master</h3>

      {/* Schede: separa Giocatori e Prezzi per evitare lo scroll unico */}
      <div className="am-mp-tabs" role="tablist">
        <button
          role="tab"
          className={`am-mp-tab ${tab === "players" ? "am-mp-tab--active" : ""}`}
          onClick={() => setTab("players")}
        >👥 Giocatori <span className="am-mp-tab-count">{allChars.length}</span></button>
        <button
          role="tab"
          className={`am-mp-tab ${tab === "prices" ? "am-mp-tab--active" : ""}`}
          onClick={() => setTab("prices")}
        >💰 Prezzi</button>
      </div>

      {/* ── SCHEDA PREZZI ── */}
      {tab === "prices" && (
      <div className="am-mp-section am-price-editor">
        <p className="am-master-note">Prezzi oggetti e costo salita di livello.</p>

        <div className="am-price-row">
          <span className="am-price-icon">📈</span>
          <span className="am-price-name">Costo Lv. Up (tutte le classi)</span>
          <span className="am-price-current">{levelUpCost} MA</span>
          <input
            className="am-coin-input"
            type="number"
            min={0}
            placeholder="nuovo costo"
            value={editPrices[LEVEL_UP_KEY] ?? ""}
            onChange={e => setEditPrices(prev => ({ ...prev, [LEVEL_UP_KEY]: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") savePrice(LEVEL_UP_KEY); }}
          />
          <button className="am-coin-save" onClick={() => savePrice(LEVEL_UP_KEY)}>Salva</button>
        </div>

        {effectiveItems.map(item => (
          <div key={item.key} className="am-price-row">
            <span className="am-price-icon">{item.icon}</span>
            <span className="am-price-name">{item.name}</span>
            <span className="am-price-current">{item.price} MA</span>
            <input
              className="am-coin-input"
              type="number"
              min={0}
              placeholder="nuovo prezzo"
              value={editPrices[item.key] ?? ""}
              onChange={e => setEditPrices(prev => ({ ...prev, [item.key]: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") savePrice(item.key); }}
            />
            <button className="am-coin-save" onClick={() => savePrice(item.key)}>Salva</button>
          </div>
        ))}
      </div>
      )}

      {/* ── SCHEDA GIOCATORI ── */}
      {tab === "players" && (
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
        <div className="am-coin-list">
          {filteredChars.length === 0 ? (
            <p className="cine-empty" style={{ marginTop: 8 }}>Nessun giocatore trovato.</p>
          ) : filteredChars.map(ch => {
          const buffsData  = ch.arenaBuffs || {};
          const ownedItems = ITEM_FIELDS.filter(it => (buffsData[it.field] ?? 0) > 0);
          const classLvls  = ch.classLevels ?? {};
          const isOpen     = !!expanded[ch.uid];
          const cur        = ch.arenaCoins ?? 0;
          const preview    = parseCoinInput(editCoins[ch.uid], cur);
          const showPrev   = preview != null && preview !== cur;

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
                <button
                  className="am-coin-save am-btn-toggle"
                  onClick={() => setExpanded(prev => ({ ...prev, [ch.uid]: !isOpen }))}
                >
                  {isOpen ? "▲ Classi" : "▼ Classi"}
                </button>
              </div>

              {isOpen && (
                <div className="am-master-classes">
                  {ARENA_CLASSES.map(cls => {
                    const lv = classLvls[cls.key] ?? 3;
                    const inputKey = `${ch.uid}_${cls.key}`;
                    return (
                      <div key={cls.key} className="am-master-class-row">
                        <span className="am-master-class-label">{cls.icon} {cls.name}</span>
                        <span className="am-class-lv-badge">Lv. {lv}</span>
                        <button
                          className="am-coin-save am-lvdown-btn"
                          title={`Scendi a Lv.${lv - 1}`}
                          disabled={lv <= 3}
                          onClick={() => levelDownClass(ch.uid, cls)}
                        >−</button>
                        <input
                          className="am-coin-input am-coin-input--sm"
                          type="number"
                          min={3}
                          placeholder="lv"
                          value={editLevels[inputKey] ?? ""}
                          onChange={e => setEditLevels(prev => ({ ...prev, [inputKey]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") saveClassLevel(ch.uid, cls.key); }}
                        />
                        <button className="am-coin-save" onClick={() => saveClassLevel(ch.uid, cls.key)}>Salva</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {ownedItems.length > 0 && (
                <div className="am-owned-items">
                  {ownedItems.map(it => (
                    <button
                      key={it.field}
                      className="am-remove-item-btn"
                      title={`Rimuovi ${it.label}`}
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
      )}
    </div>
  );
}
