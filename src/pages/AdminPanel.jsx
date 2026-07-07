import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { isDmUser } from "../utils/dmAccess";
import "./admin.css";

export default function AdminPanel() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  if (!currentUser || !isDmUser(currentUser.email)) {
    return (
      <section className="adm" style={{ "--cine-accent": "#8a261c", "--cine-accent-2": "#c0392b" }}>
        <div className="adm-masthead">
          <div className="adm-mast-main">
            <span className="adm-eyebrow">✦ Accesso riservato ✦</span>
            <h1 className="adm-title">Accesso Negato</h1>
            <p className="adm-sub">Solo il Dungeon Master può varcare questa soglia.</p>
          </div>
        </div>
      </section>
    );
  }

  // Pannelli raggruppati per area, con icona — console del Master.
  // Contiene TUTTO tranne gli Agenti (che vivono nella pagina "DM Tools").
  const GROUPS = [
    {
      label: "Generazione & Foundry",
      items: [
        { icon: "🎲", label: "Genera Sessione",  desc: "Crea la prep di una sessione con l'AI (+ archivio), per party.", path: "/dm/generate-session" },
        { icon: "🧙", label: "Genera NPC",       desc: "Crea un PNG con ritratto AI.",                        path: "/dm-admin/genera-npc" },
        { icon: "⚔️", label: "Strumenti DM",     desc: "Genera incontri, bottino, città e cronache.",         path: "/dm-admin/strumenti" },
        { icon: "🧝", label: "NPC → Foundry",    desc: "Prepara e invia gli NPC creati a Foundry.",           path: "/dm-admin/foundry-npc" },
        { icon: "🎁", label: "Oggetto → Foundry",desc: "Invia un oggetto a Foundry.",                         path: "/dm-admin/foundry-item" },
      ],
    },
    {
      label: "Economia & Gilda",
      items: [
        { icon: "💰", label: "Black Market",     desc: "Oggetti, aste e gestione del Ratto.",                 path: "/dm-admin/market" },
        { icon: "🐀", label: "Rat Reputation",   desc: "Gradi e lealtà dei player alla Gilda di Obia.",       path: "/dm-admin/reputation" },
        { icon: "🪙", label: "Corone",           desc: "Saldo Corone dei personaggi.",                        path: "/dm-admin/platinum" },
      ],
    },
    {
      label: "Mondo & Cronache",
      items: [
        { icon: "🗺", label: "Geomantia",        desc: "Mappe, lore delle città e ping NPC.",                 path: "/dm-admin/geo" },
        { icon: "📜", label: "Session Summaries",desc: "Log narrativi delle ultime avventure.",               path: "/dm-admin/summaries" },
        { icon: "✒️", label: "Lo Scriba",        desc: "La gazzetta del mondo: genera un'anteprima.",         path: "/dm-admin/scriba" },
        { icon: "🎬", label: "Cinema",           desc: "Link delle registrazioni delle sessioni.",            path: "/dm-admin/videos" },
        { icon: "📅", label: "Gestione Sessioni",desc: "Date, orari e link per i party.",                     path: "/dm-admin/sessions" },
        { icon: "🪧", label: "Quest Board",      desc: "Missioni sulla bacheca di Hemile.",                   path: "/dm-admin/quests" },
      ],
    },
    {
      label: "Battaglia & Risorse",
      items: [
        { icon: "👹", label: "World Boss Fight", desc: "Crea boss, attivali e gestisci gli HP live.",         path: "/dm-admin/world-boss" },
        { icon: "🧝", label: "Sprite Personaggi",desc: "Sprite di PG e minion per il Boss Fight.",            path: "/dm-admin/player-sprites" },
        { icon: "🗺", label: "Editor Mappe",     desc: "Mappe tattiche: terreni, quote, ostacoli, spawn.",    path: "/dm-admin/battle-maps" },
        { icon: "🐾", label: "Pet Points",       desc: "Punti e gestione dei compagni.",                      path: "/dm-admin/pet-points" },
      ],
    },
    {
      label: "Comunicazioni",
      items: [
        { icon: "🔔", label: "Invia Notifica",   desc: "Messaggio diretto a un giocatore.",                   path: "/dm-admin/send-notif", dashed: true },
      ],
    },
  ];

  const totalTools = GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="adm" style={{ "--cine-accent": "#8a261c", "--cine-accent-2": "#c0392b" }}>
      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">✦ Console del Master ✦</span>
          <h1 className="adm-title">Quartier Generale</h1>
          <p className="adm-sub">
            Bentornato, Master <strong>{currentUser.email.split("@")[0]}</strong>. Da qui governi il destino di Exanthia.
          </p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Strumenti</span><strong>{totalTools}</strong></div>
          <div className="adm-stat"><span>Aree</span><strong>{GROUPS.length}</strong></div>
        </div>
      </div>

      {GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: 26 }}>
          <h2 className="adm-panel-title" style={{ margin: "0 0 12px", fontSize: "0.82rem", letterSpacing: ".16em", textTransform: "uppercase", color: "#8a6212" }}>
            {group.label}
          </h2>
          <div className="adm-tiles">
            {group.items.map(({ icon, label, desc, path, dashed }) => (
              <div
                key={path}
                className={`adm-tile ${dashed ? "adm-tile--dashed" : ""}`}
                onClick={() => navigate(path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(path); } }}
              >
                <span className="adm-tile-icon" aria-hidden="true">{icon}</span>
                <h3 className="adm-tile-title">{label}</h3>
                <p className="adm-tile-desc">{desc}</p>
                <span className="adm-tile-cue">Apri ›</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
