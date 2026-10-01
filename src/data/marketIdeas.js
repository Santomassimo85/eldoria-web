// Casualità per la generazione AI del Mercato Nero.
//
// Usato DA DUE LATI (niente import di Vite qui dentro, solo JS puro):
//  - client (MarketAdmin, tab "Genera con AI"): il bottone 🎲 compone un prompt a caso;
//  - server (api/genera-oggetto*.js): tira la FORMA del nome, i semi tematici e
//    l'elenco delle parole vietate, e controlla che il nome uscito le rispetti.
//
// Perché: lasciato libero, il modello ricade sempre sulle stesse parole
// "fantasy" (drago, rune, abisso, ombra, stelle…) e i nomi si somigliano tutti.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};

/* ─────────── oggetti base, per categoria del mercato ─────────── */
export const OGGETTI_BASE = {
  "Arma": [
    "falcetto", "frusta", "mazzafrusto", "balestra a mano", "ascia da lancio", "tirapugni", "stocco", "scimitarra",
    "martello da guerra", "picca", "arpione", "fionda", "pugnale a lama ondulata", "spadone", "lancia corta", "kukri",
    "ventaglio da guerra", "bastone ferrato", "falce", "mazza chiodata", "bolas", "arco corto", "tridente", "machete",
    "rapier", "coltello da macellaio", "uncino da abbordaggio", "scure da boscaiolo", "cerbottana", "mannaia",
    "spada corta", "giavellotto", "flagello", "piccone da minatore", "sciabola da cavalleria", "stiletto",
  ],
  "Armatura": [
    "brigantina", "corsetto di cuoio", "scudo rotondo", "pettorale", "gambali", "bracciali", "elmo a becco",
    "cotta a scaglie", "giaco imbottito", "spallacci", "scudo a torre", "mantello foderato di maglia", "camaglio",
    "gorgiera", "guanti d'arme", "armatura di piastre spaiate", "buckler", "corazza di cuoio bollito", "schinieri",
  ],
  "Accessori": [
    "anello", "collana", "spilla", "fibbia", "cintura", "guanto", "maschera", "orecchino", "bracciale", "medaglione",
    "ditale", "pipa", "monocolo", "cappello", "sciarpa", "stivali", "orologio da tasca", "rosario", "fermaglio per capelli",
    "sonaglio", "ventaglio", "occhiali affumicati", "borsello", "cavigliera", "bastone da passeggio", "guinzaglio",
  ],
  "Artefatto Magico": [
    "lanterna", "carillon", "specchio", "bussola", "clessidra", "campana", "teiera", "scacchiera", "mappa piegata",
    "candela", "chiave", "lucchetto", "statuetta", "maschera funebre", "fiasca", "dado", "mazzo di carte", "astrolabio",
    "uovo di pietra", "bambola di pezza", "violino", "flauto d'osso", "cornetto acustico", "gabbia per uccelli", "calamaio",
    "abaco", "bilancia", "sigillo", "ombrello", "tamburo", "lente", "metronomo", "cofanetto", "pettine",
  ],
  "Pozioni": [
    "pozione", "tintura", "elisir", "unguento", "sciroppo", "tonico", "olio", "infuso", "decotto", "sale da fiuto",
    "liquore", "balsamo", "fiala di nebbia", "polvere da sciogliere", "caramella", "brodo",
  ],
  "Pergamene": [
    "pergamena", "lettera sigillata", "spartito", "mappa", "ricetta", "contratto", "biglietto d'invito", "atto notarile",
    "ex libris", "pagina strappata", "lista della spesa", "testamento", "cartolina", "almanacco tascabile", "lettera d'amore",
  ],
  "Reagenti": [
    "fungo", "radice", "dente", "piuma", "squama di pesce", "corno", "resina", "seme", "polline", "cera", "lacrima rappresa",
    "artiglio", "conchiglia", "muschio", "fiore secco", "osso di seppia", "uovo", "pelliccia", "sale", "carbone", "miele",
  ],
  "Varie": [
    "cucchiaio", "padella", "sgabello", "secchio", "scopa", "corda", "lanterna cieca", "zufolo", "trottola", "salvadanaio",
    "attaccapanni", "cuscino", "coperta", "barattolo", "spazzola", "forbici", "ago da cucito", "gomitolo", "campanaccio",
    "mattarello", "annaffiatoio", "pallottoliere", "carrucola", "pentola", "tazza", "zoccolo", "remo", "cesto",
  ],
};
const CATEGORIE = Object.keys(OGGETTI_BASE);

