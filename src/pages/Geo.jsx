import ToggleSection from "./ToggleSection"; // ASSUMENDO che sia nella stessa cartella

export default function Geo() {
  return (
    <section>
      <h1>Archivio Geomantico</h1>
      <section className="city">
        {/* L'immagine, lasciata intatta */}
        {/* <img
                src="/assets/Tirrendale.jpg"
                alt="Tirrendale"
                className="city-img"
            />{" "} */}
        {/* INIZIO DELLA SEZIONE TOGGLE (Descrizione della Città) */}
        <ToggleSection
          title="Tirrendale - Capitale di Vathrindor"
          defaultOpen={false}
        >
          <img
            src="/assets/Tirrendale_view.png"
            alt="Mappa dettagliata di Tirrendale"
            className="city-img"
          />
          <br />
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
              <span>La Fucina di Vulkan</span>
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
        {/* FINE DELLA SEZIONE TOGGLE (Punti di Interesse) */}

        <ToggleSection title="Yotta - Capitale di Ehkia" defaultOpen={false}>
          <img
            src="/assets/Yotta_gate.png"
            alt="Mappa dettagliata di Yotta"
            className="city-img"
          />
          <br />
          <span className="start">Y</span>otta fu fondata secoli fa dalle menti
          ingegnose degli gnomi, Yotta nacque come piccolo avamposto fluviale
          costruito sulle sponde di un grande fiume gelato che collegava le
          montagne di nord-est al mare interno. Gli gnomi la progettarono come
          una città-laboratorio, ricca di meccanismi a vento e mulini idraulici
          che sfruttavano le forti correnti del fiume. Ogni strada, ponte e
          torre era pensato per resistere al tempo e ai capricci del clima,
          rendendo Yotta un capolavoro di architettura funzionale.. <br />
          <br />
          <h4>La Guerra delle Razze e la Rinascita</h4>
          <li>
            Durante la Guerra delle Razze, gli gnomi furono decimati e molti
            fuggirono, lasciando la città vuota e vulnerabile. Fu allora che un
            gruppo di elfi esuli, sopravvissuti alla distruzione di Tirrendale e
            della Foresta di Aelthir, trovò rifugio tra le mura di Yotta. Gli
            elfi, con la loro grazia e magia, ridiedero vita alla città:
            ricoprirono i bastioni di rampicanti argentati, restaurarono i
            canali e consacrarono i venti a Syrael, antica dea del vento e delle
            correnti.
          </li>
          <ul>
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
            <li><strong>La Cittadella dei Meccanismi:</strong> la parte più antica,
            costruita dagli gnomi. Contiene torri a ingranaggi, laboratori e una
            biblioteca sotterranea che raccoglie antichi schemi di macchine del
            vento. </li><br />
            <li>
              <strong>Il Ponte del Respiro: </strong>un colossale ponte
              fortificato che collega le due metà della città, decorato con rune
              elfiche che reagiscono al soffio del vento.{" "}
            </li>
            <br />
            <li><strong>Il Porto dei Sussurri: </strong>zona commerciale e cuore
            economico. I moli antichi, scolpiti con volti di divinità
            dimenticate, sussurrano quando il vento cambia direzione.</li> <br />
            <li><strong>Il Tempio
            di Syrael: </strong>eretto su un’altura a nord, con un’enorme campana eolica
            che non smette mai di suonare. </li> <br />
            <li><strong>Le Case del Fiume: </strong>quartiere misto
            abitato da elfi, umani e gnomi, dove le case sono costruite su
            palafitte e illuminate da lanterne che si spengono solo quando il
            vento tace.</li>
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
                src="/public/assets/icons/business.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>La Fucina di Vulkan</span>
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
                src="/public/assets/icons/hypnosis.png"
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
                src="/public/assets/icons/reading-book.png"
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
                src="/public/assets/icons/castle.png"
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
                src="/public/assets/icons/anchor.png"
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
                src="/public/assets/icons/leather.png"
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
            src="/assets/Yotta.jpg"
            alt="Mappa dettagliata di Yotta"
            className="city-img"
          />
          <br />
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
              <span>La Fucina di Vulkan</span>
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
                src="/public/assets/icons/hypnosis.png"
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
                src="/public/assets/icons/reading-book.png"
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
                src="/public/assets/icons/castle.png"
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
                src="/public/assets/icons/anchor.png"
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
                src="/public/assets/icons/leather.png"
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
                src="/public/assets/icons/restaurant.png"
                alt="icon"
                style={{ width: "24px", height: "24px" }}
              />
              <span>Taverne</span>
            </li>
          </ul>
        </ToggleSection>
        {/* FINE DELLA SEZIONE TOGGLE (Punti di Interesse) */}

        <p>Qui aggiungerai gli oggetti e gli scambi segreti.</p>
      </section>
    </section>
  );
}
