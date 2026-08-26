import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import GlacierHero from "../components/glacier/GlacierHero";
import "./Cinema.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/fantasma.png";

// Best YouTube thumbnail with HQ fallback baked in via onError.
const ytThumb = (id) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
const ytThumbFallback = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

const formatDate = (raw) => {
  if (!raw) return "";
  const d = raw?.toDate ? raw.toDate() : (raw instanceof Date ? raw : new Date(raw));
  if (isNaN(d?.getTime?.())) return "";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
};

const tsMillis = (raw) => {
  if (!raw) return 0;
  if (raw?.toMillis) return raw.toMillis();
  if (raw instanceof Date) return raw.getTime();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

// Pulls the session number from titles like "Sessione 5: …", "Session 12 — …",
// "S05 - …", or even just "5: ...". The newest session has the highest number.
// Falls back to -Infinity so untitled / unnumbered videos sink to the bottom
// rather than randomly grabbing the featured slot.
const extractSessionNumber = (title) => {
  if (!title) return -Infinity;
  const t = String(title);
  let m = t.match(/(?:sessione|session)[\s.#:_-]*(\d+)/i);
  if (m) return parseInt(m[1], 10);
  m = t.match(/\bS(?:ess)?[._-]?(\d+)\b/i);
  if (m) return parseInt(m[1], 10);
  m = t.match(/^[\s#№n.°-]*(\d+)\b/);
  if (m) return parseInt(m[1], 10);
  return -Infinity;
};

export default function Cinema() {
  useParallaxScroll();
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);
  const currentDomain = typeof window !== "undefined" ? window.location.hostname : "";

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const snap = await getDocs(collection(db, "session_videos"));
        const vids = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        vids.sort((a, b) => {
          // Primary: session number from the title — most recent session has the highest number.
          const numA = extractSessionNumber(a.title);
          const numB = extractSessionNumber(b.title);
          if (numA !== numB) return numB - numA;
          // Tiebreaker: upload time, newest first.
          return tsMillis(b.createdAt) - tsMillis(a.createdAt);
        });
        setVideos(vids);
      } catch (error) {
        console.error("Error loading videos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  // Close player on Escape
  useEffect(() => {
    if (!playing) return;
    const onKey = (e) => { if (e.key === "Escape") setPlaying(null); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [playing]);

  const openPlayer = useCallback((v) => setPlaying(v), []);
  const closePlayer = useCallback(() => setPlaying(null), []);

  const featured = videos[0] || null;
  const archive = videos.slice(1);
  const totalEpisodes = videos.length;
  const latestDateStr = useMemo(() => featured ? formatDate(featured.createdAt) : "", [featured]);

  if (!currentUser) {
    return (
      <section className="cine-page theatrum theatrum--locked" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
        <div className="nx-pannello theatrum-locked-card">
          <div className="theatrum-locked-glyph">🎭</div>
          <h2 className="nx-titolo theatrum-locked-title">Sala Chiusa</h2>
          <p className="nx-sotto theatrum-locked-text">Solo i compagni di viaggio possono entrare nel teatro. Effettua l'accesso per ammirare le memorie della campagna.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="cine-page theatrum" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
      {/* ── HERO = VARCO (prototipo J): la locandina-fantasma nel portale esagonale ── */}
      <GlacierHero
        ariaLabel="Teatro delle Cronache"
        image={HERO_IMAGE}
        eyebrow="Theatrum Mundi · Crit Happens"
        title={<>Teatro<br />delle Cronache</>}
        seal={latestDateStr
          ? `🎭 ${totalEpisodes} sessioni · ultima: ${latestDateStr}`
          : `🎭 ${totalEpisodes} sessioni`}
        tagline="L'archivio delle sessioni — frammenti di storie giocate, custodite oltre il tempo."
      />

      {/* ── INDICE A PILLOLE (satelliti della pagina) ── */}
      {!loading && featured && (
        <nav className="nx-pillole theatrum-indice" aria-label="Indice del teatro">
          <a href="#cin-proiezione" className="nx-pillola on">▶ In proiezione</a>
          {archive.length > 0 && <a href="#cin-archivio" className="nx-pillola">🎞 Archivio · {archive.length}</a>}
          <span className="nx-pillola theatrum-pillola-info">🎭 {totalEpisodes} sessioni</span>
        </nav>
      )}

      {/* ── BODY ────────────────────────────────────────── */}
      {loading ? (
        <div className="nx-pannello theatrum-loading">
          <div className="theatrum-reel" />
          <p>Le bobine girano…</p>
        </div>
      ) : !featured ? (
        <div className="nx-pannello theatrum-empty">
          <div className="theatrum-empty-glyph">🎞</div>
          <p>Nessuna registrazione ancora archiviata.</p>
          <small>Le memorie del Monaco Errante attendono di essere proiettate.</small>
        </div>
      ) : (
        <>
          {/* ── FEATURED: pannello largo con locandina + scheda ── */}
          <div id="cin-proiezione" className="gl-sezlabel">Ultima Cronaca · In Proiezione</div>
          <article className="nx-pannello theatrum-feature">
            <span className="nx-tag">✦ Ultima cronaca</span>
            <div className="theatrum-feature-grid">
              <button
                type="button"
                className="theatrum-feature-poster"
                onClick={() => openPlayer(featured)}
                aria-label={`Riproduci ${featured.title}`}
              >
                <Thumbnail video={featured} />
                <span className="theatrum-velo" aria-hidden="true" />
                <span className="theatrum-play" aria-hidden="true">▶</span>
              </button>

              <div className="theatrum-feature-meta">
                <span className="nx-kicker">
                  Cronaca №{extractSessionNumber(featured.title) > -Infinity ? extractSessionNumber(featured.title) : totalEpisodes}
                </span>
                <h2 className="nx-titolo theatrum-feature-title">{featured.title}</h2>
                {featured.createdAt && (
                  <p className="nx-meta theatrum-feature-date">📅 {formatDate(featured.createdAt)}</p>
                )}
                {featured.desc && <p className="nx-prosa theatrum-feature-desc">{featured.desc}</p>}
                <button type="button" className="gl-cta theatrum-feature-cta" onClick={() => openPlayer(featured)}>
                  ▶ Entra nel Teatro
                </button>
              </div>
            </div>
          </article>

          {/* ── ARCHIVIO: griglia di bobine ── */}
          {archive.length > 0 && (
            <>
            <div id="cin-archivio" className="gl-sezlabel">Archivio · Sessioni Precedenti</div>
            <p className="nx-nota theatrum-archivio-sub">Le bobine delle cronache passate, pronte per essere riproiettate.</p>
            <section className="theatrum-archive" aria-label="Archivio delle sessioni">
              <ul className="nx-griglia nx-griglia--larga theatrum-rolls">
                {archive.map((v, i) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="nx-pannello nx-pannello--tap theatrum-roll"
                      onClick={() => openPlayer(v)}
                      aria-label={`Riproduci ${v.title}`}
                    >
                      <span className="nx-tag theatrum-roll-num">
                        №{extractSessionNumber(v.title) > -Infinity ? extractSessionNumber(v.title) : archive.length - i}
                      </span>
                      <div className="theatrum-roll-thumb">
                        <Thumbnail video={v} />
                        <span className="theatrum-velo" aria-hidden="true" />
                        <span className="theatrum-play" aria-hidden="true">▶</span>
                      </div>
                      <div className="theatrum-roll-body">
                        <h4 className="nx-nome theatrum-roll-title">{v.title}</h4>
                        {v.desc && <p className="nx-nota theatrum-roll-desc">{v.desc}</p>}
                        <div className="theatrum-roll-foot">
                          {v.createdAt && (
                            <span className="nx-meta theatrum-roll-date">📅 {formatDate(v.createdAt)}</span>
                          )}
                          <span className="nx-meta theatrum-roll-platform">
                            {v.platform === "twitch" ? "🟣 Twitch" : "▶ YouTube"}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            </>
          )}
        </>
      )}

      {/* ── STAGE MODAL ──────────────────────────────── */}
      {playing && (
        <div className="theatrum-stage" onClick={closePlayer}>
          <div className="theatrum-stage-curtain theatrum-stage-curtain--left" aria-hidden="true" />
          <div className="theatrum-stage-curtain theatrum-stage-curtain--right" aria-hidden="true" />
          <div className="theatrum-stage-frame" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="theatrum-stage-close" onClick={closePlayer} title="Chiudi (Esc)">
              ✕ <span className="theatrum-stage-close-lbl">Esci dalla sala</span>
            </button>
            <header className="theatrum-stage-head">
              <span className="theatrum-stage-eyebrow">⛧ Ora in proiezione ⛧</span>
              <h2 className="theatrum-stage-title">{playing.title}</h2>
              {playing.createdAt && (
                <p className="theatrum-stage-date">{formatDate(playing.createdAt)}</p>
              )}
            </header>
            <div className="theatrum-stage-screen">
              <iframe
                src={
                  playing.platform === "twitch"
                    ? `https://player.twitch.tv/?video=${playing.videoId}&parent=${currentDomain}&autoplay=true`
                    : `https://www.youtube.com/embed/${playing.videoId}?autoplay=1`
                }
                title={playing.title}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
            {playing.desc && <p className="theatrum-stage-desc">{playing.desc}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

// Thumbnail for both YouTube and Twitch.
// Twitch has no public thumbnail without an API key, so we fall back to a styled placeholder.
function Thumbnail({ video }) {
  const [errored, setErrored] = useState(false);
  if (video.platform === "twitch" || !video.videoId) {
    return (
      <div className="theatrum-thumb theatrum-thumb--placeholder">
        <span className="theatrum-thumb-glyph">🎬</span>
        <span className="theatrum-thumb-platform">Twitch</span>
      </div>
    );
  }
  return (
    <img
      className="theatrum-thumb"
      src={errored ? ytThumbFallback(video.videoId) : ytThumb(video.videoId)}
      alt=""
      loading="lazy"
      onError={() => { if (!errored) setErrored(true); }}
    />
  );
}
