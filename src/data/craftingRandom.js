// ── Oggetti basilari casuali per ogni professione (2026-11-17) ───────────────
// Un craft disponibile per ogni professione che genera un oggetto basilare di
// qualità Bassa (1–5), Media (6–15) o Alta (16+ / 20 nat.) usando Gemini AI
// (`craftingRandomItem`), con tabella locale di scorta se offline o lento.

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export function randomQualityForRoll(tier, total) {
  if (tier === "scarso" || Number(total) <= 5) {
    return { key: "bassa", label: "Qualità Bassa", icon: "🪨" };
  }
  if (Number(total) >= 16 || ["uncommon", "rare", "veryRare", "legendary"].includes(tier)) {
    return { key: "alta", label: "Qualità Alta", icon: "✨" };
  }
  return { key: "media", label: "Qualità Media", icon: "⚙" };
}

const FALLBACK_RANDOM = {
  fabbro: {
    bassa: ["Chiodi Storti da Campo", "Una manciata di chiodi e picchetti di ferro grezzo: tengono per una notte, poi si piegano."],
    media: ["Pugnale da Viaggio Temprato", "Lama semplice ma bilanciata, utile tanto per tagliare corde quanto per difendersi."],
    alta: ["Rampino d'Acciaio Silenzioso", "Rampino forgiato con precisione e rivestito in cuoio sui denti: non tintinna quando aggancia."],
  },
  alchimista: {
    bassa: ["Fiala di Olio Fumogeno Instabile", "Emette fumo denso per 1 round invece di un minuto e lascia odore di zolfo sugli abiti."],
    media: ["Balsamo Emostatico Rapido", "Unguento alchemico da spalmare su una ferita: stabilizza una creatura morente senza prove."],
    alta: ["Tonico di Prontezza Chiaro", "Infuso limpido dal sapore mentolato: dona +1 al prossimo tiro di Iniziativa entro 1 ora."],
  },
  intagliatore: {
    bassa: ["Bastone da Cammino Scheggiato", "Legno stagionato in fretta: regge il passo ma scricchiola sotto carico pesante."],
    media: ["Astuccio Stagionato per Dardi", "Faretra o astuccio intagliato con incastro antipioggia: protegge dardi e frecce dall'umidità."],
    alta: ["Fischietto da Segnale in Bosso", "Intagliato a doppio tono: udibile chiaramente a 300 metri o con soffio basso solo per gli alleati vicini."],
  },
  sarto: {
    bassa: ["Benda di Lino Sfilacciata", "Stoffa ruvida cucita in fretta: fa il suo lavoro ma si strappa dopo un solo utilizzo."],
    media: ["Mantello da Pioggia Cerato", "Tessuto trattato con cera d'api: tiene asciutti abiti e zaini sotto i temporali."],
    alta: ["Fascia con Tasche Nascoste", "Cintura morbida con due scomparti cuciti all'interno: svantaggio a chi cerca di borseggiarla."],
  },
  erborista: {
    bassa: ["Infuso Amaro Scadente", "Tisana dall'odore acre: toglie la sete ma lascia un leggero fastidio allo stomaco."],
    media: ["Impacco di Piantaggine e Camomilla", "Riduce gonfiori e vesciche dopo una marcia forzata: recupera 1d4 PF durante un riposo breve."],
    alta: ["Sali Aromatici Risveglianti", "Piccola fiala di erbe essiccate: annulla stordimento leggero o sonnolenza non magica all'istante."],
  },
  cuoco: {
    bassa: ["Gallette Bruciacchiate", "Dure come pietra ma nutrienti: valgono come 1 razione giornaliera poco invitante."],
    media: ["Razione Speziata da Viaggio", "Carne secca, frutta e spezie sigillate bene: si conserva per due settimane e solleva il morale."],
    alta: ["Brodo Concentrato Ristoratore", "Basta acqua calda: chi lo beve a fine riposo breve aggiunge +2 ai PF recuperati con i dadi vita."],
  },
  ingegnere: {
    bassa: ["Lucchetto a Molla Dura", "Scatta a fatica e talvolta si inceppa: CD 10 per aprirlo anche con la sua chiave."],
    media: ["Morsetto Tascabile a Vite", "Piccolo meccanismo in ottone per bloccare porte, carrucole o aste senza fare rumore."],
    alta: ["Lanterna a Otturatore Rapido", "Schermo scorrevole ben oliato: puoi passare da luce piena a buio totale con un gesto gratuito."],
  },
  cartografo: {
    bassa: ["Schizzo su Carta Umida", "Mappa leggibile ma con inchiostro sbavato sui margini: dettagli secondari poco chiari."],
    media: ["Tubo Portamappe Impermeabile", "Cilindro sigillato con ceralacca morbida: tiene al sicuro pergamene e mappe anche in acqua."],
    alta: ["Bussola a Quadrante Inciso", "Ago magnetizzato stabile con tacche fluorescenti: permette di orientarsi anche di notte senza stelle."],
  },
  gioielliere: {
    bassa: ["Spilla di Rame Storta", "Chiusura semplice con saldatura visibile: vale poco ma tiene fermo un mantello."],
    media: ["Sigillo Personale in Ottone", "Anello o timbro inciso con precisione per autenticare lettere e documenti con ceralacca."],
    alta: ["Monocolo da Valutatore Chiaro", "Lente molata senza bolle d'aria: dona +1 alle prove di Indagare su gemme, incisioni e serrature."],
  },
  incantatore: {
    bassa: ["Gesso Runico Sbricioloso", "Traccia un simbolo luminoso fioco per 10 minuti prima di spegnersi del tutto."],
    media: ["Pietra della Scintilla", "Piccolo quarzo inciso: se sfregato produce abbastanza scintille da accendere un fuoco da campo."],
    alta: ["Sigillo di Silenzio Minore", "Gettone d'osso inciso: attutisce il tintinnio di monete e chiavi nella borsa per un'intera giornata."],
  },
};

export async function generateRandomBasicItem({ professionKey, professionName, tier, total }, { timeoutMs = 10000 } = {}) {
  const quality = randomQualityForRoll(tier, total);
  try {
    const call = httpsCallable(functions, "craftingRandomItem");
    const timerPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
    const res = await Promise.race([
      call({ professionKey, professionName, qualityKey: quality.key, total }),
      timerPromise,
    ]);
    const data = res?.data;
    if (data?.ok && data?.name && data?.desc) {
      return { name: data.name, desc: `[${quality.label}] ${data.desc}`, quality, source: "gemini" };
    }
  } catch {
    /* fallback locale */
  }
  const byProf = FALLBACK_RANDOM[professionKey] || FALLBACK_RANDOM.fabbro;
  const [name, desc] = byProf[quality.key] || byProf.media;
  return { name, desc: `[${quality.label}] ${desc}`, quality, source: "tabella" };
}
