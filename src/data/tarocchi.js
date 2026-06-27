/* ============================================================
   TAROCCHI — Arcani Maggiori (0–21)
   Database verificato dei 22 Arcani Maggiori con significato
   in posizione DRITTA e ROVESCIATA. Usato da src/pages/Tarocchi.jsx.

   Immagini (opzionali — finché mancano si usa un placeholder):
     dorso  → /assets/tarocchi/back.png
     figura → /assets/tarocchi/<n>.png   (0.png … 21.png)
   ============================================================ */

export const ARCANI = [
  { n: 0,  nome: "Il Matto",               glifo: "0",     simbolo: "🃏", dritto: "Inizi, spontaneità, fede nel futuro.",                         rovescio: "Sconsideratezza, stallo, decisioni affrettate." },
  { n: 1,  nome: "Il Bagatto",             glifo: "I",     simbolo: "🪄", dritto: "Manifestazione, potere, azione, abilità.",                    rovescio: "Manipolazione, talento sprecato, scarsa pianificazione." },
  { n: 2,  nome: "La Papessa",             glifo: "II",    simbolo: "🌙", dritto: "Intuizione, saggezza interiore, mistero.",                    rovescio: "Segreti svelati, superficialità, intuito bloccato." },
  { n: 3,  nome: "L'Imperatrice",          glifo: "III",   simbolo: "🌹", dritto: "Abbondanza, femminilità, creatività, natura.",               rovescio: "Blocco creativo, dipendenza, soffocamento." },
  { n: 4,  nome: "L'Imperatore",           glifo: "IV",    simbolo: "♛", dritto: "Struttura, autorità, stabilità, controllo.",                  rovescio: "Tirannia, rigidità, mancanza di disciplina." },
  { n: 5,  nome: "Il Papa",                glifo: "V",     simbolo: "⛪", dritto: "Tradizione, guida spirituale, educazione.",                   rovescio: "Ipocrisia, ribellione, cattivi consigli." },
  { n: 6,  nome: "Gli Amanti",             glifo: "VI",    simbolo: "❤", dritto: "Amore, armonia, relazioni, scelte importanti.",               rovescio: "Squilibrio, disarmonia, indecisione." },
  { n: 7,  nome: "Il Carro",               glifo: "VII",   simbolo: "🛡", dritto: "Successo, ambizione, controllo, vittoria.",                   rovescio: "Mancanza di direzione, aggressività, fallimento." },
  { n: 8,  nome: "La Giustizia",           glifo: "VIII",  simbolo: "⚖", dritto: "Equità, verità, legge, causa ed effetto.",                    rovescio: "Ingiustizia, disonestà, pregiudizio." },
  { n: 9,  nome: "L'Eremita",              glifo: "IX",    simbolo: "🕯", dritto: "Riflessione, introspezione, solitudine.",                     rovescio: "Isolamento, ritiro eccessivo, paranoia." },
  { n: 10, nome: "La Ruota della Fortuna", glifo: "X",     simbolo: "🎡", dritto: "Cambiamento, cicli, destino, colpo di fortuna.",             rovescio: "Sfortuna, resistenza al cambiamento, stagnazione." },
  { n: 11, nome: "La Forza",               glifo: "XI",    simbolo: "🦁", dritto: "Coraggio, persuasione, resilienza, forza interiore.",        rovescio: "Debolezza, insicurezza, abuso di potere." },
  { n: 12, nome: "L'Appeso",               glifo: "XII",   simbolo: "🙃", dritto: "Pausa, sacrificio, nuova prospettiva.",                       rovescio: "Stagnazione, inutilità, resistenza al sacrificio." },
  { n: 13, nome: "La Morte",               glifo: "XIII",  simbolo: "💀", dritto: "Trasformazione profonda, fine, transizione.",                 rovescio: "Resistenza alla fine, paura del cambiamento." },
  { n: 14, nome: "La Temperanza",          glifo: "XIV",   simbolo: "⚗", dritto: "Equilibrio, pazienza, moderazione, guarigione.",             rovescio: "Eccesso, squilibrio, mancanza di armonia." },
  { n: 15, nome: "Il Diavolo",             glifo: "XV",    simbolo: "😈", dritto: "Dipendenza, materialismo, gioco, impulsi.",                   rovescio: "Liberazione, distacco, superamento delle paure." },
  { n: 16, nome: "La Torre",               glifo: "XVI",   simbolo: "🗼", dritto: "Cambiamento improvviso, caos, rivelazione.",                  rovescio: "Disastro evitato, paura del crollo, ritardo." },
  { n: 17, nome: "La Stella",              glifo: "XVII",  simbolo: "⭐", dritto: "Speranza, ispirazione, serenità, spiritualità.",             rovescio: "Disperazione, mancanza di fede, pessimismo." },
  { n: 18, nome: "La Luna",                glifo: "XVIII", simbolo: "🌕", dritto: "Illusione, paura, ansia, sogni, intuizione.",                rovescio: "Confusione totale, segreti, paura dell'ignoto." },
  { n: 19, nome: "Il Sole",                glifo: "XIX",   simbolo: "☀", dritto: "Positività, vitalità, gioia, successo.",                      rovescio: "Mancanza di successo, depressione, egoismo." },
  { n: 20, nome: "Il Giudizio",            glifo: "XX",    simbolo: "🎺", dritto: "Rinascita, chiamata, perdono, consapevolezza.",              rovescio: "Dubbio su se stessi, ritardi, rifiuto della verità." },
  { n: 21, nome: "Il Mondo",               glifo: "XXI",   simbolo: "🌍", dritto: "Completamento, integrazione, viaggio, successo.",            rovescio: "Incompiutezza, mancanza di chiusura, ritardi." },
];

