import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import "./admin.css";

export default function AdminPanel() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const MASTER_EMAIL = "santomassimo85@gmail.com";

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return (
      <section className="adm" style={{ "--cine-accent": "#fde68a", "--cine-accent-2": "#fbbf24" }}>
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

  // Pannelli raggruppati per TIPOLOGIA, ogni area con il suo colore acceso
  // (--g: tinge intestazione, bordo, icona e cue delle piastrelle).
  const GROUPS = [
    {
      label: "Economia & Gilda", color: "#fbbf24", glyph: "🪙",
      items: [
        { icon: "💰", label: "Black Market",     desc: "Oggetti, aste e gestione del Ratto.",                 path: "/dm-admin/market" },
        { icon: "🐀", label: "Rat Reputation",   desc: "Gradi e lealtà dei player alla Gilda di Obia.",       path: "/dm-admin/reputation" },
        { icon: "🪙", label: "Corone",           desc: "Saldo Corone dei personaggi.",                        path: "/dm-admin/platinum" },
      ],
    },
    {
      label: "Mondo & Lore", color: "#4ade80", glyph: "🗺",
      items: [
        { icon: "🗺", label: "Geomantia",        desc: "Mappe, lore delle città e ping NPC.",                 path: "/dm-admin/geo" },
        { icon: "🪧", label: "Quest Board",      desc: "Missioni sulla bacheca di Hemile.",                   path: "/dm-admin/quests" },
        { icon: "🧙", label: "Genera NPC",       desc: "Nuovi volti per le strade di Exanthia.",              path: "/dm-admin/genera-npc" },
      ],
    },
    {
      label: "Cronache & Media", color: "#a78bfa", glyph: "📜",
      items: [
        { icon: "📜", label: "Session Summaries",desc: "Log narrativi delle ultime avventure.",               path: "/dm-admin/summaries" },
        { icon: "✒️", label: "Lo Scriba",        desc: "La gazzetta del mondo: genera un'anteprima.",         path: "/dm-admin/scriba" },
        { icon: "🎬", label: "Cinema",           desc: "Link delle registrazioni delle sessioni.",            path: "/dm-admin/videos" },
      ],
    },
    {
      label: "Sessioni & Comunicazioni", color: "#22d3ee", glyph: "📅",
      items: [
        { icon: "📅", label: "Gestione Sessioni",desc: "Date, orari e link per i party.",                     path: "/dm-admin/sessions" },
        { icon: "🔮", label: "Genera Sessione",  desc: "Prep-sessione dei party con Claude.",                 path: "/dm/generate-session" },
        { icon: "🔔", label: "Invia Notifica",   desc: "Messaggio diretto a un giocatore.",                   path: "/dm-admin/send-notif", dashed: true },
      ],
    },
    {
      label: "Battaglia", color: "#f87171", glyph: "⚔",
      items: [
        { icon: "👹", label: "World Boss Fight", desc: "Crea boss, attivali e gestisci gli HP live.",         path: "/dm-admin/world-boss" },
        { icon: "🧝", label: "Sprite Personaggi",desc: "Sprite di PG e minion per il Boss Fight.",            path: "/dm-admin/player-sprites" },
        { icon: "🗺", label: "Editor Mappe",     desc: "Mappe tattiche: terreni, quote, ostacoli, spawn.",    path: "/dm-admin/battle-maps" },
      ],
    },
    {
      label: "Officina del DM", color: "#e879f9", glyph: "🛠",
      items: [
        { icon: "🛠", label: "Strumenti DM",     desc: "Cronaca, generatori e utilità del Master.",           path: "/dm-admin/strumenti" },
        { icon: "📦", label: "Oggetto → Foundry",desc: "Esporta un oggetto in formato Foundry.",              path: "/dm-admin/foundry-item" },
        { icon: "🧾", label: "NPC → Foundry",    desc: "Esporta un NPC in formato Foundry.",                  path: "/dm-admin/foundry-npc" },
      ],
    },
  ];

  const totalTools = GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="adm" style={{ "--cine-accent": "#fde68a", "--cine-accent-2": "#fbbf24" }}>
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
        <div key={group.label} className="adm-area" style={{ "--g": group.color }}>
          <h2 className="adm-area-title">
            <span className="adm-area-glyph" aria-hidden="true">{group.glyph}</span>
            {group.label}
            <span className="adm-area-count">{group.items.length}</span>
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