/* ─────────── materiali, origini, motivi, stranezze, toni ─────────── */
export const MATERIALI = [
  "osso di balena", "vetro soffiato", "ottone verderame", "corallo rosso", "sughero", "porcellana crepata", "cera d'api",
  "ferro meteorico", "legno di ciliegio", "ambra", "carta pressata", "piombo", "stagno", "madreperla", "cuoio di rospo",
  "seta grezza", "giada", "rame martellato", "pietra pomice", "sale cristallizzato", "terracotta", "avorio ingiallito",
  "legno di salice", "bronzo annerito", "zinco", "lana cotta", "vimini", "argento ossidato", "ossa di pesce", "ardesia",
  "ferro battuto", "legno fossile", "cartapesta", "corno di montone", "peltro", "tela cerata", "quarzo fumé", "rame e smalto",
  "pelle di anguilla", "cristallo di sale nero", "legno di noce", "ghisa", "ottone lucidato", "lino", "selce", "cuoio borchiato",
];

export const ORIGINI = [
  "forgiato da un ordine di monache cartografe", "perso da un circo itinerante", "costruito da una gilda di orologiai",
  "appartenuto a un boia in pensione", "intrecciato da una strega delle paludi", "ripescato da un monastero sommerso",
  "venduto da un mercante di spezie che non tornò mai", "abbandonato da un esercito in rotta", "trovato nella stiva di una nave senza equipaggio",
  "tramandato da una dinastia di birrai", "inventato da un bambino prodigio", "curato per anni da un golem giardiniere",
  "vinto a carte da un contrabbandiere", "usato in un tribunale di villaggio", "rubato al tesoro di un vescovo",
  "fatto da un apprendista distratto", "regalo di nozze di due famiglie rivali", "scavato in una miniera di sale",
  "usato da un medico della peste", "custodito da un faro abbandonato", "fabbricato in un carcere", "trovato nella pancia di un pesce",
  "fatto per una regina bambina", "lasciato in pegno a una locanda", "nato da un incidente in una distilleria",
  "usato per anni da una compagnia di attori", "benedetto per sbaglio da un prete ubriaco", "costruito da un nano cieco",
  "appartenuto a un cacciatore di taglie gnomo", "dimenticato in un convento di clausura", "barattato con una mucca",
  "usato in un'asta truccata", "realizzato da una corporazione di tintori", "sopravvissuto a un incendio in biblioteca",
];

export const MOTIVI = [
  "maree", "api e miele", "funghi", "ruggine", "orologi e tempo", "sale", "specchi", "campane", "nebbia", "lumache", "falene",
  "debiti", "matrimoni", "febbre", "vento", "radici", "fuliggine", "inchiostro", "carte da gioco", "pioggia", "lutto", "risate",
  "fame", "sonno", "eco", "gelo", "temporali", "rospi", "anguille", "gatti", "cervi", "ragni", "polpi", "lupi", "cavalli", "gufi",
  "cicale", "formiche", "pane", "vino", "cenere", "pietre di fiume", "neve sporca", "lanterne", "danza", "musica stonata",
  "giuramenti", "bugie", "nostalgia", "gelosia", "ricordi", "fortuna", "malattia", "guarigione", "ruote", "chiavi", "nodi",
  "conigli", "corvi", "serpenti d'acqua", "granchi", "lucciole", "pesci rossi", "volpi", "cinghiali", "capre", "oche",
  "spine", "petali", "muffa", "fumo", "olio", "pozzanghere", "fulmini", "mercati", "monete", "soglie e porte", "scale",
];

