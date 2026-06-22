// src/data/agentsRegistry.js
// Registro dei "servitori" AI di Eldoria, mostrato ne "Il Concilio" (/agenti).
//
// Ogni voce descrive UN agente: cosa fa, di che tipo è e dove "vive".
// I dati dal vivo (ultimi log, statistiche, stato) vengono uniti a runtime
// dalla pagina Concilio leggendo `agent_logs`, `agent_stats` e `newsletters`.
//
// kind:
//   "autonomo"  → parte da solo a orario
//   "reattivo"  → agisce quando glielo chiedi
//   "strumento" → un colpo solo, nessuna autonomia
//   "sync"      → script che gira sul PC del master, non sul sito

export const AGENTS = [
  {
    id: "oracolo",
    nome: "Oracolo di Eldoria",
    sigillo: "🔮",
    kind: "reattivo",
    motore: "Gemini",
    file: "api/assistente.js",
    sommario: "La memoria vivente del mondo. Risponde alle domande dei giocatori.",
    cosaFa: "Gli scrivi in linguaggio naturale e lui consulta scheda, mercato, bacheca, riassunti, NPC, luoghi, arena e gruppo per risponderti. Può anche fare un'offerta all'asta o accettare una missione al posto tuo, ma solo dopo la tua conferma.",
    interagisci: { tipo: "chat", to: "/assistente", label: "Apri la chat" },
  },
  {
    id: "scriba",
    nome: "Lo Scriba",
    sigillo: "📜",
    kind: "autonomo",
    motore: "Claude + Gemini",
    file: "functions/index.js",
    sommario: "Il cronista del mondo. Scrive e illustra la gazzetta, da solo.",
    cosaFa: "A intervalli regolari raccoglie i fatti del mondo, scrive un numero del giornale con Claude, lo illustra con Gemini e manda l'anteprima al direttore (te) via mail. Parte ai giocatori solo quando approvi col bottone.",
    interagisci: { tipo: "scriba" }, // gestito dalla pagina (genera ora / on-off)
  },
  {
    id: "genera-npc",
    nome: "Forgiatore di Volti",
    sigillo: "🧙",
    kind: "strumento",
    motore: "Claude Haiku",
    file: "api/genera-npc.js",
    sommario: "Genera un NPC coerente dato un contesto.",
    cosaFa: "Dagli una situazione (\"una locandiera sospettosa a Tirrendale\") e crea un NPC completo: aspetto, personalità, voce, un segreto e uno statblock essenziale. Si usa dagli Strumenti DM.",
    interagisci: { tipo: "link", to: "/dm-admin/genera-npc", label: "Vai al generatore" },
  },
  {
    id: "dm-tools",
    nome: "Mente del Master",
    sigillo: "⚔️",
    kind: "strumento",
    motore: "Claude",
    file: "api/dm-tools.js",
    sommario: "Genera incontri, bottino e città su richiesta.",
    cosaFa: "Strumenti rapidi per il master: crea un incontro bilanciato, una tabella di loot o una città con la sua religione coerente al pantheon di Eldoria.",
    interagisci: { tipo: "link", to: "/dm-admin/strumenti", label: "Vai agli Strumenti DM" },
  },
  {
    id: "genera-immagine",
    nome: "Pennello Arcano",
    sigillo: "🖼️",
    kind: "strumento",
    motore: "Gemini",
    file: "api/genera-immagine.js",
    sommario: "Genera immagini da un prompt testuale.",
    cosaFa: "Trasforma una descrizione in un'illustrazione. È il motore che, fra l'altro, dà le immagini a Lo Scriba.",
    interagisci: null,
  },
  {
    id: "obsidian-sync",
    nome: "Amanuense d'Obsidian",
    sigillo: "🗂️",
    kind: "sync",
    motore: "Claude Haiku",
    file: "tools/obsidian-sync.mjs",
    sommario: "Copia il mondo dal database al tuo vault Obsidian.",
    cosaFa: "Gira sul tuo PC: legge Firestore e aggiorna le note in Obsidian (cartella _Auto/), generando riassunti \"In breve\" con Claude. Non tocca le note scritte a mano. Si avvia a mano dal terminale, non dal sito.",
    interagisci: { tipo: "info", testo: "Si lancia dal terminale sul tuo PC:  node tools/obsidian-sync.mjs" },
  },
];

export const KIND_META = {
  autonomo:  { label: "Autonomo",  c: "#7c1d12", bg: "#f3dcc4", desc: "parte da solo" },
  reattivo:  { label: "Reattivo",  c: "#1c5a4a", bg: "#d7ecd9", desc: "agisce su richiesta" },
  strumento: { label: "Strumento", c: "#7c560f", bg: "#f0e3c2", desc: "un colpo solo" },
  sync:      { label: "Sincronia", c: "#3a4a7c", bg: "#dce2f3", desc: "gira sul PC" },
};
