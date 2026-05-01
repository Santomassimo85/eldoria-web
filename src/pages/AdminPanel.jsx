import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import "./admin.css";

export default function AdminPanel() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const MASTER_EMAIL = "santomassimo85@gmail.com";

  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return (
      <section className="admin-page">
        <h1 className="admin-page-title">Accesso Negato</h1>
        <p style={{ textAlign: "center" }}>Solo il Dungeon Master può accedere a questo pannello.</p>
      </section>
    );
  }

  const BLOCKS = [
    { label: "Black Market",       desc: "Aggiungi o modifica oggetti e gestisci le aste del Ratto.",            path: "/dm-admin/market" },
    { label: "Rat Reputation",     desc: "Gestisci i gradi e la lealtà dei player alla Gilda di Obia.",          path: "/dm-admin/reputation" },
    { label: "World Boss Fight",   desc: "Crea nuovi boss, attivali e gestisci i loro HP in tempo reale.",       path: "/dm-admin/world-boss" },
    { label: "Geomantia",          desc: "Gestisci le mappe, le lore delle città e i ping NPC.",                 path: "/dm-admin/geo" },
    { label: "Gestione Sessioni",  desc: "Imposta date, orari e link per Party AMEA, LAC ed Enox.",             path: "/dm-admin/sessions" },
    { label: "Cinema",             desc: "Carica i link delle registrazioni delle sessioni passate.",            path: "/dm-admin/videos" },
    { label: "Session Summaries",  desc: "Aggiorna i log narrativi delle ultime avventure.",                    path: "/dm-admin/summaries" },
    { label: "Platinum Coins (MP)",desc: "Aggiorna il saldo dei personaggi (Monete Platino).",                  path: "/dm-admin/platinum" },
    { label: "Quest Board",        desc: "Gestisci le missioni sulla bacheca di Hemile.",                       path: "/dm-admin/quests" },
    { label: "Sprite Personaggi",  desc: "Carica o aggiorna lo sprite pixel-art di ogni personaggio.",           path: "/dm-admin/player-sprites" },
    { label: "Invia Notifica",     desc: "Invia un messaggio diretto a un giocatore nel suo menu personale.",   path: "/dm-admin/send-notif", dashed: true },
  ];

  return (
    <section className="admin-page">
      <h1 className="admin-page-title">Exanthia Administration Panel</h1>
      <div className="admin-divider"><span className="admin-divider-icon">⚔</span></div>

      <p style={{ textAlign: "center", marginBottom: 36, color: "#666", fontSize: "0.9rem" }}>
        Bentornato, Master {currentUser.email.split("@")[0]}. Gestisci il destino del mondo.
      </p>

      <div className="admin-dash-grid">
        {BLOCKS.map(({ label, desc, path, dashed }) => (
          <div
            key={path}
            className="admin-dash-block"
            style={dashed ? { borderStyle: "dashed" } : undefined}
            onClick={() => navigate(path)}
          >
            <h2>{label}</h2>
            <p>{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
