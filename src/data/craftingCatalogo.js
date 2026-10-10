/* ============================================================
   CATALOGO DELL'OFFICINA (2026-09-21)
   ------------------------------------------------------------
   Per ogni professione, 6 "linee" di oggetti presi (o ispirati) dal
   manuale di D&D: la stessa linea esiste in tre rarità, Comune →
   Non comune → Raro. Il giocatore SCEGLIE la linea e la rarità a cui
   punta; se il tiro conferma la rarità esce l'oggetto scelto, se va
   più basso esce la stessa linea nella rarità inferiore (sotto 6 esce
   uno Scarso a caso dalla tabella del manuale).
   Molto raro e Leggendario non si scelgono: escono col d12 dalle
   tabelle (veryRare in crafting.js, legendary qui sotto).
   Tuple [nome, descrizione]; il nome guida il riconoscimento del tipo
   Foundry (craftingFoundry.js): "+1"/"+2" nel nome diventano bonus.
   ============================================================ */

const T = (name, desc) => [name, desc];
const L = (key, icon, common, uncommon, rare) => ({ key, icon, common, uncommon, rare });

export const CATALOGO = {
  // ── 1. FABBRO ──────────────────────────────────────────────
  fabbro: [
    L("spada", "🗡",
      T("Spada Lunga", "Arma da guerra: 1d8 taglienti, versatile (1d10)."),
      T("Spada Lunga +1", "+1 al colpire e ai danni. Conta come magica."),
      T("Spada Lunga +2", "+2 al colpire e ai danni. Conta come magica.")),
    L("ascia", "🪓",
      T("Ascia Bipenne", "Arma da guerra a due mani: 1d12 taglienti, pesante."),
      T("Ascia Bipenne +1", "+1 al colpire e ai danni. Conta come magica."),
      T("Ascia Bipenne +2", "+2 al colpire e ai danni. Conta come magica.")),
    L("martello", "🔨",
      T("Martello da Guerra", "Arma da guerra: 1d8 contundenti, versatile (1d10)."),
      T("Martello da Guerra +1", "+1 al colpire e ai danni. Conta come magico."),
      T("Martello da Guerra +2", "+2 al colpire e ai danni. Conta come magico.")),
    L("cotta", "⛓",
      T("Cotta di Maglia", "Armatura pesante: CA 16, richiede Forza 13, svantaggio a Furtività."),
      T("Cotta di Maglia di Mithral", "CA 16. Leggera come stoffa: niente requisito di Forza né svantaggio a Furtività."),
      T("Cotta di Maglia +1", "CA 17. Conta come magica.")),
    L("completa", "🛡",
      T("Armatura Completa", "Armatura pesante: CA 18, richiede Forza 15, svantaggio a Furtività."),
      T("Armatura Completa di Adamantio", "CA 18. Ogni colpo critico contro chi la indossa diventa un colpo normale."),
      T("Armatura Completa +1", "CA 19. Conta come magica.")),
    L("scudo", "🛡",
      T("Scudo", "Scudo d'acciaio: +2 alla CA."),
      T("Scudo +1", "+3 alla CA in tutto. Conta come magico."),
      T("Scudo +2", "+4 alla CA in tutto. Conta come magico.")),
  ],

  // ── 2. ALCHIMISTA ──────────────────────────────────────────
  alchimista: [
    L("guarigione", "🧪",
      T("Pozione di Guarigione", "Bevuta come azione: recupera 2d4+2 punti ferita."),
      T("Pozione di Guarigione Maggiore", "Recupera 4d4+4 punti ferita."),
      T("Pozione di Guarigione Superiore", "Recupera 8d4+8 punti ferita.")),
    L("fuoco", "🔥",
      T("Fuoco dell'Alchimista", "Fiala da lancio (6 m): 1d4 danni da fuoco all'inizio di ogni turno finché non si spegne (CD 10 Destrezza)."),
      T("Fuoco dell'Alchimista Denso", "Come il Fuoco dell'Alchimista ma 2d4 danni e CD 12 per spegnerlo."),
      T("Bomba Alchemica", "Lanciata a 9 m esplode in una sfera di 3 m: 3d6 danni da fuoco, TS Destrezza CD 13 per dimezzare.")),
    L("veleno", "☠",
      T("Veleno Base", "Da applicare su una lama: +1d4 danni da veleno al primo colpo entro 1 minuto."),
      T("Veleno del Serpente", "Al primo colpo: TS Costituzione CD 11 o 3d6 danni da veleno (metà se riesce)."),
      T("Veleno Paralizzante", "Al primo colpo: TS Costituzione CD 13 o paralizzato per 1 minuto (ripete il TS a fine turno).")),
    L("resistenza", "🛡",
      T("Antitossina", "Vantaggio ai TS contro il veleno per 1 ora."),
      T("Pozione di Resistenza", "Resistenza a un tipo di danno (scelto alla creazione) per 1 ora."),
      T("Pozione dell'Eroismo", "10 punti ferita temporanei e l'effetto di Benedizione per 1 ora.")),
    L("movimento", "💨",
      T("Pozione di Scalata", "Velocità di scalata pari a quella di camminata e vantaggio ad Atletica per scalare, per 1 ora."),
      T("Pozione di Respirare Sott'acqua", "Respiri sott'acqua per 1 ora."),
      T("Pozione di Forma Gassosa", "Come l'incantesimo Forma Gassosa per 1 ora (puoi interrompere prima).")),
    L("forza", "💪",
      T("Acido", "Fiala da lancio (6 m): 2d6 danni da acido."),
      T("Pozione della Forza di Gigante delle Colline", "La tua Forza diventa 21 per 1 ora."),
      T("Pozione della Forza di Gigante del Fuoco", "La tua Forza diventa 25 per 1 ora.")),
  ],

  // ── 3. INTAGLIATORE / FALEGNAME ────────────────────────────
  intagliatore: [
    L("arcolungo", "🏹",
      T("Arco Lungo", "Arma da guerra: 1d8 perforanti, gittata 45/180, pesante, due mani."),
      T("Arco Lungo +1", "+1 al colpire e ai danni. Conta come magico."),
      T("Arco Lungo +2", "+2 al colpire e ai danni. Conta come magico.")),
    L("arcocorto", "🏹",
      T("Arco Corto", "Arma semplice: 1d6 perforanti, gittata 24/96, due mani."),
      T("Arco Corto +1", "+1 al colpire e ai danni. Conta come magico."),
      T("Arco Corto +2", "+2 al colpire e ai danni. Conta come magico.")),
    L("bastone", "🪄",
      T("Bastone Ferrato", "Arma semplice: 1d6 contundenti, versatile (1d8)."),
      T("Bastone +1", "+1 al colpire e ai danni; focus arcano. Conta come magico."),
      T("Bastone degli Sciami", "Bastone +1 con 10 cariche: 1 carica = Sciame di Insetti (CD 15) per 10 minuti, 1d6+4 cariche all'alba.")),
    L("bacchetta", "✨",
      T("Bacchetta Inerte", "Focus arcano ben bilanciato: +1 alle prove di Arcano per identificare incantesimi."),
      T("Bacchetta dei Dardi Incantati", "7 cariche: 1 carica = Dardo Incantato di 1°, fino a 3 cariche per alzare il livello. Recupera 1d6+1 all'alba."),
      T("Bacchetta delle Palle di Fuoco", "7 cariche: 1 carica = Palla di Fuoco di 3° (CD 15), fino a 3 cariche per alzare il livello. Recupera 1d6+1 all'alba.")),
    L("scrigno", "📦",
      T("Scrigno con Serratura", "Scrigno robusto: serratura CD 15 per scassinarlo."),
      T("Scrigno a Tenuta Stagna", "Serratura CD 18; il contenuto non teme acqua, fuoco né umidità."),
      T("Scrigno Dimensionale", "Dentro c'è uno spazio extradimensionale di 500 kg; solo chi conosce la parola d'ordine lo apre.")),
    L("liuto", "🎼",
      T("Liuto", "Strumento musicale ben accordato: +1 alle prove di Intrattenere."),
      T("Liuto di Doss", "Strumento del bardo (non comune): vantaggio ai TS contro incantesimi mentre suoni; lancia Protezione dal Male, Passo Velato, Volto Illusorio 1/giorno."),
      T("Mandolino di Canaith", "Strumento del bardo (raro): come il Liuto di Doss, e in più Dissolvi Magie, Protezione dall'Energia (fulmine) e Cura Ferite (3°) 1/giorno.")),
  ],

  // ── 4. SARTO / TESSITORE ───────────────────────────────────
  sarto: [
    L("cuoio", "🥋",
      T("Armatura di Cuoio", "Armatura leggera: CA 11 + Destrezza."),
      T("Armatura di Cuoio Silenziosa", "CA 11 + Destrezza. Vantaggio alle prove di Furtività quando ti muovi piano."),
      T("Armatura di Cuoio +1", "CA 12 + Destrezza. Conta come magica.")),
    L("mantello", "🧥",
      T("Mantello con Cappuccio", "Caldo e discreto: vantaggio a non farsi riconoscere a distanza."),
      T("Mantello di Protezione", "+1 alla CA e a tutti i tiri salvezza mentre lo indossi."),
      T("Mantello del Dislocamento", "Sembri stare altrove: gli attacchi contro di te hanno svantaggio (si spegne fino al tuo turno se vieni colpito).")),
    L("stivali", "👢",
      T("Stivali da Viaggio", "Comodi e resistenti: ignori il terreno difficile della strada nelle marce."),
      T("Stivali Elfici", "I tuoi passi non fanno rumore: vantaggio alle prove di Furtività per muoverti in silenzio."),
      T("Stivali della Velocità", "Azione bonus: raddoppi la velocità e gli attacchi d'opportunità contro di te hanno svantaggio, per 10 minuti al giorno.")),
    L("borsa", "🎒",
      T("Zaino da Viaggio", "Capiente e ben cucito: porti 5 kg in più senza contare l'ingombro."),
      T("Borsa Conservante", "Contiene 250 kg in uno spazio di 2 m³, pesa sempre 7,5 kg."),
      T("Zaino Pratico di Heward", "Tre scomparti extradimensionali (fino a 60 kg): l'oggetto che vuoi è sempre in cima.")),
    L("veste", "👘",
      T("Veste Arcana", "Tunica da incantatore con tasche per i componenti: +1 alle prove di Arcano."),
      T("Veste Utile", "Toppe cucite che diventano oggetti: 4d4 toppe fra corda, torce, pozione di guarigione, scala, cavallo da soma…"),
      T("Veste degli Occhi", "Vedi in ogni direzione, scurovisione 36 m, vedi gli invisibili e l'Etereo entro 36 m. Svantaggio ai TS contro la Luce.")),
    L("guanti", "🧤",
      T("Guanti da Lavoro", "Robusti e aderenti: niente penalità al maneggiare oggetti roventi o taglienti."),
      T("Guanti del Ladro", "Invisibili quando indossati: +5 alle prove di Rapidità di Mano e per scassinare."),
      T("Guanti della Forza dell'Ogre", "La tua Forza diventa 19 mentre li indossi.")),
  ],

  // ── 5. ERBORISTA ───────────────────────────────────────────
  erborista: [
    L("unguento", "🫙",
      T("Unguento Curativo", "Spalmato in 1 minuto: recupera 1d4+1 punti ferita (3 dosi)."),
      T("Unguento di Keoghtom", "Vasetto con 3 dosi: ogni dose cura 2d8+2 e rimuove veleno e malattia."),
      T("Unguento della Guarigione Profonda", "Vasetto con 3 dosi: ogni dose cura 4d8+4, rimuove veleno, malattia e un livello di sfinimento.")),
    L("tisana", "🍵",
      T("Tisana Riposante", "Bevuta durante un riposo breve: recuperi 1d4 punti ferita in più per ogni Dado Vita speso."),
      T("Tisana del Mistico", "Vantaggio ai TS su Saggezza per 1 ora."),
      T("Tisana della Chiarezza", "Per 1 ora: vantaggio a Intuizione e Percezione e sai se chi ti parla mente (come Zona di Verità solo per te).")),
    L("veleno", "🐍",
      T("Veleno Naturale", "Su una lama: +1d4 danni da veleno al primo colpo entro 1 minuto."),
      T("Veleno del Serpente Runico", "Al primo colpo: TS Costituzione CD 11 o 2d6 danni da veleno e avvelenato per 1 minuto."),
      T("Belladonna Nera", "Ingerita o su lama: TS Costituzione CD 14 o 4d6 danni da veleno e avvelenato per 1 ora (metà danni se riesce).")),
    L("rimedio", "🌱",
      T("Antidoto Naturale", "Neutralizza un veleno comune e dà vantaggio ai TS contro il veleno per 1 ora."),
      T("Rimedio Potente", "Cura una malattia o un veleno, come Ristorare Inferiore."),
      T("Rimedio Universale", "Come Ristorare Inferiore, e in più rimuove un livello di sfinimento e una maledizione minore.")),
    L("erbe", "🌿",
      T("Erbe Aromatiche", "Insaporiscono le razioni: il gruppo recupera 1 punto ferita in più per Dado Vita speso nel riposo."),
      T("Erbe del Cacciatore", "Strofinate sui vestiti: vantaggio a Sopravvivenza per seguire tracce e le bestie non ti fiutano, per 8 ore."),
      T("Foglia della Speranza", "Masticata: 10 punti ferita temporanei e vantaggio ai TS contro la paura per 1 ora.")),
    L("polline", "🌼",
      T("Polline Energizzante", "Annusato: +1,5 m di velocità per 1 ora."),
      T("Polline del Risveglio", "Sveglia chi dorme (anche per magia) e dà vantaggio ai TS contro l'affascinamento per 1 ora."),
      T("Essenza dell'Ispirazione", "Fiala con 3 dosi: ogni dose dà un dado d'Ispirazione Bardica (d8) da usare entro 10 minuti.")),
  ],

  // ── 6. CUOCO / MASTRO BIRRAIO ──────────────────────────────
  cuoco: [
    L("razioni", "🍞",
      T("Razioni da Viaggio", "Dieci giorni di cibo saporito e leggero (metà peso delle razioni normali)."),
      T("Pane del Pellegrino", "Una pagnotta = un giorno di cibo e 1d4 punti ferita temporanei fino al prossimo riposo."),
      T("Banchetto dei Camerati", "Per 6 persone: +2d10 punti ferita massimi, immunità alla paura e vantaggio ai TS su Saggezza per 12 ore.")),
    L("birra", "🍺",
      T("Birra della Casa", "Un boccale scaccia la stanchezza: vantaggio alla prossima prova di Costituzione per una marcia."),
      T("Birra del Nano", "Resistenza al veleno e vantaggio ai TS contro il veleno per 1 ora."),
      T("Birra dell'Eroe", "10 punti ferita temporanei e vantaggio ai TS contro la paura per 1 ora.")),
    L("stufato", "🍲",
      T("Stufato del Cacciatore", "Un pasto caldo: chi lo mangia nel riposo breve recupera 1d6 punti ferita in più."),
      T("Stufato del Cuore Forte", "Vantaggio ai TS su Costituzione per 1 ora."),
      T("Stufato del Drago", "Resistenza a un tipo di danno (fuoco, freddo, fulmine, acido o veleno, scelto alla creazione) per 1 ora.")),
    L("te", "🍵",
      T("Tè Caldo", "Sveglia e scalda: niente svantaggio da freddo lieve per 1 ora."),
      T("Tè della Memoria", "Vantaggio alle prove di Storia, Arcano e Religione per 1 ora."),
      T("Tè della Meditazione", "Bevuto in un riposo breve: recuperi uno slot incantesimo di 3° livello o inferiore.")),
    L("dolce", "🍰",
      T("Dolce della Festa", "Sciolglie la lingua: +1 a Persuasione per 1 ora."),
      T("Dolce del Bardo", "Chi lo mangia ottiene Ispirazione."),
      T("Torta della Fortuna", "Entro 8 ore puoi ritirare un tiro per colpire, una prova o un TS (una volta).")),
    L("vino", "🍷",
      T("Vino della Casa", "Un buon rosso: +1 alle prove di Carisma a tavola per 1 ora."),
      T("Vino del Bardo", "+1d4 alle prove di Carisma per 1 ora."),
      T("Liquore del Potere", "Per 1 minuto aggiungi 1d4 ai tiri per colpire e ai TS (come Benedizione).")),
  ],

  // ── 7. INGEGNERE / ARTIGIANO ───────────────────────────────
  ingegnere: [
    L("bussola", "🧭",
      T("Bussola", "Indica sempre il nord: vantaggio a Sopravvivenza per orientarsi."),
      T("Bussola dell'Esploratore", "Indica il nord e la direzione dell'ultimo luogo che hai nominato (entro 15 km)."),
      T("Bussola del Pericolo", "Vibra prima di un'imboscata: non puoi essere sorpreso mentre la tieni in mano.")),
    L("cannocchiale", "🔭",
      T("Cannocchiale", "Ingrandisce 2 volte: vantaggio a Percezione per vedere lontano."),
      T("Cannocchiale del Cecchino", "Una volta per riposo breve, un attacco a distanza a gittata lunga non ha svantaggio."),
      T("Cannocchiale della Vista Vera", "1/giorno guardandoci dentro ottieni Vista Pura per 1 minuto.")),
    L("rampino", "🪝",
      T("Rampino con Corda", "15 m di corda: vantaggio ad Atletica per scalare dove si aggancia."),
      T("Rampino a Molla", "Si lancia da solo fino a 9 m e si aggancia (azione bonus); ti tira su in un turno."),
      T("Rampino del Ragno", "Per 1 ora al giorno scali come un ragno (velocità di scalata pari a quella di camminata, anche sui soffitti).")),
    L("proiettili", "🎯",
      T("Quadrelli (20)", "Munizioni da balestra ben bilanciate."),
      T("Proiettili d'Argento (20)", "Munizioni argentate: superano la resistenza dei licantropi e degli spiriti."),
      T("Proiettili Esplosivi (10)", "Munizioni con carica: +1d6 danni da fuoco a chi colpiscono.")),
    L("strumenti", "🧰",
      T("Strumenti di Precisione", "Set da inventore: vantaggio alle prove per riparare o smontare meccanismi."),
      T("Grimaldelli Meccanici", "+2 alle prove per scassinare; funzionano anche senza competenza (senza il bonus)."),
      T("Orologio dell'Allarme", "Posato a terra, lancia Allarme su un raggio di 9 m per 8 ore, ogni giorno.")),
    L("costrutto", "🤖",
      T("Mini Costrutto", "Giocattolo meccanico che cammina e fa rumore: distrazione (vantaggio a Inganno per creare un diversivo)."),
      T("Servo Meccanico", "1 ora al giorno agisce come un Servitore Inosservato."),
      T("Golem Custode in Miniatura", "Un famiglio costrutto (statistiche di un Famiglio, CA 15, 10 PF) che ti segue e avvisa dei pericoli.")),
  ],

  // ── 8. CARTOGRAFO / ARALDICO ───────────────────────────────
  cartografo: [
    L("mappa", "🗺",
      T("Mappa di una Regione", "Strade, fiumi e città di una regione: niente prove per orientarsi lì."),
      T("Mappa Precisa", "Segna anche sentieri e rifugi: vantaggio a Sopravvivenza nella regione."),
      T("Mappa Vivente", "Si aggiorna da sola e mostra sempre dove sei, entro la regione disegnata.")),
    L("sigillo", "🪶",
      T("Sigillo Nobile", "Timbro di un casato inventato ma credibile: +1 a Inganno con documenti."),
      T("Sigillo Convincente", "Copia fedele di un vero casato: +2 a Inganno con documenti."),
      T("Sigillo dell'Influenza", "1/giorno la lettera che sigilli porta Ammaliare Persone (CD 13) su chi la legge.")),
    L("lettera", "✉",
      T("Lettera di Presentazione", "Vantaggio alla prima prova di Persuasione con un notabile della città indicata."),
      T("Lettera di Credito", "Riconosciuta dalle banche del Nesso: vale 100 mo di credito."),
      T("Lettera del Re", "Udienza garantita con un signore o un consiglio cittadino, una volta.")),
    L("tesoro", "💰",
      T("Mappa del Tesoro", "Porta a un piccolo tesoro nascosto (deciso dal Master)."),
      T("Mappa del Tesoro Runica", "Le rune si accendono entro 1 km da un tesoro nascosto."),
      T("Mappa del Tesoro Maggiore", "Rivela la stanza segreta o il vano nascosto più vicino entro 30 m, 1/giorno.")),
    L("bandiera", "🚩",
      T("Bandiera Riconoscibile", "Stendardo del gruppo: vantaggio a Persuasione con chi vi ha già sentito nominare."),
      T("Bandiera del Capitano", "Gli alleati entro 9 m hanno vantaggio ai TS contro la paura."),
      T("Bandiera dell'Eroe", "1/giorno, per 1 minuto gli alleati entro 9 m hanno +1 ai tiri per colpire.")),
    L("codice", "🔐",
      T("Codice Cifrato", "Scrittura segreta: CD 15 di Intelligenza per decifrarla."),
      T("Codice Cifrato Avanzato", "CD 20 per decifrarlo."),
      T("Cifrario del Mistico", "Solo il destinatario indicato può leggere ciò che scrivi; per gli altri è carta bianca.")),
  ],

  // ── 9. GIOIELLIERE ─────────────────────────────────────────
  gioielliere: [
    L("anello", "💍",
      T("Anello d'Oro", "Anello finemente lavorato, vale 25 mo."),
      T("Anello di Nuotare", "Velocità di nuoto di 12 m mentre lo indossi."),
      T("Anello di Protezione", "+1 alla CA e a tutti i tiri salvezza.")),
    L("collana", "📿",
      T("Collana d'Argento", "Collana lavorata, vale 25 mo."),
      T("Collana di Adattamento", "Respiri ovunque e sei immune ai gas e ai vapori nocivi."),
      T("Amuleto della Salute", "La tua Costituzione diventa 19 mentre lo indossi.")),
    L("talismano", "🧿",
      T("Talismano Inciso", "Amuleto portafortuna: vantaggio alla prossima prova di Carisma con chi crede nei presagi."),
      T("Talismano della Salute", "Immune alle malattie mentre lo indossi."),
      T("Talismano Antiveleno", "Immune al veleno e alla condizione avvelenato.")),
    L("bracciali", "⭕",
      T("Bracciale d'Oro", "Bracciale lavorato, vale 25 mo."),
      T("Bracciali degli Arcieri", "Competenza con archi lunghi e corti e +2 ai danni con essi."),
      T("Bracciali della Difesa", "+2 alla CA se non indossi armatura né scudo.")),
    L("diadema", "👑",
      T("Diadema Decorato", "Cerchietto con gemme: +1 alle prove di Persuasione a corte."),
      T("Diadema dell'Intelletto", "La tua Intelligenza diventa 19 mentre lo indossi."),
      T("Diadema della Mente Aperta", "Telepatia entro 9 m e vantaggio a Intuizione.")),
    L("gemma", "💎",
      T("Gemma Incastonata", "Gemma tagliata e montata: vale 50 mo."),
      T("Gemma della Luminosità", "50 cariche: luce, raggio abbagliante (CD 15) o cono di luce (CD 15)."),
      T("Gemma della Vista", "3 cariche: Vista Pura per 10 minuti (recupera 1d3 all'alba).")),
  ],

  // ── 10. INCANTATORE ────────────────────────────────────────
  incantatore: [
    L("pergamena", "📜",
      T("Pergamena d'Incantesimo (1°)", "Un incantesimo di 1° livello a scelta col Master, lanciabile una volta."),
      T("Pergamena d'Incantesimo (3°)", "Un incantesimo di 3° livello a scelta col Master, lanciabile una volta."),
      T("Pergamena d'Incantesimo (5°)", "Un incantesimo di 5° livello a scelta col Master, lanciabile una volta.")),
    L("runa", "ᚱ",
      T("Runa di Protezione", "Portata addosso: +1 a un tiro salvezza, una volta, poi si consuma."),
      T("Runa contro i Demoni", "Vantaggio ai TS contro gli incantesimi e le abilità dei demoni per 1 ora al giorno."),
      T("Runa del Baluardo", "1/giorno per 1 ora: +1 alla CA e ai tiri salvezza.")),
    L("sfera", "🔮",
      T("Sfera di Luce", "Fa luce come una torcia per 8 ore, senza fiamma."),
      T("Sfera di Luce Diurna", "1/giorno lancia Luce Diurna per 1 ora."),
      T("Sfera Solare", "Luce solare vera in 9 m: i non morti che la subiscono prendono 1d8 danni radiosi all'inizio del turno, 10 minuti al giorno.")),
    L("cristallo", "💠",
      T("Cristallo Inerte di Mana", "Focus arcano: +1 alle prove per mantenere la concentrazione."),
      T("Cristallo di Mana", "Contiene uno slot di 1° livello, si ricarica all'alba."),
      T("Cristallo del Mago", "Contiene uno slot fino al 3° livello, si ricarica all'alba.")),
    L("inchiostro", "🖋",
      T("Inchiostro Magico", "Per trascrivere incantesimi nel libro: dimezza il costo della trascrizione."),
      T("Inchiostro del Veggente", "Ciò che scrivi lo vede solo chi usa Individuazione del Magico o conosce la parola chiave."),
      T("Inchiostro Profetico", "1/giorno, scrivendo una domanda ottieni un Augurio.")),
    L("glifo", "🜁",
      T("Glifo di Avviso", "Tracciato in 1 minuto: lancia Allarme su una porta o un varco per 8 ore."),
      T("Glifo di Esplosione Minore", "Tracciato in 10 minuti: chi lo attiva subisce 3d8 danni (tipo scelto), TS Destrezza CD 13 per dimezzare."),
      T("Glifo di Interdizione", "Come l'incantesimo Glifo di Interdizione (5d8, CD 15), dura finché non scatta.")),
  ],
};

