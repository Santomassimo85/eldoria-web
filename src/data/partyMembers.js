// Membri dei gruppi di gioco con avatar + razza/classe (stessi dati di
// Party.jsx), usati come RIFERIMENTO visivo e descrittivo per la generazione
// delle immagini di scena (Scriptorium/SummaryAdmin e Cronaca DM). Razza e
// classe servono al prompt per rispettare proporzioni e abbigliamento e non
// scambiare tratti tra un personaggio e l'altro.
export const PARTY_MEMBERS = {
  AMEA: [
    { name: "Garroth", race: "Mezz'Elfo", class: "Ranger",    image: "/assets/player/garroth2.png" },
    { name: "Tanagar", race: "Mezz'Orco", class: "Guerriero", image: "/assets/player/Tanagar2.png" },
    { name: "Caius",   race: "Elfo",      class: "Mago",      image: "/assets/player/caius2.jpeg" },
  ],
  LAC: [
    { name: "Horn",   race: "Umano",    class: "Ranger", image: "/assets/player/Horn.jpg" },
    { name: "Thoki",  race: "Gnomo",    class: "Mago",   image: "/assets/player/Thoki.jpg" },
    { name: "Cleofe", race: "Halfling", class: "Ladro",  image: "/assets/player/Cleofe.jpg" },
  ],
  LEAF: [
    { name: "Soran",  race: "Umano",      class: "Bardo",         image: "/assets/player/Soran.png" },
    { name: "Zethir", race: "Shadar-Kai", class: "Paladino",      image: "/assets/player/Zethir.jpeg" },
    { name: "Aksel",  race: "Umano",      class: "Arcane Sniper", image: "/assets/player/Aksel.png" },
    { name: "Dago",   race: "Umano",      class: "Ladro",         image: "/assets/player/dago.jpeg" },
  ],
  ENOX: [
    { name: "Makenna",    race: "Changeling", class: "Ladro",    image: "/assets/player/Makenna.jpeg" },
    { name: "Temistocle", race: "Halfling",   class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
    { name: "Alaric",     race: "Halfling",   class: "Warlock",  image: "/assets/player/alaric.png" },
    { name: "Lael",       race: "Alto Elfo",  class: "Mago",     image: "/assets/player/lael.jpg" },
  ],
  Unico: [],
};

export const membersOf = (key) => PARTY_MEMBERS[key] || [];
