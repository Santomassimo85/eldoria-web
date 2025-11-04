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
        
        {/* Blocco 2: Gestione Riassunti */}
        <div className="admin-block" onClick={navigateToSummaries}>
            <h2>Gestione Riassunti Sessioni</h2>
            <p>Aggiungi i log delle nuove sessioni alla pagina Riassunti.</p>
            <button className="admin-button">Vai a Riassunti Admin</button>
        </div>

      </div>
    </section>
  );
}