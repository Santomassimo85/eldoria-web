// src/pages/AdminPanel.jsx (Dashboard e Protezione)

import React from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom"; 


export default function AdminPanel() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const MASTER_EMAIL = "santomassimo85@gmail.com";

  // Reindirizzamento e protezione
  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return (
      <section style={{ textAlign: "center", paddingTop: "100px" }}>
        <h1 style={{ color: "var(--red)" }}>Accesso Negato</h1>
        <p>Solo il Dungeon Master può accedere a questo pannello.</p>
      </section>
    );
  }

  // --- Funzioni di navigazione (per i pulsanti) ---
  const navigateToMarket = () => navigate('/dm-admin/market');
  const navigateToSummaries = () => navigate('/dm-admin/summaries');
const navigateToPlatinum = () => navigate('/dm-admin/platinum'); 

  return (
    <section className="admin-page">
      <h1 style={{ color: "var(--gold)", textAlign: "center" }}>
        Pannello Amministrazione Eldoria
      </h1>
      <p style={{ textAlign: "center", marginBottom: 40 }}>
        Benvenuto, {currentUser.email.split('@')[0]}. Gestisci i dati della tua campagna.
      </p>

      <div className="admin-dashboard-grid">
        
        {/* Blocco 1: Gestione Mercato */}
        <div className="admin-block" onClick={navigateToMarket}>
            <h2>Gestione Mercato Nero</h2>
            <p>Aggiungi, modifica o elimina oggetti d'asta.</p>
            <button className="admin-button">Vai al Mercato Admin</button>
        </div>
        {/* Blocco 4: Reputazione Ratti */}
<div className="admin-block" onClick={() => navigate('/dm-admin/reputation')}>
    <h2>Reputazione Ratti 🐀</h2>
    <p>Controlla la fedeltà dei giocatori alla Gilda e i livelli raggiunti.</p>
    <button className="admin-button">Gestisci Gradi</button>
</div>
        {/* Blocco 5: Gestione video sessioni */}

<div className="admin-block" onClick={() => navigate('/dm-admin/videos')}>
    <h2>Cinema 🎬</h2>
    <p>Carica i link delle registrazioni delle sessioni.</p>
</div>
        {/* Blocco 2: Gestione Riassunti */}
        <div className="admin-block" onClick={navigateToSummaries}>
            <h2>Gestione Riassunti Sessioni</h2>
            <p>Aggiungi i log delle nuove sessioni alla pagina Riassunti.</p>
            <button className="admin-button">Vai a Riassunti Admin</button>
        </div>
        
        {/* Blocco 3: Gestione Monete Platino */}
        <div className="admin-block" onClick={navigateToPlatinum}>
            <h2>Gestione Monete (MP)</h2>
            <p>Aggiorna il saldo delle Monete Platino (MP) dei personaggi.</p>
            <button className="admin-button">Vai a Saldo MP</button>
        </div>

        <div className="admin-block" onClick={() => navigate('/dm-admin/quests')}>
    <h2>Gestione Bacheca</h2>
    <p>Aggiungi o rimuovi pergamene e missioni dalla Bacheca di Hemile.</p>
    <button className="admin-button">Gestisci Quest</button>
</div>

      </div>
    </section>
  );
}