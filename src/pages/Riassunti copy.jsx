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
            <h4 className="Obia">Cronache di Obia, vol. II — “Il furto"</h4>
            <p className="subTitle">
              “Così ebbe inizio il destino dei tre erranti, chiamati dal fato
              come pedine su una scacchiera invisibile, là dove la nebbia del
              porto cela più segreti di quanti la luce osi rivelare.”
            </p>
            <p></p>
            <p>
              Sulle banchine del porto esterno di Tirrendale, tra il canto dei
              gabbiani e l’odore acre del ferro e del sale, giunse un mezzorco
              dalla pelle scura e dallo sguardo indurito: Tanagar, figlio di
              nessuna patria, fuggiasco dal proprio sangue e dalle proprie
              cicatrici. Sbarcò da una nave mercantile cercando solo pace, ma la
              città dell’argento e delle torri alte non concede pace ai
              forestieri. Un’accusa di furto — forse menzogna, forse destino —
              lo trascinò nelle vie tortuose del mercato, dove fu costretto a
              brandire la lama per difendere la propria libertà. Nel frattempo,
              tra i vicoli gremiti e le ombre di pietra, un elfo dai capelli
              corvini, Caius Maxi-Richtofen, riceveva dalle mani tremanti di un
              facchino una pergamena sigillata. «Portala alla Biblioteca… prima
              che mi trovino,» furono le ultime parole dell’uomo prima di
              svanire nella calca come polvere nel vento. Il mago restò
              immobile, con lo sguardo tagliente come ghiaccio, mentre un
              presagio oscuro gli si insinuava nel cuore. E lontano dal clamore,
              nelle silenziose profondità della Grande Biblioteca di Tirrendale,
              un mezzelfo dai capelli neri, Garroth di Hopeclif, studiava le
              tracce di una creatura che gli aveva strappato ogni cosa —
              famiglia, speranza, persino sonno. Quando apprese del furto
              dell’Arcanite, comprese che il suo strumento di ricerca, la Lente,
              non avrebbe mai potuto essere completato. In quel momento, il suo
              destino si legò a quello degli altri due, come fili d’oro e di
              sangue intrecciati dalla mano di un dio insondabile. Tre anime,
              ignare del disegno che li univa, camminavano verso il medesimo
              punto nel tempo. E mentre le campane di Tirrendale suonavano il
              vespro, Obia annotò sul suo tomo: <br />
              <i>
                “Così nacque la compagnia senza nome. Né amici, né fratelli, ma
                legati dal soffio stesso del fato. E il vento di Eldoria
                cominciò a sussurrare il loro nome…”
              </i>
              <br />
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
                Le rovine di Toua - Drokhan giorno 8"
              </>
            }
            titleClass="summaryTitle"
            contentClass="summary-content-padding"
          >
            <h4 className="Obia">Cronache di Obia, vol. III</h4>
            <p className="subTitle">
              “Nel sud dimenticato, dove le pietre ricordano ciò che gli uomini
              hanno scordato, il fato tese la sua tela, e tre fili di destino si
              avvolsero attorno all’ombra di un nome antico: Toua.”
            </p>
            <p>
              Guidati soltanto da frammenti di voci e bisbigli di taverna, gli
              eroi lasciarono la sicurezza di Tirrendale e marciarono verso sud.
              Là, dove il vento porta solo cenere e ricordi, giunsero alle
              Rovine di Toua, una città che un tempo risuonava di mercati e
              campane, ma che ora non era che un villaggio morente, popolato da
              non più di venti anime. Case di legno marcio si piegavano sotto il
              peso degli anni, e le strade di fango tacevano come cimiteri
              dimenticati. Solo il fischiare del vento dava voce a quel luogo
              abbandonato dagli dèi. Ad accoglierli furono cinque uomini in
              armi, se così potevano dirsi: armature diseguali, armi arrugginite
              e occhi duri come pietra. Le loro mani callose tremarono non per
              paura, ma per odio — quello cieco che nasce dall’ignoranza. Il
              loro sguardo si posò su Caius, il mago dagli occhi d’argento, e il
              sospetto divenne veleno. «Se davvero sei un mago… mostraci la
              fiamma,» disse il loro capo, con un ghigno che sapeva di trappola.
              E Caius, figlio dell’orgoglio e della conoscenza, non seppe
              tacere. Sollevò la mano e lasciò che una fiamma eterea danzasse
              nell’aria, splendida e fatale come un astro proibito. Fu questione
              d’un battito di cuore. Le torce si accesero di furia, e le grida
              esplosero come un incendio: «Magia impura!» — «Stregoneria!» A
              Toua, la magia non è dono, ma peccato, e la pena va dalla
              prigionia alla forca. Caius fu incatenato con manette di Dimitre,
              un metallo forgiato dai nani per imprigionare il flusso del mana,
              e trascinato via tra urla, sputi e pietre. Ma non tutti tacquero.
              Tra le ombre delle rovine, Garroth e Tanagar seppero che il capo
              di quella plebe si nascondeva nella chiesa del villaggio: un elfo
              alto, vestito di nera armatura, con in pugno un’arma mai vista
              prima — lunga, lucente, non forgiata da mani mortali. Alcuni la
              chiamavano “fucile”, ma nessuno ne comprendeva la natura. Senza
              attendere parola né consiglio, Garroth si lanciò verso la chiesa,
              spinto da un istinto antico, forse lo stesso che guida i lupi
              verso il sangue. Tanagar lo seguì, saldo come roccia, e dietro di
              loro il vento portava il rintocco della tempesta imminente. E così
              fu che, mentre Caius languiva in catene, i suoi compagni varcarono
              la soglia del sacro, dove li attendeva un elfo oscuro, figlio
              dell’ombra e della guerra, portatore di un potere sconosciuto, che
              forse — solo forse — non apparteneva più a questo mondo. <br />{" "}
              <i>
                “Così scrisse Obia: e la chiesa di Toua si riempì di silenzio e
                sangue, e il cielo parve voltare il volto, come un dio stanco di
                guardare i propri figli.”
              </i>
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
            <h4 className="Obia">
              Cronache di Obia, vol. IV — “Il Sangue di Silaen”
            </h4>
            <p className="subTitle">
              “Là dove il silenzio arde e la follia sussurra, i mortali osano
              sfidare ciò che fu creato per gli dèi.”
            </p>
            <p>
              Nel cuore annerito delle rovine di Hakko, dove il vento geme tra
              le pietre e il tempo si è fermato come un respiro trattenuto, gli
              eroi giunsero dinanzi al loro destino. Davanti a loro, fra catene
              spezzate e colonne annerite, si ergeva Silaen, il Cavaliere
              Psionico. Era alto e sottile come un’ombra tagliata in due,
              avvolto in un’armatura nera che non rifletteva la luce, ma la
              divorava. Dietro di lui ardeva la Fiamma Mistica, viva ma senza
              calore, un fuoco che non bruciava la carne bensì la mente.
              Sussurrava parole in lingue dimenticate, promesse che solo i folli
              osavano ascoltare. Silaen tese le mani, e la voce antica che lo
              guidava parlò dentro di lui. La fiamma lo avvolse come un mantello
              d’inferno, penetrandogli nella carne e nelle ossa. Egli urlò, e il
              suo grido parve quello di mille anime incatenate che strappavano
              via il proprio corpo per fuggire. La sua figura si contorse, la
              sua armatura si fuse con la pelle, e nei suoi occhi comparve
              l’abisso. Fu allora che Tanagar, guerriero dalla forza
              primordiale, avanzò tra la polvere. L’aria si fece pesante, e le
              rovine di Toua tremarono come se gli dèi stessi stessero
              trattenendo il fiato. Il mezzorco affrontò Silaen in un duello che
              riecheggiò nei secoli: acciaio contro potere, volontà contro
              dannazione. Alla fine, con un colpo che squarciò anche il
              silenzio, Tanagar abbatté il cavaliere oscuro, e la fiamma si
              spense. L’eco del suo urlo rimase sospesa a lungo, come un
              giuramento infranto. Gli eroi raccolsero il bottino e il frammento
              di Arcanite, chiarirono le accuse con le guardie superstiti e,
              stanchi ma vittoriosi, fecero ritorno a Tirrendale. Ma la pace,
              come sempre, è illusione per chi cammina accanto al fato. Quella
              notte, sotto il tetto della taverna, Caius non dormì. La pietra —
              viva, pulsante, maledetta — lo chiamava. Nel suo cuore di mago, la
              sete di sapere divorò ogni prudenza. E così, al calare della luna,
              si levò dal giaciglio, mosse come un’ombra tra i corpi
              addormentati, e rubò l’Arcanite al compagno. Fuggì nel buio,
              silenzioso come un respiro spezzato. All’alba, Tanagar e Garroth
              scoprirono il furto. La collera fu come ferro nel sangue. Credendo
              che la pietra potesse esser caduta lungo la via del ritorno, si
              recarono al cimitero di Tirrendale, dove la nebbia giace pesante
              come un sudario. Ma là, tra lapidi e statue consumate, Garroth
              trovò qualcosa che mai avrebbe dovuto toccare: un anello antico,
              lucente come l’inverno, inciso di rune dimenticate. Appena lo
              infilò al dito, il metallo morse la carne, e gocce di sangue
              caddero sulla terra. Le voci si levarono. Sussurri, lamenti,
              preghiere… il coro dei morti che non trovano pace. E tra tutti,
              uno solo parlò con chiarezza: “La pietra è con lui… con l’elfo
              freddo.” Le tombe tacquero. Ma l’eco rimase, sospesa tra vita e
              morte. E così i vivi seppero ciò che i morti già conoscevano: che
              la fiamma rubata ardeva ora nelle mani di colui che un tempo
              chiamavano fratello. <br />
              “E scrisse Obia: <br />
              <i>
                Non vi è luce che non porti ombra, né fratellanza che il potere
                non possa spezzare.
              </i>
              ”
              <img
                src="assets/PhotoStory/GruppoMEAA/caius2.png"
                alt="Silaen l´elfo scuro"
              />
              <img src="assets/PhotoStory/GruppoMEAA/Garroth4.png" alt="" />
            </p>
          </ToggleSection>

          <ToggleSection
            title={
              <>
                28.09.2025 <br />
                Il fantasma misterioso - Drokhan giorno 10"
              </>
            }
            titleClass="summaryTitle"
            contentClass="summary-content-padding"
          >
            <h4 className="Obia">
              Cronache di Obia, vol. IV — “Il Sangue di Silaen”
            </h4>
            <p className="subTitle">
              “Non sempre il silenzio dei sepolcri è quiete. Talvolta è attesa.
              Talvolta è fame.”
            </p>
            <p>
              Davanti al cimitero di Tirrendale, gli eroi si raccolsero sotto il
              cielo di ferro del mattino. Il vento muoveva i cipressi come dita
              scheletriche, e la nebbia si stendeva a velo tra le tombe.
              Cercavano la gemma perduta, l’Arcanite, ma presto compresero di
              non essere soli. Dalle ombre del bosco settentrionale, una figura
              li osservava: una donna dai capelli rossi come sangue antico e
              dagli occhi attenti come quelli di una lupa. Era Sylva Rød Måne,
              cacciatrice errante, e la luna rossa di cui portava il nome
              sembrava riflettersi nel suo sguardo. Fiutò l’aria, e un ringhio
              le affiorò in gola. Conosceva quell’odore: il sangue dei ladri
              della pietra, la scia magica che solo chi caccia il male può
              percepire. Seguendo la traccia, Sylva trovò Caius — l’elfo freddo,
              colui che l’aveva sottratta ai suoi compagni. Ma prima che le armi
              si levassero, le voci dei morti tornarono a farsi sentire.
              Garroth, legato all’anello maledetto, fu il primo a udirle:
              suppliche, lamenti, un coro d’anime spezzate che chiedeva aiuto.
              Le loro parole guidarono il gruppo verso una cripta antica,
              sepolta sotto le radici di un albero ormai morto. Là sotto, il
              mondo taceva. Solo il gocciolare dell’acqua e il respiro delle
              pietre accompagnavano i loro passi. Sulle pareti, nomi di bambini
              incisi nel marmo. Le tombe erano piccole, troppo piccole. E quando
              l’aria si fece più fredda del ghiaccio, una presenza emerse dal
              buio. Un cavaliere spettrale, alto e imponente, con occhi di
              fiamma azzurra, apparve tra le cripte. «Via da questo luogo,»
              tuonò la sua voce, «non disturbate il sonno dei puri.» Ma il suo
              avvertimento fu troncato da un urlo: un suono acuto, lacerante,
              che fece tremare le pareti — una Banshee, spirito di madre
              impazzita dal dolore. Il fantasma del cavaliere si frappose tra i
              vivi e la creatura, difendendoli come un guardiano antico. Il
              combattimento fu feroce, ma alla fine, la luce vinse l’ombra. Tra
              le ossa dei piccoli trovarono uno scrigno e, accanto, un
              giocattolo di legno — un cavalluccio consunto dal tempo. Garroth,
              toccandolo, vide ciò che nessun mortale avrebbe dovuto vedere: le
              sofferenze dei bambini, le violenze inflitte loro dalla creatura
              che un tempo li aveva amati. L’incanto del giocattolo racchiudeva
              l’essenza del cavaliere, posta lì da un mago per proteggere le
              anime innocenti. Quando compresero la verità, il fantasma si
              inchinò, ringraziando in silenzio, e si dissolse nella luce come
              rugiada al mattino. Prima di uscire, gli eroi scoprirono una
              stanza segreta dietro un muro crepato: una armatura completa di
              piastre, perfettamente intatta, e un cofano d’argento, sigillato
              da una forza invisibile. Tanagar cercò di forzarlo, ma una
              barriera psionica gli incendiò la mente con visioni di guerra e
              sangue. Nessuno osò più toccarlo. Stremati, decisero di tornare a
              Tirrendale. Scesero la collina mentre la luna saliva alta, ognuno
              portando con sé un peso diverso: la colpa, il dubbio, la paura. E
              quando giunsero alle porte della città, si divisero, promettendo
              di ritrovarsi quella sera, alla taverna della Bassa Marea, ignari
              che i loro destini erano già intrecciati da mani che non
              appartenevano a questo mondo. <br />
              “Così scrisse Obia: <br />
              <i>
                E i vivi camminarono tra i morti, ma furono i morti, quella
                notte, a mostrare loro la via.”
              </i>
              <img
                src="assets/PhotoStory/GruppoMEAA/fantasma.png"
                alt="Fantasma cavaliere"
              />
            </p>
          </ToggleSection>

          <ToggleSection
            title={
              <>
                05.10.2025 <br />
                L´elementale triste e la vera forma di Sylva - Drokhan giorno 12
              </>
            }
            titleClass="summaryTitle"
            contentClass="summary-content-padding"
          >
            <h4 className="Obia">
              Cronache di Obia, vol. VI — “La Forgia e la Fiamma”
            </h4>
            <p className="subTitle">
              “Quando i destini si dividono, è allora che il fato tesse la sua
              trama più sottile.”
            </p>
            <p>
              Dopo i fatti accaduti nella cripta, gli eroi decisero di
              separarsi, ciascuno per seguire il proprio sentiero, con la
              promessa di ritrovarsi alla taverna della Bassa Marea prima che la
              luna sorgesse. Nel cuore rumoroso di Tirrendale, Garroth e Tanagar
              si recarono alla fucina di Torf, il mastro nano. Le braci del suo
              forno ardevano come cuori d’inferno, e il suono del martello
              echeggiava tra le travi annerite. Garroth desiderava rinforzare la
              sua arma, mentre Tanagar portava con sé l’armatura di piastre
              trovata nella cripta, pesante e misteriosa, ancora percorsa da
              un’eco di magia dimenticata. Torf, dopo ore di lavoro e bestemmie,
              dichiarò che quell’armatura non era opera di mani mortali: “C’è
              anima in quel ferro,” disse, “e non so se sia un bene o un male.”
              Nel frattempo, Caius percorreva le vie più silenziose della città,
              diretto alla torre dell’Arcanista. Tra pile di pergamene e odore
              di incenso, il mago chiese delucidazioni sulla scultura del
              soldato trovata nella cripta, quella che racchiudeva un’anima
              viva. Il vecchio arcanista, tremando come pergamena al vento, gli
              parlò di un sacerdote dimenticato, che un tempo studiava le magie
              dell’anima e viveva a nord-ovest, oltre il ponte, tra le terre
              innevate. Caius chiese anche della fucina abbandonata, quella che
              da anni nessuno osava più avvicinare. Scoprì che un tempo era
              conosciuta come la Forgia dei Sunrise, un luogo dove si forgiavano
              armi benedette e armature viventi, alimentate da una fiamma magica
              ormai spenta da generazioni. Mentre gli altri vagavano per la
              città, Sylva Rød Måne si era ritirata nel bosco, cercando la
              solitudine tra gli alberi e i ricordi. Lì, su una roccia
              screpolata, trovò una piccola creatura di fuoco, un elementale
              malinconico, seduto in silenzio. La sua fiamma era debole e
              triste, e il suo corpo tremolava come una candela al vento. Sylva
              comprese, con un dolore antico nel cuore, che era solo al mondo, e
              che la sua famiglia — la fiamma che lo aveva creato — era morta da
              tempo. Non riuscì a comunicare con lui, ma tornò in città per
              raccontarlo agli altri. Quella sera, riuniti nella taverna, tra il
              rumore dei boccali e la luce delle lanterne, gli eroi misero
              insieme i pezzi del mistero. La fucina e l’elementale erano
              collegati. I Sunrise, un tempo maestri fabbri e signori della
              fiamma, erano stati massacrati settant’anni prima da un’orda di
              orchi e goblin. Solo una bambina si era salvata, ma si diceva
              fosse caduta nel fiume e mai più ritrovata. Spinti dalla verità,
              decisero di tornare alla fucina abbandonata. Lì, tra le ceneri
              fredde, l’elementale apparve di nuovo, ma alla vista degli eroi
              iniziò a fuggire, spaventato. Dopo un inseguimento tra le rovine e
              la polvere, Garroth gli mostrò una pietra a forma di fiamma,
              trovata nella cripta. Non appena la creatura la toccò, la pietra
              si fuse con la sua essenza: la luce esplose, e l’elementale si
              trasformò in una creatura di fuoco adulto, alta quanto un uomo,
              con occhi di lava e voce di brace. Parlò finalmente, raccontando
              la sua storia: era lui la fiamma della fucina, il cuore che la
              teneva viva, legato da un patto antico con l’elementale
              primordiale del fuoco. Aveva amato i Sunrise come una famiglia, e
              la bambina era stata la sua piccola fiamma, la sola in grado di
              parlargli davvero. Ora cercava un nuovo legame, qualcuno che
              potesse stringere un patto e riaccendere la fucina. Ma gli eroi,
              pur non accettando subito il vincolo, gli promisero vendetta e
              giurarono di distruggere i carnefici della sua famiglia.
              L’elementale, commosso, si unì a loro, come fiamma guida del
              gruppo. Lasciarono Tirrendale e si incamminarono verso sud-ovest,
              diretti al Clan dei Senza Onore, un giorno di viaggio tra foreste
              e colline. Sul cammino, trovarono una torre solitaria che svettava
              su una collina di nebbia. Entrarono, ma l’aria odorava di zolfo e
              muffa, e presto un drago delle paludi piombò dal tetto con un
              ruggito che fece tremare il suolo. La battaglia sembrava
              inevitabile, ma Garroth, con voce ferma e sguardo sincero, lo
              convinse a non attaccarli. Scoprì che il drago custodiva le
              proprie uova e temeva per la loro sicurezza. Con parole d’onore,
              Garroth gli promise un cavallo come dono se li avesse lasciati
              andare in pace. Ma proprio mentre la tensione si scioglieva, Sylva
              perse il controllo. La sua natura lycan si risvegliò, e con un
              ululato di rabbia si lanciò in avanti, gli occhi gialli e le vene
              di luce sotto la pelle. Fu Garroth a fermarla, mentre Tanagar la
              tratteneva con la forza. Dopo attimi di puro terrore, la bestia si
              placò, e solo il respiro del drago rimase a scandire il silenzio.
              Prima di andarsene, Garroth giurò che sarebbe tornato, non come
              nemico, ma come amico, per onorare la parola data. E così, sotto
              il cielo plumbeo, gli eroi ripresero il cammino. Giunti infine al
              villaggio degli orchi, la tregua ebbe fine: quattro guerrieri li
              circondarono, armati di lance e archi, gli occhi colmi d’odio e
              sospetto. Il vento portava l’odore del sangue imminente. <br />{" "}
              “Così scrisse Obia: <br />
              <i>
                E quando la fiamma trovò i suoi portatori, il mondo tremò,
                poiché ogni luce, presto o tardi, chiama la propria ombra.”
              </i>
              <img
                src="assets/PhotoStory/GruppoMEAA/jade.png"
                alt="Fantasma cavaliere"
              />
              <img
                src="assets/PhotoStory/GruppoMEAA/SylvaBerserk.png"
                alt="Sylva in ira"
              />
               <img
                src="assets/PhotoStory/GruppoMEAA/senzaOnore.png"
                alt="Sylva in ira"
              />
            </p>
          </ToggleSection>

          <ToggleSection
            title={
              <>
                12.10.2025 <br />
                Il santuario degli enigmi - Drokhan giorno 14"
              </>
            }
            titleClass="summaryTitle"
            contentClass="summary-content-padding"
          >
            <h4 className="Obia">
              Cronache di Obia, vol. IV — “Il Sangue di Silaen”
            </h4>
            <p className="subTitle">
              “Là dove il silenzio arde e la follia sussurra, i mortali osano
              sfidare ciò che fu creato per gli dèi.”
            </p>
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
                src="assets/PhotoStory/GruppoMEAA/fantasma1.png"
                alt="Fantasma cavaliere"
              />
              <img src="assets/PhotoStory/GruppoMEAA/Garroth4.png" alt="" />
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
