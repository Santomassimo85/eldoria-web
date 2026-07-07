import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { isDmUser } from "../utils/dmAccess";
import "./admin.css";

/* ============================================================
   DM Tools — pagina rapida (master + co-master).
   Contiene SOLO: gli Agenti (Il Concilio) e i due invii a
   Foundry (NPC e Oggetto). Tutto il resto vive in DM Admin.
   ============================================================ */
export default function DmToolsHub() {
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

  const TILES = [
    { icon: "🜂", label: "Agenti",           desc: "Il Concilio — i tuoi agenti AI.",            path: "/agenti" },
    { icon: "🧝", label: "NPC → Foundry",    desc: "Prepara e invia gli NPC creati a Foundry.",  path: "/dm-admin/foundry-npc" },
    { icon: "🎁", label: "Oggetto → Foundry",desc: "Invia un oggetto a Foundry.",                path: "/dm-admin/foundry-item" },
  ];

  return (
    <section className="adm" style={{ "--cine-accent": "#8a261c", "--cine-accent-2": "#c0392b" }}>
      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">✦ DM Tools ✦</span>
          <h1 className="adm-title">Strumenti Rapidi</h1>
          <p className="adm-sub">Agenti AI e invii a Foundry. Il resto è in <strong>DM Admin</strong>.</p>
        </div>
      </div>

      <div className="adm-tiles">
        {TILES.map(({ icon, label, desc, path }) => (
          <div
            key={path}
            className="adm-tile"
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
    </section>
  );
}