export const STRANEZZE = [
  "canticchia piano quando qualcuno mente", "è sempre tiepido al tatto", "profuma di pane appena sfornato", "si lamenta se viene appoggiato",
  "cambia colore con l'umore di chi lo porta", "attira tutti i gatti nel raggio di cento passi", "gocciola acqua salata senza motivo",
  "ticchetta come un orologio", "fa starnutire chi lo guarda troppo a lungo", "di notte si sposta di qualche centimetro",
  "ha un piccolo morso su un lato", "porta inciso un nome cancellato", "suona come una campanella quando piove",
  "è più pesante il martedì", "lascia impronte di fuliggine", "non si riflette negli specchi", "ha un odore di stalla persistente",
  "sussulta quando qualcuno lo nomina", "sembra sempre appena lucidato", "ha una crepa che si allarga e si richiude",
  "brontola sottovoce in una lingua sconosciuta", "si scalda vicino all'oro", "macchia d'inchiostro le dita", "non sta mai dritto",
];

export const TONI = [
  "elegante", "rozzo e popolare", "sinistro", "buffo", "sacro", "militare", "decadente", "rustico", "nobile", "bizzarro",
  "malinconico", "festoso", "funebre", "marinaresco", "contadino", "burocratico", "sfarzoso", "povero e rattoppato",
];

/* ─────────── forme del nome (tirata a sorte a ogni generazione) ─────────── */
export const FORME_NOME = [
  { k: "proprio",   t: "un NOME PROPRIO dell'oggetto, come le armi delle leggende, una o due parole inventate o rare", es: "Vespertina · Mordisale · Gaia Lenta" },
  { k: "persona",   t: "l'oggetto + \"di\" + il nome e cognome di una persona INVENTATA (artigiano, proprietario, vittima)", es: "Il Liuto di Orsola Brena · Fiasca di Mastro Tebaldo Ruso" },
  { k: "soprannome",t: "un SOPRANNOME POPOLARE dato dai bassifondi, colloquiale e un po' sguaiato", es: "La Vecchia Tossica · Piangimiele · Quella del Pescivendolo" },
  { k: "catalogo",  t: "un nome da CATALOGO di bottega, tecnico, con modello o marchio inventato", es: "Lanterna a Tre Stoppini, modello Varrin · Balestra Corta n. 7 dei Fratelli Oda" },
  { k: "quotidiano",t: "oggetto + complemento CONCRETO e quotidiano (mestieri, cibi, luoghi comuni, persone comuni)", es: "Mantello del Pescatore Annegato · Guanto della Lavandaia" },
  { k: "composto",  t: "UNA SOLA parola composta verbo+nome, all'italiana", es: "Spezzaonde · Cantaruggine · Ruballume" },
  { k: "cerimonia", t: "un TITOLO LUNGO e cerimoniale, 4-6 parole", es: "Ultima Promessa della Badessa Grigia" },
  { k: "lingua",    t: "una parola in una LINGUA ANTICA inventata + un epiteto in italiano", es: "Ysmeret, la Paziente · Kaddu il Sordo" },
  { k: "ironico",   t: "un nome IRONICO o autoironico, che fa sorridere", es: "Spada Abbastanza Buona · Il Pugnale del Lunedì" },
  { k: "evento",    t: "il nome di un EVENTO in cui l'oggetto ebbe un ruolo", es: "Corona della Notte dei Cento Debiti · Il Cucchiaio dell'Assedio di Marzo" },
  { k: "secco",     t: "una sola parola breve e secca, un sostantivo comune usato come nome", es: "Rovo · Stoppino · Grandine" },
  { k: "aggettivo", t: "oggetto + un aggettivo INUSUALE e concreto (non epico)", es: "Guanto Insonne · Bilancia Bugiarda · Elmo Raffreddato" },
  { k: "luogo",     t: "l'oggetto + il nome di un luogo minore INVENTATO (un vicolo, un ponte, una fattoria, un pozzo)", es: "Scure del Ponte Storto · Anello del Vicolo dei Tintori" },
  { k: "animale",   t: "un nome legato a un animale COMUNE e non epico (niente creature leggendarie)", es: "Il Rospo d'Ottone · Morso di Cinghiale · Piuma d'Oca Matta" },
];

