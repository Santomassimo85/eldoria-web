import ToggleSection from './ToggleSection'; // ASSUMENDO che sia nella stessa cartella

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
            <ToggleSection title="Tirrendale - Capitale di Vathrindor" defaultOpen={true}>
                <img
            src="/assets/Tirrendale.jpg"
            alt="Mappa dettagliata di Tirrendale"
            className="city-img" 
                />
                <br />
                
                <span className="start">T</span>irrendale, gemma incastonata tra le
                braccia del mare e l'abbraccio silente del bosco, è il cuore pulsante di
                Vathrindor. La città si erge, vetusta e gloriosa, attorno al Fiume
                Tirreno, le cui acque scendono dalle montagne come lacrime primordiali.{" "}
                <br />
                Narrano le saghe e gli antichi tomi che questo fiume fu il primo alito
                vitale di Eldoria, nato dal dolore e dal sacrificio dei giganti caduti
                nell'eclatante scontro tra Ny e Ouh, le divinità della luce e
                dell'oscurità che forgiarono il mondo. Un'aura di sacralità e forza
                ancestrale pervade le sue sponde. <br />
                <br />
                <h4>Baluardi e Cuori della Città</h4>
                <ul>
                    <li>
                    <strong>Il Fiume Tirreno (Il Pianto dei Giganti):</strong> Il fiume non è solo un confine liquido, ma l'anima stessa di Tirrendale, le sue correnti un perpetuo promemoria dell'equilibrio cosmico.
                    </li>
                    <li>
                    <strong>La Rocca Ducale (Maniero Eothen):</strong> Sorge a mezzogiorno, dimora del nobile <strong>Duca Eothen</strong>. La sua architettura riflette la sua saggezza: il potere risiede nella stabilità, non nell'ostentazione vana.
                    </li>
                    <li>
                    <strong>Il Grande Emissario (Il Porto):</strong> A levante, questo vasto porto è il respiro vitale di Tirrendale, un crocevia di razze e merci.
                    </li>
                    <li>
                    <strong>Armonia delle Stirpi:</strong> Tirrendale è un crogiolo dove Umani, Elfi, Orchi, Nani e molte altre genti si incontrano e convivono.
                    </li>
                    <br />
                    <h4>Voci del Passato e del Presente</h4>
                    <li>
                    <strong>L'Osteria dei Tre Incroci:</strong> La locanda più rinomata, edificata sul punto dove tre vie maestre si congiungevano in un umile villaggio.
                    </li>
                    <li>
                    <strong>Il Sepolcreto di Illote (a Nord-Ovest):</strong> Vasto campo santo, dimora eterna del defunto <strong>Duca Illote</strong>.
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