// ── LEGGENDARI: tabella d12 per professione (esce a caso, totale 26+) ──────
export const LEGGENDARI = {
  fabbro: [
    T("Spada Lunga +3", "+3 al colpire e ai danni; quando colpisci un critico, il bersaglio è stordito fino al tuo prossimo turno (TS Costituzione CD 17)."),
    T("Lama Vorpal", "Spada +3: con un 20 naturale recide la testa di una creatura che ne ha una (immuni: senza testa o leggendarie con TS Costituzione CD 19)."),
    T("Ascia Bipenne dei Titani", "+3 al colpire e ai danni; 2d12 taglienti invece di 1d12 contro creature Grandi o più grandi."),
    T("Martello dei Fulmini", "Martello da guerra +3: sintonizzato, Forza 20 e 1/giorno scaglia un fulmine di 8d6 (CD 17) lanciandolo."),
    T("Armatura Completa +3", "CA 21, conta come magica; resistenza ai danni contundenti, perforanti e taglienti non magici."),
    T("Corazza del Dio Forgiatore", "Armatura completa +2 (CA 20): immune al fuoco, 1/giorno lancia Muro di Fuoco (CD 17)."),
    T("Scudo dello Spirito Guardiano", "Scudo +3: 1/giorno lancia Spiriti Guardiani (CD 17) senza concentrazione per 1 minuto."),
    T("Lancia Solare", "Lancia +3 di luce pura: +2d8 danni radiosi ai non morti, fa luce 9 m, si richiama in mano come azione bonus."),
    T("Guanti d'Acciaio del Gigante delle Tempeste", "La tua Forza diventa 27 mentre li indossi e attacchi disarmato con 1d8 + Forza."),
    T("Elmo del Comandante Eterno", "Immune a paura e affascinamento; azione bonus 1/giorno: gli alleati entro 18 m attaccano subito con la reazione."),
    T("Catena dell'Assoluto", "Catena +3 (1d8 contundenti, portata): l'afferrato non può teletrasportarsi né mutare forma."),
    T("Ferro del Primo Re", "Arma a scelta +3: chi la impugna aggiunge il bonus di competenza ai tiri salvezza e non può essere disarmato."),
  ],
  alchimista: [
    T("Elisir della Vita", "Una creatura morta da meno di 10 giorni torna in vita con tutti i punti ferita, come Rianimare Morti."),
    T("Pozione della Longevità", "Ringiovanisci di 1d6+6 anni (10% ogni volta successiva che invecchi invece di ringiovanire)."),
    T("Pozione di Guarigione Suprema", "Recupera 10d4+20 punti ferita."),
    T("Elisir della Forza di Gigante delle Tempeste", "La tua Forza diventa 29 per 1 ora."),
    T("Veleno della Morte Sussurrata", "Al primo colpo: TS Costituzione CD 19 o 12d6 danni da veleno e la creatura scende a 0 PF se i danni la portano sotto 50."),
    T("Pozione dell'Invulnerabilità", "Resistenza a tutti i danni per 1 minuto."),
    T("Pozione della Forma Eterea", "Diventi etereo per 8 ore, come Forma Eterea; puoi tornare quando vuoi."),
    T("Elisir dell'Arcimago", "Per 1 ora recuperi uno slot di ogni livello fino al 5° e hai vantaggio alle prove di concentrazione."),
    T("Acido del Vuoto", "Fiala da lancio (6 m): 8d6 danni da acido e l'oggetto o la creatura non magica colpita è corrosa (−2 CA permanente alle armature)."),
    T("Bomba del Sole Nero", "Esplode in una sfera di 6 m: 10d6 danni necrotici (CD 17 per dimezzare) e oscurità magica per 1 minuto."),
    T("Filtro dell'Oblio", "Chi lo beve dimentica per sempre le ultime 24 ore (TS Saggezza CD 19 se non è consenziente)."),
    T("Siero della Fenice", "Se muori con il siero addosso, torni a 1 PF all'inizio del tuo turno successivo in un'esplosione di 4d6 fuoco (3 m). Si consuma."),
  ],
  intagliatore: [
    T("Arco della Luna Cacciatrice", "Arco lungo +3: le frecce diventano luce (danni radiosi) e non hanno svantaggio a gittata lunga."),
    T("Bastone del Mago Sovrano", "Bastone +2, 50 cariche: assorbe incantesimi e lancia Palla di Fuoco, Fulmine, Dissolvi Magie, Invisibilità e altri (come il Bastone del Mago)."),
    T("Bastone del Potere", "Bastone +2 con 20 cariche: +2 alla CA e ai TS; lancia Cono di Freddo, Palla di Fuoco (5°), Fulmine (5°), Muro di Forza…"),
    T("Bacchetta dei Miracoli", "7 cariche: lancia Desiderio Minore (a scelta del Master) o Sciame di Meteore (3 cariche), 1d6+1 all'alba."),
    T("Trono del Cielo", "Sedia intagliata: chi vi siede può lanciare Ammaliare Mostri (CD 17) 3/giorno e vede attraverso gli occhi delle statue della stanza."),
    T("Scudo di Quercia del Primo Albero", "Scudo +3: mentre lo imbracci hai resistenza al fuoco e 1/giorno lanci Crescita di Spine (CD 17)."),
    T("Liuto di Ollamh", "Strumento leggendario del bardo: Confusione, Controllare Tempo Atmosferico, Muro di Fuoco, Fulmine, Volare 1/giorno; vantaggio ai TS contro incantesimi mentre suoni."),
    T("Scrigno dell'Abisso Portatile", "Uno spazio extradimensionale di 10 m³ con una scala che scende: chiunque ci entri è al sicuro."),
    T("Statua Vivente del Guardiano", "Statua di legno che si anima (Guardiano Scudo: CA 17, 142 PF) e difende chi porta il suo amuleto."),
    T("Carro Volante d'Ebano", "Un carro che vola (velocità 18 m) per 12 ore al giorno, con 4 posti."),
    T("Porta dell'Altrove", "Cornice di legno: montata su un muro apre un passaggio verso un altro luogo già visitato, 1/giorno per 1 minuto."),
    T("Frecce del Fato (3)", "Frecce +3: quando colpiscono, la creatura fa TS Costituzione CD 17 o subisce 6d10 danni perforanti extra e cade prona."),
  ],
  sarto: [
    T("Mantello dell'Invisibilità", "Alzando il cappuccio diventi invisibile per 2 ore al giorno (in tutto)."),
    T("Cintura della Forza di Gigante delle Tempeste", "La tua Forza diventa 29 mentre la indossi."),
    T("Veste delle Stelle", "+1 ai TS; 6 stelle da lanciare (5d4 danni radiosi, +5 al colpire); 1/giorno ti porta sul Piano Astrale."),
    T("Stivali dei Sette Passi", "3 cariche: Passo Velato con azione bonus; ricarica all'alba."),
    T("Armatura di Scaglie di Drago", "Armatura di scaglie +1: resistenza a un tipo di danno (drago scelto alla creazione) e vantaggio ai TS contro il soffio."),
    T("Guanti del Vento Sussurrante", "Attacchi disarmati magici 1d8; azione bonus: spingi una creatura entro 9 m di 4,5 m (TS Forza CD 17)."),
    T("Borsa dei Trucchi Cosmica", "Tira fuori 3 creature al giorno (come la Borsa dei Trucchi, tabella grigia/rossa/marrone a scelta)."),
    T("Sciarpa della Fenice", "1/giorno, se scendi a 0 PF torni a metà punti ferita in una vampata di 3d6 fuoco (3 m)."),
    T("Cappello della Sovranità", "Vantaggio a Persuasione e Intimidire; 1/giorno lancia Dominare Persone (CD 17)."),
    T("Tenda del Palazzo Magnifico", "Una tenda che dentro è un palazzo: come Palazzo Magnifico di Mordenkainen, 1/giorno per 24 ore."),
    T("Mantello del Serafino", "Per 1 ora al giorno vola (velocità 18 m) e hai resistenza ai danni radiosi e necrotici."),
    T("Veste dell'Arcimago Supremo", "+2 alla CA e ai TS, vantaggio ai TS contro incantesimi, CD dei tuoi incantesimi +2."),
  ],
  erborista: [
    T("Foglia dell'Albero del Mondo", "Mangiata: recuperi tutti i punti ferita e ogni malattia, veleno, maledizione e sfinimento."),
    T("Unguento della Rinascita", "Spalmato su un corpo morto da meno di 24 ore lo riporta in vita a 1 PF, come Rianimare Morti."),
    T("Tisana dell'Eternità", "Chi la beve non invecchia per 10 anni e non ha bisogno di mangiare né dormire per 30 giorni."),
    T("Veleno dell'Ombra Morente", "Al primo colpo: TS Costituzione CD 19 o 10d10 danni necrotici e i punti ferita massimi calano della stessa cifra."),
    T("Erbe del Druido Antico", "Bruciate in 1 minuto: chi respira il fumo lancia una volta Comunione con la Natura e Parlare con le Piante."),
    T("Semi del Bosco Vivente", "Piantati, in 1 minuto crescono in un Treant alleato che ti obbedisce per 1 ora."),
    T("Polline della Luna Rossa", "Soffiato in un cono di 9 m: le creature falliscono un TS Saggezza CD 17 o sono affascinate e disarmate per 1 minuto."),
    T("Essenza del Serafino", "3 dosi: ognuna cura 10d8 e rimuove ogni condizione (come Ristorare Superiore)."),
    T("Radice dell'Immortalità Minore", "Chi la mangia non può morire per i prossimi 7 giorni (a 0 PF resta stabile e cosciente)."),
    T("Esca del Cacciatore di Dèi", "Attira entro 1 km una creatura leggendaria a scelta del Master, che arriva in 1d4 ore."),
    T("Ghirlanda dei Quattro Venti", "Indossata: velocità di volo 18 m per 1 ora al giorno e immunità ai danni da fulmine."),
    T("Rimedio della Resurrezione", "Come l'incantesimo Resurrezione, senza componenti: funziona su chi è morto da meno di 100 anni."),
  ],
  cuoco: [
    T("Banchetto degli Eroi Perfetto", "Per 12 persone: come l'incantesimo Banchetto degli Eroi, e in più immunità al veleno per 24 ore."),
    T("Birra del Gigante delle Tempeste", "Per 1 ora Forza 29 e resistenza al fulmine e al tuono."),
    T("Ambrosia degli Antichi", "Chi la assaggia recupera tutti gli slot incantesimo e i punti ferita, una volta al giorno per persona."),
    T("Idromele di Valhalla", "Un boccale = 20 punti ferita temporanei, immunità alla paura e un attacco in più con l'azione di Attacco per 10 minuti."),
    T("Pane della Vita", "Una pagnotta per persona: per 24 ore chi scende a 0 PF resta a 1 PF, una volta."),
    T("Tè dell'Oracolo", "Bevuto: una Divinazione (risposta vera del Master) sul giorno che verrà."),
    T("Vino della Memoria Eterna", "Chi lo beve rivive un ricordo con ogni dettaglio; vantaggio permanente alle prove per ricordare quel giorno."),
    T("Torta del Compleanno Cosmico", "Una fetta per persona: ogni commensale ottiene Ispirazione e ritira un tiro entro 24 ore."),
    T("Distillato del Drago Rosso", "Soffio di fuoco per 1 ora: azione, cono di 4,5 m, 6d6 danni da fuoco (CD 15), poi 1d4 turni di ricarica."),
    T("Zuppa della Rinascita", "Un corpo morto da meno di 1 ora che ne beve un cucchiaio torna in vita a 1 PF (Rivivificare)."),
    T("Sale dell'Immortalità", "Una presa sul cibo: chi lo mangia non invecchia per 1 anno."),
    T("Stufato del Serafino Supremo", "Per 6 persone: +2 alla CA, resistenza ai danni radiosi e necrotici e volo (velocità 9 m) per 1 ora."),
  ],
  ingegnere: [
    T("Automa da Guerra Titanico", "Costrutto Grande (statistiche di un Golem di Ferro) che obbedisce a chi ha la chiave. Va ricaricato con 1.000 mo di Arcanite al mese."),
    T("Occhio del Cielo", "Cannocchiale montato: vedi qualunque luogo conosciuto entro 100 km (Scrutare CD 17), 3/giorno."),
    T("Bussola dei Piani", "Indica il portale più vicino verso il piano che nomini; 1/giorno lancia Spostamento Planare per te solo."),
    T("Cannocchiale dell'Onniscienza", "Guardandoci dentro per 1 minuto ottieni una risposta vera a una domanda (come Comunione), 1/giorno."),
    T("Rampino dell'Infinito", "Si aggancia a qualunque punto entro 90 m e ti porta lì come Passo Velato, 3/giorno."),
    T("Proiettili del Sole (5)", "Munizioni +3: 4d8 danni radiosi extra, i non morti colpiti sono distrutti se hanno meno di 50 PF."),
    T("Orologio del Tempo Fermato", "1/settimana ferma il tempo per te per 1d4+1 turni, come Fermare il Tempo."),
    T("Golem dell'Arcanite Sovrano", "Costrutto Medio (CA 18, 120 PF, 2 attacchi 2d8+5) che lancia Scudo su di te come reazione, 3/giorno."),
    T("Macchina Volante Personale", "Velocità di volo 24 m per 8 ore al giorno, un passeggero, non fa rumore."),
    T("Guanto Meccanico del Titano", "Forza 25 e attacchi disarmati 2d6 contundenti; azione: schianti un muro non magico di 1,5 m."),
    T("Cuore di Fuoco Eterno", "Montato su un costrutto o un'arma: +2d6 danni da fuoco a ogni colpo; è una fonte di calore e luce infinita."),
    T("Sigillo dell'Ingegnere Cosmico", "Ogni meccanismo che tocchi funziona come nuovo (Riparare senza limiti) e apri qualunque serratura non magica."),
  ],
  cartografo: [
    T("Mappa delle Stelle Cadute", "Segna il punto esatto dove cadrà la prossima pietra celeste (1d10 giorni): 2d6 × 100 mo di metallo stellare."),
    T("Sigillo dell'Imperatore Eterno", "Un documento sigillato con esso è legge in qualunque regno umano: TS Saggezza CD 19 per rifiutarsi di obbedire."),
    T("Lettera dei Destini", "Chi la legge vede il proprio futuro più probabile (Prescienza per 8 ore, una volta a persona)."),
    T("Mappa del Cuore del Mondo", "Mostra ogni luogo di potere, portale e leyline entro 100 km, in tempo reale."),
    T("Stendardo della Vittoria", "Piantato: gli alleati entro 18 m hanno +2 ai tiri per colpire e ai TS, immunità alla paura; 1 ora al giorno."),
    T("Cifrario degli Dèi", "Scrivi una domanda: la risposta arriva dalla divinità del casato (Comunione) 1/settimana."),
    T("Carta dei Piani", "Consultata per 10 minuti: Spostamento Planare per te e 8 compagni verso il piano indicato, 1/settimana."),
    T("Sigillo del Vero Nome", "Scritto il vero nome di una creatura, hai vantaggio ai TS contro di lei e lei svantaggio contro di te, per sempre."),
    T("Mappa del Labirinto Infinito", "Chi la legge senza la parola chiave è intrappolato in un Labirinto (come l'incantesimo) finché non ne esce."),
    T("Genealogia dei Primi Re", "Prova il tuo diritto a un trono: vantaggio permanente a Persuasione con la nobiltà di un regno a scelta."),
    T("Bandiera del Sole Nascente", "Alzata all'alba: gli alleati entro 30 m recuperano 5d8 PF e ogni condizione; 1/giorno."),
    T("Diario del Viaggiatore Eterno", "Ogni luogo scritto nel diario si può raggiungere con Cerchio di Teletrasporto 1/giorno (nessun cerchio necessario)."),
  ],
  gioielliere: [
    T("Anello del Vento Elementale", "Anello del Comando Elementale (aria): volo, Levitazione, Muro di Vento, Tempesta di Ghiaccio e comanda gli elementali dell'aria."),
    T("Collana dei Fuochi Cosmici", "9 gemme: ognuna è una Palla di Fuoco di livello 3–6 (a scelta) da staccare e lanciare."),
    T("Amuleto dei Piani", "1/giorno lancia Spostamento Planare (con rischio 1 su 20 di finire su un piano casuale)."),
    T("Bracciali del Titano", "Forza 27 e vantaggio ai TS su Forza; +2 alla CA se non indossi armatura."),
    T("Diadema del Sovrano dei Draghi", "Parli con i draghi, hai vantaggio ai TS contro i loro soffi e 1/giorno lanci Dominare Mostri (CD 19) su un drago."),
    T("Gemma dell'Anima", "Come la Gemma della Cattura di Anime: intrappola una creatura a 0 PF (TS Carisma CD 19), poi puoi evocarla come alleata 1/giorno."),
    T("Corona del Re Eterno", "+2 alla CA e ai TS, immune a paura e affascinamento; chi ti attacca fa TS Saggezza CD 17 o esita per un turno."),
    T("Anello della Rigenerazione", "Recuperi 1d6 PF ogni 10 minuti e ricrescono gli arti perduti in 1d6+1 giorni."),
    T("Occhio di Drago Incastonato", "Anello: scurovisione 36 m, vedi gli invisibili e 1/giorno soffi come un drago (8d6, tipo scelto, CD 17)."),
    T("Anello dell'Arcimago", "Lancia Controincantesimo (5°) come reazione 3/giorno e i tuoi incantesimi hanno CD +1."),
    T("Collana della Preghiera Suprema", "10 grani: ognuno lancia Ristorare Superiore, Benedizione, Cura Ferite (4°) o Parola Guaritrice di Massa; si ricarica all'alba."),
    T("Talismano della Sfera Ultima", "Trasporta il Talismano della Sfera: con Concentrazione controlli una Sfera di Annientamento (a scelta del Master)."),
  ],
  incantatore: [
    T("Pergamena d'Incantesimo (9°)", "Un incantesimo di 9° livello a scelta col Master, lanciabile una volta."),
    T("Runa dell'Eterna Protezione", "Incisa sulla pelle: +2 alla CA e ai TS, permanente finché non la cancelli."),
    T("Sfera del Sole Nascente", "Come Luce Solare Suprema, a comando, senza limite; i non morti entro 18 m subiscono 4d8 radiosi all'inizio del turno."),
    T("Cristallo dell'Arcanite Infinita", "Contiene uno slot di ogni livello dal 1° al 5°, si ricarica all'alba."),
    T("Inchiostro del Fato", "Ciò che scrivi col suo ultimo goccio diventa vero, entro i limiti di un Desiderio (una volta sola)."),
    T("Glifo della Fine", "Tracciato in 1 ora: chi lo attiva subisce 20d6 danni da forza (CD 19) e l'area di 6 m crolla."),
    T("Tomo del Pensiero Limpido", "Letto in 6 giorni: Intelligenza +2 (max 30); poi perde la magia per un secolo."),
    T("Libro dei Nomi Veri", "Conosci il vero nome di una creatura a scelta per sessione: i tuoi incantesimi contro di lei hanno CD +2 e ignorano la resistenza alla magia."),
    T("Grimorio Vivente", "Libro senziente: contiene 30 livelli di incantesimi a scelta del Master e ti suggerisce (vantaggio ad Arcano)."),
    T("Pergamena del Desiderio", "Una pergamena che porta l'incantesimo Desiderio: leggerla lo lancia, una volta."),
    T("Runa del Legame Planare", "Incisa su un cerchio: Legame Planare (CD 19) senza componenti materiali, 1/settimana."),
    T("Occhio Arcano Permanente", "Sfera di cristallo: un Occhio Arcano sempre attivo che controlli con un'azione, ovunque entro 1 km."),
  ],
};

