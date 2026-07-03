// Membri dei gruppi di gioco con i loro avatar (stessi asset di Party.jsx),
// usati come RIFERIMENTO visivo per la generazione delle immagini di scena
// (Scriptorium/SummaryAdmin e Cronaca DM). Chiavi allineate ai gruppi.
export const PARTY_MEMBERS = {
  AMEA: [
    { name: "Garroth", image: "/assets/player/garroth2.png" },
    { name: "Tanagar", image: "/assets/player/Tanagar2.png" },
    { name: "Caius",   image: "/assets/player/caius2.jpeg" },
    { name: "Sylva",   image: "/assets/player/Sylva.png" },
  ],
  LAC: [
    { name: "Horn",   image: "/assets/player/Horn.jpg" },
    { name: "Thoki",  image: "/assets/player/Thoki.jpg" },
    { name: "Cleofe", image: "/assets/player/Cleofe.jpg" },
  ],
  LEAF: [
    { name: "Soran",  image: "/assets/player/Soran.png" },
    { name: "Zethir", image: "/assets/player/Zethir.jpeg" },
    { name: "Taaras", image: "/assets/player/TaarasStormrage.png" },
  ],
  ENOX: [
    { name: "Makenna",    image: "/assets/player/Makenna.jpeg" },
    { name: "Temistocle", image: "/assets/player/Temistocle.jpeg" },
    { name: "Alaric",     image: "/assets/player/alaric.png" },
    { name: "Lael",       image: "/assets/player/lael.jpg" },
  ],
  ECO: [
    { name: "Aksel", image: "/assets/player/Aksel.png" },
    { name: "Dago",  image: "/assets/player/dago.jpeg" },
  ],
  Unico: [],
};

export const membersOf = (key) => PARTY_MEMBERS[key] || [];
