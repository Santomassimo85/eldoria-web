// Config dei tre party del generatore sessioni DM (strumento privato master).
// Sorgente di verità per: selettore party, checkbox personaggi, seed Firestore.
// I personaggi sono quelli REALI (allineati a partyMembers.js), con AMEA senza
// Sylva e senza il Lupo (non fanno più parte del gruppo). Le storie dei party
// non si mescolano MAI: ogni query di sessione filtra per `id`/`party`.

export const PARTIES = [
  {
    id: "AMEA",
    name: "Gruppo AMEA",
    world: "Eldoria",
    characters: ["Garroth", "Tanagar", "Caius"],
    closingChronicle: "Cronache di Obia", // citazione di chiusura sessione
    color: "#c0392b",
    active: true,
  },
  {
    id: "LEAF",
    name: "Gruppo LEAF",
    world: "Nyxaris Aetherna / Exanthia",
    characters: ["Soran", "Zethir", "Aksel", "Dago"],
    closingChronicle: "Canti di Nyxaris",
    color: "#27ae60",
    active: false,
  },
  {
    id: "ENOX",
    name: "Gruppo ENOX",
    world: "Eldoria / Ezhkie",
    characters: ["Makenna", "Temistocle", "Alaric", "Lael"],
    closingChronicle: "Annali di Ezhkie",
    color: "#8e44ad",
    active: false,
  },
];

export const PARTY_IDS = PARTIES.map((p) => p.id);
export const partyById = (id) =>
  PARTIES.find((p) => p.id?.toLowerCase() === String(id || "").toLowerCase()) || null;
export const charactersOf = (id) => partyById(id)?.characters || [];

// Id documento deterministico per una sessione: es. ("AMEA", 20) -> "amea-20".
export const sessionDocId = (party, sessionNumber) =>
  `${String(party || "").toLowerCase()}-${sessionNumber}`;
