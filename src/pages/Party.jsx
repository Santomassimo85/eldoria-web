import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { classColor } from "../utils/classColor";
import "./Party.css";
import "../styles/cinematic.css";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import CineToolbar from "../components/CineToolbar";
import GlacierHero from "../components/glacier/GlacierHero";
import { isHiddenName, isHiddenChar } from "../data/hiddenPlayers";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/La_cessione_dell_anello.png";
/* numeri in lettere per la tagline del varco (1–20). */
const NUM_IT = ["Zero", "Una", "Due", "Tre", "Quattro", "Cinque", "Sei", "Sette", "Otto", "Nove", "Dieci", "Undici", "Dodici", "Tredici", "Quattordici", "Quindici", "Sedici", "Diciassette", "Diciotto", "Diciannove", "Venti"];

/* ── Party data — kept in one structure so we can render statistics ── */
const PARTIES = [
  {
    id: "AMEA",
    name: "Compagnia di Amea",
    code: "A",
    color: "#c0392b",
    divider: "/assets/PhotoStory/GruppoMEAA/SylvaBerserk.png",
    motto: "Il fuoco non chiede permesso",
    members: [
      { name: "Caius",   race: "Elfo",       class: "Mago",      image: "/assets/player/caius2.jpeg" },
      { name: "Garroth", race: "Mezz'Elfo",  class: "Ranger",    image: "/assets/player/garroth2.png" },
      { name: "Tanagar", race: "Mezz'Orco",  class: "Guerriero", image: "/assets/player/Tanagar2.png" },
    ],
  },
  {
    id: "LAC",
    name: "Compagnia di Lac",
    code: "L",
    color: "#2980b9",
    divider: "/assets/PhotoStory/GruppoMEAA/Krag-Dor.jpg",
    motto: "Le acque profonde non temono il vento",
    members: [
      { name: "Horn",    race: "Umano",    class: "Ranger", image: "/assets/player/Horn.jpg" },
      { name: "Thoki",   race: "Gnomo",    class: "Mago",   image: "/assets/player/Thoki.jpg" },
      { name: "Cleofe",  race: "Halfling", class: "Ladro",  image: "/assets/player/Cleofe.jpg" },
    ],
  },
  {
    id: "ENOX",
    name: "Compagnia di Enox",
    code: "E",
    color: "#8e44ad",
    divider: "/assets/PhotoStory/GruppoMEAA/cultista.png",
    motto: "Nel buio si forgiano i nomi più luminosi",
    members: [
      // ex-membri usciti: Dante, Timoty Bevibotte, Daga, Alaric · storici nascosti: Roynot, Vyger
      { name: "Makenna",                race: "Changeling",            class: "Ladro",    image: "/assets/player/Makenna.jpeg" },
      { name: "Temistocle Sottocolle",  race: "Halfling piede lesto",  class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
      { name: "Lael",                   race: "Alto Elfo",             class: "Mago",     image: "/assets/player/lael.jpg" },
      { name: "Palar",                  race: "Dragonide (Ametista)",  class: "Paladino", image: "/assets/player/palar.webp" },
      { name: "Kael & Mora",            race: "Hexblood",              class: "??",       image: "/assets/player/.png" },
      { name: "Zareth",                 race: "Umano",                 class: "Guerriero", image: "/assets/player/zareth.webp" },
    ],
  },
  {
    id: "LEAF",
    name: "Compagnia di Leaf",
    code: "F",
    color: "#27ae60",
    divider: "/assets/PhotoStory/GruppoLEAF/soranSong.png",
    motto: "Dove cade la foglia, nasce la rotta",
    members: [
      // { name: "Taaras Stormrage", race: "Mezz'Elfo",  class: "Chierico", image: "/assets/player/TaarasStormrage.png" },
      { name: "Soran",            race: "Umano",      class: "Bardo",    image: "/assets/player/Soran.png" },
      { name: "Zethir",           race: "Shadar-Kai", class: "Paladino", image: "/assets/player/Zethir.jpeg?v=2" },
      { name: "Aksel",            race: "Umano",      class: "Arcane Sniper", image: "/assets/player/Aksel.png" },
      { name: "Dago",             race: "Umano",      class: "Ladro",    image: "/assets/player/dago.jpeg" },
      { name: "Karlberht",        race: "Umano",      class: "Guerriero", image: "/assets/player/Karlberht.jpg" },
    ],
  },
];

/* ── Biografie degli eroi ──────────────────────────────────────────
   Riempile a piacere: la chiave è il `name` del membro in PARTIES.
   Una stringa vuota = nessuna biografia mostrata. Accetta più paragrafi
   separati da una riga vuota (\n\n). */
const HERO_BIOS = {
  "Caius": "Caius Maxis-Richtofen nacque tra i marmi bianchi e le guglie dorate della capitale di Tirrenia, figlio di una stirpe di studiosi e magistrati elfi, devoti alla legge e alle arti arcane più nobili. La sua famiglia, aristocratica e inflessibile, si aspettava che lui proseguisse la tradizione come mago di corte o custode della grande biblioteca arcana. Fin da giovane, però, Caius mostrò un insaziabile desiderio di sapere che andava oltre i confini consentiti. Non si accontentava della magia «pura» e «luminosa» degli accademici della capitale: ciò che davvero lo affascinava erano i segreti proibiti, le arti che i suoi maestri chiamavano blasfeme, i confini tra la vita e la morte. Notte dopo notte, trafugava manoscritti dalle cripte delle biblioteche, studiava rituali antichi e dimenticati, interrogava i morti in sogno. Quando la sua ossessione divenne evidente, la famiglia tentò di fermarlo, distruggendo parte dei suoi appunti e minacciandolo di esilio. Ma fu lui stesso a scegliere di andarsene: nella notte, con una borsa di pergamene, teschi incisi e ampolle d’ombra, fuggì dalla capitale, giurando che un giorno sarebbe tornato non per chiedere perdono, ma per dimostrare la superiorità delle sue ricerche. Negli anni successivi, viaggiò per terre desolate, ossari e rovine, apprendendo i segreti della necromanzia. Reclutò altri studiosi ed emarginati come lui (maghi decaduti, necromanti in fuga, cultisti disillusi) e insieme fondarono un gruppo di ricerca segreto che chiamarono \"935\".\n\nPer anni il Progetto 935 prosperò, costruendo un laboratorio nascosto in una catacomba sotterranea, unendo scienza, magia e riti ancestrali per sondare la «sorgente della vita» e «la chiave della resurrezione».\n\nMa qualcosa andò terribilmente storto... Durante uno degli esperimenti più ambiziosi, qualcosa o qualcuno rispose alle loro evocazioni. Le cripte si riempirono di una nebbia scura, le ombre presero forma, i corpi risorti si rivoltavano, e in un istante il laboratorio divenne una trappola mortale. Quando il fumo si dissipò, Caius era l’unico ancora in vita. Nessuno sa esattamente cosa accadde quella notte. I pochi che hanno visto il luogo in seguito parlano di ossa fuse nella pietra, mormorii che serpeggiano nelle mura, luci verdastre che non si spengono mai. Caius non ha mai raccontato la verità su ciò che vide o fece, ma da allora porta negli occhi un’ombra che neppure il tempo riesce a cancellare. Alcuni dicono che sia maledetto, altri sussurrano che abbia fatto un patto con qualcosa di inconcepibile, lui si limita a sorridere freddamente e a cambiare argomento.\n\nAdditional Features and Traits :\n\nAllineamento.\n\nGli elfi amano la libertà, la varietà e l'espressione individuale, cosa che li avvicina agli aspetti più positivi del caos. Apprezzano e proteggono la libertà degli altri quanto la propria, e per buona parte tendono al bene piuttosto che al male. Caius si pone in maniera neutrale nel confine tra bene e male.\n\nTrance.\n\nGli elfi non hanno bisogno di dormire. Anziché dormire entrano per 4 ore al giorno in una proronda meditazione e in uno stato semicosciente. (Il termine in\n\nComune per tale meditazione è \"trance\".) Durante questa meditazione, l'elfo entra in una sorta di stato sognante, che in realtà non è altro che una serie di esercizi mentali che anni di pratica hanno reso automatici. Dopo tale periodo, l'elfo...\n\n----------------------------------------------------------------------------------------------------------------------\n\nMESTIERE:\n\nALCHIMIA: LIV.2 (+13)\n\nAllies & Organizations :\n\nKAL-DURR – Il Giogo del Destino (Divinità del tempo e del fato)\n\n- Dominio: Cicli, morte e rinascita, destino ineluttabile\n\n- Titoli: Il Ciclo Infranto, Il Custode dell’Orologio Muto\n\n- Simbolo: Un serpente che si morde la coda, con tre clessidre all’interno\n\n- Descrizione: Kal-Durr non decide il destino: lo conserva, lo ripete, lo osserva. Alcuni veggenti lo adorano, ma lo temono. Altri lo maledicono.\n\n- Dogma: “Tutto accade perché è già accaduto. Nulla è nuovo, solo riscritto.”\n\nCaius fondò il gruppo di ricerca 935, che studiava le magie legate alla morte e alla resurrezione...\n\nZOMBI\n\nNon morto Medio, neutro/e malvagio\n\nClasse Armatura 8\n\nPunti Ferita 22 (3d8 + 9)\n\nVelocità 6 m\n\nFOR 13 (+1)\n\nDES 6 (- 2)\n\nCOS 16 (+3)\n\nTiri Salvezza Sag +O\n\nImmunità ai Danni veleno\n\nINT 3 (- 4)\n\nImmunità alfe Condizioni avvelenato\n\nSAG 6 (- 2)\n\nSensi Percezione passiva 8, scurovisione 18 m\n\nCAR 5 (- 3)\n\nLinguaggi capisce tutti i linguaggi che conosceva in vita ma\n\nnon può parlarl11\n\nSfida 1/4 (50 PE)\n\nTempra dei Non Morti. Se i danni riducono lo zombi a O punti\n\nferita, esso deve effettuare un tiro salvezza su Costituzione\n\ncon una CO pari a S + i danni subiti, a meno che non si tratti\n\ndi danni radiosi o di un colpo critico. Se ha successo, lo zombi\n\nscende invece a 1 punto ferita.\n\nAZIONI\n\nSchianta. AttQcco con Arma da Mischia: +3 al tiro per co~pire,\n\nportata 1,5 m, un bersaglio. Colpito: 4 (1d6 + 1) danni\n\ncontundentì.\n\n------------------------------------------------------------------------------------------------------\n\nSCHELETRO\n\nNon morto Medio, legale malvagio\n\nClasse Armatura 13 (frammenti di armatura)\n\nPunti Ferita 13 (2d8 + 4}\n\nVelocità 9 m\n\nFOR 10 (+O)\n\nDES 14 {+2)\n\nCOS 15 (+2)\n\nINT 6 (-2)\n\nVulnerabtlità ai Danni contundente\n\nImmunità al Danni veleno\n\nSAG 8 (-1)\n\nImmunità alle Condizioni avvelenatot indebolimento\n\nSensi Percezione passiva 9, scurovisione 18 m\n\nCAR 5 {-3)\n\nLinguaggi capisce tutti i linguaggi che conosceva in vita ma non\n\npuò parlarli\n\nSfida 1/4 (SOPE)\n\nAZIONI\n\nSpada Corta. Attacco con Arma da Mischia: +4 al tiro per\n\ncolpire, portata 1,5 m, un bersaglio. Colpito: S (ld6 + 2) danni\n\nperforanti.\n\nArco Corto. Attacco con Arma a Distanza: +4 al tiro per colpire,\n\ngittata 24/96 m, un bersaglio. Colpito: 5 (1d6 + 2) danni\n\nperforanti.\n\n------------------------------------------------------------------------------------------------------\n\nUNDEAD SPIRIT\n\nMedium undead\n\nArmor Class 1 1 + the level of the spell (natural armor)\n\nHit Points 30 (Ghostly and Putrid only) or 20 (Skeletal only) +\n\n10 for each spell level above 3 rd\n\nSpeed 30 ft.; fly 40 ft. (hover) (Ghostly only)\n\nSTR\n\n1 2 (+l )\n\nDEX\n\n1 6 (+3)\n\nCON\n\n1 5 (+2)\n\nI NT\n\n4 (-3)\n\nDamage Immunities necrotic, poison\n\nWIS\n\n10 (+O)\n\nCHA\n\n9 (-1 )\n\nCondition Immunities exhaustion, frightened, paralyzed,\n\npoisoned\n\nSenses d a rkvision 60 ft., passive Perception 10\n\nLanguages understands the languages you speak\n\nChallenge - Proficiency Bonus equals your bonus\n\nFestering Aura (Putrid Only). Any creature, other than you ,\n\nthat starts i t s turn with in 5 feet o f t h e s pi rit m ust succeed on a\n\nConstitution saving th row against you r spell save DC or be poi·\n\nsoned until the start of its next turn.\n\nIncorporeal Passage (Ghostly Only). The spirit can move\n\nthrough other creatures and objects as if they were difficult\n\nterra i n . If it ends its turn inside an object, it is s h u nted to the\n\nnearest u noccupied space and takes l d l O force damage for\n\nevery 5 feet traveled.\n\nACT I O N S\n\nMultiattack. The spirit makes a nu mber o f attacks equal to half\n\nthis spe l l 's level (rounded down) .\n\nDeathly Touch (Ghostly Only). Melee Weapon Attack: your\n\nspell attack modifier to h it, reach 5 ft., one creature. Hit: l d8\n\n+ 3 + the spell's level necrotic damage, and the creature must\n\nsucceed on a Wisdom saving throw against you r spell save\n\nDC or be frightened of the undead u ntil the end of the target's\n\nnext turn.\n\nGrave Bolt (Skeletal Only). Ranged Spell Attack: you r spell at·\n\ntack mod ifier to hit, range 1 50 ft. , one target. Hit: 2d4 + 3 + the\n\nspel l's level necrotic damage.\n\nRotting Claw (Putrid Only). Melee Weapon Attack: you r spell\n\nattack modifier to hit, reach 5 ft., one target. Hit: ld6 + 3 + the\n\nspell's level slashing damage. I f the target is poisoned, it m ust\n\nsucceed on a Constitution saving throw against your spell save\n\nDC or be paralyzed u ntil the end of its next turn.\n\nTreasure :\n\n-9* Ring of the fiend:\n\nUn demone ti ha posseduto da bambino. Sei stato rinchiuso ma sei scappato. Il demone è ancora dentro di te, ma ora cerchi di tenerlo rinchiuso;\n\n-Vestiti Comuni;\n\n-Borsa del cacciatore di mostri:\n\nInclude uno scrigno, un piede di porco, un martello, tre paletti di legno, un simbolo sacro, una fiaschetta di acqua santa, un set di manette, uno specchio d'acciaio, una fiaschetta di petrolio, un acciarino e 3 torce;\n\n-Sacco di bacche:\n\nUn piccolo sacco di iuta pieno di 1d10+1 bacche buone derivanti dall'incantesimo \"Bacca Buona\". Al termine di un riposo lungo, tutte le bacche dentro o fuori dal sacco scompaiono e il sacco si riempie di nuovo con 1d10+1 bacche buone. Dare una bacca buona a un giocatore privo di sensi non lo sveglierà, ma continuerà a lasciarlo privo di sensi con 1 PF.\n\n-Borsa arcimago 1:\n\nuna perla che vale almeno 100gp e una piuma di gufo...un po´di pelo un pezzo di ambra, un cristallo, un pezzo di vetro, fosforo e una lucciola\n\n-borsa di componenti magici: polvere d´oro, piuma, perla, monete di rame (50)\n\nGM Notes :\n\nprima o poi tiro su costituzione per il ring of the fiend",
  "Garroth": "Garroth nasce in una famiglia tranquilla, che può permettersi di vivere bene, in modo non agiato ma quasi.\n\nI genitori di Garroth, Dortumal il padre elfo, e Isabella, madre umana.\n\nI genitori di Garroth avevano passato le pene dell'inferno per poter vivere insieme in quanto le famiglie dei due non volevano che si mischiasse il sangue con una razza diversa.\n\nI due non dando ascolto alle loro famiglie, decisero di prendere la loro strada e lasciarsi alle spalle quella che era una realtà a loro non consona.\n\nPrima che nascesse Garroth, bisognava ripartire da zero, dato che il matrimonio non era stato appoggiato nè dalla famiglia di lei, nè da quella di lui, quindi i due fecero quello che sapevano fare meglio, i cacciatori. Infatti le corrispettive famiglie erano note per essere delle famiglie di cacciatori esperti, e quindi non fu difficile per i due mettere in pratica quello che avevano sempre saputo fare per procacciarsi da vivere per la giornata.\n\nSi sparse la voce della loro bravura e iniziò un susseguirsi di chiamate da parte dei cittadini, chi chiedeva aiuto, chi voleva che venisse cacciato un particolare animale, chi chiedeva invece se fosse possibile uccidere bestie feroci che minacciavano la tranquillità delle persone e delle bestie da soma.\n\nLa famiglia Tel'Arion stava prendendo piede sempre i più e tutto andava a gonfie vele, raggiungendo l'apice quando Isabella rimase incinta di Garroth, un bambino con le sembianze umane e i tratti da elfo.\n\nI mezz'elfi metaforicamente parlando sono descritti come esseri che sono in bilico tra due mondi, quello degli elfi e quello degli umani, ma in questa storia, la metafora ha assunto un significato più pratico, dato che fin dalla giovane età Garroth dimostrò innate capacità che gli permettevano di viaggiare tra i vari piani della realtà.\n\nNegli anni a venire la madre morì, in quanto umana, non poteva competere con la longevità degli elfi, e Garroth rimase con il padre,che continuò ad addestrarlo fino a farlo diventare un cacciatore senza eguali.\n\nUn giorno durante lo svolgimento di una missione con il padre, si trovarono a dover fronteggiare una figura mai vista prima dal vivo, un Drago.\n\nDopo una lunga ed estenuante battaglia il drago uccise il padre di Garroth il quale preso dal panico e dalla paura si rannicchiò a terra e chiudendo gli occhi si trovò in una dimensione a lui sconosciuta.\n\nPassati anni e anni dall'accaduto, i lutto era stato superato, ma la cattiveria che quella bestia immonda aveva dimostrato nei loro confronti è una cosa che ancora oggi incattivisce Garroth facendogli desiderare di avere vendetta un giorno.\n\nAdditional Features and Traits :\n\nTerreno prescelto: Foresta; Montagna\n\nNemico prescelto: Drago; Folletto\n\nAllies & Organizations :\n\n13 frecce rimanenti\n\nRICORDATI DI PRENDERLE/I UNA VOLTA USATE\n\npezzi di metallo\n\nSINTONIA DELLA FORESTA: una volta al giorno puoi trasformarti in lupo, cervo (ovviamente solo per scappare questo) o orso. come un druido ma con meno hp\n\n5 proiettili (+2 danni)\n\n6 proiettili pericolosi\n\n5 gessetti portali\n\nferrite dorata\n\nlvl 1 +7 artificiere + viti di mystal\n\nPianta di cristallo: Questa pianta ha una consistenza molto morbida eppure é letteralmente di cristallo, risulta impossibile romperla senza un oggetto adatto.\n\nPuó essere utilizzata, una volta sbriciolata, per qualsiasi professione e ne migliorerebbe il craft.\n\nPer lavorarla serve un martello nanico con punta in mytrhal",
  "Tanagar": "clan dei demoni grigi",
  "Horn": "Lasciato il villaggio natale alla ricerca della preda definitiva. Attraversato foreste, montagne, laghi e villaggi senza trovare una preda degna delle leggende del villaggio in cui è nato.\n\nTreasure :\n\nPolvere di funghi x1\n\nAnello delle antiche radici - 4 cariche - crescita vegetale costo 3 , intralciare costo 1, muro di spine costo 4. Si ricarica un d4 all'alba, se lo indossi ti trasformi in Trent 1 volta al giorno e usi le spell senza pagare costo ma come azione. Vantaggio tiri su natura.",
  "Thoki": "",
  "Cleofe": "",
  "Makenna": "Per anni, Makenna ha creduto di essere una bambina umana come tante, seppur più sfortunata. Non ricordava i suoi genitori; i suoi primi ricordi erano fatti di polvere, vicoli bui e il freddo del ferro ai polsi. Credeva che i suoi tratti — i capelli castani, gli occhi nocciola, quella piccola cicatrice sul mento — fossero i suoi. Solo molto dopo, avrebbe capito la verità: quel volto apparteneva a Lyra, l'unica amica che avesse mai avuto nei bassifondi, sparita nel nulla quando erano ancora piccole. Senza saperlo, Makenna ne aveva \"indossato\" il ricordo per sopravvivere alla solitudine. Makenna non era una complice dei criminali che la tenevano prigioniera; era il loro strumento. I suoi padroni avevano intuito il suo talento innato per il furto e la manipolazione, anche se lei stessa non comprendeva come riuscisse a passare inosservata o a cambiare espressione in modo così convincente. La tenevano in catene, spezzando la sua volontà con la fame e la paura. La usavano per svuotare le tasche dei nobili e per infiltrarsi dove un adulto avrebbe fallito. Makenna era un'ombra senz'anima, soggiogata da uomini che vedevano in lei solo un oggetto di profitto. Il punto di rottura arrivò con la fine dell'adolescenza. Una notte, uno dei suoi carcerieri, ubriaco di potere e vino, tentò di prendersi con la forza l'unica cosa che Makenna sentiva ancora sua: il proprio corpo. In quel momento, qualcosa dentro di lei si spezzò. Non fu solo paura; fu un’ondata di rabbia primordiale. Mentre l'uomo le metteva le mani addosso, la pelle di Makenna iniziò a mutare, diventando pallida come la luna, e i suoi occhi si fecero vacui e argentei. La sua vera natura di Changeling emerse tra le urla. In un raptus di violenza cieca e disperata, Makenna usò le stesse catene che la legavano per stringere la gola dei suoi aguzzini. Non rimase nessuno in vita in quel covo. Quando il silenzio tornò, Makenna si guardò le mani: non erano più quelle di Lyra. Erano mutabili, aliene, libere.Oggi Makenna viaggia per il mondo come una ladra che non ruba per arricchirsi, ma per scardinare le catene. Il suo passato ha plasmato un codice morale ferreo ma ribelle: L'Odio per l'oppressione: Non tollera vedere nessuno in schiavitù o vittima di soprusi. Se vede un potente abusare di un debole, Makenna non si limita a rubargli la borsa; gli rovina la vita. La Ricerca dell'Identità: Cambia volto spesso, a volte per necessità, a volte per il gusto di essere \"qualcun altro\", ma sta ancora cercando di capire chi sia la vera Makenna sotto la maschera. L'Invidia Dolceamara: Quando vede una famiglia che cena insieme o due amici che si fidano l'uno dell'altro, prova una fitta al cuore. Invidia profondamente chi ha qualcuno da amare, un lusso che a lei è sempre stato negato. \"Hanno cercato di farmi dimenticare chi fossi, prima ancora che io potessi scoprirlo. Ora, ogni serratura che scasso è un respiro di libertà che restituisco al mondo.\"",
  "Temistocle Sottocolle": "faceva parte di un clan di ricercatori halfling nella foresta di Altocolle, il villaggio fu attaccato da un mago malvagio e il suo drago, Milo era bimbo e stranamente è riuscito a proteggersi dentro l'insenatura di un albero che è risultato la casa di una fatina, purtroppo i genitore non sono riusciti a salvarsi, durante le fiamma il corpo di Milo è stato pervaso da energia che lo ha protetto e gli ha trasmesso dei poteri, dei quali ad oggi sta imparando ad utilizzarli ma non a controllarli del tutto.\n\ndurante il suo girovagare ha fatto amicizia con un topino di campagna che anche lui dopo l'attacco del mago e il drago è rimasto ferito, Milo se ne è preso cura e lo ha chiamato Hoppiti, dopo gli avvenimenti il topino è come sentisse quando qualche cosa di pericoloso si avvicina.\n\nAllies & Organizations :\n\nNushala giovane elfa che mi sta addestrando e mi aiuta.\n\n2 clan elfi radici silenti che proteggono foresta, gufi bianchi clan più aperto e ammissibile. non devo farmi vedere dagli elfi.\n\nCitta´di Yotta, la taverna di Quobec, chiedere informazione\n\ncerca Auwyn Biancomento\n\ncittadine di Nolborg - sud ovest - a ovest è presente un arena dove fanno combattere animali e persone.\n\narena a ovest, far tradurre pergamena, lettera roynot\n\nbottega dragonide, ci siamo diretti verso la foresta del tiglio bianco.\n\nBiancomento ti aspetta ad Altocolle. i sette, Aurelios.\n\ndrago rosso che ha ucciso la mia famiglia vive a sud pirandros vive ai picchi vermigli\n\npergamena del robot da tradurre in gnomico:come modificare tramite arcanite protettori gnomici come golem o altri protettori. come inserire cristallo e dove inserirlo.\n\nnuovi compagni Lael Makenna\n\ncittà di Plia per levare anello Makenna, catene del piccolo.",
  "Alaric Voltasorte": "",
  "Lael": "",
  "Palar": "Capitolo 1: La Gabbia Dorata\n\nNato da due genitori amorevoli nel profondo sud del continente di Vathriddon (ancor più a\n\nmeridione di Inss, dove nessuna città nota alle razze umanoidi osa spingersi) Palar cresce come la\n\nstella più luminosa della magione, il cucciolo eletto.\n\nEntrambi i suoi genitori sono Dragonborn Gemmati: uno dal colore rosso cremisi, l’altro blu\n\noltremare. Palar è la perfetta unione cromatica dei due, una splendida sfumatura d'ametista.\n\nTrascorre i suoi primi anni di vita avvolto da un affetto viscerale, senza mai doversi distaccare dalle\n\nmura domestiche. I suoi unici contatti con l'esterno sono le visite dei coetanei: piccoli dragonidi\n\ncromatici accolti dalla servitù e fatti giocare sotto strettissima sorveglianza, affinché nessuno si\n\nfaccia male. Tra loro, due diventano i suoi affetti più cari: la bianca Nieve e il verde Semper.\n\nIl cibo abbonda, le giornate scorrono felici. Compiuti i 12 anni (raggiunta dunque la maturità per la\n\nsua razza) la routine di Palar cambia. I genitori gli insegnano personalmente le basi della magia,\n\nl'arte del combattimento con scudo e mazza, la storia dei secoli passati e la struttura del mondo\n\nesterno: un luogo che funziona solo grazie alla legge, alla disciplina e alla cieca fede nel solo vero\n\ndio fra gli dei, il regnante Thal-Grimor. Le sue giornate si scandiscono tra il rigore delle sale\n\nd'addestramento al mattino e lo studio nella sterminata biblioteca del palazzo al pomeriggio.\n\nCapitolo 2: La Notte delle Ombre\n\nTutto procedeva serenamente, fino a quella notte. Fuori pioveva, probabilmente. Lampi e tuoni\n\ncolpiscono la magione, seguiti improvvisamente da urla strazianti. Palar si sveglia di soprassalto,\n\ncorre alla finestra e tenta di scorgere qualcosa attraverso le tenebre magiche che avvolgono\n\ncostantemente la sua stanza.\n\nUna fiamma. Poi due, dieci, cento. Una marcia sta avanzando verso la dimora.\n\nLa servitù, che mai dormiva, è già armata e pronta a reprimere gli invasori. Dei genitori, invece,\n\nnessuna traccia. Solo in quel momento Palar realizza un dettaglio strano: non li ha mai visti di notte.\n\nMa non c'è tempo per riflettere. Gli ordini per lui sono chiari: restare chiuso in camera, vivere al\n\nmassimo delle proprie possibilità ed eccellere in tutto. Ma Palar è ormai un adulto. Non può\n\nrimanere inerme: può fare la differenza.\n\nMentre indossa in fretta l’armatura, le enormi porte del palazzo si sfondano. Le urla sono ruggenti,\n\nfuriose. Improvvisamente, due ombre sfuggenti guizzano per i corridoi e irrompono nell’androne:\n\nuna scia rossa e una blu. Le luci si spengono. Le urla degli invasori cambiano tono, trasformandosi\n\nin una straziante agonia. Dopo pochi secondi, il silenzio avvolge la stanza. Dalle ombre emergono\n\ndue sagome allungate, dai tratti infernali, che svettano imponenti sopra una pila di cadaveri\n\ndragonidi.\n\n«Avvisa gli schiavi affinché sia tutto pulito entro domani mattina. Non possiamo sprecare tempo\n\ncon la cavia DC-07.»\n\nCapitolo 3: Cavia DC-07\n\nUna singola frase. Una frase che distrugge tutto. Non solo per la brutalità delle parole, ma per la\n\nvoce che l'ha pronunciata: quella sagoma rossa, quell'essere immondo, ha la voce di sua madre.\n\nIl cuore di Palar pulsa all'impazzata, il fiato si spezza. Chi sono davvero quei due esseri? Chi sono i\n\nsuoi genitori? E soprattutto... chi è davvero lui?\n\nNon appena i due mostri si congedano, Palar si fionda nell'androne trasformato in mattatoio e si\n\nblocca, terrorizzato. In cima all'ammasso di cadaveri c'è Semper. Il corpo del suo giovane amico è\n\ncoperto di vecchie cicatrici mai notate prima e privo di ampie porzioni di scaglie, come se gli\n\nfossero state strappate a forza; porta su di sé i segni inequivocabili di una lunga prigionia. Semper\n\nrespira a fatica, ma il suo occhio è ancora vivo. Si muove.\n\n«Palar…» sussurra il giovane verde, richiamando l'amico d'ametista che si china immediatamente\n\nsu di lui.\n\n«Non ti fidare di loro… di nessuno di loro. La tua stirpe… il tuo essere un dragonide delle\n\ngemme… Non sono la tua famiglia. Non sono la nostra gente…»\n\nPalar ha mille domande pronte ad esplodere, ma vengono accolte solo dal silenzio. Semper esala il\n\nsuo ultimo respiro.\n\nCapitolo 4: La Fuga verso il Vero Mondo\n\nScosso nell'anima, con indosso l'armatura e lo scudo forniti da quella falsa famiglia, Palar guarda\n\nl'enorme portone scardinato: è l'unica via di fuga per capire la verità. Corre senza mai guardarsi\n\nindietro.\n\nPasso dopo passo, l'illusione svanisce e lascia spazio a una cruda realtà. Il paesaggio che lo circonda\n\nnon ha nulla di normale: non c'è cielo, non ci sono sole né luna, ma solo roccia e tenebre a perdita\n\nd'occhio. Ciò che vedeva dalle finestre della sua gabbia dorata era solo un incantesimo. La terra che\n\nlo ha sempre ospitato è un luogo sotterraneo fatto di schiavitù, sofferenza e menzogna.\n\nPoi, in lontananza, una flebile luce biancastra: che provenga da \"fuori\"? Ma dove si trova quel\n\nfuori? E cosa c'è al di sopra? Tutto ciò che gli è stato insegnato è stato un inganno.\n\nUna menzogna orchestrata da chi? E perché? Le sue scaglie d'ametista, così diverse da quelle di\n\ntutti i dragonidi massacrati in quella casa, valgono davvero così tanto impegno? Valgono davvero\n\ntutto quel sangue versato?",
  "Kael & Mora": "",
  "Zareth": "Il Nero\n\nNella città di Plia, tra i vicoli stretti e le taverne fumose, il sangue e l'oro decidevano il destino degli uomini. Darian aveva dieci anni quando la sua vita cambiò per sempre.\n\nEra una sera tranquilla. Seduto a tavola con suo padre, sua madre e sua sorella, stava cenando mentre fuori il vento soffiava tra le case. Le risate riempivano la stanza e per un momento tutto sembrava perfetto. Poi la porta venne sfondata. Tre uomini armati fecero irruzione nella casa. Non dissero una parola. Non fecero richieste. Vennero soltanto per uccidere.\n\nIl padre di Darian tentò di opporsi, ma fu abbattuto in pochi istanti. Sua madre cercò di proteggere i figli, ma venne colpita senza pietà. Sua sorella provò a fuggire, ma uno degli aggressori la raggiunse prima che potesse mettersi in salvo. Nascosto sotto il tavolo, Darian osservò impotente la strage della sua famiglia. Il terrore lo immobilizzava mentre il sangue si allargava sul pavimento di legno.\n\nQuando i tre assassini si avvicinarono per uccidere anche lui, la porta esplose nuovamente. A entrare fu Morigue. Nelle sue mani brillavano due scimitarre ricurve. Lo zio si lanciò contro gli aggressori con una furia terrificante. Le sue lame danzavano nell'aria come serpenti d'acciaio, fendendo il vuoto con rapidità letale. I tre uomini capirono subito che non avrebbero avuto vita facile e, approfittando della confusione, si ritirarono fuggendo nella notte.\n\nQuando il silenzio tornò nella casa, tutto ciò che rimaneva della famiglia di Darian erano i corpi senza vita sul pavimento. Morigue era il fratello del padre del ragazzo e uno dei capi banda dei bassifondi di Plia. Negli anni aveva accumulato numerosi nemici nel tentativo di espandere il proprio potere. Secondo lui quel massacro non era stato casuale. Non volevano soltanto fare del male a una famiglia innocente. Volevano colpire lui.\n\nDa quel giorno Morigue prese Darian sotto la sua protezione. Il ragazzo crebbe tra ladri, contrabbandieri e assassini. All'inizio il suo compito era semplice: osservare e ascoltare. Passava le giornate nelle piazze, nei mercati e nelle taverne di Plia, raccogliendo voci e segreti. Nessuno prestava attenzione a un ragazzino che vagava senza meta per la città, ed era proprio questa la sua forza.\n\nPassarono gli anni. Un giorno, mentre attraversava il quartiere del porto, Darian vide un volto che non aveva mai dimenticato. Uno degli uomini che aveva assassinato la sua famiglia. La cicatrice sul viso era inconfondibile. Senza farsi notare iniziò a seguirlo attraverso vicoli e strade sempre più isolate fino a raggiungere un vecchio magazzino abbandonato. Attraverso una finestra sporca vide l'interno dell'edificio e il suo cuore accelerò. Gli altri due assassini erano lì.\n\nPer anni aveva sognato quel momento. Attese fino al calare della notte. Quando il magazzino piombò nel silenzio, si arrampicò attraverso una finestra ed entrò senza fare rumore. Uno degli uomini dormiva con un pugnale infilato alla cintura. Darian lo estrasse lentamente e gli tagliò la gola prima che potesse svegliarsi. Poi raggiunse il secondo, che morì nello stesso silenzio. Il terzo aprì gli occhi appena in tempo per vedere una figura emergere dall'oscurità. Fu l'ultima cosa che vide.\n\nQuando il sole sorse, i tre uomini che avevano sterminato la sua famiglia erano morti.\n\nDarian tornò da Morigue e gli raccontò tutto. Lo zio rimase in silenzio a lungo. Non era impressionato dal fatto che il ragazzo si fosse vendicato. Era impressionato dal modo in cui l'aveva fatto: freddamente, silenziosamente e senza la minima esitazione.\n\nDa quel giorno decise di farne qualcosa di più di un semplice informatore. Fece addestrare Darian dai migliori combattenti che riuscì a trovare e gli insegnò personalmente l'arte delle due scimitarre. Erano le stesse lame che aveva brandito la notte in cui gli aveva salvato la vita. All'inizio Darian cadeva, sbagliava e si feriva continuamente, ma con il passare degli anni le armi divennero un'estensione naturale del suo corpo. I suoi movimenti erano rapidi, eleganti e mortali.\n\nMorigue gli insegnò anche un'altra abilità: il liuto. Un musicista poteva entrare quasi ovunque senza destare sospetti. Palazzi nobiliari, locande, case mercantili e sale da gioco aprivano le porte a chi sapeva intrattenere gli ospiti. Così, mentre gli altri ascoltavano la musica, Darian ascoltava conversazioni. Memorizzava segreti, scopriva tradimenti e individuava obiettivi.\n\nNegli anni successivi divenne l'arma più preziosa di Morigue. Rubava documenti, recuperava informazioni, eliminava rivali e si infiltrava nelle organizzazioni nemiche. Ogni successo aumentava il potere della banda. Ogni missione accresceva la sua fama.\n\nLe persone iniziarono a raccontare storie su una figura vestita di nero che compariva dal nulla e spariva come un fantasma. Si diceva che nessuna serratura potesse fermarlo, che nessuna guardia riuscisse a vederlo arrivare e che le sue due scimitarre apparissero nell'oscurità un istante prima della morte.\n\nBen presto il suo vero nome venne dimenticato da molti. Nei vicoli di Plia, nelle taverne malfamate e nei covi della criminalità tutti lo chiamavano nello stesso modo.\n\nIl Nero.\n\nOltre Plia\n\nQuindici anni erano trascorsi dalla notte in cui la famiglia di Darian era stata sterminata.\n\nIn quel tempo molte cose erano cambiate.\n\nLa banda di Morigue, un tempo poco più di un gruppo di criminali dei bassifondi, era cresciuta fino a diventare una delle organizzazioni più influenti di tutta Plia. I mercanti pagavano per la sua protezione, le guardie cittadine chiudevano spesso un occhio davanti ai suoi affari e persino alcune famiglie nobili preferivano trattare con lui piuttosto che averlo come nemico.\n\nMorigue era riuscito dove molti avevano fallito.\n\nAveva costruito un impero.\n\nE gran parte di quel successo era dovuto a Darian.\n\nOvunque si sussurrava il nome del Nero. Le storie sul suo conto erano diventate leggenda. Alcuni sostenevano che fosse in grado di attraversare una fortezza senza essere visto. Altri giuravano che potesse comparire alle spalle di un uomo senza produrre alcun rumore. La verità era più semplice: Darian era diventato talmente bravo nel suo lavoro da sembrare qualcosa di sovrannaturale.\n\nEppure, nonostante il potere, la ricchezza e il rispetto che si era conquistato, qualcosa continuava a tormentarlo.\n\nPlia.\n\nOgni strada della città gli ricordava il passato.\n\nOgni vicolo custodiva un ricordo.\n\nOgni quartiere gli riportava alla mente la notte in cui aveva perso tutto.\n\nA volte si ritrovava davanti alla vecchia casa della sua famiglia senza nemmeno rendersene conto. Rimaneva là in silenzio, osservando l'edificio ormai abbandonato mentre i fantasmi della sua infanzia tornavano a tormentarlo.\n\nLa vendetta aveva placato la sua rabbia.\n\nMa non aveva guarito le sue ferite.\n\nUna sera, mentre il sole tramontava dietro le mura della città, Darian raggiunse la dimora di Morigue.\n\nLo trovò nel suo studio.\n\nLo zio era seduto dietro una pesante scrivania di legno scuro. Le due scimitarre che lo avevano reso famoso erano appese alla parete alle sue spalle.\n\nMorigue sollevò lo sguardo.\n\nHai quell'espressione da diversi mesi.\n\nDarian rimase in piedi davanti a lui.\n\nQuale espressione?\n\nQuella di un uomo che non riesce più a respirare dove si trova.\n\nPer qualche istante nessuno parlò.\n\nAlla fine Darian sospirò. Voglio andarmene per un po'.\n\nMorigue non sembrò sorpreso.\n\nDa Plia?\n\nDa tutto questo.\n\nLo zio intrecciò le dita e lo osservò attentamente.\n\nSei stanco?\n\nNo.\n\nSei deluso?\n\nNo.\n\nAllora cos'è?\n\nDarian si avvicinò alla finestra.\n\nFuori, la città brillava sotto le luci delle torce.\n\nHo passato la mia vita a percorrere queste strade. Conosco ogni vicolo, ogni tetto e ogni segreto di questa città. Ma ogni volta che guardo Plia vedo ancora quella casa. Vedo ancora mia madre, mio padre e mia sorella.\n\nMorigue abbassò lo sguardo.\n\nEra raro sentir parlare Darian della sua famiglia.\n\nLa città è diventata una prigione continuò il giovane. Non fatta di mura. Di ricordi.\n\nIl vecchio capo banda rimase in silenzio per alcuni istanti.\n\nPoi annuì.\n\nAllora parti.\n\nDarian si voltò sorpreso.\n\nCosì facilmente?\n\nMorigue lasciò sfuggire una breve risata.\n\nTi avrei fermato anni fa. Ma ormai non sei più un ragazzo che ha bisogno di essere protetto.\n\nLo zio si alzò e si avvicinò a lui.\n\nHai servito la nostra organizzazione fedelmente. Hai contribuito a costruire tutto ciò che possediamo. Se credi che questo viaggio sia quello di cui hai bisogno, hai il mio permesso.\n\nLa mattina seguente Darian lasciò Plia.\n\nMentre le mura di Plia sparivano lentamente all'orizzonte, Darian si concesse un ultimo sguardo alla città.\n\nEra il luogo che gli aveva dato tutto.\n\nEd era anche il luogo che gli aveva portato via tutto.\n\nPoi voltò le spalle al passato e proseguì verso terre sconosciute.",
  "Soran": "",
  "Zethir": "Zethir Nightwhisper è uno Shadar-Kai che ha dedicato la sua esistenza a Kal-durr, egli è divenuto un braccio armato del destino la cui vocazione è quella di eliminare chi cerca di stravolgerlo o di eluderlo come negromanti, non morti o qualcuno che voglia riscrivere degli eventi col fine di influenzare il destino stesso. Zethir parla poco, risultando spesso distaccato e lontano dalle emozioni, a primo impatto ne risulta quasi privo, assumendo un aspetto malinconico nel suo insieme. Zethir non teme la morte, essendo conscio che se dovesse accadere sarebbe il suo destino e sarebbe solamente un passaggio, quando la infligge non lo fa mai con odio ma con la decisione di chiudere un capitolo necessario. Zethir ha l'aspetto di un elfo, tranne che per la pelle grigia e pallida, le irido grige ed i capelli bianchi che a volte fanno si che venga scambiato per un drow. Ha un fisico slanciato ed atletico, alto circa 185cm ed i capelli sono lunghi spesso raccolti in una coda che li fa ricadere fluidi alle sue spalle, la sua figura nel complesso risulta quasi malinconica unita al suo carattere, ma il suo sguardo trasmette una placida tranquillità. È difficile vederlo senza la sua armatura indosso, che toglie solamente per riposare e prendersene cura con molta attenzione in una sorta di rituale.",
  "Aksel": "Sono il terzogenito di una famiglia nobiliare. Non avendo diritto ad un'eredità, sono stato mandato sin da giovanissimo in un'accademia di magia a studiare.\n\nMe la son cavata bene sin da subito con la teoria, ma all'atto pratico ho avuto grossi problemi: era come se, tranne che per gli incantesimi più semplici, la mia magia si disperdesse quando li lanciavo. A 20 anni ho trovato nella biblioteca accademica un antico tomo che parlava di una, ormai in disuso, arte di lancio degli incantesimi, la quale consisteva nel concentrare l'energia magica, attraverso l'uso di focus arcani appositi, in forma di frecce arcane da scagliare. Oltre che al restarne affascinato, pensai che quella potesse essere la soluzione al mio problema e, per i successivi 10 anni, sperimentai e cercai di riprodurre sia il focus che quel particolare stile di lancio degli incantesimi.\n\nEbbi ragione; dopo tanto lavoro sono riuscito a ricreare quest'arte perduta nella sua forma più semplice. Decisi a quel punto di abbandonare gli studi e vivere di avventura per affinare la mia tecnica e scoprire quante e quali magie poter lanciare in quel modo. Il mio sogno divenne quindi quello di diventare maestro di quest'arte e fondare una scuola dedita al suo insegnamento ai posteri.",
  "Dago": "Origini NobiliariCesare Renzi, soprannominato Dago, nacque nelle Case del Fiume, nella residenza sopraelevata della sua famiglia nobile. La casata Renzi è antica ma modesta: rispettata nelle vie del Porto dei Sussurri e conosciuta per la sua discrezione più che per il potere. La sua infanzia fu un mosaico di luce e ingranaggi, tra lezioni di retorica impartite da maestri elfi, giardini sospesi mossi dal vento e il lento scorrere del Grande Fiume Gelato sotto la sua stanza. Conobbe un mondo che sembrava sempre pronto a offrirgli un nuovo enigma da decifrare.\n\nLa nascita del ladro pianificatoreCesare non divenne ladro per necessità, ma perché era bravo. Scoprì di saper leggere le intenzioni negli sguardi, di muoversi senza essere notato tra le ombre del Ponte del Respiro e di prevedere le mosse altrui come ingranaggi di una macchina perfetta. Non rubava oro, ma informazioni, documenti e segreti in grado di influenzare il fragile equilibrio di Yotta. La nobiltà e i mercanti lo conoscono come un uomo rispettabile; pochi sospettano la verità.\n\nTratti di personalità e difettoAffabile e brillante: ama le conversazioni intelligenti.\n\nCalcolatore: ogni sua azione è parte di un piano più grande.\n\nCurioso fino all'imprudenza: i segreti lo attirano come una fiamma.\n\nElegante: evita la violenza inutile anche nel crimine.\n\nDifetto psicologico: Cesare soffre di una profonda dipendenza dal controllo e non sopporta che qualcosa gli sfugga. Questa ossessione lo porta a manipolare chi gli sta vicino e a vedere minacce dove non ce ne sono, convinto che senza il suo controllo tutto crollerebbe.\n\nIdeale e motivazione profondaIdeale: L'equilibrio. Cesare vuole essere la mente invisibile che impedisce alla città di cadere, risolvendo ciò che la politica non può affrontare.\n\nMotivazione: Dimostrare di essere indispensabile, affinché il suo valore venga riconosciuto.\n\nOggetto personale e segreto profondoOggetto: La Spilla del Pianto, una piccola spilla d'argento raffigurante una goccia che cade nel Grande Fiume Gelato. È un regalo del suo vecchio tutore e la porta sempre nascosta come talismano.\n\nSegreto: Da anni riceve lettere anonime in calligrafia antica che anticipano eventi e scandali prima che accadano. L'ultima lettera recitava: \"Quando cadrà l'equilibrio, tu sarai la prima chiave. E la prima vittima\". Questo lo porta a dubitare di ogni alleato.\n\nLegami e posizione socialeCasata Renzi: Famiglia rispettata ma non influentissima.\n\nLyris \"la Seta\": Ladra rivale; tra loro c'è un rapporto di attrazione e tradimenti.\n\nMaestro Vhalor: Precettore colto e ambiguo che gli ha insegnato a leggere l'invisibile.\n\nCapitano Roderik Hale: Guardia del Porto, onesto e sospettoso, che ammira Cesare.\n\nNanius Brakk: Gestisce una bottega rispettabile che nasconde il mercato nero.\n\nMotto: \"La verità è un'arma. Io scelgo dove puntarla.\" Frase iconica: \"Ogni serratura ha una chiave. A volte basta sapere chi la tiene.\"\n\nIl Segreto della Chiave MeccanicaCesare custodisce un segreto mai rivelato: durante un rapimento al Porto dei Sussurri gli fu estratto l'anulare sinistro insieme alla Chiave Meccanica. I rapitori, una cellula del mercato nero, hanno sigillato il dito perfettamente conservato dentro un ingranaggio della Cittadella dei Meccanismi. L'anello-chiave è nascosto in una camera meccanica accessibile solo con conoscenze specifiche o la complicità di un artigiano. Cesare ricorda solo frammenti del dolore e un vuoto che lo perseguita.",
  "Karlberht": "Karlberht è originario di un villaggio remoto lontano dai regni più potenti. Un giorno però, nonostante la lontananza, un reggimento dell'esercito del regno/impero (a discrezione del master) che era impiegato in una campagna militare in quei territori, si imbatté nel piccolo villaggio e lo occupò, usandolo come accampamento per qualche tempo. Il capo villaggio non ne poteva più dei soprusi del capitano del reggimento e dei suoi sottoposti, così raccolse tutti gli uomini del villaggio e, a costo di molte vite compresa quella del capo villaggio, riuscirono inaspettatamente a scacciare i soldati invasori dal villaggio. Purtroppo la settimana seguente il resto dell'esercito passò di lì e, al corrente della ribellione del villaggio, aveva intenzione di uccidere tutti. Senza più un capo a cui riferirsi, lo Sciamano (nome a discrezione del master, se utile) del villaggio fece da mediatore con il comandante (nome a discrezione del master, se di qualche utilità), e riuscì a salvare il villaggio in cambio del primogenito dello Sciamano come ostaggio.\n\nIl bambino (Karlberht) aveva solo 5 anni ma aveva lo sguardo determinato e selvaggio, e, durante la negoziazione, il bimbo salvó il comandante dal morso di un serpente velenoso. Il comandante, devoto agli dèi, interpretò come segno divino l'accaduto e prese con sé il fanciullo per addestrarlo personalmente.\n\nKarlberht viene allevato e addestrato come componente di un unità speciale (cavalieri dell' eco/ nome a discrezione del master) usata poi per missioni importanti, ma Karlberht non ha dimenticato le sue radici barbariche e il padre Sciamano, e serve il comandante in cambio della protezione del proprio villaggio dal resto dell'esercito. Di ritorno da una missione impegnativa però, karlberht viene a sapere che il suo comandante è stato accusato di alto tradimento (se a ragione o a torto lascio a discrezione del master) e la sua unità riassegnata a un altro comandante, che ha già raso al suolo il suo villaggio uccidendo tutti.\n\nKarlberht ha dunque abbandonato il suo posto tra i ranghi dei \"cavalieri dell'eco\" senza aver più la volontà di combattere, ma un giorno lo spirito del padre Sciamano lo contatta dal regno dei morti (in una visione/sono ad occhi aperti) e gli rivela la sua vera natura di figlio di (creatura divina/ultraterrena della lore) e lo incarica di fare (missione per raggiungere il resto del gruppo e scoprire le sue vere origini)",
};

/* Compagnie con almeno un eroe ATTIVO: quelle svuotate (es. Lac) spariscono
   dal registro senza cancellare i dati — basta riattivare un membro. */
const ACTIVE_PARTIES = PARTIES.filter((p) => p.members.some((m) => !m.hidden && !isHiddenName(m.name)));

/* normalizza un nome per il confronto (minuscolo, apostrofi, spazi). */
const normName = (s) =>
  String(s ?? "").toLowerCase().replace(/[´`’‘ʼ]/g, "'").replace(/\s+/g, " ").trim();
/* prima "parola" del nome — per agganciare l'eroe al suo personaggio Firestore. */
const firstTok = (s) => normName(s).split(/[\s'"\-]+/)[0];

/* abilità mostrate nella scheda (chiave Firestore → etichetta). */
const ABILITY_LABELS = [
  ["str", "FOR"], ["dex", "DES"], ["con", "COS"],
  ["int", "INT"], ["wis", "SAG"], ["cha", "CAR"],
];

/* helper: filtra i membri visibili di una compagnia secondo la query */
function membersFor(party, query) {
  const q = query.trim().toLowerCase();
  return party.members
    .filter((m) => !m.hidden && !isHiddenName(m.name))
    .filter((m) => !q || [m.name, m.race, m.class, party.id, party.name]
      .filter(Boolean).join(" ").toLowerCase().includes(q));
}

/* ── Eroe = pannello del Nesso con anello-ritratto (tap → scheda).
   `hero.locked` = personaggio non ancora sbloccato: nessun ritratto
   (placeholder dell'anello) e scheda non apribile. ── */
function RosterEntry({ hero, tag, onOpen }) {
  const locked = !!hero.locked;
  return (
    <button
      type="button"
      className={`nx-pannello eroe-card ${locked ? "eroe-card--locked" : "nx-pannello--tap"}`}
      style={{ "--cls": classColor(hero.class) }}
      onClick={locked ? undefined : onOpen}
      aria-disabled={locked || undefined}
      title={locked ? "Personaggio non ancora sbloccato" : undefined}
    >
      <span className="nx-tag">{locked ? "🔒" : tag}</span>
      <span className="nx-anello">
        {locked ? (
          <span className="nx-anello-ph" aria-hidden="true">?</span>
        ) : (
          <img
            src={hero.image}
            alt={hero.name}
            loading="lazy"
            onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
          />
        )}
      </span>
      <span className="nx-nome">{hero.name}</span>
      <span className="nx-meta">{hero.race}</span>
      <span className="eroe-classe">{hero.class}</span>
      <span className="eroe-cue" aria-hidden="true">{locked ? "Non sbloccato" : "Scheda ›"}</span>
    </button>
  );
}

/* ── Scheda eroe = modale-varco del Nesso ── */
function HeroModal({ hero, party, char, onClose }) {
  const bio = (HERO_BIOS[hero.name] || "").trim();
  const bioParas = bio ? bio.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];

  // Dati "ricchi" presi dal foglio personaggio (se agganciato).
  const race = char?.race || hero.race;
  const klass = char?.class || hero.class;
  const subclass = char?.subclass;
  const background = char?.background;
  const level = char?.level;
  const st = char?.stats || null;

  return (
    <div className="nx-modale-overlay" onClick={onClose}>
      <div
        className="nx-modale eroe-modale"
        style={{ "--cls": classColor(klass) }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="nx-modale-close" onClick={onClose} aria-label="Chiudi">✕</button>
        <img
          className="nx-modale-img"
          src={hero.image}
          alt={hero.name}
          onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
        />
        <span className="nx-kicker">{party.code} · {party.name}</span>
        <h3 className="nx-titolo">{hero.name}</h3>
        {Number.isFinite(level) && (
          <span className="nx-tag nx-tag--inline eroe-livello">Livello {level}</span>
        )}

        <div className="nx-meta-box">
          <p><strong>Razza</strong> {race || "—"}</p>
          <p><strong>Classe</strong> <span className="eroe-classe eroe-classe--inline">{klass || "—"}</span></p>
          {subclass && <p><strong>Sottoclasse</strong> {subclass}</p>}
          {background && <p><strong>Origine</strong> {background}</p>}
        </div>

        {/* Statistiche dal foglio personaggio */}
        {st && (
          <div className="eroe-sheet">
            <div className="eroe-vitals">
              {Number.isFinite(st.hp ?? st.maxHp) && (
                <span className="eroe-vital"><b>{st.hp ?? st.maxHp}</b><i>PF</i></span>
              )}
              {Number.isFinite(st.ac) && (
                <span className="eroe-vital"><b>{st.ac}</b><i>CA</i></span>
              )}
              {Number.isFinite(st.speed) && (
                <span className="eroe-vital"><b>{st.speed}</b><i>Vel.</i></span>
              )}
            </div>
            <div className="nx-pillole eroe-abilities">
              {ABILITY_LABELS.map(([key, label]) => {
                const a = st[key];
                if (!a || !Number.isFinite(a.score)) return null;
                const mod = Number.isFinite(a.mod) ? a.mod : Math.floor((a.score - 10) / 2);
                return (
                  <span key={key} className="eroe-ability" title={`${label} ${a.score} (${mod >= 0 ? "+" : ""}${mod})`}>
                    <i>{label}</i>
                    <span className="eroe-d20" aria-hidden="true">
                      <svg viewBox="0 0 100 100"><path d="M50 4 92 28v44L50 96 8 72V28z" /><path className="eroe-d20-facce" d="M50 4v18M50 22 92 28M50 22 8 28M50 22 78 66M50 22 22 66M22 66h56M22 66 8 72M78 66l14 6M22 66 50 96M78 66 50 96" /></svg>
                      <b>{a.score}</b>
                    </span>
                    <em>{mod >= 0 ? `+${mod}` : mod}</em>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Biografia (riempibile in HERO_BIOS) */}
        {bioParas.length > 0 && (
          <div className="nx-prosa eroe-bio">
            <span className="nx-kicker">Biografia</span>
            {bioParas.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}

        <p className="nx-citazione">«{party.motto}»</p>
      </div>
    </div>
  );
}

/* ── Casata = etichetta di sezione + griglia di pannelli ── */
function HouseSection({ party, query, charByName, focusHero, onFocusConsumed }) {
  const [openIdx, setOpenIdx] = useState(null);
  const visibleMembers = membersFor(party, query);

  // Apertura automatica della scheda quando si arriva da un link (?hero=…)
  useEffect(() => {
    if (!focusHero) return;
    const idx = visibleMembers.findIndex((m) => !m.locked && firstTok(m.name) === firstTok(focusHero));
    if (idx >= 0) {
      setOpenIdx(idx);
      onFocusConsumed?.();
      const el = document.getElementById(`party-${party.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusHero]);

  if (visibleMembers.length === 0) return null;
  const open = openIdx != null ? visibleMembers[openIdx] : null;

  return (
    <section id={`party-${party.id}`} className="casata" data-id={party.id}>
      <div className="gl-sezlabel">{party.code} · {party.name}</div>
      <p className="nx-nota casata-motto">«{party.motto}» · {visibleMembers.length} {visibleMembers.length === 1 ? "eroe" : "eroi"}</p>

      <div className="nx-griglia casata-griglia">
        {visibleMembers.map((m, i) => (
          <RosterEntry key={m.name} hero={m} tag={party.id} onOpen={() => setOpenIdx(i)} />
        ))}
      </div>

      {open && (
        <HeroModal
          hero={open}
          party={party}
          char={charByName?.get(firstTok(open.name)) || null}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function Party() {
  const [activeParty, setActiveParty] = useState("all");
  const [query, setQuery] = useState("");
  const [chars, setChars] = useState([]);
  const [searchParams] = useSearchParams();
  const [focusHero, setFocusHero] = useState(() => searchParams.get("hero") || null);
  useParallaxScroll();

  // Foglio personaggi (lettura pubblica) → dati ricchi nella scheda eroe.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      setChars(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !isHiddenChar(c)));
    }, () => {});
    return () => unsub();
  }, []);

  // Lookup: prima parola del nome → personaggio Firestore.
  const charByName = useMemo(() => {
    const m = new Map();
    for (const c of chars) {
      if (!c.name) continue;
      const key = firstTok(c.name);
      if (key && !m.has(key)) m.set(key, c);
    }
    return m;
  }, [chars]);

  const allMembers = useMemo(
    () => ACTIVE_PARTIES.flatMap((p) => p.members.filter((m) => !m.hidden && !isHiddenName(m.name)).map((m) => ({ ...m, party: p.id }))),
    []
  );

  const stats = useMemo(() => ({
    parties: ACTIVE_PARTIES.length,
    heroes:  allMembers.length,
    races:   new Set(allMembers.map((m) => m.race)).size,
    classes: new Set(allMembers.map((m) => m.class)).size,
  }), [allMembers]);

  const visibleParties = useMemo(
    () => activeParty === "all" ? ACTIVE_PARTIES : ACTIVE_PARTIES.filter((p) => p.id === activeParty),
    [activeParty]
  );

  const matchCount = useMemo(
    () => visibleParties.reduce((n, p) => n + membersFor(p, query).length, 0),
    [visibleParties, query]
  );

  return (
    <section className="cine-page party-page cine-compact" style={{ "--cine-accent": "#a83232", "--cine-accent-2": "#c0392b" }}>
      <AmbientFX variant="cosmos" />

      {/* ── HERO = VARCO esagonale (nesso.css) ── */}
      <GlacierHero
        id="party-top"
        ariaLabel="Le Compagnie di Exanthia"
        image={HERO_IMAGE}
        imgPos="center 28%"
        eyebrow="Registro Araldico"
        title={<>Le Compagnie<br />di Exanthia</>}
        seal={`${stats.heroes} eroi attivi · ${stats.parties} compagnie`}
        tagline={`${NUM_IT[stats.parties] || stats.parties} compagnie. ${NUM_IT[stats.heroes] || stats.heroes} anime. Una sola leggenda che si scrive, notte dopo notte, sulle pietre di Exanthia.`}
        actions={<a href="#party-index" className="gl-cta">✦ Sfoglia il registro</a>}
      />

      {/* ── INDICE DELLE CASATE: pillole-satellite (filtro) ── */}
      <div id="party-index" className="party-index">
        {/* legenda dei colori di classe */}
        <div className="eroe-legenda" aria-label="Colori delle classi">
          {[...new Set(allMembers.map((m) => m.class).filter((c) => c && c !== "??"))].sort().map((c) => (
            <span key={c} className="eroe-classe" style={{ "--cls": classColor(c) }}>{c}</span>
          ))}
        </div>
        <div className="nx-pillole" role="tablist">
          <button
            type="button"
            className={`nx-pillola ${activeParty === "all" ? "on" : ""}`}
            onClick={() => setActiveParty("all")}
          >
            ✦ Tutte
          </button>
          {ACTIVE_PARTIES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`nx-pillola ${activeParty === p.id ? "on" : ""}`}
              onClick={() => setActiveParty(p.id)}
            >
              <b className="party-pill-code">{p.code}</b> {p.id}
            </button>
          ))}
        </div>
      </div>

      {/* ── RICERCA ── */}
      <CineToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Cerca per nome, razza o classe…"
        count={matchCount}
        countNoun={matchCount === 1 ? "eroe" : "eroi"}
      />

      {/* ── CASATE ── */}
      <div className="casate">
        {matchCount === 0 ? (
          <p className="cine-empty">Nessun eroe corrisponde alla ricerca.</p>
        ) : (
          visibleParties.map((p) => (
            <HouseSection
              key={p.id}
              party={p}
              query={query}
              charByName={charByName}
              focusHero={focusHero}
              onFocusConsumed={() => setFocusHero(null)}
            />
          ))
        )}
      </div>
    </section>
  );
}
