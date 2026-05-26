// Single source of truth for the world-map city hubs.
// Both GeoAdmin (NPC editor) and WorldMap (renderer) import from here so they
// can never drift out of sync. Adding a city here makes it available everywhere.
export const CITIES_HUB = [
  { name: "Tirrendale",                x: 50.55, y: 62.23 },
  { name: "Helmvil",                   x: 53.87, y: 37.42 },
  { name: "Yotta",                     x: 26.44, y: 31.82 },
  { name: "Foresta del Tiglio Bianco", x: 23.40, y: 43.20 },
  { name: "Castello Dorato",           x: 67.53, y: 20.68 },
  { name: "Gossvill",                  x: 86.37, y: 31.81 },
  { name: "Clan dei Senza Onore",      x: 26.82, y: 75.41 },
  { name: "Clan dei Demoni Grigi",     x: 44.32, y: 44.38 },
  { name: "Nerocastello",              x: 11.41, y: 35.18 },
  { name: "Thenduin Village",          x: 92.45, y: 30.12 },
  { name: "Monaci delle Sabbie",       x: 91.69, y: 41.26 },
  { name: "Torre dell'Arcano",         x: 72.29, y: 21.02 },
  { name: "Tassio",                    x: 60.88, y: 53.40 },
  { name: "Hopeclif",                  x: 74.38, y: 64.79 },
  { name: "Ganno",                     x: 64.55, y: 37.97 },
  { name: "Inss",                      x: 58.16, y: 75.81 },
  { name: "Nølborg",                   x: 19.56, y: 38.55 },
  { name: "Plia",                      x: 25.42, y: 50.47 },
  { name: "Altocolle",                 x: 31.88, y: 33.66 },
  { name: "Thelén Dhir",                x: 71.22, y: 43.77 },
];
