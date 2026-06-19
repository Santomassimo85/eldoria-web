// functions/scriba/_sampleData.js
// Dati d'esempio (mimano collectScribaData NELLA NUOVA FORMA) per le prove
// locali dello Scriba: mese/stagione, geografia reale, dossier RISERVATO (da
// NON pubblicare), arena, mercato, anagrafe e numero precedente.
const { CONTINENTI } = require("./places");
const { exanthiaMonthInfo } = require("./calendar");

module.exports = {
    periodoGiorni: 10,
    mese: exanthiaMonthInfo(1), // Solleone, estate
    geografia: CONTINENTI,
    // DOSSIER RISERVATO — solo sfondo, NON pubblicabile (mima i riassunti).
    dossierRiservato: [
        { titolo: "Il crollo del Ponte di Valmorra", sfondo: "Una compagnia in fuga dai contrabbandieri ha fatto saltare i piloni del ponte; tre carri di merci perduti." },
        { titolo: "Patto con la Strega delle Paludi", sfondo: "Per un antidoto, è stato stretto un patto con Yssolde delle Paludi di Cenere." },
    ],
    arene: [
        {
            campione: "Garrok",
            razzaCampione: "Orco",
            stileCampione: "lama veloce",
            partecipanti: 8,
            classifica: [
                { nome: "Garrok", razza: "Orco", stile: "lama veloce", vittorie: 3, sconfitte: 0 },
                { nome: "Maelis del Velo", razza: "Elfa", stile: "incantatrice", vittorie: 2, sconfitte: 1 },
                { nome: "Vharn il Muto", razza: "Mezzorco", stile: "scudo pesante", vittorie: 1, sconfitte: 2 },
            ],
        },
    ],
    mercato: {
        venduti: [
            { oggetto: "Pugnale di ossidiana stillante", rarita: "raro", prezzo: 1200 },
            { oggetto: "Mappa del Cammino Sommerso", rarita: "non comune", prezzo: 450 },
        ],
        inVendita: [
            { oggetto: "Anello del Sussurro", rarita: "raro", base: 800 },
        ],
    },
    npcNoti: [
        { nome: "Maestro Aldwyn", citta: "Tirrendale", fazione: "Ordine del Pentacolo", descrizione: "Anziano arcanista, custode del Sacello Antico." },
        { nome: "Bargello Korr", citta: "Helmvil", fazione: "Guardia Cittadina", descrizione: "Capo delle guardie, ossessionato dai contrabbandieri del Liriath." },
    ],
    eroiDelReame: [
        { nome: "Tanagar", razza: "Umano", ruolo: "guerriero" },
        { nome: "Caius", razza: "Tiefling", ruolo: "stregone" },
        { nome: "Cleofe", razza: "Mezzelfa", ruolo: "ladra" },
    ],
    incarichiAperti: [
        { titolo: "Recupera il Calice Perduto", zona: "Selva Silente", difficolta: "Media", ricompensa: "500 monete d'oro", descrizione: "Reliquia trafugata da una cripta.", stato: "available" },
    ],
    numeroPrecedente: null,
};
