import { useEffect, useState } from "react";
import Countdown from "../components/Countdown";
import ToggleSection from "../pages/ToggleSection";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function Home() {
  const [visible, setVisible] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState([]);

  const antichiDei = [
    {
      nome: "VULKAROS – Il Fabbro delle Fiamme",
      immagine: "/assets/pantheon/Vulkaros.jpg",
      dominio: "Fuoco, Forgiatura, Guerra",
      titoli: "Il Cuore Incandescente, Il Martello Eterno",
      simbolo: "Un martello fiammeggiante sopra una montagna in eruzione",
      descrizione: "Vulkàros è colui che ha acceso il primo solo. Le sue fucine sotterranee plasmano metalli divini e armi sacre. È venerato dai fabbri, guerrieri e distruttori.",
      dogma: "“Attraverso il fuoco nasce la forma, attraverso il conflitto nasce la verità.”",
    },
    {
      nome: "NYSIA – La Madre delle Maree",
      immagine: "/assets/pantheon/Nysia.jpg",
      dominio: "Acqua, Vita, Morte",
      titoli: "L’Abisso Gentile, La Portatrice delle Correnti",
      simbolo: "Una conchiglia aperta che contiene una goccia d’acqua splendente",
      descrizione: "Nysia governa mari e lacrime. Genera e consuma con la stessa grazia. I marinai, i guaritori e i necromanti la onorano.",
      dogma: "“Come l’acqua, accogli. Come l’acqua, travolgi.”",
    },
    {
      nome: "SYRAEL – La Danzatrice dei Venti",
      immagine: "/assets/pantheon/Syrael.jpg",
      dominio: "Aria, Cambiamento, Profezia",
      titoli: "L’Invisibile, La Sussurratrice",
      simbolo: "Tre piume intrecciate in una spirale",
      descrizione: "Syrael è la voce dei sussurri, la brezza che accarezza o il ciclone che spazza via. I viaggiatori e gli oracoli la pregano.",
      dogma: "“Nulla è fermo. Sii il vento, non la pietra.”",
    },
    {
      nome: "DROKHAN – Il Dormiente di Pietra",
      immagine: "/assets/pantheon/Drokhan.jpg",
      dominio: "Terra, Stabilità, Giustizia",
      titoli: "Il Silenzioso, Il Giudice Immobile",
      simbolo: "Una bilancia incisa su una roccia fratturata",
      descrizione: "Drokan dorme sotto le montagne, ma ascolta ogni giuramento. Le sue leggi sono scritte nei fossili. Venerato da giudici, costruttori, e minatori.",
      dogma: "“Ciò che è saldo non cede. Costruisci con verità.”",
    },
    {
      nome: "ENOIA – La custode dell’Anima",
      immagine: "/assets/pantheon/Enoia.jpg",
      dominio: "Spirito, Memoria, Destino",
      titoli: "La Luce Interiore, L’Occhio dell’Inizio",
      simbolo: "Un cerchio di luce con cinque punti cardinali",
      descrizione: "Enoia è l’origine e la fine. Rappresenta l’anima che lega tutti gli elementi e ogni essere vivente. Venerata da monaci, artisti, veggenti e pazzi.",
      dogma: "“Tutto ciò che è stato e sarà è riflesso nel tuo fuoco interiore.”",
    },
    {
      nome: "LIRAEL – Il Sorriso delle Maschere",
      immagine: "/assets/pantheon/Lirael.jpg",
      dominio: "Musica, parole, rappresentazione, memoria, emozione",
      titoli: "Il Bardo Eterno, L’Occhio che Racconta, La Voce Senza Fine",
      simbolo: "Due maschere intrecciate, una che sorride, l’altra che piange",
      descrizione: "Lirael guida i bardi, gli attori, i menestrelli e persino gli spie. Si dice che tutto ciò che viene raccontato in modo sincero venga custodito nei suoi archivi celesti.",
      dogma: "“Ogni storia merita una fine. Ma anche una canzone.”",
    },
    {
      nome: "MYRHAL – Il Tessitore dell’Arcano",
      immagine: "/assets/pantheon/Myrhal.jpg",
      dominio: "Magia, conoscenza proibita, tessitura della realtà",
      titoli: "Il Signore del Filo Invisibile, Colui che Tesse il Cosmo",
      simbolo: "Una ragnatela a forma di spirale, con un occhio al centro",
      descrizione: "Myrhal non ha forma, ma appare a chi studia la magia nei sogni e nei momenti di rivelazione. Le sue magie non sono lanci incantati, ma trame da comprendere e intrecciare.",
      dogma: "“Chi conosce il filo, può ricamare la realtà.”",
    },
    {
      nome: "ZENARA – Il Cuore Selvatico",
      immagine: "/assets/pantheon/Zenara.jpg",
      dominio: "Bestie, empatia, equilibrio selvaggio",
      titoli: "La Madre delle Zanne, L’Abbraccio dei Boschi, Il Soffio della Cucciolata",
      simbolo: "Una zampa e una foglia intrecciate",
      descrizione: "Zenara non parla, ma il suo spirito vive in ogni creatura libera. I ranger, i druidi e persino alcuni barbari la venerano.",
      dogma: "“Non serve voce per avere un’anima.”",
    },
    {
      nome: "KAL-DURR – Il Giogo del Destino",
      immagine: "/assets/pantheon/Kal_Durr.jpg",
      dominio: "Cicli, morte e rinascita, destino ineluttabile",
      titoli: "Il Ciclo Infranto, Il Custode dell’Orologio Muto",
      simbolo: "Un serpente che si morde la coda, con tre clessidre all’interno",
      descrizione: "Kal-Durr non decide il destino: lo conserva, lo ripete, lo osserva. Alcuni veggenti lo adorano, ma lo temono. Altri lo maledicono.",
      dogma: "“Tutto accade perché è già accaduto. Nulla è nuovo, solo riscritto.”",
    },
    {
      nome: "NAAVIR – Il Sorriso Invertito",
      immagine: "/assets/pantheon/Naavir.jpg",
      dominio: "Inganno, verità nascoste, scelta",
      titoli: "La Lama del Contratto, Il Primo Bugiardo",
      simbolo: "Un volto bifronte, uno angelico e uno demoniaco, con un coltello in mezzo",
      descrizione: "Naavir non è il male, ma il dubbio. È adorato da ladri, spie, illusionisti e chiunque scelga la via tortuosa. Dice sempre la verità, ma in modo che nessuno la riconosca.",
      dogma: "“Ciò che è giusto cambia. Sii tu il cambiamento.”",
    },
  ];

  const nuoviDei = [
    {
      nome: "MALAKOR – L'Architetto del Giudizio",
      immagine: "/assets/pantheon/malakor.png",
      dominio: "Giustizia (Distorta), Ordine, Contratti",
      titoli: "Il Fabbro di Leggi, Il Custode dei Vincoli",
      simbolo: "Un martello di adamantio con un'impugnatura a forma di catena avvolta",
      descrizione: "Malakor è il dio dell'ordine burocratico spietato e dell'interpretazione rigida dei patti. È venerato da giudici corrotti, governanti autoritari e mercanti spietati. Malakor non cerca la morale, ma l'esecuzione formale di ogni accordo. Si dice che le sue fucine creino le pergamene dei contratti più vincolanti di Exanthia.",
      dogma: "“Un patto è un legame sacro; la legge non deve mostrare pietà, solo rigidità. Il caos si combatte con la sanzione.”",
    },
    {
      nome: "VENESTRA – La Musa della Passione Caduta",
      immagine: "/assets/pantheon/venestra.png",
      dominio: "Amore (Ossessivo), Bellezza (Esuberante), Disperazione",
      titoli: "La Regina dei Cuori Infranti, L'Ispiratrice degli Ossessi",
      simbolo: "Una rosa appassita circondata da spine d'oro che sanguinano",
      descrizione: "Venestra governa l'amore non corrisposto e la bellezza che porta alla follia. È invocata da artisti in preda all'ispirazione distruttiva e amanti gelosi. Si nutre dell'energia delle emozioni umane portate all'estremo. Si dice che le sue muse siano sirene che incantano i viaggiatori con canti di dolore.",
      dogma: "“Il dolore è la forma più pura dell'amore. Non esiste passione senza sacrificio.”",
    },
    {
      nome: "XYLOS – Il Custode della Sfortuna Cosciente",
      immagine: "/assets/pantheon/xylos.png",
      dominio: "Sfortuna, Coincidenza (Perversa), Oblio",
      titoli: "Il Signore dei Dadi Truccati, Il Portatore di Sciagure",
      simbolo: "Una moneta con due facce identiche: una sfigurata e l'altra con una runa illeggibile",
      descrizione: "Xylos è il dio della sfortuna malevola che colpisce nei momenti peggiori. È invocato da giocatori d'azzardo superstiziosi e marinai. Non è malvagio, ma si diverte a testare la resilienza dei mortali attraverso prove apparentemente impossibili. I suoi templi sono spesso labirinti di indovinelli mortali.",
      dogma: "“La sfortuna non è un caso, è un dono per testare la tua forza. Ogni coincidenza è una lezione.”",
    },
    {
      nome: "SUNE – La Carezza di Luce",
      immagine: "/assets/pantheon/sune.png",
      dominio: "Bellezza, Amore, Passione",
      titoli: "La Rosa di Diamante, La Fiamma del Desiderio, Lo Specchio dell'Anima",
      simbolo: "Un volto perfetto dai capelli infuocati che emerge da una corolla cristallina",
      descrizione: "Sune rappresenta lo splendore residuo di Ny. Custode dell'armonia estetica che eleva l'anima sopra l'orrore. Venerata da artisti, nobili di Yotta ed elfi alti. I suoi seguaci credono che l'amore sia l'unica forza capace di riparare la trama della realtà frammentata.",
      dogma: "“La bellezza è la verità resa visibile. L'amore è il legame che unisce tutti gli esseri e cura le cicatrici degli antichi.”",
    },
  ];

  const deiMalvagi = [
    {
      nome: "MORGATH – II Mietitore di Mana",
      immagine: "/assets/pantheon/morgath.png",
      dominio: "Magia Corrotta, Fame, Arcanite",
      titoli: "Colui che Divora il Bagliore, Il Parassita Arcano",
      simbolo: "Una mano scheletrica che stringe un cristallo di Arcanite che cola sangue",
      descrizione: "Si dice che Morgath sia nato dai resti del mago 'L’Arcano'. Non cerca il dominio politico, ma la totale sottomissione della trama magica. I suoi seguaci cercano i frammenti di Mana puro non per usarli, ma per 'nutrire' il loro Dio, privando il mondo della sua linfa vitale.",
      dogma: "“La magia è un errore della creazione. Consumala finché il mondo non sarà di nuovo silenzioso e buio.”",
    },
    {
      nome: "XUL’KORAH – La Madre delle Piaghe Strategiche",
      immagine: "/assets/pantheon/xulkorah.png",
      dominio: "Inganno, Malattie, Decadimento delle Alleanze",
      titoli: "La Tessitrice di Discordia, La Signora del Pus Dorato",
      simbolo: "Una mosca dalle ali d'angelo sopra un cranio spaccato",
      descrizione: "Xul’Korah incarna il tradimento che avvenne durante la guerra. È la divinità di chi colpisce alle spalle. Non usa la forza bruta, ma sussurri che infettano la mente e piaghe che indeboliscono le città dall'interno. È venerata da spie, avvelenatori e nobili corrotti.",
      dogma: "“Un regno cade più in fretta per un dubbio sussurrato che per mille spade alzate.”",
    },
    {
      nome: "THAL-GRIMOR – Il Generale di Ferro Rosso",
      immagine: "/assets/pantheon/thalgrimor.png",
      dominio: "Guerra Crudele, Tirannia, Schiavitù",
      titoli: "Il Trono di Ossa, Colui che Non Concede Tregua",
      simbolo: "Un elmo chiuso da cui colano lacrime di piombo fuso",
      descrizione: "Rappresenta la ferocia pura degli inferi che non ha mai accettato la tregua di Hemile. Thal-Grimor è il dio della guerra senza onore, della distruzione dei civili e della sottomissione totale. I suoi culti si annidano nelle guarnigioni mercenarie più brutali.",
      dogma: "“La pace è solo il tempo che i deboli usano per affilare lame che non avranno il coraggio di usare. Spezzali ora.”",
    },
    {
      nome: "MALAKHIA – L'Eclissi della Memoria",
      immagine: "/assets/pantheon/malakhia.png",
      dominio: "Oblio, Follia, Vuoto Cosmico",
      titoli: "La Fine di Ogni Storia, L'Ombra del Trono Spezzato",
      simbolo: "Un occhio spalancato, completamente nero, che piange cenere",
      descrizione: "Se Ny è luce e Ouh è buio, Malakhia è l'assenza di entrambi: il vuoto primordiale. È la divinità nichilista che vuole cancellare la storia di Exanthia. I suoi seguaci distruggono manoscritti e templi per far scivolare il mondo nella follia del nulla.",
      dogma: "“Ciò che viene dimenticato non è mai esistito. Diventa nulla, e sarai finalmente libero dal dolore.”",
    },
  ];

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sessions"), (snapshot) => {
      const sessionData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSessions(sessionData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setVisible(scrollY < 200);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const renderPantheon = (lista) => (
    lista.map((dio, index) => (
      <div key={index} className="divinita-entry">
        <br />
        <h2 className="divinita-name-red">{dio.nome}</h2>
        <p className="divinita-titolo-gold">{dio.titoli || dio.titolo}</p>
        <img src={dio.immagine} alt={dio.nome} className="divinita-main-img" />
        <div className="divinita-details-box">
          <p><strong>Dominio:</strong> {dio.dominio}</p>
          <p><strong>Titoli:</strong> {dio.titoli || dio.titolo}</p>
          <p><strong>Simbolo:</strong> {dio.simbolo}</p>
          <p className="divinita-text-desc">{dio.descrizione}</p>
          <p className="dogma-text"><em>{dio.dogma}</em></p>
          <br />
        </div>
        {index < lista.length - 1 && <hr className="gold-divider" />}
      </div>
    ))
  );

  return (
    <div className="home-container">
      <button className={`floating-sidebar-btn ${isSidebarOpen ? "active" : ""}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        {isSidebarOpen ? "✕" : "📅"}
      </button>

      <div className={`side-drawer ${isSidebarOpen ? "open" : ""}`}>
        <div className="drawer-content">
          <h2 className="chatBotTitle">Prossime Sessioni</h2>
          {sessions.length > 0 ? (
            sessions.map((s) => <Countdown key={s.id} partyName={s.id} targetDate={s.date} />)
          ) : (
            <p style={{ textAlign: "center", color: "#666" }}>Nessuna sessione programmata.</p>
          )}
        </div>
      </div>

      <section className="main-content full-width-home">
        <img src="/assets/creation.png" className={`creation-image ${visible ? "show" : "hide"}`} alt="Exanthia" id="creation-img" />
        <h1>L'inizio del mondo di Exanthia</h1>
        <p>... [Testo Lore] ...</p>
      </section>

      {/* --- ANTICHI DEI --- */}
      <section className="full-width-content">
        <ToggleSection title="Antichi Dei (I Nati dalle Lacrime)" defaultOpen={false}>
          <h1 className="pantheon-main-title">I Nati dalle Lacrime</h1>
          <img src="/assets/pantheon/Antico_pantheon.png" className="creation-image show" alt="Antico Pantheon" />
          <div className="pantheon-list">{renderPantheon(antichiDei)}</div>
        </ToggleSection>
      </section>

      {/* --- NUOVI DEI --- */}
      <section className="full-width-content">
        <ToggleSection title="Nuovi Dei (Dopo la Grande Guerra)" defaultOpen={false}>
          <h1 className="pantheon-main-title">I Custodi dell'Era Spezzata</h1>
          <div className="pantheon-list">{renderPantheon(nuoviDei)}</div>
        </ToggleSection>
      </section>

      {/* --- DEI MALVAGI --- */}
      <section className="full-width-content">
        <ToggleSection title="Dei Malvagi (Le Ombre del Vuoto)" defaultOpen={false}>
          <h1 className="pantheon-main-title">Le Piaghe di Exanthia</h1>
          <div className="pantheon-list">{renderPantheon(deiMalvagi)}</div>
        </ToggleSection>
      </section>
    </div>
  );
}