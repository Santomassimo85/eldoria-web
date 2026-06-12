// api/dm-tools.js
// "Cervello" degli strumenti DM. Riceve { tipo, input } e chiama Claude.
// tipo: "incontro" | "loot" | "citta". Restituisce JSON pronto da mostrare.
// La chiave Anthropic resta qui, nascosta.

// ---- PANTHEON FISSO DI ELDORIA (usato per le religioni delle città) ----
const PANTHEON = `
VECCHIE DIVINITÀ (I nati dalle lacrime):
- Vulkàros — Fuoco, Forgiatura, Guerra. Venerato da fabbri, guerrieri, distruttori.
- Nysia — Acqua, Vita, Morte. Marinai, guaritori, necromanti.
- Syrael — Aria, Cambiamento, Profezia. Viaggiatori, oracoli.
- Drokhan — Terra, Stabilità, Giustizia. Giudici, costruttori, minatori.
- Enoia — Spirito, Memoria, Destino. Monaci, artisti, veggenti.
- Lirael — Arte, Musica, Storia, Memoria. Bardi, attori, spie.
- Myrhal — Magia, Conoscenza proibita, Segreti. Maghi, studiosi.
- Zenara — Natura, Bestie, Equilibrio selvaggio. Ranger, druidi, barbari.
- Kal-Durr — Tempo, Fato, Cicli di morte e rinascita. Veggenti (temuto).
- Naavir — Inganno, Verità nascoste, Ombre morali. Ladri, spie, illusionisti.

NUOVI DEI (dopo la grande guerra):
- Malakor — Giustizia distorta, Ordine, Contratti (legale, tendenze malvagie). Giudici corrotti, governanti autoritari, mercanti spietati. Setta: I Sigilli di Ferro.
- Venestra — Amore ossessivo, Bellezza, Disperazione (caotico, tendenze malvagie). Artisti ossessi, amanti gelosi. Setta: I Lacerati.
- Xylos — Sfortuna, Coincidenza perversa, Oblio (neutrale/caotico). Giocatori d'azzardo, marinai superstiziosi.
- Sune — Bellezza, Amore, Passione (neutrale buono). Artisti, nobili di Yotta, elfi alti.

DIVINITÀ MALVAGIE:
- Morgath — Magia corrotta, Fame, Arcanite. Vuole consumare il mana del mondo.
- Xul'Korah — Inganno, Malattie, Decadimento delle alleanze. Spie, avvelenatori, nobili corrotti.
- Thal-Grimor — Guerra crudele, Tirannia, Schiavitù. Guarnigioni mercenarie brutali.
- Malakhia — Oblio, Follia, Vuoto cosmico. Nichilisti che distruggono storia e templi.
`;

const MAP_TEMPLATE = `Mappa fantasy di una città vista dall'alto (top-down), stile illustrazione cartografica da manuale di gioco di ruolo. Vista a volo d'uccello leggermente inclinata.
CITTÀ: [NOME] — [DIMENSIONE]
INSEDIAMENTO: [FORTIFICAZIONE], [POSIZIONE]
CARATTERE: [CARATTERE]
ELEMENTI: isolati di edifici con tetti coerenti e strade che si connettono davvero; piazza centrale e edificio principale; [ELEMENTI SPECIFICI: mura e porte / porto e moli / ponti sul fiume]; vegetazione e terreno naturale intorno.
STILE: [PALETTE COLORI], luce diffusa, texture pittorica da mappa disegnata a mano, nessun testo o etichetta, nessuna griglia, bordi che sfumano nel terreno.
INQUADRATURA: intera città visibile, centrata, formato quadrato.`;

function buildPrompt(tipo, input) {
  const i = input || {};

  if (tipo === "incontro") {
    return `Sei il generatore di incontri casuali per la campagna fantasy Eldoria.
Crea un incontro adatto a un party in viaggio.
CONTESTO: zona "${i.zona || "strada di campagna"}", party di ${i.numPg || 4} PG di livello ${i.livelloParty || 5}, momento: ${i.momento || "giorno"}, difficoltà voluta: ${i.difficolta || "media"}.
Rispondi SOLO con questo JSON, senza testo prima/dopo, senza backtick:
{
  "titolo":"",
  "nemici":[{"nome":"","numero":1,"note":""}],
  "ambiente":"",
  "tattica":"",
  "colpo_di_scena":"",
  "difficolta":"",
  "ricompensa":""
}
Coerente col livello del party. Niente azioni o dialoghi dei personaggi dei giocatori.`;
  }

  if (tipo === "loot") {
    return `Sei il generatore di bottino per la campagna fantasy Eldoria.
Genera un bottino bilanciato sul livello del party.
CONTESTO: fonte "${i.fonte || "tesoro"}", riferimento di potere "${i.riferimento || "medio"}", livello medio del party: ${i.livelloMedio || 5}, tema "${i.tema || "vario"}".
IMPORTANTE: puoi inventare anche oggetti magici NON presenti in D&D (homebrew, originali), con nome, rarità ed effetto chiaro — il Master li ricreerà a mano su Foundry. Mescola pure oggetti classici e originali.
Rispondi SOLO con questo JSON, senza testo prima/dopo, senza backtick:
{
  "monete":"",
  "oggetti":[{"nome":"","rarita":"","descrizione":""}],
  "nota":""
}
Descrizioni brevi (1-2 frasi). Rarità tra: comune, non comune, raro, molto raro, leggendario. Bilancia il valore sul livello medio indicato.`;
  }

  // citta
  return `Sei il generatore di insediamenti per la campagna fantasy Eldoria.
Crea una città/villaggio ricca e giocabile.
CONTESTO: nome "${i.nome || "(inventa un nome adatto a Eldoria)"}", dimensione "${i.dimensione || "cittadina"}", carattere "${i.carattere || "borgo di passaggio"}".${i.note ? `\nDETTAGLI EXTRA DEL MASTER: "${i.note}"` : ""}

RELIGIONE: scegli TU, in autonomia e in modo coerente col carattere della città, cosa si venera, SCEGLIENDO SOLO da questo pantheon di Eldoria. Una città può: seguire una sola divinità, più culti insieme, ospitare una setta malvagia (magari segreta), oppure essere in gran parte atea/non credente. Spiega templi, culti dominanti ed eventuali tensioni religiose.
PANTHEON:${PANTHEON}

Scrivi una descrizione LUNGA ed evocativa nel campo "descrizione" (almeno 5-6 frasi).
Compila "mapPrompt" partendo ESATTAMENTE da questo modello, sostituendo i campi tra parentesi quadre con i tratti di QUESTA città (elementi e palette coerenti):
${MAP_TEMPLATE}

Rispondi SOLO con questo JSON, senza testo prima/dopo, senza backtick:
{
  "nome":"",
  "dimensione":"",
  "carattere":"",
  "descrizione":"",
  "governo":"",
  "capo":"",
  "difesa":"",
  "religione":"",
  "economia":"",
  "luoghi":[{"nome":"","tipo":"","descrizione":""}],
  "ganci":["",""],
  "mapPrompt":""
}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { tipo, input } = req.body || {};
  if (!["incontro", "loot", "citta"].includes(tipo)) {
    return res.status(400).json({ error: "tipo non valido (incontro | loot | citta)." });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1600,
        messages: [{ role: "user", content: buildPrompt(tipo, input) }]
      })
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testo = (data.content || []).map(b => b.text || "").join("");
    const pulito = testo.replace(/```json|```/g, "").trim();
    return res.status(200).json(JSON.parse(pulito));
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}