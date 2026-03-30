import { useAuth } from "../AuthContext"; // Percorso corretto se entrambi sono in src
import { useNavigate } from "react-router-dom";
import { db } from "../firebase"; // Percorso corretto
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * AdminPanel Component
 * Dashboard per il Dungeon Master di Eldoria.
 */
export default function AdminPanel() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Email del Master per il controllo accessi
  const MASTER_EMAIL = "santomassimo85@gmail.com";

  // Protezione: solo il Master può accedere
  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return (
      <section style={{ textAlign: "center", paddingTop: "100px" }}>
        <h1 style={{ color: "var(--red)" }}>Accesso Negato</h1>
        <p>Solo il Dungeon Master può accedere a questo pannello.</p>
      </section>
    );
  }

  /**
   * FUNZIONE PER INVIARE NOTIFICHE (Messaggi)
   * Questa funzione può essere esportata o usata internamente.
   * @param {string} userId - L'ID del destinatario (uid di Firebase)
   * @param {string} title - Titolo del messaggio
   * @param {string} message - Testo del messaggio
   */
  const sendNotification = async (userId, title, message) => {
    try {
      await addDoc(collection(db, "notifications"), {
        userId: userId,
        title: title,
        message: message,
        read: false,
        timestamp: serverTimestamp(),
      });
      console.log("Notifica inviata con successo!");
    } catch (error) {
      console.error("Errore nell'invio della notifica:", error);
    }
  };

  // Funzioni di navigazione
  const navigateToMarket = () => navigate("/dm-admin/market");
  const navigateToSummaries = () => navigate("/dm-admin/summaries");
  const navigateToPlatinum = () => navigate("/dm-admin/platinum");

  return (
    <section className="admin-page">
      <h1 style={{ color: "var(--gold)", textAlign: "center" }}>
        Eldoria Administration Panel
      </h1>
      <p style={{ textAlign: "center", marginBottom: 40 }}>
        Bentornato, Master {currentUser.email.split("@")[0]}. Gestisci il destino del mondo.
      </p>

      <div className="admin-dashboard-grid">
        {/* Mercato Nero */}
        <div className="admin-block" onClick={navigateToMarket}>
          <h2>Black Market</h2>
          <p>Aggiungi o modifica oggetti e gestisci le aste del Ratto.</p>
        </div>

        {/* Reputazione Gilda dei Ratti */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/reputation")}>
          <h2>Rat Reputation</h2>
          <p>Gestisci i gradi e la lealtà dei player alla Gilda di Obia.</p>
        </div>

        {/* Combattimenti Boss */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/world-boss")}>
          <h2>World Boss Fight</h2>
          <p>Crea nuovi boss, attivali e gestisci i loro HP in tempo reale.</p>
        </div>

        {/* Archivio Geografico */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/geo")}>
          <h2>Geomantia</h2>
          <p>Gestisci le mappe, le lore delle città e i ping NPC.</p>
        </div>

        {/* Gestione Sessioni */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/sessions")}>
          <h2>Gestione Sessioni</h2>
          <p>Imposta date, orari e link per Party AMEA, LAC ed Enox.</p>
        </div>

        {/* Cinema (Registrazioni) */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/videos")}>
          <h2>Cinema</h2>
          <p>Carica i link delle registrazioni delle sessioni passate.</p>
        </div>

        {/* Riassunti Sessioni */}
        <div className="admin-block" onClick={navigateToSummaries}>
          <h2>Session Summaries</h2>
          <p>Aggiorna i log narrativi delle ultime avventure.</p>
        </div>

        {/* Bilancio Monete Platino */}
        <div className="admin-block" onClick={navigateToPlatinum}>
          <h2>Platinum Coins (MP)</h2>
          <p>Aggiorna il saldo dei personaggi (Monete Platino).</p>
        </div>

        {/* Bacheca delle Quest */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/quests")}>
          <h2>Quest Board</h2>
          <p>Gestisci le missioni sulla bacheca di Hemile.</p>
        </div>

        {/* Gestore Notifiche Manuali */}
        <div className="admin-block" style={{ border: '1px dashed var(--gold)' }} onClick={() => navigate("/dm-admin/send-notif")}>
          <h2>Invia Notifica</h2>
          <p>Invia un messaggio diretto a un giocatore nel suo menu personale.</p>
        </div>
      </div>
    </section>
  );
}