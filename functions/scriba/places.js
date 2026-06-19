// functions/scriba/places.js
//
// Geografia REALE del mondo di Exanthia (da luoghi_per_continente.txt): 3
// continenti, ciascuno col proprio bioma, e i loro luoghi con clima, acqua,
// vegetazione, terreno e vocazione di vita. È l'ossatura su cui Lo Scriba ancora
// le notizie: nomi e CARATTERE dei luoghi sono veri. L'agent può inventare solo
// piccoli villaggi/accampamenti/locande MINORI; i luoghi grossi vengono da qui.

const CONTINENTI = [
  {
    nome: "Vathriddon",
    descrizione: "Il continente centrale, il più vasto. A nord catene innevate con valichi e fortezze nella roccia; al centro un reticolo di grandi fiumi e laghi con foreste miste e la capitale; a ovest una costa fredda e boscosa di baie e fiordi; a est e sud-est badlands aridi color ocra che sfumano nel deserto; a sud speroni rocciosi e praterie. Acqua, legname e selvaggina abbondanti al centro; frontiera dura e secca a oriente.",
    luoghi: [
      { nome: "Tirrendale", descrizione: "Capitale del continente, sulla foce/delta del fiume su un lago interno: città cinta dalle acque, porto fluviale, ponti e mulini, foreste e campi intorno. Clima temperato umido; pesca, traffici, crocevia commerciale. Cuore politico ed economico." },
      { nome: "Il Sacello Antico di Tirrendale", descrizione: "Antico santuario su altura boscosa presso Tirrendale, affacciato sul fiume. Culto e pellegrinaggio; bosco ombroso e sorgenti." },
      { nome: "Fiume Liriath", descrizione: "Il grande fiume che solca il continente da nord a sud-est, alimentato dalle nevi dei monti. Pesca, guadi, ponti levatoi; rive di prati, canneti e villaggi. Via d'acqua principale per commercio e spostamenti." },
      { nome: "Hakko", descrizione: "Borgo del nord montano addossato alle vette. Freddo e ventoso, terreno roccioso; conifere, miniere e caccia d'alta quota." },
      { nome: "Havondé", descrizione: "Cittadina dell'est su penisola verde affacciata al mare interno. Porto e pesca, campi terrazzati, clima mite costiero. Snodo marittimo verso oriente." },
      { nome: "Thelén Dhir", descrizione: "Sito di sapore elfico nell'est: torre di guardia / rovine su altura presso i boschi, a dominio delle terre aride. Foresta e roccia, acqua scarsa." },
      { nome: "Selva Silente", descrizione: "Fitta foresta primordiale di conifere, ombrosa e silenziosa. Sottobosco umido, ruscelli e radure; molta selvaggina. Terra di cacciatori, taglialegna e creature schive." },
      { nome: "Blumwood", descrizione: "Bosco rigoglioso di latifoglie e fioriture, clima mite e suolo fertile. Ruscelli, frutti e cacciagione. Vita agreste e venatoria." },
      { nome: "Boschi Sabbiosi", descrizione: "Boscaglia rada su terreno sabbioso, frontiera fra le foreste centrali e i badlands ocra. Querce basse, arbusti, dune; poca acqua, cacciagione minuta. Terra arida di confine." },
      { nome: "Clan dei Demoni Grigi", descrizione: "Accampamento di clan su alture rocciose grigie ai margini delle terre aride. Brullo e ventoso, acqua scarsa; razzia, allevamento e caccia dura. Insediamento ostile." },
      { nome: "Clan dei Senza Onore", descrizione: "Campo di reietti ai margini selvaggi, fra boscaglia e badlands. Terreno povero; vita di banda, predazione e sopravvivenza." },
      { nome: "Antica Città di Toua", descrizione: "Antica città in rovina dell'entroterra, riconquistata dalla foresta. Mura crollate, cisterne e sorgenti fra gli alberi; selvaggina fra le rovine. Sito storico e pericoloso." },
      { nome: "Helmvil", descrizione: "Villaggio fortificato presso le vie interne. Campi recintati, palizzate, boschi e ruscelli; vita agricola difensiva." },
      { nome: "Villaggio di Calen", descrizione: "Villaggio rurale di pianura fra campi, ruscelli e pascoli. Clima mite; agricoltura, allevamento e caccia stagionale." },
      { nome: "Tassio", descrizione: "Borgo presso colline e foreste interne, vicino a corsi d'acqua. Legname, caccia e piccoli commerci." },
      { nome: "Ganno", descrizione: "Borgo dell'entroterra su via di transito, fra campi e boschi radi. Mercato locale, agricoltura e allevamento." },
      { nome: "Inss", descrizione: "Piccolo insediamento isolato, avamposto fra le terre selvagge. Poche case, terreno aspro, caccia e raccolta di sussistenza." },
    ],
  },
  {
    nome: "Ehkia",
    descrizione: "Il continente innevato del nord-ovest: terra glaciale. Distese di tundra bianca, ghiacciai, coste gelate e mari freddi; foreste di conifere e tigli innevati. Clima rigido tutto l'anno. Vita dura: caccia da pelliccia, pesca nelle acque gelide, insediamenti fortificati contro il freddo e la guerra.",
    luoghi: [
      { nome: "Nerocastello", descrizione: "Cupa fortezza di pietra scura su pianura innevata presso la costa gelata. Roccaforte militare, terra di battaglie. Glaciale e duro; presidio e potere armato del nord." },
      { nome: "Yotta", descrizione: "Cittadina dai tetti rossi su piana nevosa presso il mare, attraversata da un fiume ghiacciato. Pesca e commercio costiero; clima freddo. Centro abitato principale fra le nevi." },
      { nome: "Nolborg", descrizione: "Insediamento a est di Nerocastello, sulla costa innevata. Borgo-fortezza esposto ai venti gelidi; pesca, caccia e difesa." },
      { nome: "Altocolle", descrizione: "Abitato d'altura nell'interno innevato di Ehkia, dominante sulle valli ghiacciate; conifere e caccia di montagna." },
      { nome: "Foresta del Tiglio Bianco", descrizione: "Foresta di tigli dalle chiome bianche di neve. Bosco rado e luminoso, suolo gelato, ruscelli ghiacciati; selvaggina da pelliccia e legname pregiato. Luogo silenzioso e suggestivo." },
    ],
  },
  {
    nome: "Ohzkie",
    descrizione: "Le terre temperato-aride dell'est: continente caldo e contrastato. A nord colline verdi, campi terrazzati e vigneti, una foresta dalle chiome chiare e porti sul mare; a sud una distesa sabbiosa quasi desertica; in mare aperto isolotti rocciosi. Vita di agricoltura e viticoltura, marineria e commercio costiero, ascesi monastica nelle sabbie.",
    luoghi: [
      { nome: "Gossvill", descrizione: "Cittadina portuale sulla costa nord-occidentale, con approdo e navi. Clima mite marittimo; pesca, commercio e cantieri. Porta d'accesso al continente." },
      { nome: "Hopecliff", descrizione: "Abitato di costa arroccato su scogliere affacciate al mare. Vento, salsedine e terrazze coltivate sul ciglio; pesca e vedetta marittima." },
      { nome: "Monastero dei Monaci delle Sabbie", descrizione: "Monastero isolato nella fascia sabbiosa e arida del sud. Dune, poca acqua, caldo secco; comunità ascetica, oasi e carovane. Ritiro e disciplina." },
      { nome: "Castello Dorato", descrizione: "Castello chiaro/dorato su una piccola isola verdeggiante in mare aperto, circondato dalle acque. Clima mite, isolamento difeso dal mare; sede signorile e ricca." },
      { nome: "Torre dell'Arcano", descrizione: "Torre solitaria su isolotti rocciosi battuti dal mare. Roccia nuda, onde e vento; luogo di studio arcano, isolato e quasi inaccessibile." },
    ],
  },
];

module.exports = { CONTINENTI };
