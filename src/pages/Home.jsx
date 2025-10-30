import { useEffect, useState } from "react";
import Countdown from './Countdown'; // Importa il nuovo componente

export default function Home() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setVisible(scrollY < 200); // nasconde se si scende più di 200px
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    // Usa un container per applicare il layout a griglia su schermi grandi
    <div className="home-grid-container">
      
      {/* 🧭 COLONNA 1: SIDEBAR (Visibile solo su schermi grandi) */}
      <div className="sidebar-data">
        <Countdown />
        {/* Potresti aggiungere qui altre informazioni importanti */}
      </div>

      {/* 📚 COLONNA 2: CONTENUTO PRINCIPALE */}
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
          ancora nome e la luce non conosceva il buio, esisteva soltanto il vuoto.
          Un abisso silenzioso, privo di forma e di vita, ove dimoravano due
          essenze primordiali: una di pura oscurità, l’altra splendente come una
          stella. Le antiche scritture li chiamano Ny e Ouh, la Luce e l’Oscurità.
          <br />
          <br />
          Si narra che, durante una battaglia tanto furiosa da squarciare
          l’eternità stessa, il sangue di Ny si sparse nell’abisso e diede origine
          al Piano Celestiale, mentre quello di Ouh si riversò come un fiume
          d’ombra, generando il Piano Infernale. Le loro carni lacerate divennero
          terra e roccia, e col passare dei millenni presero forma le valli, i
          mari e le montagne del mondo che oggi chiamiamo Eldoria. Alcuni
          sostengono che dalle lacrime dei due gemelli nacquero le prime divinità,
          ma simili racconti vengono ormai considerati leggende da chi si dedica
          allo studio dei piani. Ciò che è certo è che, dopo quella prima guerra
          divina, il mondo conobbe la pace. <br />
          <br />
          Le tribù mortali prosperarono, adorando Ny e Ouh con culti semplici e
          puri, finché col passare delle ere i loro nomi vennero dimenticati e
          rimpiazzati da un nuovo pantheon di dèi minori. Eldoria visse secoli
          d’equilibrio, finché un uomo, spinto da brama di potere, infranse ogni
          armonia. Egli si faceva chiamare L’Arcano, e la sua conoscenza della
          magia superava quella di ogni altro mortale. Soggiogò città intere e
          piegò popoli al proprio volere. Ma dietro di lui si celava un potere ben
          più antico: Arkra’x l’Ossuto, demone del Piano Infernale e servitore del
          suo signore Zha’rukhael, il Trono Spezzato.
          <br />
          Arkra’x tramava per aprire le porte degli inferi e riversare i suoi
          eserciti sul piano terreno, così che il “Mondo Rosso”, come lo chiamano
          i monaci più eruditi, potesse dominare ogni cosa. Quando il suo piano fu
          compiuto, un urlo riecheggiò dagli abissi: “Nzâgh’th khâl ûr’ezth
          rzhûn-ar Thol’kar.” Parole che nella lingua antica significano:
          “L’ascesa degli inferi e il dominio sulla terra.” Le orde demoniache
          invasero Eldoria, travolgendo ogni regno. Persino L’Arcano, tradito
          dalla creatura che aveva servito, venne distrutto. <br />
          <br />
          Si racconta che, nel momento della sua morte, avvenuta tra le dune aride
          dell’attuale Tirrenia, il suo corpo liberò una tale quantità di energia
          arcana da illuminare il cielo per giorni interi. Dalla sua essenza si
          dispersero frammenti di Mana Puro, che caddero sulla terra come stelle
          spezzate. Quelle scintille di potere, dette Arcanite, sono ancora oggi
          ambite da sovrani, maghi e assassini, poiché anche una sola scheggia
          racchiude un’energia smisurata. La guerra che seguì fu tanto violenta da
          spezzare il mondo stesso. Le terre si frantumarono e il mare invase i
          vuoti lasciati dalle montagne cadute, dividendo il continente in più
          parti...
          <b>
            <i>Eppure, nel caos, sorsero anche eroi.</i>{" "}
          </b>{" "}
          <br />
          <br />
          L’antico Manoscritto di Obia narra di una compagnia di guerrieri
          chiamata I Ratti, formata da esseri di razze e arti diverse, che
          riuscirono a ricacciare nell’abisso più della metà delle orde demoniache
          e ad abbattere due generali infernali. Ma la battaglia non era ancora
          vinta. Le forze oscure continuavano ad avanzare, finché un giorno un
          bagliore azzurro squarciò i cieli e un coro di voci celestiali riempì
          l’aria. Dall’alto discesero i Serafini, schiere di luce al servizio dei
          piani celestiali, armati di spade incandescenti e ali luminose. La loro
          venuta cambiò le sorti del conflitto. Per giorni e notti il cielo e la
          terra furono divorati dal fuoco e dal canto della guerra, finché non
          restò che silenzio. <br />
          Quando le fiamme si spensero, i corpi dei caduti —
          demoni e mortali, angeli e uomini — ricoprivano il suolo di Eldoria come
          un mare di morte. Le orde infernali, sconfitte e senza guida, si
          ritirarono negli abissi. Ma anche i Serafini pagarono un prezzo
          terribile. Fu allora che Hemile, emissario del Piano Celestiale, discese
          negli inferi per trattare una tregua. Nessuno sa davvero cosa accadde in
          quell’incontro. Alcuni dicono che Hemile e Zha’rukhael strinsero un
          patto di sangue, altri che il Serafino rimase imprigionato per
          l’eternità. Da quel giorno, tuttavia, i piani rimasero separati e la
          pace tornò a regnare. Molti secoli sono trascorsi da allora.
          <br /><br />
  
          Millottocentocinquantadue anni dopo la cosiddetta Caduta delle Stelle —
          come venne chiamata la discesa dei Serafini — Eldoria prospera di nuovo.
          Le città risplendono, le arti e la conoscenza rifioriscono, e gli uomini
          credono di vivere un’era d’oro. I soldati pattugliano strade tranquille
          e i più grandi pericoli si limitano agli ubriachi delle taverne o ai
          ladri di mercato. Eppure, i saggi sentono che qualcosa si muove sotto la
          calma apparente. I venti del destino spirano di nuovo tra le montagne e
          le valli di Eldoria. Ombre antiche sussurrano nei sogni degli uomini, e
          poteri dimenticati si ridestano lentamente dalle profondità del mondo.
          La pace che dura da quasi due millenni è fragile come vetro. <br />
          E quando si
          spezzerà, come tutte le cose create dall’uomo, nuovi eroi dovranno
          sorgere dalle ceneri… o perire tra le tenebre che essi stessi avranno
          evocato.
        </p>
      </section>
    </div>
  );
}