/* ─────────── parole vietate ─────────── */
// Radici abusate: valgono SEMPRE, salvo che il Master le scriva nel prompt.
const RADICI_ABUSATE = [
  { re: /^dra(g|c)/, label: "drago/draghi/draconico" },
  { re: /^run(a|e|i|ic|at)/, label: "rune/runato/runico" },
  { re: /^abiss/, label: "abisso" },
  { re: /^vuot/, label: "vuoto" },
  { re: /^etern/, label: "eterno" },
  { re: /^ombr(a|e|os)(?!ll)/, label: "ombra" },
  { re: /^sussurr/, label: "sussurro" },
  { re: /^stell/, label: "stelle/stellare" },
  { re: /^cristall/, label: "cristallo" },
  { re: /^galatt/, label: "galattico" },
  { re: /^sangu/, label: "sangue" },
  { re: /^anim(a|e)$/, label: "anima" },
  { re: /^oscur/, label: "oscuro" },
  { re: /^tenebr/, label: "tenebre" },
  { re: /^arcan/, label: "arcano" },
  { re: /^antic/, label: "antico" },
  { re: /^ossidian/, label: "ossidiana" },
  { re: /^fenic/, label: "fenice" },
  { re: /^void|^shadow|^dragon|^rune/, label: "parole inglesi" },
];

const STOP = new Set([
  "del", "della", "dello", "dei", "degli", "delle", "di", "da", "dal", "dalla", "con", "per", "tra", "fra", "il", "lo", "la",
  "le", "gli", "un", "una", "uno", "e", "ed", "o", "al", "alla", "allo", "ai", "agli", "alle", "nel", "nella", "sul", "sulla",
  "che", "non", "piu", "set", "the", "of",
]);

export const normWord = (w) => String(w || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z]/g, "");

