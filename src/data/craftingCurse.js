// ── Maledizioni dell'1 naturale ──────────────────────────────────────────────
// Dal 2026-09-22 un 1 naturale all'Officina non brucia più il lavoro: l'oggetto
// esce comunque, ma alla rarità più bassa (Scarso) e con una MALEDIZIONE che
// vede SOLO il Master. Il giocatore ritira un pezzo venuto male e non sa che si
// porta dietro anche altro: se ne accorgerà al tavolo.
//
// La maledizione la inventa Gemini (`api/crafting-maledizione.js`) su misura
// per il tipo di oggetto e per l'impegno messo nel lavoro. Se l'endpoint non
// risponde — chiave mancante, rete giù, Gemini lento — si pesca da CURSE_TABLE
// qui sotto: il tiro non deve MAI fallire per colpa di una chiamata di rete.
//
// Forma della maledizione: { nome, effetto, meccanica, rivelazione, rimozione,
// gravita, fonte: "gemini" | "tabella" }.

import { TIER_ORDER, normTier } from "./crafting";

// Quanto morde: dipende dall'impegno. Chi punta in alto e ci mette dentro
// materiali di pregio e componenti ha svegliato qualcosa di più grosso.
export const CURSE_GRAVITA = [
  { key: "lieve", label: "Lieve", icon: "🌫", desc: "Fastidio scenico: imbarazza, puzza, attira occhiate storte." },
  { key: "seria", label: "Seria", icon: "🕯", desc: "Un malus vero ma sopportabile, su una prova o un valore." },
  { key: "grave", label: "Grave", icon: "☠", desc: "Pesa davvero e non si molla: serve una quest per spezzarla." },
];
export const gravitaByKey = (k) => CURSE_GRAVITA.find((g) => g.key === k) || CURSE_GRAVITA[1];

// Peso dell'impegno → gravità. Rarità mirata (0–4) + investimento + componenti + fretta.
export function curseGravita({ targetTier, invest, components = [], pace } = {}) {
  let n = Math.max(0, TIER_ORDER.indexOf(normTier(targetTier)) - 1); // common 0 · uncommon 1 · … · legendary 4
  if (invest === "extra") n += 1;
  if (invest === "pregio") n += 2;
  n += Math.min(2, components.length);
  if (pace === "fretta") n += 1;
  return n >= 5 ? "grave" : n >= 2 ? "seria" : "lieve";
}

