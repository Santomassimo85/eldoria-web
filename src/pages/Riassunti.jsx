import ToggleSection from "./ToggleSection"; // Assumi che ToggleSection.jsx sia nella stessa cartella

export default function Riassunti() {
  return (
    <section className="summary-page">
      <h1>Memorie del monaco errante</h1>
      <h3>Le schegge del mondo</h3>
      <p>
        <span className="start">Anno 1852 d.C.S. </span>“Scrivo queste parole
        perché il mondo dimentica più in fretta di quanto il vento spenga una
        candela.” Sono trascorsi quasi duemila anni dalla Caduta delle Stelle,
        quando il mago che chiamavano l’Arcano tentò di afferrare la verità
        stessa della magia. Le sue mani, incapaci di contenere tanta potenza,
        lacerarono i cieli e infransero la terra. Dalla sua rovina nacquero i
        Frammenti di Arcanite, schegge di mana puro, scintille di ciò che fu il
        suo spirito. Alcuni li definiscono doni divini, altri maledizioni
        immortali: io credo che siano semplicemente specchi dell’anima di chi li
        tocca. Nei secoli, molti li hanno cercati — re, maghi, mercanti e
        assassini — e molti sono caduti nel tentativo di comprenderli. Ma oggi,
        nella città di Tirrendale, la loro eco risuona di nuovo. Gli studiosi
        della Grande Biblioteca avevano creato un congegno mai visto: la Lente
        della Lunga Ricerca, capace, dicono, di seguire le tracce di energia
        magica attraverso i piani. Un’impresa che avrebbe potuto cambiare la
        storia… finché la spedizione che trasportava Arcanite raffinata non è
        stata assalita. Nessuno sa chi sia stato. I saggi parlano di ladri e
        contrabbandieri, altri di culti dimenticati, altri ancora di un volto di
        ferro e piume che ritorna dai secoli bui. Le strade di Tirrendale
        sussurrano nomi, ma nessuno conosce la verità. Io sento solo l’eco dei
        frammenti, sparsi come stelle su un cielo troppo vasto. E so che, da
        qualche parte, nuovi eroi si muovono — forse inconsapevoli — nel disegno
        che l’Arcano non ha mai finito di tracciare. “Se questo mondo dovrà
        essere ricomposto, non sarà con la forza, ma con la memoria.” —{" "}
        <i>Obia, Monaco dell’Eco Silente</i>
      </p>
      {/* <ToggleSection title="L´arcanite perduta" defaultOpen={true}> */}
      <ToggleSection title="Gruppo AMEA">
        <div className="summary-grid">
          <ToggleSection
            title={
              <>
                05.09.2025 <br />
                L´inizio - Drokhan giorno 4
              </>
            }
            titleClass="summaryTitle"
            contentClass="summary-content-padding"
          >
            <p>
              Al porto esterno di Tirrendale, un mezzorco dal passato tormentato
              sbarca da una nave mercantile, ignaro che il suo arrivo coinciderà
              con un accusa di furto e un inseguimento che lo costringerà a
              combattere per la libertà. - Poco distante, un mago dagli occhi
              freddi e curiosi, riceve una pergamena misteriosa da un facchino
              terrorizzato. Le uniche parole prima che l’uomo sparisse tra la
              folla: _«Portala alla Biblioteca… prima che mi trovino.»_ - Nello
              stesso momento, un è immerso negli archivi della Biblioteca,
              studiando le tracce di una bestia che gli ha strappato tutto ciò
              che amava. Ma quando apprende del furto di Arcanite, capisce che
              il suo unico mezzo per trovarla — la Lente — non potrà mai essere
              completato. Tre destini si intrecciano in una città che cela più
              segreti di quanti ne mostri. Insieme, dovranno scoprire chi ha
              rubato l’Arcanite, perché, e fino a che punto il loro incontro non
              sia stato voluto da qualcosa di molto più grande di loro. <br />
              <img
                src="assets/PhotoStory/GruppoMEAA/tanagar3.png"
                alt="Tanagar che arriva a Tirrendale"
              />
              <img
                src="assets/PhotoStory/GruppoMEAA/tanagar1.png"
                alt="Gli eroi in biblioteca"
              />
            </p>
          </ToggleSection>

          <ToggleSection
            title={
              <>
                12.09.2025 <br />
                Il vero volto dell´elfo - Drokhan giorno 8"
              </>
            }
            titleClass="summaryTitle"
            contentClass="summary-content-padding"
          >
            <p>
              Guidati da frammenti di voci e dicerie, gli eroi si mossero verso
              sud, fino alle rovine di Toua, un luogo che un tempo fu città e
              ora non è che un villaggio dimenticato di non più di venti anime.
              Case di legno consunto, strade di terra e silenzi interrotti
              soltanto dal fischiare del vento. Ad accoglierli, cinque uomini in
              armi – se così si potevano chiamare – vestiti con armature
              disuguali e armi raccogliticce, più derivate dal caso che dal
              mestiere. I loro occhi si posarono subito sull’elfo, Caius, e lo
              sguardo fu di sospetto. In quei luoghi, la magia non era dono, ma
              peccato. Con voce falsa e sorriso teso, uno di loro si fece
              avanti: “Se davvero sei un mago,” disse, “mostraci la fiamma.” E
              l’orgoglio di Caius, acuito dall’ignoranza altrui, ebbe la meglio
              sulla prudenza. Sollevò la mano, e per un istante la luce
              dell’incanto danzò nell’aria. Ma quell’attimo bastò: le torce si
              accesero di rabbia e le voci si levarono come un coro d’accusa.
              “Magia impura!” gridarono. A Toua, la magia è vietata, e la pena
              va dalla prigionia alla morte. Caius fu incatenato con manette di
              Dimitre, un metallo nanico noto per soffocare il flusso del mana,
              e trascinato via tra urla e pietre. Nel frattempo, Tanagar e
              Garroth seppero che il capo di quella gente si trovava nella
              chiesa del villaggio — un elfo alto, vestito d’armatura nera, e
              armato di un’arma lunga e lucente come mai se ne videro prima.
              Alcuni la chiamavano “fucile”, ma nessuno ne conosceva la natura.
              Garroth, senza attendere altro, si lanciò verso la chiesa, spinto
              da un istinto antico e dall’odore del pericolo. Tanagar lo seguì,
              saldo come roccia e pronto al ferro. Nel silenzio che precedeva la
              tempesta, la terra stessa pareva trattenere il respiro. E così,
              mentre Caius languiva in catene, i suoi compagni varcarono la
              soglia del sacro per affrontare un elfo oscuro, figlio dell’ombra
              e della guerra, e portatore d’un potere sconosciuto, che forse non
              apparteneva più a questo mondo…
              <img
                src="assets/PhotoStory/GruppoMEAA/silaen.png"
                alt="Silaen l´elfo scuro"
              />
            </p>
          </ToggleSection>

          <ToggleSection
            title={
              <>
                21.09.2025 <br />
                Il cimitero di Tirrendale - Drokhan giorno 9"
              </>
            }
            titleClass="summaryTitle"
            contentClass="summary-content-padding"
          >
            <p>
              Nel cuore delle rovine di Hakko, tra le ceneri del silenzio e il
              suono metallico delle catene, gli eroi affrontarono Silaen, il
              Cavaliere Psionico. Snello e alto come un’ombra spezzata, avvolto
              in un’armatura nera che rifletteva la luce come vetro scuro, egli
              si ergeva davanti alla fiamma mistica — un fuoco vivo, che
              bruciava senza calore e sussurrava parole che solo le menti folli
              potevano udire. Silaen, guidato da una voce antica, tese le mani e
              assorbì la fiamma nel proprio corpo, gridando come se mille anime
              gli scavassero il petto. Il suo potere crebbe, deformandolo, e il
              suo sguardo divenne quello di chi non appartiene più al mondo dei
              vivi. Ma Tanagar, con la forza di chi ha giurato di non cedere
              all’ombra, abbatté il cavaliere in un duello che fece tremare le
              rovine di Toua. Con la sua morte, il fuoco si spense e il silenzio
              tornò sovrano. Raccolto il bottino e chiarite le accuse con le
              guardie del villaggio, gli eroi fecero infine ritorno a
              Tirrendale, portando con sé la preziosa Arcanite — o almeno così
              credevano. Quella notte, sotto il tetto della taverna, Caius
              vegliava inquieto. La pietra lo chiamava. Il suo bagliore arcano
              lo divorava dall’interno, e mentre il resto del gruppo dormiva,
              egli cedette alla tentazione: con passo silenzioso come l’ombra,
              rubò la gemma a Tanagar, fuggendo nel buio prima che il giorno lo
              tradisse. All’alba, Tanagar e Garroth scoprirono la scomparsa. La
              rabbia e il sospetto li spinsero verso il cimitero di Tirrendale,
              sperando che la pietra fosse caduta lungo la via del ritorno. Ma
              tra lapidi e nebbia trovarono ben altro. Garroth, attratto da un
              antico monile, indossò un anello maledetto. Subito le voci dei
              morti lo assalirono — sussurri, preghiere, lamenti. Tra i
              bisbigli, una sola frase si fece chiara come lama: “La pietra è
              con lui… con l´elfo freddo.” Le tombe tacquero, ma l’eco rimase.
              Così i vivi seppero ciò che i morti già conoscevano: che la fiamma
              rubata bruciava ora nelle mani di chi, un tempo, era loro
              fratello.
              <img
                src="assets/PhotoStory/GruppoMEAA/caius2.png"
                alt="Silaen l´elfo scuro"
              />
            </p>
          </ToggleSection>
        </div>
      </ToggleSection>

      <ToggleSection title="Gruppo LAC">
        <div>
          <p>Qui va il riassunto della trama per il Party 1...</p>
        </div>
      </ToggleSection>
      {/* </ToggleSection> */}

      {/* <ToggleSection title="Party LAC">
        <ToggleSection title="Personaggi">
          <div className="party-grid">
            
          </div>
        </ToggleSection>
        <ToggleSection title="Riassunto della Trama">
          <div>
            <p>Qui va il riassunto della trama per il Party 2...</p>
          </div>
        </ToggleSection>
        <ToggleSection title="Note e Appunti">
          <div>
            <p>Qui vanno le note e gli appunti per il Party 2...</p>
          </div>
        </ToggleSection>
      </ToggleSection> */}
    </section>
  );
}
