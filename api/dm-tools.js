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

const MAP_TEMPLATE = `Strict top-down orthographic battle map of the settlement [NOME] ([DIMENSIONE]), bird's-eye view seen straight from directly above at 90°, NO perspective, NO tilt, NO horizon — like a game master's tabletop map for Foundry VTT.
LAYOUT (must be readable and specific to THIS town, not generic): [DESCRIZIONE LAYOUT — dove passa la strada/il fiume principale, dov'è la piazza, dove sorgono i quartieri, cosa c'è ai bordi]. Streets actually connect building to building; blocks of houses with consistent rooftops; a clearly recognisable central square with the main building ([EDIFICIO PRINCIPALE]).
KEY LANDMARKS to draw as distinct, identifiable buildings placed around the map: [LUOGHI NOTEVOLI — elenca i 3-5 edifici principali di questa città].
SETTLEMENT FEATURES: [ELEMENTI SPECIFICI: mura e porte / porto e moli / ponti sul fiume / campi coltivati / bosco]. Natural terrain and vegetation around the edges, fading softly into the border.
INQUADRATURA: whole settlement fully visible and centred, square format. No text, no letters, no labels, no legend, no grid lines, no compass.`;

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
  const dim = (i.dimensione || "cittadina").toLowerCase();
  const isBig = dim.includes("città") || dim.includes("citta") || dim.includes("metropoli");

  // NPC già creati dal Master in questa località (passati dal client).
  const npcs = Array.isArray(i.npcs) ? i.npcs.filter(n => n && n.name) : [];
  const npcBlock = npcs.length
    ? `\nPERSONAGGI GIÀ ESISTENTI E CANONICI IN QUESTA LOCALITÀ (creati dal Master — sono la VERITÀ ufficiale, NON inventarne altri che li contraddicano):
${npcs.map(n => `- ${n.name}${n.location ? ` — ${n.location}` : ""}${n.faction ? ` (${n.faction})` : ""}${n.description ? `: ${String(n.description).slice(0, 300)}` : ""}`).join("\n")}
REGOLE OBBLIGATORIE su questi personaggi:
• Se tra loro c'è un sovrano/governatore/sindaco/capo, USA IL SUO NOME nei campi "governo" e "capo". NON inventare un altro capo (niente "un re" generico se qui c'è già un nome).
• Se ci sono locandieri, mercanti, sacerdoti, capitani, ecc., inseriscili nei "luoghi" pertinenti (taverne, botteghe, templi, caserme) citandoli per nome.
• Puoi aggiungere altri luoghi/personaggi minori inventati, ma SOLO se non contraddicono quelli sopra.\n`
    : "";

  return `Sei il generatore di insediamenti per la campagna fantasy Eldoria.
Crea una città/villaggio ricca e giocabile.
CONTESTO: nome "${i.nome || "(inventa un nome adatto a Eldoria)"}", dimensione "${i.dimensione || "cittadina"}", carattere "${i.carattere || "borgo di passaggio"}".${i.note ? `\nDETTAGLI EXTRA DEL MASTER (rispettali): "${i.note}"` : ""}
${npcBlock}
RELIGIONE: scegli TU, in autonomia e in modo coerente col carattere della città, cosa si venera, SCEGLIENDO SOLO da questo pantheon di Eldoria. Una città può: seguire una sola divinità, più culti insieme, ospitare una setta malvagia (magari segreta), oppure essere in gran parte atea/non credente. Spiega templi, culti dominanti ed eventuali tensioni religiose.
PANTHEON:${PANTHEON}

DIFESA — REGOLA IMPORTANTE:
${isBig
  ? `Questa è una città grande: compila il campo "difesa" ma resta VAGO e atmosferico, MAI numeri precisi. Descrivi il TIPO di forza, non quanti sono. Esempi di tono giusto: "una guarnigione ben addestrata presidia le mura e le porte", "una robusta guardia cittadina pattuglia i quartieri, affiancata da mercenari nei momenti di tensione". VIETATO scrivere conteggi tipo "12 soldati", "200 guardie".`
  : `Questo insediamento è piccolo (villaggio/cittadina): LASCIA il campo "difesa" come stringa vuota "". Non elencare guardie o soldati. Al massimo un accenno alla protezione può stare dentro la "descrizione" in modo vago (es. "pochi uomini di guardia", "una milizia raccogliticcia"), MAI numeri.`}

Scrivi una descrizione LUNGA ed evocativa nel campo "descrizione" (almeno 5-6 frasi).
Compila "mapPrompt" partendo ESATTAMENTE da questo modello, sostituendo OGNI campo tra parentesi quadre con i tratti REALI di QUESTA città: il layout deve rispecchiare la descrizione e i luoghi notevoli che hai scritto sopra (stessa piazza, stesse strade, stessi edifici), NON un impianto generico. Cita nel mapPrompt i luoghi notevoli veri.
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
        max_tokens: tipo === "citta" ? 4000 : 1600,
        messages: [{ role: "user", content: buildPrompt(tipo, input) }]
      })
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testo = (data.content || []).map(b => b.text || "").join("");
    let pulito = testo.replace(/```json|```/g, "").trim();

    // Fallback: se il JSON è spezzato (token limit), lo chiudiamo a forza
    try {
      JSON.parse(pulito);
    } catch {
      // Tronca all'ultimo campo completo e chiude il JSON
      const lastComma = pulito.lastIndexOf('",');
      const lastClose = pulito.lastIndexOf('"}');
      const cutAt = Math.max(lastComma, lastClose);
      if (cutAt > 0) {
        pulito = pulito.substring(0, cutAt + 2);
        // Chiudi eventuali array/oggetti aperti
        const opens = (pulito.match(/\[/g) || []).length - (pulito.match(/\]/g) || []).length;
        const openO = (pulito.match(/\{/g) || []).length - (pulito.match(/\}/g) || []).length;
        pulito += "]".repeat(Math.max(0, opens)) + "}".repeat(Math.max(0, openO));
      }
    }

    return res.status(200).json(JSON.parse(pulito));
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}