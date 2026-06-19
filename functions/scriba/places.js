// functions/scriba/places.js
//
// Geografia REALE del mondo (da luoghi_per_continente.txt): 3 continenti e i
// loro luoghi. È l'ossatura su cui Lo Scriba ancora le notizie: nomi di città,
// regioni e fiumi veri. L'agent può inventare piccoli villaggi/accampamenti
// MINORI, ma i nomi grossi devono venire da qui.

const CONTINENTI = [
  {
    nome: "Vathriddon",
    luoghi: [
      "Antica Città di Toua", "Blumwood", "Boschi Sabbiosi", "Clan dei Demoni Grigi",
      "Clan dei Senza Onore", "Fiume Liriath", "Ganno", "Hakko", "Havondé", "Helmvil",
      "Il Sacello Antico di Tirrendale", "Inss", "Selva Silente", "Tassio",
      "Thelén Dhir", "Tirrendale", "Villaggio di Calen",
    ],
  },
  {
    nome: "Ehkia",
    luoghi: ["Altocolle", "Foresta del Tiglio Bianco", "Nerocastello", "Nolborg", "Yotta"],
  },
  {
    nome: "Ohzkie",
    luoghi: ["Castello Dorato", "Gossvill", "Hopecliff", "Monastero dei Monaci delle Sabbie", "Torre dell'Arcano"],
  },
];

module.exports = { CONTINENTI };