// Percorsi immagine. I nomi file sono irregolari (1_.jpg…4_.jpg, back3.png),
// quindi si usa una mappa esplicita; il fallback è gestito a runtime via onError.
const FACE_FILE = {
  0: "0.jpg", 1: "1_.jpg", 2: "2_.jpg", 3: "3_.jpg", 4: "4_.jpg",
  5: "5.jpg", 6: "6.jpg", 7: "7.jpg", 8: "8.jpg", 9: "9.jpg",
  10: "10.jpg", 11: "11.jpg", 12: "12.jpg", 13: "13.jpg", 14: "14.jpg",
  15: "15.jpg", 16: "16.jpg", 17: "17.jpg", 18: "18.jpg", 19: "19.jpg",
  20: "20.jpg", 21: "21.jpg",
};
export const cardFaceSrc = (n) => `/assets/tarocchi/${FACE_FILE[n] || `${n}.jpg`}`;

// I 7 dorsi disponibili (back3 è .png, gli altri .jpg).
export const CARD_BACKS = ["back1.jpg", "back2.jpg", "back3.png", "back4.jpg", "back5.jpg", "back6.jpg", "back7.jpg"];
export const DEFAULT_BACK = CARD_BACKS[0];
export const cardBackSrc = (file) => `/assets/tarocchi/${file || DEFAULT_BACK}`;

// Numero massimo di carte per lettura.
export const MAX_CARDS = 3;

// Lookup rapido per numero d'Arcano (usato dalla cronologia).
export const ARCANO_BY_N = Object.fromEntries(ARCANI.map((a) => [a.n, a]));

// ── Ruoli dell'Oracolo ──────────────────────────────────────────────────────
// Privilegiati (pagina completa): il Master e il PG Alaric.
// Makenna (ripperti96) NON è privilegiata qui: usa l'Oracolo da giocatrice.
export const ORACLE_MASTER_EMAIL = "santomassimo85@gmail.com";
// Alaric è identificato per NOME personaggio (collection characters).
export const isAlaricName = (name) => /^\s*alaric/i.test(String(name || ""));

// Foto del personaggio Alaric (l'oracolo bendato).
export const ALARIC_PORTRAIT = "/assets/player/alaric.png";

// Stese: numero di carte → titolo + ruolo di ogni posizione.
export const STESE = {
  1: { titolo: "La Carta del Giorno", ruoli: ["Il Responso"] },
  2: { titolo: "Bivio",               ruoli: ["La Sfida", "Il Consiglio"] },
  3: { titolo: "La Linea del Tempo",  ruoli: ["Passato", "Presente", "Futuro"] },
  4: { titolo: "Il Sentiero",         ruoli: ["Situazione", "Ostacolo", "Consiglio", "Esito"] },
  5: { titolo: "La Croce dell'Oracolo", ruoli: ["Passato", "Presente", "Futuro", "Causa nascosta", "Esito"] },
};