const tokens = (s) => String(s || "").split(/[\s'’\-,.;:!?()"«»]+/).map(normWord).filter((w) => w.length >= 3 && !STOP.has(w));

// I nomi degli oggetti base non si vietano mai (se serve un elmo, è un elmo).
const BASE_WORDS = new Set(Object.values(OGGETTI_BASE).flat().flatMap(tokens));

/**
 * Parole da evitare per QUESTA generazione.
 * @param nomiEsistenti nomi già nel mercato/registro
 * @param prompt        richiesta del Master: le parole che scrive lui sono sempre permesse
 * @returns {{ radici: Array<{re,label}>, ripetute: string[], recenti: string[] }}
 */
export function paroleVietate(nomiEsistenti = [], prompt = "") {
  const nelPrompt = new Set(tokens(prompt));
  const promptHas = (re) => [...nelPrompt].some((w) => re.test(w));
  const radici = RADICI_ABUSATE.filter((r) => !promptHas(r.re));

  // radice corta (prime 4 lettere) per contare insieme drago/draghi, corvo/corvi…
  const conta = new Map();
  for (const n of nomiEsistenti) {
    const visti = new Set();
    for (const w of tokens(n)) {
      if (BASE_WORDS.has(w) || w.length < 4) continue;
      const r = w.slice(0, 4);
      if (visti.has(r)) continue;
      visti.add(r);
      const c = conta.get(r) || { n: 0, w };
      c.n++; conta.set(r, c);
    }
  }
  const ripetute = [...conta.entries()]
    .filter(([r, c]) => c.n >= 2 && ![...nelPrompt].some((w) => w.startsWith(r)))
    .map(([, c]) => c.w);
  // tutte le parole "di tema" già usate almeno una volta: da evitare se possibile
  const recenti = [...new Set(nomiEsistenti.flatMap(tokens).filter((w) => !BASE_WORDS.has(w) && w.length >= 4))]
    .filter((w) => !nelPrompt.has(w))
    .slice(-60);
  return { radici, ripetute, recenti };
}

/** Il nome viola le parole vietate? Torna l'elenco delle parole colpevoli. */
export function violazioniNome(nome, vietate) {
  const ws = tokens(nome);
  const out = [];
  for (const w of ws) {
    const r = vietate.radici.find((x) => x.re.test(w));
    if (r) { out.push(w); continue; }
    if (vietate.ripetute.some((rip) => w.slice(0, 4) === rip.slice(0, 4))) out.push(w);
  }
  return [...new Set(out)];
}

/** Nome troppo simile a uno esistente (stessa parola di tema o stessa struttura)? */
export function troppoSimile(nome, nomiEsistenti = []) {
  const a = normWord(nome);
  return nomiEsistenti.some((n) => normWord(n) === a);
}

/** Dadi del nome: forma + lunghezza + due semi tematici di ispirazione. */
export function tiraDadiNome() {
  const forma = pick(FORME_NOME);
  return { forma, semi: pickN(MOTIVI, 2), tono: pick(TONI) };
}

/** Blocco di istruzioni sul nome da mettere nel prompt di Claude. */
export function istruzioniNome({ dadi, vietate, nomiEsistenti = [] }) {
  const righe = [
    `NOME — regole tirate ai dadi per QUESTO oggetto (rispettale):`,
    `- Forma del nome: ${dadi.forma.t}. Esempi della forma (NON copiarli): ${dadi.forma.es}.`,
    `- Se il prompt o l'immagine non suggeriscono altro, lasciati ispirare da: ${dadi.semi.join(" e ")}; tono ${dadi.tono}.`,
    `- VIETATE queste parole e le loro varianti: ${vietate.radici.map((r) => r.label).join(", ")}.`,
  ];
  if (vietate.ripetute.length) righe.push(`- VIETATE anche perché già abusate nel mercato: ${vietate.ripetute.join(", ")}.`);
  if (nomiEsistenti.length) righe.push(`- Nomi già in vendita (il tuo deve essere DIVERSO per parole, struttura e suono): ${nomiEsistenti.slice(-40).join(" · ")}.`);
  righe.push(`- Niente cliché da fantasy generico. Sorprendi.`);
  return righe.join("\n");
}

/* ─────────── 🎲 prompt casuale (client) ─────────── */
const RARITA_PESATE = [
  ["Comune", 3], ["Non comune", 4], ["Rara", 3], ["Molto rara", 2], ["Leggendaria", 1],
];
const pesato = (lista) => {
  const tot = lista.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * tot;
  for (const [v, w] of lista) { r -= w; if (r <= 0) return v; }
  return lista[0][0];
};

/**
 * Compone un'idea d'oggetto completamente a caso.
 * @param categoria opzionale: se assente la sceglie a caso
 * @returns {{ prompt: string, categoria: string, rarita: string }}
 */
export function ideaCasuale(categoria) {
  const cat = OGGETTI_BASE[categoria] ? categoria : pick(CATEGORIE);
  const base = pick(OGGETTI_BASE[cat]);
  const mat = pick(MATERIALI);
  // per le cose che non sono "fatte di" un materiale, il materiale va sul contenitore
  const conMateriale =
    cat === "Pozioni"   ? `${base} in una boccetta di ${mat}` :
    cat === "Reagenti"  ? `${base} custodito in un astuccio di ${mat}` :
    cat === "Pergamene" ? `${base} con sigillo e custodia di ${mat}` :
                          `${base} in ${mat}`;
  const parti = [
    conMateriale,
    pick(ORIGINI),
    `motivo ricorrente: ${pickN(MOTIVI, 2).join(" e ")}`,
    `stranezza: ${pick(STRANEZZE)}`,
    `aspetto ${pick(TONI)}`,
  ];
  const prompt = parti[0].charAt(0).toUpperCase() + parti[0].slice(1) + ", " + parti.slice(1).join("; ") + ".";
  return { prompt, categoria: cat, rarita: pesato(RARITA_PESATE) };
}