// ── Tabella di scorta (quando Gemini non risponde) ───────────────────────────
// Una voce per tipo dnd5e, più le generiche. Stessa forma della risposta di
// Gemini, così l'interfaccia del Master non deve distinguere.
export const CURSE_TABLE = {
  weapon: [
    { nome: "Sete di Ruggine", effetto: "Il filo si copre di una patina rossastra che torna per quanto la si lucidi, e la lama sembra respirare quando c'è sangue vicino.", meccanica: "−2 ai punti ferita massimi finché l'arma è equipaggiata.", rivelazione: "Al primo riposo lungo con l'arma al fianco: il portatore si sveglia più stanco di come si è coricato.", rimozione: "Immergerla per una notte intera nell'acqua corrente di un fiume benedetto." },
    { nome: "Mano Pesante", effetto: "L'equilibratura è sbagliata di un soffio: il colpo parte sempre un istante dopo quello che l'occhio si aspetta.", meccanica: "Svantaggio al primo tiro per colpire di ogni combattimento.", rivelazione: "Dopo due o tre scontri, quando il primo fendente va a vuoto sempre.", rimozione: "Rifarla riequilibrare da un mastro armiere di grado superiore a chi l'ha forgiata." },
    { nome: "Voce del Metallo", effetto: "Sotto il colpo l'acciaio canta una nota lunga che si sente a cento passi.", meccanica: "Svantaggio alle prove di Furtività mentre l'arma è indosso, anche nel fodero.", rivelazione: "Al primo avvicinamento silenzioso andato a monte senza motivo apparente.", rimozione: "Fasciare l'elsa col crine di una bestia muta, di quelle che non gridano mai." },
    { nome: "Morso Ingrato", effetto: "L'arma non distingue bene la mano che la tiene dal bersaglio.", meccanica: "Con un 1 naturale al tiro per colpire il portatore subisce 1d4 danni taglienti.", rivelazione: "Al primo fallimento critico in combattimento.", rimozione: "Offrirle volontariamente il sangue del suo artigiano in un rituale di scuse." },
    { nome: "Fame di Ferro", effetto: "Poggiata accanto ad altro metallo, di notte, lo intacca.", meccanica: "Ogni riposo lungo una moneta d'oro nella borsa del portatore si sbriciola in polvere rossa.", rivelazione: "Quando i conti dell'oro non tornano mai.", rimozione: "Nutrirla con un lingotto di ferro meteoritico e lasciarla sepolta una luna." },
  ],
  equipment: [
    { nome: "Peso del Rimorso", effetto: "Il pezzo calza perfettamente ma addosso sembra sempre bagnato, anche all'asciutto.", meccanica: "−5 piedi alla velocità finché è equipaggiato.", rivelazione: "Alla prima marcia forzata o inseguimento: resta indietro senza capire perché.", rimozione: "Farlo asciugare tre giorni sotto il sole di una vetta consacrata." },
    { nome: "Occhi Annebbiati", effetto: "Una runa incisa storta manda un riflesso continuo ai bordi della vista.", meccanica: "Svantaggio alle prove di Percezione basate sulla vista finché è indosso.", rivelazione: "Al primo agguato che chiunque altro aveva notato.", rimozione: "Raschiare la runa e farla reincidere da chi sa leggerla." },
    { nome: "Puzza di Carogna", effetto: "Il conciatore ha usato un grasso andato a male: all'alba l'odore torna, forte.", meccanica: "Ogni alba il portatore puzza di carogna per 8 ore: svantaggio alle prove di Persuasione e le bestie lo evitano.", rivelazione: "La prima mattina in una locanda affollata.", rimozione: "Lavarlo nell'aceto di una cantina abbandonata da più di cent'anni." },
    { nome: "Stretta Lenta", effetto: "Le fibbie si allacciano da sole quando il portatore dorme.", meccanica: "Toglierlo richiede un'azione e una prova di Atletica CD 12: non si può togliere in fretta.", rivelazione: "La prima volta che serve spogliarsi in fretta.", rimozione: "Tagliare le fibbie con una lama d'argento e rifarle in cuoio nuovo." },
    { nome: "Freddo che Resta", effetto: "Sotto la stoffa la pelle non si scalda mai del tutto.", meccanica: "Svantaggio ai tiri salvezza contro il freddo e contro l'esaurimento da clima rigido.", rivelazione: "Alla prima notte all'addiaccio in montagna.", rimozione: "Passarlo sulle braci di una fucina accesa da un nano per sette notti." },
  ],
  consumable: [
    { nome: "Coda Amara", effetto: "Il preparato funziona, ma lascia in gola qualcosa che non se ne va.", meccanica: "Chi lo consuma ha svantaggio al prossimo tiro salvezza su Costituzione entro un'ora.", rivelazione: "Subito dopo averlo bevuto, dal sapore che resta.", rimozione: "Nessuna: è monouso, ma chi l'ha fatto ha imparato la lezione." },
    { nome: "Dono Rimandato", effetto: "L'effetto c'è tutto, solo che arriva quando gli pare.", meccanica: "L'effetto si manifesta al turno successivo a quello in cui viene consumato.", rivelazione: "La prima volta che serve subito e non succede niente.", rimozione: "Nessuna: va rifatto da capo, con calma." },
    { nome: "Sogno Sbagliato", effetto: "Chi lo prende dorme, ma non riposa: sogna la fucina in cui è stato fatto.", meccanica: "Chi lo consuma non recupera i dadi vita al prossimo riposo lungo.", rivelazione: "Al riposo seguente, quando le ferite non si chiudono come dovrebbero.", rimozione: "Bere acqua di sorgente prima di dormire per tre notti." },
    { nome: "Metà Dose", effetto: "Il colore è giusto ma la boccetta è più leggera di quanto sembri.", meccanica: "L'effetto vale la metà: dadi arrotondati per difetto, durata dimezzata.", rivelazione: "Quando i conti dei punti ferita non tornano.", rimozione: "Nessuna: è quel che è." },
    { nome: "Invito Sbagliato", effetto: "L'odore che sprigiona quando si apre richiama qualcosa nei paraggi.", meccanica: "All'uso tira 1d6: con 1 un incontro casuale arriva entro 10 minuti.", rivelazione: "Quando qualcosa bussa poco dopo l'uso.", rimozione: "Nessuna: aprirlo lontano da dove si dorme." },
  ],
  tool: [
    { nome: "Manico Traditore", effetto: "Gli attrezzi sono buoni, ma uno di loro si gira sempre nella mano al momento peggiore.", meccanica: "Svantaggio alla prima prova con gli strumenti di ogni giornata.", rivelazione: "Quando il lavoro semplice va storto e quello difficile riesce.", rimozione: "Sostituire il pezzo difettoso: va trovato quale, con una prova d'Indagare CD 15." },
    { nome: "Firma Storta", effetto: "Qualunque cosa esca da questi strumenti porta un segno che non è quello dell'artigiano.", meccanica: "Chi riconosce il marchio (Indagare CD 12) crede il lavoro rubato: svantaggio alle prove sociali per venderlo.", rivelazione: "Al primo tentativo di vendere qualcosa fatto con questi arnesi.", rimozione: "Farli marchiare di nuovo da una gilda riconosciuta." },
    { nome: "Lentezza Ostinata", effetto: "Gli arnesi funzionano, ma ogni gesto chiede il doppio dell'attenzione.", meccanica: "Ogni lavoro fatto con questi strumenti richiede il doppio del tempo.", rivelazione: "Al primo lavoro cronometrato.", rimozione: "Oliarli col grasso di una bestia che non si è mai fermata in vita sua." },
    { nome: "Mani Fredde", effetto: "Il metallo degli arnesi resta gelido anche vicino al fuoco.", meccanica: "Dopo un'ora d'uso continuato: un livello di indebolimento finché non ci si scalda.", rivelazione: "Alla prima sessione di lavoro lunga.", rimozione: "Lasciarli una notte nel letto di braci di una fucina viva." },
  ],
  loot: [
    { nome: "Occhi nella Stanza", effetto: "Chi lo tiene con sé sente di essere guardato, e non sbaglia del tutto.", meccanica: "Svantaggio ai tiri salvezza contro la paura finché lo si possiede.", rivelazione: "Al primo incontro con non morti o creature dell'ombra.", rimozione: "Seppellirlo per una notte in terra consacrata e riprenderlo all'alba." },
    { nome: "Sonno Corto", effetto: "Di notte, dalla borsa, arriva un fruscio di pagine che nessuno ha aperto.", meccanica: "Chi dorme entro 10 piedi dall'oggetto non si sveglia per i rumori: nessun tiro di Percezione passiva durante il riposo.", rivelazione: "Al primo attacco notturno al campo.", rimozione: "Chiuderlo in una cassa foderata di piombo o regalarlo a un tempio." },
    { nome: "Lingua Sbagliata", effetto: "I segni cambiano leggermente ogni volta che si rilegge lo stesso punto.", meccanica: "Ogni informazione che l'oggetto fornisce ha 1 probabilità su 6 di essere falsa: il Master tira in segreto.", rivelazione: "Quando una pista rivelatasi giusta ne porta una sbagliata.", rimozione: "Farlo ricopiare da uno scriba che non sa leggere quella lingua." },
    { nome: "Sfortuna di Bottega", effetto: "Pare attirare i piccoli disastri: corde che si sfilacciano, cinghie che cedono.", meccanica: "Una volta per riposo lungo il Master può far ritirare al portatore un tiro riuscito.", rivelazione: "La prima volta che una cosa semplice va inspiegabilmente male.", rimozione: "Perderlo di proposito e non cercarlo più, oppure un rituale di purificazione." },
    { nome: "Richiamo del Fabbro", effetto: "Ogni tanto l'oggetto è tiepido, come se qualcuno dall'altra parte lo stesse tenendo in mano.", meccanica: "Chi l'ha forgiato sogna il portatore ogni notte e ne conosce sempre la direzione approssimativa.", rivelazione: "Quando qualcuno si presenta sapendo troppo.", rimozione: "Spezzare il legame: distruggere l'oggetto o il banco su cui è nato." },
  ],
};
// Voci buone per qualunque tipo: si aggiungono sempre al mazzo.
CURSE_TABLE.any = [
  { nome: "Marchio del Lunedì", effetto: "Sul pezzo resta l'impronta di un pollice che non è di nessuno dei presenti.", meccanica: "Svantaggio alle prove di Carisma mentre l'oggetto è in vista.", rivelazione: "Quando qualcuno nota l'impronta e cambia espressione.", rimozione: "Farlo benedire da un chierico di grado almeno 5." },
  { nome: "Peso Falso", effetto: "Pesa sempre un po' più di quanto dovrebbe, e ogni giorno un pizzico in più.", meccanica: "Conta come il doppio del suo peso per il carico trasportato.", rivelazione: "Quando la borsa comincia a tirare senza aver preso niente.", rimozione: "Appenderlo per una notte a un ramo sopra un precipizio." },
  { nome: "Odio del Fuoco", effetto: "Vicino a una fiamma viva l'oggetto scricchiola e si contrae.", meccanica: "Chi lo porta ha svantaggio ai tiri salvezza contro i danni da fuoco.", rivelazione: "Al primo incendio o soffio di drago.", rimozione: "Ritemprarlo lentamente: una settimana di lavoro e 100 mo." },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Maledizione dalla tabella locale (scorta: rete giù, chiave mancante, Gemini lento).
export function fallbackCurse({ foundryType = "loot", gravita = "seria" } = {}) {
  const mazzo = [...(CURSE_TABLE[foundryType] || CURSE_TABLE.loot), ...CURSE_TABLE.any];
  return { ...pick(mazzo), gravita, fonte: "tabella" };
}

// Maledizione da Gemini, con scorta locale e tempo massimo d'attesa: il tiro
// non deve restare appeso a una chiamata di rete.
export async function generateCurse(ctx = {}, { timeoutMs = 12000 } = {}) {
  const gravita = ctx.gravita || "seria";
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    let r;
    try {
      r = await fetch("/api/crafting-maledizione", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...ctx, gravita }),
        signal: ac.signal,
      });
    } finally { clearTimeout(t); }
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    const c = data?.curse;
    if (!c?.nome || !c?.meccanica) throw new Error("vuota");
    return { nome: c.nome, effetto: c.effetto || "", meccanica: c.meccanica, rivelazione: c.rivelazione || "", rimozione: c.rimozione || "", gravita, fonte: "gemini" };
  } catch {
    return fallbackCurse({ foundryType: ctx.tipo, gravita });
  }
}

// Riga secca per il registro e la coda del Master.
export const curseLine = (c) => (c?.nome ? `${gravitaByKey(c.gravita).icon} ${c.nome} — ${c.meccanica}` : "");