/* ============================================================
   RICETTE DI GRADO (2026-10-10)
   ------------------------------------------------------------
   Le 6 linee qui sopra sono dell'Apprendista. Ogni grado del
   Sentiero apre 2 linee nuove: Discepolo e Artigiano fino al Raro,
   Maestro fino al Molto raro, Leggenda fino al Leggendario — così
   anche Molto raro e Leggendario diventano oggetti che si scelgono.
   `min` = la rarità più bassa a cui la linea si sceglie; sotto,
   con un tiro basso, esce la versione più semplice della stessa
   linea (sempre definita da Comune in su).
   Il terzo elemento della tupla è la MECCANICA per Foundry
   (vedi `itemMech` in fondo e craftingFoundry.js):
     base   parola-chiave per riconoscere arma/armatura se il nome non basta
     plus   +N al colpire e ai danni (armi) o alla CA (armature)
     extra  [dado, tipo] danno in più sull'arma
     heal / temp   formula di cura / punti ferita temporanei
     dmg    [dado, tipo] danno del consumabile; save [car, CD]
     uses   [quanti, "day"|"charges"|"lr"|"sr", recupero]
     fx     effetti attivi: "ac+1", "save+1", "res:fire", "imm:poison",
            "str=21", "con=19", "int=19", "spell+1", "dc+1", "swim=40", "fly=30", "climb=30"
     res: "choice"  resistenza a scelta al ritiro
     type / ctype   tipo dnd5e e sottotipo del consumabile
   ============================================================ */

