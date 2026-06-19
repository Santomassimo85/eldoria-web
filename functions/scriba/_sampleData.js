// functions/scriba/_sampleData.js
// Dati d'esempio (mimano collectScribaData) per le prove locali dello Scriba.
// Rispecchiano la forma REALE prodotta da collectEvents.js (con razze, NPC,
// eroi e incarichi) così l'anteprima locale mostra anche la sezione Arena.
module.exports = {
    periodoGiorni: 10,
    dal: "(prova)",
    al: "(prova)",
    riassunti: [
        {
            titolo: "Il crollo del Ponte di Valmorra",
            sottotitolo: "La compagnia fugge dalle fogne",
            data: "Recente",
            racconto:
                "Gli avventurieri, inseguiti da una banda di contrabbandieri, hanno fatto " +
                "saltare i piloni del vecchio Ponte di Valmorra per coprirsi la fuga. Il " +
                "ponte, arteria commerciale tra il quartiere dei conciatori e il mercato " +
                "basso, è precipitato nel canale. Nessun morto tra i popolani, ma tre " +
                "carri di merci perduti e il traffico cittadino in ginocchio.",
        },
        {
            titolo: "Patto con la Strega delle Paludi",
            sottotitolo: "",
            data: "Recente",
            racconto:
                "Per ottenere un antidoto raro, il gruppo ha stretto un patto con Yssolde, " +
                "la strega che abita le Paludi di Cenere. Si dice abbia chiesto in cambio " +
                "un favore da riscuotere 'quando le tre lune saranno allineate'.",
        },
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
        { nome: "Maestro Aldwyn", citta: "Capitale dei Sette", fazione: "Ordine del Pentacolo", descrizione: "Anziano arcanista, custode della Torre Sommersa." },
        { nome: "Bargello Korr", citta: "Mercato Basso", fazione: "Guardia Cittadina", descrizione: "Capo delle guardie, ossessionato dai contrabbandieri." },
    ],
    eroiDelReame: [
        { nome: "Tanagar", razza: "Umano", ruolo: "guerriero" },
        { nome: "Caius", razza: "Tiefling", ruolo: "stregone" },
        { nome: "Cleofe", razza: "Mezzelfa", ruolo: "ladra" },
    ],
    incarichiAperti: [
        { titolo: "Recupera il Calice Perduto", zona: "Foresta Sussurrante", difficolta: "Media", ricompensa: "500 monete d'oro", descrizione: "Una reliquia trafugata da una cripta nei boschi.", stato: "available" },
    ],
};
