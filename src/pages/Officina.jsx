// ── /officina: la pagina della Gilda dove si CREA (il manuale resta in /crafting) ──
import { Link } from "react-router-dom";
import GlacierHero from "../components/glacier/GlacierHero";
import CraftingOfficina from "./CraftingOfficina";
import { HERO_QUOTE, PREGIATURE } from "../data/crafting";
import { CRAFT_MAX_PER_DAY, CRAFT_MAX_PER_WEEK } from "../data/craftingWeek";
import "./Crafting.css";
import "./Officina.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/helmvil_nani.png";

export default function Officina() {
  useParallaxScroll();
  const pickable = PREGIATURE.filter((p) => p.pick).map((p) => p.label).join(", ");
  const random = PREGIATURE.filter((p) => !p.pick && p.key !== "scarso").map((p) => p.label).join(" e ");
  return (
    <section className="cine-page cr-page off-page" style={{ "--cine-accent": "var(--el)", "--cine-accent-2": "var(--el-soft)" }}>
      <GlacierHero
        id="off-top"
        ariaLabel="L'Officina della Gilda"
        image={HERO_IMAGE}
        eyebrow="Gilda · l'arte dell'artigiano"
        title={<>L'Officina</>}
        seal={`⚒ ${CRAFT_MAX_PER_DAY} prova al giorno · ${CRAFT_MAX_PER_WEEK} a settimana`}
        tagline={HERO_QUOTE}
        actions={<><a href="#off-banco" className="gl-cta" aria-label="Vai al banco">⚒ Al banco</a><Link to="/crafting" className="gl-cta gl-cta--ghost" aria-label="Leggi il manuale">📖 Il manuale</Link></>}
      />

      <div id="off-banco" className="off-wrap">
        <p className="nx-nota off-page-lead">
          Scegli la <strong>rarità</strong> e, per {pickable}, anche <strong>quale oggetto</strong> fare; per {random} l'oggetto lo decide il d12.
          Poi prepari il banco e tiri: il lavoro dura un tempo fisso, quando è finito ritiri l'oggetto e il Master lo importa su Foundry.
          Le regole per esteso sono nel <Link to="/crafting">manuale</Link>.
        </p>
        <CraftingOfficina />
      </div>
    </section>
  );
}
