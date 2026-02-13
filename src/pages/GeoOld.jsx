import ToggleSection from "./ToggleSection";

/**
 * Geo Component
 * 
 * Renders the Geomantic Archive page displaying detailed information
 * about major cities and locations in the world of Eldoria.
 * 
 * Each city section is expandable using the ToggleSection component and includes:
 * - Descriptive narrative text with historical context
 * - Thematic imagery
 * - Key landmarks and districts
 * - Points of interest with icon illustrations
 * 
 * @component
 * @returns {JSX.Element} The Geo page displaying all city archives
 */
export default function Geo() {
  return (
    <section>
      <h1>Archivio Geomantico</h1>
      <section className="city">
        
        {/* TIRRENDALE SECTION - Capital of Vathrindor */}
        <ToggleSection
          title="Tirrendale - Capitale di Vathrindor"
          defaultOpen={false}
        >
          {/* City image */}
          <img
            src="/assets/Tirrendale_view.png"
            alt="Mappa dettagliata di Tirrendale"
            className="city-img"
          />
          <br />
          
          {/* Drop cap styling with city description */}
          <span className="start">T</span>irrendale, gemma incastonata tra le
          braccia del mare e l'abbraccio silente del bosco, è il cuore pulsante
          di Vathrindor. La città si erge, vetusta e gloriosa, attorno al Fiume
          Tirreno, le cui acque scendono dalle montagne come lacrime
          primordiali. <br />
          Narrano le saghe e gli antichi tomi che questo fiume fu il primo alito
          vitale di Eldoria, nato dal dolore e dal sacrificio dei giganti caduti
          nell'eclatante scontro tra Ny e Ouh, le divinità della luce e
          dell'oscurità che forgiarono il mondo. Un'aura di sacralità e forza
          ancestrale pervade le sue sponde. <br />
          <br />
          
          {/* Landmarks and city hearts section */}
          <h4>Baluardi e Cuori della Città</h4>
          <ul>
            <li>
              <strong>Il Fiume Tirreno (Il Pianto dei Giganti):</strong> Il
              fiume non è solo un confine liquido, ma l'anima stessa di
              Tirrendale, le sue correnti un perpetuo promemoria dell'equilibrio
              cosmico.
            </li>
            <li>
              <strong>La Rocca Ducale (Maniero Eothen):</strong> Sorge a
              mezzogiorno, dimora del nobile <strong>Duca Eothen</strong>. La
              sua architettura riflette la sua saggezza: il potere risiede nella
              stabilità, non nell'ostentazione vana.
            </li>
            <li>
              <strong>Il Grande Emissario (Il Porto):</strong> A levante, questo
              vasto porto è il respiro vitale di Tirrendale, un crocevia di
              razze e merci.
            </li>
            <li>
              <strong>Armonia delle Stirpi:</strong> Tirrendale è un crogiolo
              dove Umani, Elfi, Orchi, Nani e molte altre genti si incontrano e
              convivono.
            </li>
            <br />
            
            {/* Historical and cultural locations */}
            <h4>Voci del Passato e del Presente</h4>
            <li>
              <strong>L'Osteria dei Tre Incroci:</strong> La locanda più
              rinomata, edificata sul punto dove tre vie maestre si
              congiungevano in un umile villaggio.
            </li>
            <li>
              <strong>Il Sepolcreto di Illote (a Nord-Ovest):</strong> Vasto
              campo santo, dimora eterna del defunto{" "}
              <strong>Duca Illote</strong>.
            </li>
          </ul>
          <br />
          
          {/* Points of Interest - Tirrendale */}
          <h4 style={{ textAlign: "left" }}>Punti di Interesse</h4>
          <ul style={{ padding: 0 }}>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/business.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>La Fucina di Fombom</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/market.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Il Mercato del Macellaio e del Pescatore</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/hypnosis.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>L'Oracolo dell'Arcanista</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/reading-book.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>La Grande Biblioteca</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/castle.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Il Maniero Ducale</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/anchor.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>I Moli dell'Emissario</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/cemetery.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Il Sepolcreto</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/leather.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Conciapelli</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/assets/icons/restaurant.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Taverne</span>
            </li>
          </ul>
        </ToggleSection>

        {/* YOTTA SECTION - Capital of Ehkia */}
        <ToggleSection title="Yotta - Capitale di Ehkia" defaultOpen={false}>
          {/* City image */}
          <img
            src="/assets/Yotta_gate.png"
            alt="Mappa dettagliata di Yotta"
            className="city-img"
          />
          <br />
          
          {/* Drop cap styling with city description */}
          <span className="start">Y</span>otta fu fondata secoli fa dalle menti
          ingegnose degli gnomi, Yotta nacque come piccolo avamposto fluviale
          costruito sulle sponde di un grande fiume gelato che collegava le
          montagne di nord-est al mare interno. Gli gnomi la progettarono come
          una città-laboratorio, ricca di meccanismi a vento e mulini idraulici
          che sfruttavano le forti correnti del fiume. Ogni strada, ponte e
          torre era pensato per resistere al tempo e ai capricci del clima,
          rendendo Yotta un capolavoro di architettura funzionale.. <br />
          <br />
          
          {/* Historical transformation section */}
          <h4>La Guerra delle Razze e la Rinascita</h4>
          <li>
              <strong>Il Porto e il Culto del Vento:</strong>Il porto di Yotta è
              il cuore pulsante della città. Un tempo, nelle notti di luna
              piena, da qui partivano rituali di sacrificio umano offerti a
              Syrael per placare le tempeste e ottenere venti favorevoli. Oggi
              il culto è cambiato: i sacrifici sono simbolici e il porto è
              diventato un crocevia di commercio tra i continenti di Vathrindor,
              Eokian e Althoria. Le sue banchine sono gremite di mercanti,
              marinai e studiosi, e si dice che ogni vento che soffia su Yotta
              porti una lingua diversa e un segreto nuovo.
            </li>
            <h4>Struttura e Quartieri Principali</h4>
            <li>
              <strong>La Cittadella dei Meccanismi:</strong> la parte più
              antica, costruita dagli gnomi. Contiene torri a ingranaggi,
              laboratori e una biblioteca sotterranea che raccoglie antichi
              schemi di macchine del vento.{" "}
            </li>
            <br />
            <li>
              <strong>Il Ponte del Respiro: </strong>un colossale ponte
              fortificato che collega le due metà della città, decorato con rune
              elfiche che reagiscono al soffio del vento.{" "}
            </li>
            <br />
            <li>
              <strong>Il Porto dei Sussurri: </strong>zona commerciale e cuore
              economico. I moli antichi, scolpiti con volti di divinità
              dimenticate, sussurrano quando il vento cambia direzione.
            </li>{" "}
            <br />
            <li>
              <strong>Il Tempio di Syrael: </strong>eretto su un’altura a nord,
              con un’enorme campana eolica che non smette mai di suonare.{" "}
            </li>{" "}
            <br />
            <li>
              <strong>Le Case del Fiume: </strong>quartiere misto abitato da
              elfi, umani e gnomi, dove le case sono costruite su palafitte e
              illuminate da lanterne che si spengono solo quando il vento tace.
            </li>
          {/* </ul> */}
          <br />
          <h4 style={{ textAlign: "left" }}>Punti di Interesse</h4>
          <ul style={{ padding: 0 }}>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/business.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>La forgia di Hokum</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/market.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Il Mercato del vento</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/hypnosis.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Ahnto l´arcanista</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/reading-book.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>La Santa Biblioteca</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/castle.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>La Rocca di Athilien</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/anchor.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Approdo alto</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/cemetery.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Il Sepolcreto</span>
            </li>

            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/axe.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Il Taglialegna</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/restaurant.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Taverne</span>
            </li>
          </ul>
        </ToggleSection>
        {/* FINE DELLA SEZIONE TOGGLE (Punti di Interesse) */}

        <ToggleSection title="The Golden Castle - Ohzkie" defaultOpen={false}>
          <img
            src="/assets/Golden_castle.png"
            alt="Mappa dettagliata di Yotta"
            className="city-img"
          />
          <br />
          <span className="start">S</span>ituato nel continente più a nord di
          Eldoria, tra le nebbie eterne e le gelide correnti del Mare Argenteo,
          sorge il leggendario Golden Castle, la fortezza che mai conobbe
          sconfitta. Le sue mura dorate riflettono la luce anche quando il sole
          non sorge, e secondo le cronache più antiche, ciò avviene grazie alla
          Benedizione del Drago Aurexion, il grande drago dorato che un tempo
          dimorava sulla vicina Montagna Alata di Auramyr.
          <br />
          <br />
          <h4>Auramyr, la Montagna Alata</h4>
          <ul>
            <li>
              <strong>La Montagna Alata </strong>non prende il nome da un caso.
              Le sue vette sono scolpite da antiche raffiche magiche, e si dice
              che, durante il regno di Aurexion, le cime si muovessero come ali
              d’oro sotto la luce del tramonto. Il drago, una creatura di luce e
              saggezza, vegliava sul nord come un dio dimenticato. Donò parte
              del suo potere agli uomini che vivevano nella valle, giurando
              protezione a chi non avrebbe mai brandito le armi contro la
              conoscenza e la verità.
            </li>
            <li>
              <strong>
                {" "}
                Ma quando gli alchimisti della Torre del Richiamo{" "}
              </strong>
              iniziarono a distorcere la magia del vento e del tempo, Aurexion
              abbandonò la montagna, lasciando dietro di sé una scia di cenere
              dorata che ancora oggi cade come neve lucente sulle sue pendici.
            </li>
            <li>
              <strong>La Torre del Richiamo e l’Ordine di Aetherion: </strong>{" "}
              La Torre del Richiamo, oggi silenziosa e spezzata dalle tempeste,
              era un tempo il cuore pulsante dell’Ordine di Aetherion, un gruppo
              di maghi e alchimisti che studiava i “Richiami” — risonanze arcane
              in grado di piegare le leggi naturali. L’Ordine riuscì a evocare
              presenze provenienti da altri piani, ma le loro sperimentazioni
              divennero sempre più pericolose, finché una notte il cielo si
              squarciò e la torre rimase segnata da un vortice perpetuo. Molti
              credono che le loro anime siano ancora intrappolate tra i piani, e
              che il vento attorno alla torre non sia altro che il loro sussurro
              eterno.
            </li>
            <li>
              <strong>
                Il Conte Vaelor D’Auryn – Il Signore del Castello Dorato:
              </strong>
              Il Conte Vaelor D’Auryn, ultimo discendente della stirpe
              gnomico-elfica dei D’Auryn, costruì il Golden Castle sulle rovine
              di un antico santuario di Aurexion. Si dice che, quando pose la
              prima pietra, il vento stesso si fermò, come per benedirlo. Vaelor
              era un uomo temuto e rispettato: spietato con i nemici, ma giusto
              con i suoi. Si racconta che fece impalare intere compagnie di
              banditi che tentarono di scalare le mura, e che lanciò
              personalmente gli invasori nelle gole di Auramyr. Nessuno ha mai
              violato il suo castello: le frecce rimbalzavano, le catapulte si
              spezzavano, e i maghi vedevano i loro incantesimi dissolversi
              nell’aria. Molti credono che Vaelor avesse stretto un patto con
              Aurexion stesso, ricevendone la Benedizione del Sole Spezzato — un
              frammento d’anima draconica incastonato nel suo cuore. Da allora,
              nessun assedio ha mai potuto oscurare il bagliore dorato del
              Golden Castle.
            </li>
            <br />
            
          </ul>
          <br />
          <h4 style={{ textAlign: "left" }}>Punti di Interesse</h4>
          <ul style={{ padding: 0 }}>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/alchemy.svg"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>L´alchimista Baelon</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/prison.svg"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Le segrete di Vaelor</span>
            </li>
            <li
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                gap: "10px",
              }}
            >
              <img
                src="/public/assets/icons/pvp.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>L´arena Dorata</span>
            </li>
            
          </ul>
        </ToggleSection>
        {/* FINE DELLA SEZIONE TOGGLE (Punti di Interesse) */}

      </section>
    </section>
  );
}