const M = (name, desc, mech) => (mech ? [name, desc, mech] : [name, desc]);
const G = (grado, min, key, icon, t) => ({ key, icon, grado, min, ...t });

export const RICETTE_GRADO = {
  // ── FABBRO ─────────────────────────────────────────────────
  fabbro: [
    G(2, "uncommon", "rovente", "🔥", {
      common: M("Spada Lunga", "Arma da guerra: 1d8 taglienti, versatile (1d10)."),
      uncommon: M("Spada Lunga Rovente", "1d8 taglienti + 1d4 fuoco. Conta come magica.", { base: "spada lunga", extra: ["1d4", "fire"] }),
      rare: M("Lingua di Fuoco", "Spada lunga: 1d8 taglienti + 2d6 fuoco; a comando la lama arde e fa luce in 12 m.", { base: "spada lunga", extra: ["2d6", "fire"] }),
    }),
    G(2, "common", "mezza", "🛡", {
      common: M("Mezza Armatura", "Armatura media: CA 15 + Destrezza (max +2), svantaggio a Furtività."),
      uncommon: M("Mezza Armatura +1", "CA 16 + Destrezza (max +2). Conta come magica."),
      rare: M("Mezza Armatura +2", "CA 17 + Destrezza (max +2). Conta come magica."),
    }),
    G(3, "uncommon", "gelo", "❄", {
      common: M("Ascia da Battaglia", "Arma da guerra: 1d8 taglienti, versatile (1d10)."),
      uncommon: M("Ascia da Battaglia del Gelo", "1d8 taglienti + 1d4 freddo. Conta come magica.", { base: "ascia da battaglia", extra: ["1d4", "cold"] }),
      rare: M("Ascia Brinata", "Ascia da battaglia: 1d8 taglienti + 2d6 freddo; chi colpisci perde 3 m di velocità fino al tuo prossimo turno.", { base: "ascia da battaglia", extra: ["2d6", "cold"] }),
    }),
    G(3, "rare", "resistenza", "🔰", {
      common: M("Cotta di Maglia", "Armatura pesante: CA 16, richiede Forza 13, svantaggio a Furtività."),
      uncommon: M("Cotta di Maglia +1", "CA 17. Conta come magica."),
      rare: M("Cotta di Maglia della Resistenza", "CA 16 e resistenza a un tipo di danno, scelto al ritiro.", { base: "cotta di maglia", res: "choice" }),
    }),
    G(4, "rare", "superiore", "⚔", {
      common: M("Spada Lunga / Ascia da Battaglia / Martello da Guerra", "Arma da guerra a scelta: 1d8, versatile (1d10)."),
      uncommon: M("Spada Lunga +1 / Ascia da Battaglia +1 / Martello da Guerra +1", "+1 al colpire e ai danni. Conta come magica."),
      rare: M("Spada Lunga +2 / Ascia da Battaglia +2 / Martello da Guerra +2", "+2 al colpire e ai danni. Conta come magica."),
      veryRare: M("Spada Lunga +3 / Ascia da Battaglia +3 / Martello da Guerra +3", "+3 al colpire e ai danni. Conta come magica."),
    }),
    G(4, "rare", "bastione", "🏰", {
      common: M("Armatura Completa", "Armatura pesante: CA 18, richiede Forza 15, svantaggio a Furtività."),
      uncommon: M("Armatura Completa +1", "CA 19. Conta come magica."),
      rare: M("Armatura Completa +2", "CA 20. Conta come magica."),
      veryRare: M("Armatura Completa +3", "CA 21. Conta come magica."),
    }),
    G(5, "rare", "vorpal", "🗡", {
      common: M("Spada Lunga", "Arma da guerra: 1d8 taglienti, versatile (1d10)."),
      uncommon: M("Spada Lunga +1", "+1 al colpire e ai danni. Conta come magica."),
      rare: M("Spada Lunga +2", "+2 al colpire e ai danni. Conta come magica."),
      veryRare: M("Spada Lunga +3", "+3 al colpire e ai danni. Conta come magica."),
      legendary: M("Lama Vorpal", "Spada lunga +3. Con un 20 naturale recide la testa di una creatura che ne ha una (le creature leggendarie subiscono invece 6d8 taglienti in più).", { base: "spada lunga", plus: 3 }),
    }),
    G(5, "rare", "fulmini", "⚡", {
      common: M("Martello da Guerra", "Arma da guerra: 1d8 contundenti, versatile (1d10)."),
      uncommon: M("Martello da Guerra +1", "+1 al colpire e ai danni. Conta come magico."),
      rare: M("Martello da Guerra +2", "+2 al colpire e ai danni. Conta come magico."),
      veryRare: M("Martello del Tuono", "Martello da guerra +2: 1d8 contundenti + 2d6 tuono.", { base: "martello da guerra", plus: 2, extra: ["2d6", "thunder"] }),
      legendary: M("Martello dei Fulmini", "Martello da guerra +3: 1d8 contundenti + 2d6 fulmine. 1 volta al giorno, lanciato, scatena un fulmine: 8d6 fulmine in una linea di 18 m, TS Destrezza CD 17 per dimezzare.", { base: "martello da guerra", plus: 3, extra: ["2d6", "lightning"], uses: [1, "day"] }),
    }),
  ],

  // ── ALCHIMISTA ─────────────────────────────────────────────
  alchimista: [
    G(2, "uncommon", "acido", "🧪", {
      common: M("Acido", "Fiala da lancio (6 m): 2d6 danni da acido."),
      uncommon: M("Acido Concentrato", "Fiala da lancio (6 m), schizza in 1,5 m: 4d6 acido, TS Destrezza CD 13 per dimezzare.", { ctype: "trinket", dmg: ["4d6", "acid"], save: ["dex", 13] }),
      rare: M("Fiala di Dissoluzione", "Esplode in una sfera di 3 m: 6d6 acido, TS Destrezza CD 15 per dimezzare; corrode le armature non magiche (−1 CA finché non si riparano).", { ctype: "trinket", dmg: ["6d6", "acid"], save: ["dex", 15] }),
    }),
    G(2, "uncommon", "olio", "🫗", {
      common: M("Olio dell'Arma", "Spalmato su una lama: non arrugginisce e non perde il filo per una settimana."),
      uncommon: M("Olio Infuocato", "Spalmato su un'arma (1 minuto di effetto): +1d4 danni da fuoco a ogni colpo.", { ctype: "potion" }),
      rare: M("Olio dell'Affilatura", "Spalmato su un'arma (1 ora di effetto): +1 al colpire e ai danni, e conta come magica.", { ctype: "potion" }),
    }),
    G(3, "uncommon", "mente", "🧠", {
      common: M("Infuso Lucido", "Per 1 ora non puoi addormentarti né essere stordito dalla stanchezza."),
      uncommon: M("Pozione della Lettura del Pensiero", "Bevuta: come Individuazione dei Pensieri (CD 13) per 1 minuto.", { ctype: "potion", save: ["wis", 13] }),
      rare: M("Pozione della Chiaroveggenza", "Bevuta: come l'incantesimo Chiaroveggenza per 10 minuti, su un luogo che conosci.", { ctype: "potion" }),
    }),
    G(3, "uncommon", "gas", "💨", {
      common: M("Fiala Fumogena", "Lanciata (6 m): nube di 3 m che oscura pesantemente per 1 minuto."),
      uncommon: M("Fiala Soporifera", "Nube di 3 m: TS Costituzione CD 13 o addormentato per 1 minuto (si sveglia se subisce danni).", { ctype: "trinket", save: ["con", 13] }),
      rare: M("Fiala di Gas Tossico", "Nube di 6 m: 4d8 veleno, TS Costituzione CD 15 per dimezzare; chi fallisce è avvelenato per 1 minuto.", { ctype: "trinket", dmg: ["4d8", "poison"], save: ["con", 15] }),
    }),
    G(4, "rare", "viverna", "🐲", {
      common: M("Veleno Base", "Da applicare su una lama: +1d4 danni da veleno al primo colpo entro 1 minuto."),
      uncommon: M("Veleno del Serpente", "Al primo colpo: TS Costituzione CD 11 o 3d6 danni da veleno (metà se riesce)."),
      rare: M("Veleno Paralizzante", "Al primo colpo: TS Costituzione CD 13 o paralizzato per 1 minuto (ripete il TS a fine turno)."),
      veryRare: M("Veleno di Viverna", "Al primo colpo: TS Costituzione CD 15 o 7d6 danni da veleno (metà se riesce).", { ctype: "poison", dmg: ["7d6", "poison"], save: ["con", 15] }),
    }),
    G(4, "rare", "giganti", "💪", {
      common: M("Tonico del Facchino", "Per 8 ore la tua capacità di carico raddoppia."),
      uncommon: M("Pozione della Forza di Gigante delle Colline", "La tua Forza diventa 21 per 1 ora."),
      rare: M("Pozione della Forza di Gigante del Fuoco", "La tua Forza diventa 25 per 1 ora."),
      veryRare: M("Pozione della Forza di Gigante delle Nuvole", "La tua Forza diventa 27 per 1 ora.", { ctype: "potion", fx: ["str=27"] }),
    }),
    G(5, "rare", "ombra", "🌑", {
      common: M("Fiala Fumogena", "Lanciata (6 m): nube di 3 m che oscura pesantemente per 1 minuto."),
      uncommon: M("Pozione dell'Ombra", "Per 1 ora le ombre ti coprono: vantaggio alle prove di Furtività in penombra.", { ctype: "potion" }),
      rare: M("Pozione della Velocità", "Come l'incantesimo Velocità per 1 minuto (senza concentrazione).", { ctype: "potion" }),
      veryRare: M("Pozione di Invisibilità", "Sei invisibile per 1 ora; l'effetto finisce se attacchi o lanci un incantesimo.", { ctype: "potion" }),
      legendary: M("Elisir dell'Eclisse", "Per 1 ora sei invisibile anche mentre attacchi (come Invisibilità Superiore, senza concentrazione) e puoi usare Passo Velato 3 volte.", { ctype: "potion" }),
    }),
    G(5, "rare", "vita", "❤", {
      common: M("Pozione di Guarigione", "Bevuta come azione: recupera 2d4+2 punti ferita."),
      uncommon: M("Pozione di Guarigione Maggiore", "Recupera 4d4+4 punti ferita."),
      rare: M("Pozione di Guarigione Superiore", "Recupera 8d4+8 punti ferita."),
      veryRare: M("Pozione di Guarigione Suprema", "Recupera 10d4+20 punti ferita.", { ctype: "potion", heal: "10d4+20" }),
      legendary: M("Elisir della Vita", "Versato in bocca a chi è morto da meno di 10 giorni lo riporta in vita con tutti i punti ferita, come Rianimare Morti. Su un vivo: recupera 20d4+40 punti ferita.", { ctype: "potion", heal: "20d4+40" }),
    }),
  ],

  // ── INTAGLIATORE / FALEGNAME ───────────────────────────────
  intagliatore: [
    G(2, "common", "balestra", "🎯", {
      common: M("Balestra Leggera", "Arma semplice: 1d8 perforanti, gittata 24/96, ricarica, due mani.", { base: "balestra" }),
      uncommon: M("Balestra Leggera +1", "+1 al colpire e ai danni. Conta come magica.", { base: "balestra" }),
      rare: M("Balestra Leggera +2", "+2 al colpire e ai danni. Conta come magica.", { base: "balestra" }),
    }),
    G(2, "common", "scudo", "🛡", {
      common: M("Scudo di Quercia", "Scudo di legno: +2 alla CA.", { base: "scudo" }),
      uncommon: M("Scudo di Quercia +1", "+3 alla CA in tutto. Conta come magico.", { base: "scudo" }),
      rare: M("Scudo di Quercia +2", "+4 alla CA in tutto. Conta come magico.", { base: "scudo" }),
    }),
    G(3, "uncommon", "adepto", "🪄", {
      common: M("Bastone Ferrato", "Arma semplice: 1d6 contundenti, versatile (1d8)."),
      uncommon: M("Bastone dell'Adepto", "Bastone e focus arcano: +1 ai tiri per colpire con gli incantesimi.", { base: "bastone", fx: ["spell+1"] }),
      rare: M("Bastone dell'Adepto Superiore", "Bastone e focus arcano: +2 ai tiri per colpire con gli incantesimi.", { base: "bastone", fx: ["spell+2"] }),
    }),
    G(3, "uncommon", "bacchette", "✨", {
      common: M("Bacchetta Inerte", "Focus arcano ben bilanciato: +1 alle prove di Arcano per identificare incantesimi."),
      uncommon: M("Bacchetta della Ragnatela", "7 cariche: 1 carica = Ragnatela (CD 15). Recupera 1d6+1 cariche all'alba.", { ctype: "wand", save: ["dex", 15], uses: [7, "day", "1d6+1"] }),
      rare: M("Bacchetta dei Fulmini", "7 cariche: 1 carica = Fulmine (8d6 fulmine, linea di 30 m, TS Destrezza CD 15 per dimezzare). Recupera 1d6+1 cariche all'alba.", { ctype: "wand", dmg: ["8d6", "lightning"], save: ["dex", 15], uses: [7, "day", "1d6+1"] }),
    }),
    G(4, "rare", "arco", "🏹", {
      common: M("Arco Lungo", "Arma da guerra: 1d8 perforanti, gittata 45/180, pesante, due mani."),
      uncommon: M("Arco Lungo +1", "+1 al colpire e ai danni. Conta come magico."),
      rare: M("Arco Lungo +2", "+2 al colpire e ai danni. Conta come magico."),
      veryRare: M("Arco Lungo +3", "+3 al colpire e ai danni. Conta come magico."),
    }),
    G(4, "rare", "metamorfosi", "🦎", {
      common: M("Bacchetta Inerte", "Focus arcano ben bilanciato: +1 alle prove di Arcano per identificare incantesimi."),
      uncommon: M("Bacchetta dei Dardi Incantati", "7 cariche: 1 carica = Dardo Incantato di 1°, fino a 3 cariche per alzare il livello. Recupera 1d6+1 all'alba."),
      rare: M("Bacchetta delle Palle di Fuoco", "7 cariche: 1 carica = Palla di Fuoco di 3° (CD 15), fino a 3 cariche per alzare il livello. Recupera 1d6+1 all'alba."),
      veryRare: M("Bacchetta della Metamorfosi", "7 cariche: 1 carica = Metamorfosi (CD 15). Recupera 1d6+1 cariche all'alba.", { ctype: "wand", save: ["wis", 15], uses: [7, "day", "1d6+1"] }),
    }),
    G(5, "rare", "giuramento", "🌅", {
      common: M("Arco Lungo", "Arma da guerra: 1d8 perforanti, gittata 45/180, pesante, due mani."),
      uncommon: M("Arco Lungo +1", "+1 al colpire e ai danni. Conta come magico."),
      rare: M("Arco Lungo +2", "+2 al colpire e ai danni. Conta come magico."),
      veryRare: M("Arco Lungo +3", "+3 al colpire e ai danni. Conta come magico."),
      legendary: M("Arco del Giuramento", "Arco lungo +3. Dici \"morte rapida al mio nemico\": per 7 giorni quel bersaglio subisce 3d6 perforanti in più dalle tue frecce e non ha copertura contro di esse (1 volta all'alba).", { base: "arco lungo", plus: 3, uses: [1, "day"] }),
    }),
    G(5, "rare", "potere", "🔱", {
      common: M("Bastone Ferrato", "Arma semplice: 1d6 contundenti, versatile (1d8)."),
      uncommon: M("Bastone +1", "+1 al colpire e ai danni; focus arcano. Conta come magico."),
      rare: M("Bastone +2", "+2 al colpire e ai danni; focus arcano. Conta come magico."),
      veryRare: M("Bastone del Fuoco", "10 cariche: Mani Brucianti (1), Palla di Fuoco (3), Muro di Fuoco (4), CD 15. Recupera 1d6+4 cariche all'alba.", { base: "bastone", uses: [10, "day", "1d6+4"] }),
      legendary: M("Bastone del Potere", "Bastone +2: +2 alla CA, ai tiri salvezza e ai tiri per colpire con gli incantesimi. 20 cariche per Dardo Incantato, Palla di Fuoco, Fulmine, Cono di Freddo e altri (CD 17). Recupera 2d8+4 cariche all'alba.", { base: "bastone", plus: 2, fx: ["ac+2", "save+2", "spell+2"], uses: [20, "day", "2d8+4"] }),
    }),
  ],

  // ── SARTO / TESSITORE ──────────────────────────────────────
  sarto: [
    G(2, "common", "borchiato", "🥋", {
      common: M("Armatura di Cuoio Borchiato", "Armatura leggera: CA 12 + Destrezza."),
      uncommon: M("Armatura di Cuoio Borchiato +1", "CA 13 + Destrezza. Conta come magica."),
      rare: M("Armatura di Cuoio Borchiato +2", "CA 14 + Destrezza. Conta come magica."),
    }),
    G(2, "uncommon", "elfico", "🍃", {
      common: M("Mantello da Viaggio", "Impermeabile e caldo: non soffri il freddo lieve né la pioggia."),
      uncommon: M("Mantello Elfico", "Con il cappuccio alzato le prove di Percezione per vederti hanno svantaggio, e tu hai vantaggio a Furtività per nasconderti."),
      rare: M("Mantello del Pipistrello", "Vantaggio a Furtività; al buio puoi volare a 12 m (tenendo i lembi) e 1 volta al giorno trasformarti in pipistrello.", { uses: [1, "day"] }),
    }),
    G(3, "uncommon", "resistenza", "🔰", {
      common: M("Mantello con Cappuccio", "Caldo e discreto: vantaggio a non farsi riconoscere a distanza."),
      uncommon: M("Mantello del Viandante", "Chi lo indossa non soffre il caldo né il freddo estremi (fino a −45 °C e +50 °C)."),
      rare: M("Mantello della Resistenza", "Resistenza a un tipo di danno, scelto al ritiro, mentre lo indossi.", { type: "equipment", res: "choice" }),
    }),
    G(3, "uncommon", "saltatore", "👢", {
      common: M("Stivali da Viaggio", "Comodi e resistenti: ignori il terreno difficile della strada nelle marce."),
      uncommon: M("Stivali del Saltatore", "Le tue distanze di salto triplicano."),
      rare: M("Stivali Alati", "Velocità di volo pari a quella di camminata, fino a 4 ore al giorno (anche spezzate).", { fx: ["fly=30"], uses: [4, "day"] }),
    }),
    G(4, "rare", "borchiato3", "🥋", {
      common: M("Armatura di Cuoio Borchiato", "Armatura leggera: CA 12 + Destrezza."),
      uncommon: M("Armatura di Cuoio Borchiato +1", "CA 13 + Destrezza. Conta come magica."),
      rare: M("Armatura di Cuoio Borchiato +2", "CA 14 + Destrezza. Conta come magica."),
      veryRare: M("Armatura di Cuoio Borchiato +3", "CA 15 + Destrezza. Conta come magica."),
    }),
    G(4, "rare", "aracnide", "🕷", {
      common: M("Mantello con Cappuccio", "Caldo e discreto: vantaggio a non farsi riconoscere a distanza."),
      uncommon: M("Mantello di Protezione", "+1 alla CA e a tutti i tiri salvezza mentre lo indossi."),
      rare: M("Mantello del Dislocamento", "Sembri stare altrove: gli attacchi contro di te hanno svantaggio (si spegne fino al tuo turno se vieni colpito)."),
      veryRare: M("Mantello dell'Aracnide", "Resistenza al veleno, scali come un ragno (anche sui soffitti), non resti invischiato nelle ragnatele e 1 volta al giorno lanci Ragnatela (CD 13).", { type: "equipment", fx: ["res:poison", "climb=30"], uses: [1, "day"] }),
    }),
    G(5, "rare", "arcimago", "🌌", {
      common: M("Veste Arcana", "Tunica da incantatore con tasche per i componenti: +1 alle prove di Arcano."),
      uncommon: M("Veste Utile", "Toppe cucite che diventano oggetti: 4d4 toppe fra corda, torce, pozione di guarigione, scala, cavallo da soma…"),
      rare: M("Veste degli Occhi", "Vedi in ogni direzione, scurovisione 36 m, vedi gli invisibili e l'Etereo entro 36 m. Svantaggio ai TS contro la Luce."),
      veryRare: M("Veste delle Stelle", "+1 a tutti i tiri salvezza. 6 stelle: ognuna lancia Dardo Incantato di 5° livello; recupera 1d6 stelle a mezzanotte.", { type: "equipment", fx: ["save+1"], uses: [6, "day", "1d6"] }),
      legendary: M("Veste dell'Arcimago", "Senza armatura la tua CA è 15 + Destrezza; vantaggio ai tiri salvezza contro gli incantesimi; +2 alla CD dei tuoi incantesimi e ai tiri per colpire con essi.", { type: "equipment", fx: ["dc+2", "spell+2"] }),
    }),
    G(5, "rare", "invisibile", "👻", {
      common: M("Mantello con Cappuccio", "Caldo e discreto: vantaggio a non farsi riconoscere a distanza."),
      uncommon: M("Mantello Elfico", "Con il cappuccio alzato le prove di Percezione per vederti hanno svantaggio, e tu hai vantaggio a Furtività per nasconderti."),
      rare: M("Mantello del Dislocamento", "Sembri stare altrove: gli attacchi contro di te hanno svantaggio (si spegne fino al tuo turno se vieni colpito)."),
      veryRare: M("Mantello dell'Ombra Viva", "1 volta al giorno, come azione bonus, diventi invisibile per 1 minuto (finisce se attacchi).", { type: "equipment", uses: [1, "day"] }),
      legendary: M("Mantello dell'Invisibilità", "Alzando il cappuccio diventi invisibile, fino a 2 ore al giorno anche spezzate (finisce se attacchi o lanci un incantesimo).", { type: "equipment", uses: [2, "day"] }),
    }),
  ],

  // ── ERBORISTA ──────────────────────────────────────────────
  erborista: [
    G(2, "uncommon", "infuso", "🍵", {
      common: M("Unguento Curativo", "Spalmato in 1 minuto: recupera 1d4+1 punti ferita (3 dosi)."),
      uncommon: M("Infuso del Guaritore", "Bevuto come azione: recupera 2d4+2 punti ferita.", { ctype: "potion", heal: "2d4+2" }),
      rare: M("Infuso del Bosco Antico", "Bevuto: recupera 4d4+4 punti ferita e neutralizza un veleno.", { ctype: "potion", heal: "4d4+4" }),
    }),
    G(2, "uncommon", "spine", "🌵", {
      common: M("Polvere Urticante", "Soffiata in faccia (1,5 m): prurito e lacrime, svantaggio alla prossima prova di Percezione."),
      uncommon: M("Polvere di Spine", "Lanciata in un cubo di 3 m: 2d4 perforanti, TS Destrezza CD 12 per dimezzare.", { ctype: "trinket", dmg: ["2d4", "piercing"], save: ["dex", 12] }),
      rare: M("Seme dei Rovi", "Lanciato a 9 m: per 10 minuti un cerchio di 6 m diventa terreno difficile e chi lo attraversa subisce 2d4 perforanti ogni 1,5 m (come Crescita di Spine).", { ctype: "trinket", dmg: ["2d4", "piercing"] }),
    }),
    G(3, "uncommon", "corteccia", "🌳", {
      common: M("Tisana Riposante", "Bevuta durante un riposo breve: recuperi 1d4 punti ferita in più per ogni Dado Vita speso."),
      uncommon: M("Infuso dell'Orso", "Bevuto: 2d6 punti ferita temporanei per 1 ora.", { ctype: "potion", temp: "2d6" }),
      rare: M("Infuso della Pelle di Corteccia", "Per 1 ora la tua CA non può essere inferiore a 16 (come Pelle di Corteccia).", { ctype: "potion" }),
    }),
    G(3, "uncommon", "sonno", "💤", {
      common: M("Erba del Sonno", "In tisana: chi la beve si addormenta subito e riposa profondamente per 8 ore."),
      uncommon: M("Polline Soporifero", "Soffiato in un cono di 4,5 m: TS Costituzione CD 13 o addormentato per 1 minuto (si sveglia se subisce danni).", { ctype: "trinket", save: ["con", 13] }),
      rare: M("Fiore del Lungo Sonno", "Soffiato in un cono di 4,5 m: TS Costituzione CD 15 o addormentato per 1 ora (si sveglia solo se subisce danni).", { ctype: "trinket", save: ["con", 15] }),
    }),
    G(4, "rare", "balsamo", "🫙", {
      common: M("Unguento Curativo", "Spalmato in 1 minuto: recupera 1d4+1 punti ferita (3 dosi)."),
      uncommon: M("Unguento di Keoghtom", "Vasetto con 3 dosi: ogni dose cura 2d8+2 e rimuove veleno e malattia."),
      rare: M("Unguento della Guarigione Profonda", "Vasetto con 3 dosi: ogni dose cura 4d8+4, rimuove veleno, malattia e un livello di sfinimento."),
      veryRare: M("Balsamo della Rinascita", "Vasetto con 2 dosi: ogni dose cura 8d8+8 e rimuove tutti i livelli di sfinimento.", { ctype: "potion", heal: "8d8+8", uses: [2, "charges"] }),
    }),
    G(4, "rare", "loto", "🪷", {
      common: M("Veleno Naturale", "Su una lama: +1d4 danni da veleno al primo colpo entro 1 minuto."),
      uncommon: M("Veleno del Serpente Runico", "Al primo colpo: TS Costituzione CD 11 o 2d6 danni da veleno e avvelenato per 1 minuto."),
      rare: M("Belladonna Nera", "Ingerita o su lama: TS Costituzione CD 14 o 4d6 danni da veleno e avvelenato per 1 ora (metà danni se riesce)."),
      veryRare: M("Loto Nero", "Su lama: TS Costituzione CD 17 o 8d6 danni da veleno e avvelenato per 24 ore (metà danni se riesce).", { ctype: "poison", dmg: ["8d6", "poison"], save: ["con", 17] }),
    }),
    G(5, "rare", "seme", "🌱", {
      common: M("Seme di Quercia", "Piantato, in un giorno diventa un alberello robusto: buon riparo per la notte."),
      uncommon: M("Seme della Crescita", "Piantato: come l'incantesimo Crescita Vegetale su 30 m."),
      rare: M("Seme del Guardiano", "Piantato: per 1 ora un albero risvegliato combatte al tuo fianco (statistiche di un Albero Risvegliato).", { ctype: "trinket" }),
      veryRare: M("Seme della Foresta Viva", "Piantato: come Muro di Spine (CD 17), 7d8 perforanti.", { ctype: "trinket", dmg: ["7d8", "piercing"], save: ["dex", 17] }),
      legendary: M("Seme dell'Albero del Mondo", "Piantato fra gli alleati: ognuno entro 9 m recupera 10d8 punti ferita e si libera da veleni, malattie e maledizioni minori.", { ctype: "trinket", heal: "10d8" }),
    }),
    G(5, "rare", "panacea", "💧", {
      common: M("Antidoto Naturale", "Neutralizza un veleno comune e dà vantaggio ai TS contro il veleno per 1 ora."),
      uncommon: M("Rimedio Potente", "Cura una malattia o un veleno, come Ristorare Inferiore."),
      rare: M("Rimedio Universale", "Come Ristorare Inferiore, e in più rimuove un livello di sfinimento e una maledizione minore."),
      veryRare: M("Panacea", "Bevuta: come l'incantesimo Ristorare Superiore.", { ctype: "potion" }),
      legendary: M("Lacrima di Yggdrasil", "Bevuta: recuperi 70 punti ferita e guarisci da cecità, sordità e ogni malattia (come Guarigione).", { ctype: "potion", heal: "70" }),
    }),
  ],

  // ── CUOCO / MASTRO BIRRAIO ─────────────────────────────────
  cuoco: [
    G(2, "uncommon", "rancio", "🥘", {
      common: M("Stufato del Cacciatore", "Un pasto caldo: chi lo mangia nel riposo breve recupera 1d6 punti ferita in più."),
      uncommon: M("Pasticcio del Soldato", "Mangiato: 1d8 punti ferita temporanei per 1 ora.", { ctype: "food", temp: "1d8" }),
      rare: M("Rancio dell'Eroe", "Mangiato: 2d8 punti ferita temporanei e vantaggio ai TS contro la paura per 1 ora.", { ctype: "food", temp: "2d8" }),
    }),
    G(2, "uncommon", "grappa", "🥃", {
      common: M("Birra della Casa", "Un boccale scaccia la stanchezza: vantaggio alla prossima prova di Costituzione per una marcia."),
      uncommon: M("Grappa del Fuoco", "Un sorso: resistenza al freddo per 1 ora.", { ctype: "food", fx: ["res:cold"] }),
      rare: M("Acquavite del Drago", "Un sorso: resistenza al fuoco per 1 ora e, una volta in quell'ora, sputi un cono di 4,5 m di fuoco (3d6, TS Destrezza CD 13 per dimezzare).", { ctype: "food", fx: ["res:fire"], dmg: ["3d6", "fire"], save: ["dex", 13] }),
    }),
    G(3, "uncommon", "brodo", "🍜", {
      common: M("Tè Caldo", "Sveglia e scalda: niente svantaggio da freddo lieve per 1 ora."),
      uncommon: M("Brodo Ristoratore", "Bevuto come azione: recupera 2d4+2 punti ferita.", { ctype: "food", heal: "2d4+2" }),
      rare: M("Brodo della Nonna", "Bevuto: recupera 4d4+4 punti ferita e toglie la condizione avvelenato.", { ctype: "food", heal: "4d4+4" }),
    }),
    G(3, "rare", "gigante", "🍖", {
      common: M("Spezie Rare", "Un sacchetto di spezie d'Oltremare: vale 25 mo al mercato."),
      uncommon: M("Pepe del Drago", "Nel pasto: vantaggio ai TS su Costituzione per 1 ora."),
      rare: M("Pasto del Gigante", "Mangiato: la tua Forza diventa 21 per 1 ora.", { ctype: "food", fx: ["str=21"] }),
    }),
    G(4, "rare", "banchetto", "🍗", {
      common: M("Razioni da Viaggio", "Dieci giorni di cibo saporito e leggero (metà peso delle razioni normali)."),
      uncommon: M("Pane del Pellegrino", "Una pagnotta = un giorno di cibo e 1d4 punti ferita temporanei fino al prossimo riposo."),
      rare: M("Banchetto dei Camerati", "Per 6 persone: +2d10 punti ferita massimi, immunità alla paura e vantaggio ai TS su Saggezza per 12 ore."),
      veryRare: M("Banchetto degli Eroi", "Per 12 persone, consumato in 1 ora: per 24 ore immuni alla paura e al veleno, vantaggio ai TS su Saggezza e +2d10 punti ferita massimi.", { ctype: "food", fx: ["imm:poison"] }),
    }),
    G(4, "rare", "idromele", "🍯", {
      common: M("Vino della Casa", "Un buon rosso: +1 alle prove di Carisma a tavola per 1 ora."),
      uncommon: M("Vino del Bardo", "+1d4 alle prove di Carisma per 1 ora."),
      rare: M("Liquore del Potere", "Per 1 minuto aggiungi 1d4 ai tiri per colpire e ai TS (come Benedizione)."),
      veryRare: M("Idromele degli Dèi", "Un corno: 20 punti ferita temporanei e l'effetto di Benedizione per 1 ora.", { ctype: "food", temp: "20" }),
    }),
    G(5, "rare", "ambrosia", "🍰", {
      common: M("Dolce della Festa", "Scioglie la lingua: +1 a Persuasione per 1 ora."),
      uncommon: M("Dolce del Bardo", "Chi lo mangia ottiene Ispirazione."),
      rare: M("Torta della Fortuna", "Entro 8 ore puoi ritirare un tiro per colpire, una prova o un TS (una volta)."),
      veryRare: M("Torta dei Fati", "Entro 24 ore puoi ritirare tre tiri a scelta (tiri per colpire, prove o TS).", { ctype: "food", uses: [3, "charges"] }),
      legendary: M("Ambrosia", "Un boccone: recuperi tutti i punti ferita (10d10+50), guarisci da ogni malattia e veleno, e per 24 ore non invecchi né soffri la fame.", { ctype: "food", heal: "10d10+50" }),
    }),
    G(5, "rare", "calderone", "🍲", {
      common: M("Stufato del Cacciatore", "Un pasto caldo: chi lo mangia nel riposo breve recupera 1d6 punti ferita in più."),
      uncommon: M("Stufato del Cuore Forte", "Vantaggio ai TS su Costituzione per 1 ora."),
      rare: M("Stufato del Drago", "Resistenza a un tipo di danno (fuoco, freddo, fulmine, acido o veleno, scelto alla creazione) per 1 ora."),
      veryRare: M("Stufato del Titano", "Mangiato: per 1 ora la tua Forza diventa 25 e hai 20 punti ferita temporanei.", { ctype: "food", fx: ["str=25"], temp: "20" }),
      legendary: M("Zuppa dell'Immortale", "Per 24 ore, la prima volta che scendi a 0 punti ferita resti invece a 1, e hai resistenza ai danni contundenti, perforanti e taglienti.", { ctype: "food", fx: ["res:bludgeoning", "res:piercing", "res:slashing"] }),
    }),
  ],

  // ── INGEGNERE / ARTIGIANO ──────────────────────────────────
  ingegnere: [
    G(2, "common", "manobalestra", "🎯", {
      common: M("Balestra a Mano", "Arma da guerra: 1d6 perforanti, gittata 9/36, leggera, ricarica."),
      uncommon: M("Balestra a Mano +1", "+1 al colpire e ai danni. Conta come magica."),
      rare: M("Balestra a Mano +2", "+2 al colpire e ai danni. Conta come magica."),
    }),
    G(2, "uncommon", "granate", "💣", {
      common: M("Petardo", "Lanciato: un botto assordante, tutti entro 9 m si girano a guardare (distrazione).", { type: "consumable", ctype: "trinket" }),
      uncommon: M("Granata a Schegge", "Lanciata a 9 m, esplode in 3 m: 3d6 perforanti, TS Destrezza CD 13 per dimezzare.", { type: "consumable", ctype: "trinket", dmg: ["3d6", "piercing"], save: ["dex", 13] }),
      rare: M("Granata a Fulmine", "Lanciata a 9 m, esplode in 4,5 m: 5d6 fulmine, TS Destrezza CD 15 per dimezzare.", { type: "consumable", ctype: "trinket", dmg: ["5d6", "lightning"], save: ["dex", 15] }),
    }),
    G(3, "uncommon", "ripetizione", "⚙", {
      common: M("Balestra Leggera", "Arma semplice: 1d8 perforanti, gittata 24/96, ricarica, due mani.", { base: "balestra" }),
      uncommon: M("Balestra Leggera +1", "+1 al colpire e ai danni. Conta come magica.", { base: "balestra" }),
      rare: M("Balestra di Ripetizione", "Balestra leggera +1 con caricatore: niente proprietà ricarica.", { base: "balestra", plus: 1 }),
    }),
    G(3, "uncommon", "tagliola", "🪤", {
      common: M("Tagliola", "Piazzata in 1 minuto: chi la calpesta fa TS Destrezza CD 13 o subisce 1d4 perforanti ed è trattenuto.", { type: "consumable", ctype: "trinket", dmg: ["1d4", "piercing"], save: ["dex", 13] }),
      uncommon: M("Tagliola Rinforzata", "Come la Tagliola, ma 2d6 perforanti e CD 15 (Forza CD 15 per liberarsi).", { type: "consumable", ctype: "trinket", dmg: ["2d6", "piercing"], save: ["dex", 15] }),
      rare: M("Mina Runica", "Piazzata in 1 minuto: chi la calpesta fa esplodere una sfera di 3 m, 4d10 fuoco, TS Destrezza CD 15 per dimezzare.", { type: "consumable", ctype: "trinket", dmg: ["4d10", "fire"], save: ["dex", 15] }),
    }),
    G(4, "rare", "pesante", "🎯", {
      common: M("Balestra Pesante", "Arma da guerra: 1d10 perforanti, gittata 30/120, pesante, ricarica, due mani."),
      uncommon: M("Balestra Pesante +1", "+1 al colpire e ai danni. Conta come magica."),
      rare: M("Balestra Pesante +2", "+2 al colpire e ai danni. Conta come magica."),
      veryRare: M("Balestra Pesante +3", "+3 al colpire e ai danni. Conta come magica."),
    }),
    G(4, "rare", "segugio", "🐕", {
      common: M("Mini Costrutto", "Giocattolo meccanico che cammina e fa rumore: distrazione (vantaggio a Inganno per creare un diversivo)."),
      uncommon: M("Servo Meccanico", "1 ora al giorno agisce come un Servitore Inosservato."),
      rare: M("Golem Custode in Miniatura", "Un famiglio costrutto (statistiche di un Famiglio, CA 15, 10 PF) che ti segue e avvisa dei pericoli."),
      veryRare: M("Segugio d'Ottone", "Cane meccanico che combatte al tuo fianco: statistiche di un Lupo Crudele, CA 16, immune a veleno e paura. Si ripara in un riposo lungo.", { type: "loot" }),
    }),
    G(5, "rare", "tempesta", "🌩", {
      common: M("Petardo", "Lanciato: un botto assordante, tutti entro 9 m si girano a guardare (distrazione)."),
      uncommon: M("Granata a Schegge", "Lanciata a 9 m, esplode in 3 m: 3d6 perforanti, TS Destrezza CD 13 per dimezzare."),
      rare: M("Granata a Fulmine", "Lanciata a 9 m, esplode in 4,5 m: 5d6 fulmine, TS Destrezza CD 15 per dimezzare."),
      veryRare: M("Bomba Tonante", "Lanciata a 18 m, esplode in 6 m: 8d6 tuono, TS Costituzione CD 17 per dimezzare; chi fallisce è assordato e spinto via di 3 m.", { type: "consumable", ctype: "trinket", dmg: ["8d6", "thunder"], save: ["con", 17] }),
      legendary: M("Cuore della Tempesta", "Lanciato a 30 m, esplode in 9 m: 12d6 fulmine, TS Destrezza CD 19 per dimezzare.", { type: "consumable", ctype: "trinket", dmg: ["12d6", "lightning"], save: ["dex", 19] }),
    }),
    G(5, "rare", "colosso", "🤖", {
      common: M("Armatura Completa", "Armatura pesante: CA 18, richiede Forza 15, svantaggio a Furtività."),
      uncommon: M("Armatura Completa +1", "CA 19. Conta come magica."),
      rare: M("Armatura Completa +2", "CA 20. Conta come magica."),
      veryRare: M("Armatura a Vapore", "Armatura completa a ingranaggi: CA 20 e la tua Forza diventa 21 mentre la indossi.", { base: "armatura completa", plus: 2, fx: ["str=21"] }),
      legendary: M("Armatura del Colosso", "Armatura completa: CA 21, la tua Forza diventa 23 e 1 volta al giorno voli a 9 m per 1 minuto.", { base: "armatura completa", plus: 3, fx: ["str=23"], uses: [1, "day"] }),
    }),
  ],

  // ── CARTOGRAFO / ARALDICO ──────────────────────────────────
  cartografo: [
    G(2, "uncommon", "passaggi", "🗺", {
      common: M("Mappa di una Regione", "Strade, fiumi e città di una regione: niente prove per orientarsi lì."),
      uncommon: M("Mappa dei Passaggi", "Segna guadi e sentieri dimenticati: nella regione viaggiate a passo veloce senza penalità a Percezione."),
      rare: M("Mappa Profetica", "1 volta al giorno, toccando la mappa, lanci Localizza Oggetto o Localizza Creatura entro la regione.", { uses: [1, "day"] }),
    }),
    G(2, "uncommon", "salvacondotto", "📜", {
      common: M("Lettera di Presentazione", "Vantaggio alla prima prova di Persuasione con un notabile della città indicata."),
      uncommon: M("Lasciapassare", "Le guardie di una città scelta ti lasciano entrare e uscire senza domande."),
      rare: M("Salvacondotto del Consiglio", "In una città scelta non puoi essere arrestato senza un ordine del suo signore; vale fino a che non la tradisci."),
    }),
    G(3, "uncommon", "stelle", "✨", {
      common: M("Carta del Cielo", "Le costellazioni della stagione: di notte ti orienti senza prove."),
      uncommon: M("Astrolabio", "Sai sempre in che giorno, a che ora e (sotto il cielo) in che punto della regione ti trovi.", { type: "tool" }),
      rare: M("Atlante delle Stelle", "1 volta al giorno, leggendo le stelle, ottieni un Augurio.", { uses: [1, "day"] }),
    }),
    G(3, "uncommon", "stendardo", "🚩", {
      common: M("Bandiera Riconoscibile", "Stendardo del gruppo: vantaggio a Persuasione con chi vi ha già sentito nominare."),
      uncommon: M("Bandiera del Capitano", "Gli alleati entro 9 m hanno vantaggio ai TS contro la paura."),
      rare: M("Stendardo della Carica", "1 volta al giorno, piantato a terra: per 1 minuto gli alleati entro 9 m hanno +3 m di velocità e vantaggio al primo attacco di ogni turno.", { uses: [1, "day"] }),
    }),
    G(4, "rare", "piani", "🌀", {
      common: M("Mappa di una Regione", "Strade, fiumi e città di una regione: niente prove per orientarsi lì."),
      uncommon: M("Mappa Precisa", "Segna anche sentieri e rifugi: vantaggio a Sopravvivenza nella regione."),
      rare: M("Mappa Vivente", "Si aggiorna da sola e mostra sempre dove sei, entro la regione disegnata."),
      veryRare: M("Mappa dei Piani", "1 volta a settimana, tracciando il sigillo di un piano, lanci Spostamento Planare per te e fino a 8 compagni.", { uses: [1, "charges"] }),
    }),
    G(4, "rare", "regale", "👑", {
      common: M("Sigillo Nobile", "Timbro di un casato inventato ma credibile: +1 a Inganno con documenti."),
      uncommon: M("Sigillo Convincente", "Copia fedele di un vero casato: +2 a Inganno con documenti."),
      rare: M("Sigillo dell'Influenza", "1/giorno la lettera che sigilli porta Ammaliare Persone (CD 13) su chi la legge."),
      veryRare: M("Sigillo Regale", "1 volta al giorno la lettera che sigilli porta Suggestione di Massa (CD 17) su chi la legge ad alta voce.", { uses: [1, "day"], save: ["wis", 17] }),
    }),
    G(5, "rare", "atlante", "🌍", {
      common: M("Mappa di una Regione", "Strade, fiumi e città di una regione: niente prove per orientarsi lì."),
      uncommon: M("Mappa Precisa", "Segna anche sentieri e rifugi: vantaggio a Sopravvivenza nella regione."),
      rare: M("Mappa Vivente", "Si aggiorna da sola e mostra sempre dove sei, entro la regione disegnata."),
      veryRare: M("Mappa dei Piani", "1 volta a settimana, tracciando il sigillo di un piano, lanci Spostamento Planare per te e fino a 8 compagni."),
      legendary: M("Atlante di Exanthia", "1 volta a settimana ti teletrasporta, con 8 compagni, in qualunque luogo disegnato sull'atlante, senza errori (come Teletrasporto).", { uses: [1, "charges"] }),
    }),
    G(5, "rare", "nomi", "📕", {
      common: M("Codice Cifrato", "Scrittura segreta: CD 15 di Intelligenza per decifrarla."),
      uncommon: M("Codice Cifrato Avanzato", "CD 20 per decifrarlo."),
      rare: M("Cifrario del Mistico", "Solo il destinatario indicato può leggere ciò che scrivi; per gli altri è carta bianca."),
      veryRare: M("Codice del Silenzio", "Chi lo porta addosso non può essere localizzato né spiato con la divinazione (come Anti-individuazione, permanente)."),
      legendary: M("Libro dei Nomi Segreti", "1 volta a settimana, scrivendo il vero nome di una creatura, le imponi un compito (come Costrizione, CD 19).", { uses: [1, "charges"], save: ["wis", 19] }),
    }),
  ],

  // ── GIOIELLIERE ────────────────────────────────────────────
  gioielliere: [
    G(2, "uncommon", "calore", "🔥", {
      common: M("Anello d'Oro", "Anello finemente lavorato, vale 25 mo."),
      uncommon: M("Anello del Calore", "Resistenza al freddo; non soffri il freddo estremo.", { type: "equipment", fx: ["res:cold"] }),
      rare: M("Anello di Resistenza", "Resistenza a un tipo di danno, scelto al ritiro.", { type: "equipment", res: "choice" }),
    }),
    G(2, "uncommon", "spilla", "🪙", {
      common: M("Spilla d'Argento", "Spilla lavorata, vale 25 mo."),
      uncommon: M("Spilla dello Scudo", "Resistenza ai danni da forza e immunità a Dardo Incantato.", { base: "spilla", type: "equipment", fx: ["res:force"] }),
      rare: M("Medaglione dei Pensieri", "3 cariche: 1 carica = Individuazione dei Pensieri (CD 13). Recupera 1d3 cariche all'alba.", { type: "equipment", uses: [3, "day", "1d3"], save: ["wis", 13] }),
    }),
    G(3, "uncommon", "evasione", "💫", {
      common: M("Anello d'Oro", "Anello finemente lavorato, vale 25 mo."),
      uncommon: M("Anello del Salto", "A comando, salti tre volte più lontano (come Saltare).", { type: "equipment" }),
      rare: M("Anello dell'Evasione", "3 cariche: quando fallisci un TS su Destrezza puoi spendere 1 carica per riuscirlo. Recupera 1d3 cariche all'alba.", { type: "equipment", uses: [3, "day", "1d3"] }),
    }),
    G(3, "uncommon", "periapto", "📿", {
      common: M("Amuleto Inciso", "Pendente con un simbolo sacro: vale 25 mo e funziona da simbolo sacro."),
      uncommon: M("Periapto della Salute", "Immune a ogni malattia mentre lo indossi.", { type: "equipment" }),
      rare: M("Periapto delle Ferite Chiuse", "Ti stabilizzi da solo quando sei morente, e i Dadi Vita che spendi curano il doppio.", { type: "equipment" }),
    }),
    G(4, "rare", "rigenerazione", "💍", {
      common: M("Anello d'Oro", "Anello finemente lavorato, vale 25 mo."),
      uncommon: M("Anello di Nuotare", "Velocità di nuoto di 12 m mentre lo indossi."),
      rare: M("Anello di Protezione", "+1 alla CA e a tutti i tiri salvezza."),
      veryRare: M("Anello della Rigenerazione", "Recuperi 1d6 punti ferita ogni 10 minuti; una parte del corpo persa ricresce in 1d6+1 giorni.", { type: "equipment" }),
    }),
    G(4, "rare", "piani", "🔮", {
      common: M("Collana d'Argento", "Collana lavorata, vale 25 mo."),
      uncommon: M("Collana di Adattamento", "Respiri ovunque e sei immune ai gas e ai vapori nocivi."),
      rare: M("Amuleto della Salute", "La tua Costituzione diventa 19 mentre lo indossi."),
      veryRare: M("Amuleto dei Piani", "Azione: prova di Intelligenza CD 15 e lanci Spostamento Planare (con un fallimento, finisci in un piano a caso).", { type: "equipment" }),
    }),
    G(5, "rare", "invisibilita", "👁", {
      common: M("Anello d'Oro", "Anello finemente lavorato, vale 25 mo."),
      uncommon: M("Anello di Nuotare", "Velocità di nuoto di 12 m mentre lo indossi."),
      rare: M("Anello di Protezione", "+1 alla CA e a tutti i tiri salvezza."),
      veryRare: M("Anello della Rigenerazione", "Recuperi 1d6 punti ferita ogni 10 minuti; una parte del corpo persa ricresce in 1d6+1 giorni."),
      legendary: M("Anello dell'Invisibilità", "A comando diventi invisibile finché non attacchi, lanci un incantesimo o lo togli.", { type: "equipment" }),
    }),
    G(5, "rare", "scarabeo", "🪲", {
      common: M("Talismano Inciso", "Amuleto portafortuna: vantaggio alla prossima prova di Carisma con chi crede nei presagi."),
      uncommon: M("Talismano della Salute", "Immune alle malattie mentre lo indossi."),
      rare: M("Talismano Antiveleno", "Immune al veleno e alla condizione avvelenato."),
      veryRare: M("Pietra della Fortuna Maggiore", "+1 a tutte le prove di caratteristica e ai tiri salvezza; 1 volta al giorno ritiri un tiro.", { type: "equipment", fx: ["save+1"], uses: [1, "day"] }),
      legendary: M("Scarabeo della Protezione", "Vantaggio ai tiri salvezza contro gli incantesimi. 12 cariche: quando un effetto di necromanzia o un non morto ti colpirebbe, spendi 1 carica e lo annulli.", { type: "equipment", uses: [12, "charges"] }),
    }),
  ],

  // ── INCANTATORE ────────────────────────────────────────────
  incantatore: [
    G(2, "uncommon", "guerra", "🔥", {
      common: M("Pergamena di Dardo Incantato", "Tre dardi di forza: 1d4+1 ciascuno, colpiscono sempre.", { ctype: "scroll", dmg: ["3d4+3", "force"] }),
      uncommon: M("Pergamena di Palla di Fuoco", "Sfera di 6 m a 45 m: 8d6 fuoco, TS Destrezza CD 15 per dimezzare.", { ctype: "scroll", dmg: ["8d6", "fire"], save: ["dex", 15] }),
      rare: M("Pergamena di Cono di Freddo", "Cono di 18 m: 8d8 freddo, TS Costituzione CD 17 per dimezzare.", { ctype: "scroll", dmg: ["8d8", "cold"], save: ["con", 17] }),
    }),
    G(2, "uncommon", "cura", "✚", {
      common: M("Pergamena di Cura Ferite", "Al tocco: recupera 1d8+3 punti ferita.", { ctype: "scroll", heal: "1d8+3" }),
      uncommon: M("Pergamena di Parola Guaritrice di Massa", "Fino a 6 alleati entro 18 m recuperano 1d4+3 punti ferita ciascuno.", { ctype: "scroll", heal: "1d4+3" }),
      rare: M("Pergamena di Cura Ferite di Massa", "Fino a 6 alleati in una sfera di 9 m recuperano 3d8+5 punti ferita ciascuno.", { ctype: "scroll", heal: "3d8+5" }),
    }),
    G(3, "uncommon", "scudo", "🛡", {
      common: M("Runa di Protezione", "Portata addosso: +1 a un tiro salvezza, una volta, poi si consuma."),
      uncommon: M("Runa dello Scudo", "3 cariche: come reazione lanci Scudo (+5 CA fino al tuo turno). Recupera 1d3 cariche all'alba.", { base: "runa", type: "equipment", uses: [3, "day", "1d3"] }),
      rare: M("Runa della Resistenza", "Incisa su un monile: resistenza a un tipo di danno, scelto al ritiro.", { type: "equipment", res: "choice" }),
    }),
    G(3, "uncommon", "focus", "💠", {
      common: M("Cristallo Inerte di Mana", "Focus arcano: +1 alle prove per mantenere la concentrazione."),
      uncommon: M("Focus del Mago +1", "Focus arcano: +1 ai tiri per colpire con gli incantesimi.", { type: "equipment", fx: ["spell+1"] }),
      rare: M("Focus del Mago +2", "Focus arcano: +2 ai tiri per colpire con gli incantesimi.", { type: "equipment", fx: ["spell+2"] }),
    }),
    G(4, "rare", "disintegrazione", "💥", {
      common: M("Pergamena di Dardo Incantato", "Tre dardi di forza: 1d4+1 ciascuno, colpiscono sempre."),
      uncommon: M("Pergamena di Palla di Fuoco", "Sfera di 6 m a 45 m: 8d6 fuoco, TS Destrezza CD 15 per dimezzare."),
      rare: M("Pergamena di Cono di Freddo", "Cono di 18 m: 8d8 freddo, TS Costituzione CD 17 per dimezzare."),
      veryRare: M("Pergamena di Disintegrazione", "Raggio a 18 m: 10d6+40 forza, TS Destrezza CD 18 per evitarlo del tutto; a 0 PF il bersaglio diventa polvere.", { ctype: "scroll", dmg: ["10d6+40", "force"], save: ["dex", 18] }),
    }),
    G(4, "rare", "focus3", "🔮", {
      common: M("Cristallo Inerte di Mana", "Focus arcano: +1 alle prove per mantenere la concentrazione."),
      uncommon: M("Focus del Mago +1", "Focus arcano: +1 ai tiri per colpire con gli incantesimi."),
      rare: M("Focus del Mago +2", "Focus arcano: +2 ai tiri per colpire con gli incantesimi."),
      veryRare: M("Focus del Mago +3", "Focus arcano: +3 ai tiri per colpire con gli incantesimi.", { type: "equipment", fx: ["spell+3"] }),
    }),
    G(5, "rare", "meteore", "☄", {
      common: M("Pergamena di Dardo Incantato", "Tre dardi di forza: 1d4+1 ciascuno, colpiscono sempre."),
      uncommon: M("Pergamena di Palla di Fuoco", "Sfera di 6 m a 45 m: 8d6 fuoco, TS Destrezza CD 15 per dimezzare."),
      rare: M("Pergamena di Cono di Freddo", "Cono di 18 m: 8d8 freddo, TS Costituzione CD 17 per dimezzare."),
      veryRare: M("Pergamena di Palla di Fuoco Ritardata", "Sfera di 6 m: 12d6 fuoco, TS Destrezza CD 18 per dimezzare (puoi ritardarla fino a 1 minuto, +1d6 per turno).", { ctype: "scroll", dmg: ["12d6", "fire"], save: ["dex", 18] }),
      legendary: M("Pergamena di Pioggia di Meteore", "Quattro sfere di 12 m a 1,5 km: 20d6 fuoco + 20d6 contundenti, TS Destrezza CD 19 per dimezzare.", { ctype: "scroll", dmg: ["20d6", "fire"], dmg2: ["20d6", "bludgeoning"], save: ["dex", 19] }),
    }),
    G(5, "rare", "grimorio", "📖", {
      common: M("Grimorio Vuoto", "Rilegato in pelle con fermagli: 100 pagine per incantesimi."),
      uncommon: M("Grimorio del Novizio", "1 volta al giorno, studiandolo per 1 minuto, recuperi uno slot di 1° livello.", { uses: [1, "day"] }),
      rare: M("Grimorio dell'Adepto", "1 volta al giorno, studiandolo per 1 minuto, recuperi uno slot fino al 3° livello.", { uses: [1, "day"] }),
      veryRare: M("Grimorio del Maestro", "1 volta al giorno, studiandolo per 1 minuto, recuperi uno slot fino al 5° livello.", { uses: [1, "day"] }),
      legendary: M("Grimorio dell'Arcimago", "1 volta al giorno recuperi uno slot fino al 7° livello e, finché lo porti, +1 alla CD dei tuoi incantesimi.", { fx: ["dc+1"], uses: [1, "day"] }),
    }),
  ],
};

