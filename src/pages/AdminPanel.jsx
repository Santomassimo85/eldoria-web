// src/pages/AdminPanel.jsx
// Admin Panel component for Dungeon Master to manage campaign data
// Includes protection to allow only the master user access

import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * AdminPanel Component
 * 
 * Provides a dashboard for the Dungeon Master to manage:
 * - Black Market items
 * - Session summaries
 * - Platinum coins balance
 * - Player rat faction reputation
 * - Session recordings
 * - Quest board management
 * 
 * @returns {JSX.Element} Admin dashboard or access denied message
 */
export default function AdminPanel() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Master user email for access control
  const MASTER_EMAIL = "santomassimo85@gmail.com";

  // Redirect and protect: only allow master user
  if (!currentUser || currentUser.email !== MASTER_EMAIL) {
    return (
      <section style={{ textAlign: "center", paddingTop: "100px" }}>
        <h1 style={{ color: "var(--red)" }}>Access Denied</h1>
        <p>Only the Dungeon Master can access this panel.</p>
      </section>
    );
  }

  // Navigation helper functions for dashboard blocks
  const navigateToMarket = () => navigate("/dm-admin/market");
  const navigateToSummaries = () => navigate("/dm-admin/summaries");
  const navigateToPlatinum = () => navigate("/dm-admin/platinum");

  return (
    <section className="admin-page">
      <h1 style={{ color: "var(--gold)", textAlign: "center" }}>
        Eldoria Administration Panel
      </h1>
      <p style={{ textAlign: "center", marginBottom: 40 }}>
        Welcome, {currentUser.email.split("@")[0]}. Manage your campaign data.
      </p>

      <div className="admin-dashboard-grid">
        {/* Market Management Block */}
        <div className="admin-block" onClick={navigateToMarket}>
          <h2>Black Market</h2>
          <p>Add, edit, or remove auction items.</p>
          {/* <button className="admin-button">Market Admin</button> */}
        </div>

        {/* Rat Faction Reputation Block */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/reputation")}>
          <h2>Rat Reputation</h2>
          <p>Track player loyalty to the Guild and rank levels.</p>
          {/* <button className="admin-button">Manage Ranks</button> */}
        </div>

        <div className="admin-block" onClick={() => navigate("/dm-admin/geo")}>
  <h2>Geomantia</h2>
  <p>Gestisci le mappe e le lore delle città.</p>
</div>

        {/* Session Recordings Block */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/videos")}>
          <h2>Cinema</h2>
          <p>Upload links to session recordings.</p>
        </div>

        {/* Session Summaries Block */}
        <div className="admin-block" onClick={navigateToSummaries}>
          <h2>Session Summaries</h2>
          <p>Add logs of new sessions to the Summaries page.</p>
          {/* <button className="admin-button">Summaries Admin</button> */}
        </div>

        {/* Platinum Coins Balance Block */}
        <div className="admin-block" onClick={navigateToPlatinum}>
          <h2>Platinum Coins (MP)</h2>
          <p>Update character Platinum Coins (MP) balance.</p>
          {/* <button className="admin-button">MP Balance</button> */}
        </div>

        {/* Quest Board Management Block */}
        <div className="admin-block" onClick={() => navigate("/dm-admin/quests")}>
          <h2>Quest Board</h2>
          <p>Add or remove scrolls and missions from Hemile's Board.</p>
          {/* <button className="admin-button">Manage Quests</button> */}
        </div>
      </div>
    </section>
  );
}