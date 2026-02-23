import { useEffect, useState } from "react";
import Countdown from "../components/Countdown";




export default function Home() {
  const [visible, setVisible] = useState(true);


  const divinita = [
    {
      nome: "VULKAROS – Il Fabbro delle Fiamme",
      immagine: "/assets/pantheon/vulkaros.jpg",
      dominio: "Fuoco, Forgiatura, Guerra",
      titoli: "Il Cuore Incandescente, Il Martello Eterno",
      simbolo: "Un martello fiammeggiante sopra una montagna in eruzione",
      descrizione: "Vulkàros è colui che ha acceso il primo sole. Le sue fucine sotterranee plasmano metalli divini e armi sacre. È venerato dai fabbri, guerrieri e distruttori.",
      dogma: "“Attraverso il fuoco nasce la forma, attraverso il conflitto nasce la verità.”"
    },
    {
      nome: "NYSIA – La Madre delle Maree",
      immagine: "/assets/pantheon/nysia.jpg",
      dominio: "Acqua, Vita, Morte",
      titoli: "L’Abisso Gentile, La Portatrice delle Correnti",
      simbolo: "Una conchiglia aperta che contiene una goccia d’acqua splendente",
      descrizione: "Nysia governa mari e lacrime. Genera e consuma con la stessa grazia. I marinai, i guaritori e i necromanti la onorano.",
      dogma: "“Come l’acqua, accogli. Come l’acqua, travolgi.”"
    },
    {
      nome: "SYRAEL – La Danzatrice dei Venti",
      immagine: "/assets/pantheon/syrael.jpg",
      dominio: "Aria, Cambiamento, Profezia",
      titoli: "L’Invisibile, La Sussurratrice",
      simbolo: "Tre piume intrecciate in una spirale",
      descrizione: "Syrael è la voce dei sussurri, la brezza che accarezza o il ciclone che spazza via. I viaggiatori e gli oracoli la pregano.",
      dogma: "“Nulla è fermo. Sii il vento, non la pietra.”"
    },
    {
      nome: "DROKHAN – Il Dormiente di Pietra",
      immagine: "/assets/pantheon/drokhan.jpg",
      dominio: "Terra, Stabilità, Giustizia",
      titoli: "Il Silenzioso, Il Giudice Immobile",
      simbolo: "Una bilancia incisa su una roccia fratturata",
      descrizione: "Drokan dorme sotto le montagne, ma ascolta ogni giuramento. Le sue leggi sono scritte nei fossili. Venerato da giudici, costruttori, e minatori.",
      dogma: "“Ciò che è saldo non cede. Costruisci con verità.”"
    },
    {
      nome: "ENOIA – La custode dell’Anima",
      immagine: "/assets/pantheon/enoia.jpg",
      dominio: "Spirito, Memoria, Destino",
      titoli: "La Luce Interiore, L’Occhio dell’Inizio",
      simbolo: "Un cerchio di luce con cinque punti cardinali",
      descrizione: "Enoia è l’origine e la fine. Rappresenta l’anima che lega tutti gli elementi e ogni essere vivente. Venerata da monaci, artisti, veggenti e pazzi.",
      dogma: "“Tutto ciò che è stato e sarà è riflesso nel tuo fuoco interiore.”"
    },
    {
      nome: "LIRAEL – Il Sorriso delle Maschere",
      immagine: "/assets/pantheon/lirael.jpg",
      dominio: "Musica, parole, rappresentazione, memoria, emozione",
      titoli: "Il Bardo Eterno, L’Occhio che Racconta, La Voce Senza Fine",
      simbolo: "Due maschere intrecciate, una che sorride, l’altra che piange",
      descrizione: "Lirael guida i bardi, gli attori, i menestrelli e persino gli spie. Si dice che tutto ciò che viene raccontato in modo sincero venga custodito nei suoi archivi celesti.",
      dogma: "“Ogni storia merita una fine. Ma anche una canzone.”"
    },
    {
      nome: "MYRHAL – Il Tessitore dell’Arcano",
      immagine: "/assets/pantheon/myrhal.jpg",
      dominio: "Magia, conoscenza proibita, tessitura della realtà",
      titoli: "Il Signore del Filo Invisibile, Colui che Tesse il Cosmo",
      simbolo: "Una ragnatela a forma di spirale, con un occhio al centro",
      descrizione: "Myrhal non ha forma, ma appare a chi studia la magia nei sogni e nei momenti di rivelazione. Le sue magie non sono lanci incantati, ma trame da comprendere e intrecciare.",
      dogma: "“Chi conosce il filo, può ricamare la realtà.”"
    },
    {
      nome: "ZENARA – Il Cuore Selvatico",
      immagine: "/assets/pantheon/zenara.jpg",
      dominio: "Bestie, empatia, equilibrio selvaggio",
      titoli: "La Madre delle Zanne, L’Abbraccio dei Boschi, Il Soffio della Cucciolata",
      simbolo: "Una zampa e una foglia intrecciate",
      descrizione: "Zenara non parla, ma il suo spirito vive in ogni creatura libera. I ranger, i druidi e persino alcuni barbari la venerano.",
      dogma: "“Non serve voce per avere un’anima.”"
    },
    {
      nome: "KAL-DURR – Il Giogo del Destino",
      immagine: "/assets/pantheon/Kal_durr.jpg",
      dominio: "Cicli, morte e rinascita, destino ineluttabile",
      titoli: "Il Ciclo Infranto, Il Custode dell’Orologio Muto",
      simbolo: "Un serpente che si morde la coda, con tre clessidre all’interno",
      descrizione: "Kal-Durr non decide il destino: lo conserva, lo ripete, lo osserva. Alcuni veggenti lo adorano, ma lo temono. Altri lo maledicono.",
      dogma: "“Tutto accade perché è già accaduto. Nulla è nuovo, solo riscritto.”"
    },
    {
      nome: "NAAVIR – Il Sorriso Invertito",
      immagine: "/assets/pantheon/naavir.jpg",
      dominio: "Inganno, verità nascoste, scelta",
      titoli: "La Lama del Contratto, Il Primo Bugiardo",
      simbolo: "Un volto bifronte, uno angelico e uno demoniaco, con un coltello in mezzo",
      descrizione: "Naavir non è il male, ma il dubbio. È adorato da ladri, spie, illusionisti e chiunque scelga la via tortuosa. Dice sempre la verità, ma in modo che nessuno la riconosca.",
      dogma: "“Ciò che è giusto cambia. Sii tu il cambiamento.”"
    }
  ];


  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setVisible(scrollY < 200); // nasconde se si scende più di 200px
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    // Use a container to apply grid layout on large screens
    <div className="home-grid-container">
      {/* COLUMN 1: SIDEBAR (Visible only on large screens) */}
      <div className="sidebar-data">
        <Countdown />
        {/* You could add other important information here */}
        <div className="welcome-box">
          <h3>Benvenuti ad Eldoria</h3>
          <p>
            Seleziona "Next Game" dal menu per vedere le prossime sessioni dei
            party.
          </p>
        </div>
      </div>

      <section className="main-content">
        <img
          src="/assets/creation.png"
          className={`creation-image ${visible ? "show" : "hide"}`}
          alt="Eldoria"
          id="creation-img"
        />
        <h1>L´inizio del mondo di Eldoria</h1>
        <p>
          <span className="start">E</span>oni or sono, quando il tempo non aveva
          ancora nome e la luce non conosceva il buio, esisteva soltanto il
          vuoto. Un abisso silenzioso, privo di forma e di vita, ove dimoravano
          due essenze primordiali: una di pura oscurità, l'altra splendente come
          una stella. Le antiche scritture li chiamano Ny e Ouh, la Luce e
          l'Oscurità.
          <br />
          <br />
          Si narra che, durante una battaglia tanto furiosa da squarciare
          l'eternità stessa, il sangue di Ny si sparse nell'abisso e diede
          origine al Piano Celestiale, mentre quello di Ouh si riversò come un
          fiume d'ombra, generando il Piano Infernale. Le loro carni lacerate
          divennero terra e roccia, e col passare dei millenni presero forma le
          valli, i mari e le montagne del mondo che oggi chiamiamo Eldoria.
          Alcuni sostengono che dalle lacrime dei due gemelli nacquero le prime
          divinità, ma simili racconti vengono ormai considerati leggende da chi
          si dedica allo studio dei piani. Ciò che è certo è che, dopo quella
          prima guerra divina, il mondo conobbe la pace. <br />
          <br />
          Le tribù mortali prosperarono, adorando Ny e Ouh con culti semplici e
          puri, finché col passare delle ere i loro nomi vennero dimenticati e
          rimpiazzati da un nuovo pantheon di dèi minori. Eldoria visse secoli
          d'equilibrio, finché un uomo, spinto da brama di potere, infranse ogni
          armonia. Egli si faceva chiamare L'Arcano, e la sua conoscenza della
          magia superava quella di ogni altro mortale. Soggiogò città intere e
          piegò popoli al proprio volere. Ma dietro di lui si celava un potere
          ben più antico: Arkra'x l'Ossuto, demone del Piano Infernale e
          servitore del suo signore Zha'rukhael, il Trono Spezzato.
          <br />
          Arkra'x tramava per aprire le porte degli inferi e riversare i suoi
          eserciti sul piano terreno, così che il "Mondo Rosso", come lo
          chiamano i monaci più eruditi, potesse dominare ogni cosa. Quando il
          suo piano fu compiuto, un urlo riecheggiò dagli abissi: "Nzâgh'th khâl
          ûr'ezth rzhûn-ar Thol'kar." Parole che nella lingua antica
          significano: "L'ascesa degli inferi e il dominio sulla terra." Le orde
          demoniache invasero Eldoria, travolgendo ogni regno. Persino L'Arcano,
          tradito dalla creatura che aveva servito, venne distrutto. <br />
          <br />
          Si racconta che, nel momento della sua morte, avvenuta tra le dune
          aride dell'attuale Tirrenia, il suo corpo liberò una tale quantità di
          energia arcana da illuminare il cielo per giorni interi. Dalla sua
          essenza si dispersero frammenti di Mana Puro, che caddero sulla terra
          come stelle spezzate. Quelle scintille di potere, dette Arcanite, sono
          ancora oggi ambite da sovrani, maghi e assassini, poiché anche una
          sola scheggia racchiude un'energia smisurata. La guerra che seguì fu
          tanto violenta da spezzare il mondo stesso. Le terre si frantumarono e
          il mare invase i vuoti lasciati dalle montagne cadute, dividendo il
          continente in più parti...
          <b>
            <i>Eppure, nel caos, sorsero anche eroi.</i>{" "}
          </b>{" "}
          <br />
          <br />
          L'antico Manoscritto di Obia narra di una compagnia di guerrieri
          chiamata I Ratti, formata da esseri di razze e arti diverse, che
          riuscirono a ricacciare nell'abisso più della metà delle orde
          demoniache e ad abbattere due generali infernali. Ma la battaglia non
          era ancora vinta. Le forze oscure continuavano ad avanzare, finché un
          giorno un bagliore azzurro squarciò i cieli e un coro di voci
          celestiali riempì l'aria. Dall'alto discesero i Serafini, schiere di
          luce al servizio dei piani celestiali, armati di spade incandescenti e
          ali luminose. La loro venuta cambiò le sorti del conflitto. Per giorni
          e notti il cielo e la terra furono divorati dal fuoco e dal canto
          della guerra, finché non restò che silenzio. <br />
          Quando le fiamme si spensero, i corpi dei caduti — demoni e mortali,
          angeli e uomini — ricoprivano il suolo di Eldoria come un mare di
          morte. Le orde infernali, sconfitte e senza guida, si ritirarono negli
          abissi. Ma anche i Serafini pagarono un prezzo terribile. Fu allora
          che Hemile, emissario del Piano Celestiale, discese negli inferi per
          trattare una tregua. Nessuno sa davvero cosa accadde in
          quell'incontro. Alcuni dicono che Hemile e Zha'rukhael strinsero un
          patto di sangue, altri che il Serafino rimase imprigionato per
          l'eternità. Da quel giorno, tuttavia, i piani rimasero separati e la
          pace tornò a regnare. Molti secoli sono trascorsi da allora.
          <br />
          <br />
          Millottocentocinquantadue anni dopo la cosiddetta Caduta delle Stelle
          — come venne chiamata la discesa dei Serafini — Eldoria prospera di
          nuovo. Le città risplendono, le arti e la conoscenza rifioriscono, e
          gli uomini credono di vivere un'era d'oro. I soldati pattugliano
          strade tranquille e i più grandi pericoli si limitano agli ubriachi
          delle taverne o ai ladri di mercato. Eppure, i saggi sentono che
          qualcosa si muove sotto la calma apparente. I venti del destino
          spirano di nuovo tra le montagne e le valli di Eldoria. Ombre antiche
          sussurrano nei sogni degli uomini, e poteri dimenticati si ridestano
          lentamente dalle profondità del mondo. La pace che dura da quasi due
          millenni è fragile come vetro. <br />E quando si spezzerà, come tutte
          le cose create dall'uomo, nuovi eroi dovranno sorgere dalle ceneri… o
          perire tra le tenebre che essi stessi avranno evocato.
        </p>
      </section>


      <section className="full-width-content">
        <h1 className="pantheon-main-title">Antico Pantheon</h1>
        <p className="subtitle-pantheon">Arazzo raffigurante "I nati dalle lacrime"</p> <br></br>
        <img
          src="/assets/pantheon/Antico_pantheon.png"
          className="creation-image show"
          alt="Antico Pantheon"
        />

        <div className="pantheon-list">
          {divinita.map((dio, index) => (
            <div key={index} className="divinita-entry">
              <br />
              <h2 className="divinita-name-red">{dio.nome}</h2>
              <p className="divinita-titolo-gold">{dio.titolo}</p>
              
              <img src={dio.immagine} alt={dio.nome} className="divinita-main-img" />
              
              <div className="divinita-details-box">
                <p><strong>Dominio:</strong> {dio.dominio}</p>
                <p><strong>Titoli:</strong> {dio.titoli}</p>
                <p><strong>Simbolo:</strong> {dio.simbolo}</p>
                <p className="divinita-text-desc">{dio.descrizione}</p>
                <p className="dogma-text"><em>{dio.dogma}</em></p>
                <br />
              </div>
              {index < divinita.length - 1 && <hr className="gold-divider" />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