/* Meccanica per Foundry degli oggetti GIÀ esistenti (catalogo dell'Apprendista
   e tabelle d12), per nome: così anche loro arrivano su Foundry "usabili". */
const MECH_EXISTING = {
  "Pozione di Guarigione": { ctype: "potion", heal: "2d4+2" },
  "Pozione di Guarigione Maggiore": { ctype: "potion", heal: "4d4+4" },
  "Pozione di Guarigione Superiore": { ctype: "potion", heal: "8d4+8" },
  "Fuoco dell'Alchimista": { ctype: "trinket", dmg: ["1d4", "fire"] },
  "Fuoco dell'Alchimista Denso": { ctype: "trinket", dmg: ["2d4", "fire"] },
  "Bomba Alchemica": { ctype: "trinket", dmg: ["3d6", "fire"], save: ["dex", 13] },
  "Veleno Base": { ctype: "poison", dmg: ["1d4", "poison"] },
  "Veleno del Serpente": { ctype: "poison", dmg: ["3d6", "poison"], save: ["con", 11] },
  "Veleno Paralizzante": { ctype: "poison", save: ["con", 13] },
  "Pozione di Resistenza": { ctype: "potion", res: "choice" },
  "Pozione dell'Eroismo": { ctype: "potion", temp: "10" },
  "Acido": { ctype: "trinket", dmg: ["2d6", "acid"] },
  "Pozione della Forza di Gigante delle Colline": { ctype: "potion", fx: ["str=21"] },
  "Pozione della Forza di Gigante del Fuoco": { ctype: "potion", fx: ["str=25"] },
  "Pozione di Respirare Sott'acqua": { ctype: "potion" },
  "Pozione di Scalata": { ctype: "potion", fx: ["climb=30"] },
  "Bastone degli Sciami": { uses: [10, "day", "1d6+4"] },
  "Bacchetta dei Dardi Incantati": { ctype: "wand", dmg: ["3d4+3", "force"], uses: [7, "day", "1d6+1"] },
  "Bacchetta delle Palle di Fuoco": { ctype: "wand", dmg: ["8d6", "fire"], save: ["dex", 15], uses: [7, "day", "1d6+1"] },
  "Mantello di Protezione": { type: "equipment", fx: ["ac+1", "save+1"] },
  "Guanti della Forza dell'Ogre": { type: "equipment", fx: ["str=19"] },
  "Stivali della Velocità": { type: "equipment", uses: [1, "day"] },
  "Unguento Curativo": { ctype: "potion", heal: "1d4+1", uses: [3, "charges"] },
  "Unguento di Keoghtom": { ctype: "potion", heal: "2d8+2", uses: [3, "charges"] },
  "Unguento della Guarigione Profonda": { ctype: "potion", heal: "4d8+4", uses: [3, "charges"] },
  "Veleno Naturale": { ctype: "poison", dmg: ["1d4", "poison"] },
  "Veleno del Serpente Runico": { ctype: "poison", dmg: ["2d6", "poison"], save: ["con", 11] },
  "Belladonna Nera": { ctype: "poison", dmg: ["4d6", "poison"], save: ["con", 14] },
  "Foglia della Speranza": { ctype: "potion", temp: "10" },
  "Pane del Pellegrino": { ctype: "food", temp: "1d4" },
  "Birra del Nano": { ctype: "food", fx: ["res:poison"] },
  "Birra dell'Eroe": { ctype: "food", temp: "10" },
  "Stufato del Drago": { ctype: "food", res: "choice" },
  "Proiettili Esplosivi (10)": { ctype: "ammo", extra: ["1d6", "fire"] },
  "Anello di Nuotare": { type: "equipment", fx: ["swim=40"] },
  "Anello di Protezione": { type: "equipment", fx: ["ac+1", "save+1"] },
  "Amuleto della Salute": { type: "equipment", fx: ["con=19"] },
  "Talismano Antiveleno": { type: "equipment", fx: ["imm:poison"] },
  "Diadema dell'Intelletto": { type: "equipment", fx: ["int=19"] },
  "Gemma della Luminosità": { uses: [50, "charges"], save: ["con", 15] },
  "Gemma della Vista": { uses: [3, "day", "1d3"] },
  "Runa del Baluardo": { type: "equipment", uses: [1, "day"] },
  "Glifo di Esplosione Minore": { ctype: "scroll", dmg: ["3d8", "force"], save: ["dex", 13] },
  "Glifo di Interdizione": { ctype: "scroll", dmg: ["5d8", "force"], save: ["dex", 15] },
  "Cristallo di Mana": { uses: [1, "day"] },
  "Cristallo del Mago": { uses: [1, "day"] },
};

// Indice nome → meccanica (oggetti esistenti + ricette di grado).
const MECH_INDEX = (() => {
  const idx = { ...MECH_EXISTING };
  for (const lines of Object.values(RICETTE_GRADO)) {
    for (const line of lines) {
      for (const k of ["common", "uncommon", "rare", "veryRare", "legendary"]) {
        const t = line[k];
        if (!t || !t[2]) continue;
        for (const n of String(t[0]).split(/\s*\/\s*/)) idx[n.trim()] = t[2];
      }
    }
  }
  return idx;
})();

// La meccanica Foundry di un oggetto, dal suo nome (anche dopo la scelta fra "A / B").
export const itemMech = (name) => MECH_INDEX[String(name || "").trim()] || null;
