export default function Geo() {
return (
    <section>
        <h1>Archivio Geomantico</h1>
        <section className="city">
            <h3>Tirrendale</h3>
            {/* <img
                src="/assets/Tirrendale.jpg"
                alt="Tirrendale"
                className="city-img"
            />{" "} */}
            <ZoomableImage
        src="/assets/Tirrendale.jpg"
        alt="Mappa dettagliata di Tirrendale"
        className="city-img" 
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
            <li>
                <strong>Il Fiume Tirreno (Il Pianto dei Giganti)</strong>: Il fiume
                non è solo un confine liquido, ma l'anima stessa di Tirrendale, le sue
                correnti un perpetuo promemoria dell'equilibrio cosmico.
            </li>
            <br />
            <li>
                <strong>La Rocca Ducale (Maniero Eothen)</strong>: Sorge a
                mezzogiorno, dimora del nobile Duca Eothen. La sua architettura,
                seppur meno imponente di fortezze d'altri reami, riflette la sua
                saggezza: il potere risiede nella stabilità, non nell'ostentazione
                vana.
            </li>
            <br />
            <li>
                <strong>Il Grande Emissario (Il Porto)</strong>: A levante, questo
                vasto porto è il respiro vitale di Tirrendale, dove i venti portano
                navi cariche di tesori da terre lontane. Qui, il clamore di mercanti
                di ogni stirpe si fonde con il grido dei gabbiani, testimoniando la
                pace con i vicini clan orchesca, i cui marinai solcano spesso queste
                acque.
            </li>
            <br />
            <li>
                <strong>Armonia delle Stirpi</strong>: Tirrendale è un crogiolo dove
                Umani, Elfi, Orchi, Nani e molte altre genti si incontrano e
                convivono, prova vivente che l'armonia è la più grande delle virtù.
            </li>
            <br />
            <h4>Voci del passato e del presente</h4>
            <li>
                {" "}
                <strong>
                    Osteria dei Tre Incroci ( Crocevia delle Voci del Passato e del
                    Presente)
                </strong>
                : La più rinomata tra le locande, un faro per viandanti e
                avventurieri. Edificata sul punto esatto dove, in tempi immemori, tre
                vie maestre si congiungevano in un umile villaggio. Qui, tra il fumo
                del camino e il tintinnio dei boccali, si intrecciano destini e si
                svelano segreti.
            </li>
            <br />
            <li>
                <strong>Il Sepolcreto di Illote (a Nord-Ovest)</strong>: Un vasto
                campo santo, dimora eterna di generazioni passate. Qui riposa
                l'illustre Duca Illote, padre di Eothen, in un mausoleo di pietra. Un
                luogo di quiete e memoria, dove il velo tra i mondi appare più
                sottile. Al suo interno, una sobria Cappella veglia sulle anime.
            </li>

            <br />
                    <h4>Luoghi di Rilievo e Mistero</h4>
                    <ul style={{ listStyle: "none", padding: 0 }} className="luoghi">
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
                            <span>I moli dell´emissario</span>
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
                                src="/public/assets/icons/business.png"
                                alt="icon"
                                style={{ width: "24px", height: "24px" }}
                            />
                            <span>Fucina di Fandi</span>
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
                            <span>Il mercato</span>
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
                            <span>Cimitero</span>
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
                            <span>Arcanista (Allen)</span>
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
        </section>

        <p>Qui aggiungerai gli oggetti e gli scambi segreti.</p>
    </section>
);
}
