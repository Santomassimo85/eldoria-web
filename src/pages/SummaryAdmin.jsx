import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { db, storage } from "../firebase";
import "./admin.css";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import HtmlToolbar from "../components/HtmlToolbar";
import { membersOf } from "../data/partyMembers";

const MASTER_EMAIL = "santomassimo85@gmail.com";
// Email autorizzate a gestire i riassunti di sessione (master + collaboratore).
const SUMMARY_EDITORS = [MASTER_EMAIL, "ripperti96@gmail.com"];
const canEditSummaries = (user) => !!user && SUMMARY_EDITORS.includes(user.email);

const PARTIES = [
  { key: "AMEA",  label: "AMEA",  color: "#c0392b", roster: "Garroth, Tanagar, Caius, Sylva" },
  { key: "LAC",   label: "LAC",   color: "#2980b9", roster: "Horn, Thoki, Cleofe" },
  { key: "LEAF",  label: "LEAF",  color: "#27ae60", roster: "Soran, Zenthir, Taaras" },
  { key: "ENOX",  label: "ENOX",  color: "#8e44ad", roster: "Makenna, Temistocle, Alaric, Lael" },
  { key: "ECO",   label: "ECO",   color: "#0f766e", roster: "Aksel, Dago, Ismael" },
  { key: "Unico", label: "Storia del Mondo", color: "#d4af37", roster: "Cronache globali" },
];

const initialFormData = {
  title: "",
  subTitle: "",
  party: "AMEA",
  content: "",
  order: "",
  date: "",
  coverImage: "",
  images: [],
};

/* ──────────────────────────────────────────────────────────────
   DropZone — same pattern as the other admin pages
   ────────────────────────────────────────────────────────────── */
const DropZone = ({ value, uploading, onFile, onClear, label, icon = "📜" }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`sumadm-drop ${dragOver ? "drag" : ""} ${uploading ? "loading" : ""} ${value ? "filled" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <div className="sumadm-drop-state">
          <span className="sumadm-drop-spinner" />
          <strong>Caricamento…</strong>
        </div>
      ) : value ? (
        <>
          <img src={value} alt="" className="sumadm-drop-img" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
          <div className="sumadm-drop-overlay">
            <span>📤 Cambia copertina</span>
            {onClear && (
              <button
                type="button"
                className="sumadm-drop-clear"
                onClick={(e) => { e.stopPropagation(); onClear(); }}
              >
                ✕ Rimuovi
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="sumadm-drop-state">
          <span className="sumadm-drop-icon">{icon}</span>
          <strong>{label}</strong>
          <small>Trascina o clicca · max 5MB</small>
        </div>
      )}
    </div>
  );
};

/* Multi-file drop zone for the inline gallery */
const MultiDropZone = ({ uploading, onFiles, label = "Trascina immagini per la galleria", icon = "🖼" }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type?.startsWith("image/"));
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`sumadm-drop sumadm-drop-multi ${dragOver ? "drag" : ""} ${uploading ? "loading" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <div className="sumadm-drop-state">
          <span className="sumadm-drop-spinner" />
          <strong>Caricamento…</strong>
        </div>
      ) : (
        <div className="sumadm-drop-state">
          <span className="sumadm-drop-icon">{icon}</span>
          <strong>{label}</strong>
          <small>Trascina o clicca · max 5MB ciascuna · selezione multipla</small>
        </div>
      )}
    </div>
  );
};

const partyColor = (key) => PARTIES.find((p) => p.key === key)?.color || "#888";
const rosterOf = (key) => PARTIES.find((p) => p.key === key)?.roster || "";
const stripHtml = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// Stili disponibili per l'immagine di scena. La chiave viene scelta dal DM
// prima di generare; il suffisso guida il modello d'immagine.
const SCENE_STYLES = {
  comic: {
    label: "Dark fantasy comic",
    icon: "🖋",
    suffix:
      "Dark-fantasy comic-book / graphic-novel art, bold inked outlines, dramatic cel shading, high-contrast moody lighting, gritty atmosphere, rich saturated accents.",
  },
  watercolor: {
    label: "Acquerello",
    icon: "🎨",
    suffix:
      "Traditional watercolor fantasy illustration, soft flowing washes and bleeding pigments, delicate ink linework, luminous paper grain, muted earthy palette, dreamy hand-painted feel.",
  },
  epic: {
    label: "Epico",
    icon: "⚔️",
    suffix:
      "Epic cinematic fantasy oil painting, sweeping dramatic composition, volumetric god-rays, grand heroic scale, painterly brushwork, rich depth and detail like a classical masterwork.",
  },
};
const styleOf = (key) => SCENE_STYLES[key] || SCENE_STYLES.comic;
const scenePromptFull = (scena, styleKey) =>
  `${String(scena || "").trim()}. ${styleOf(styleKey).suffix} No text, no lettering, no speech bubbles, no frame, no border.`;

// Converte un avatar (anche asset relativo) in data URL ridotto: i path
// relativi non sono scaricabili lato server, così viaggiano inline e leggeri.
async function refToDataUrl(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  return cv.toDataURL("image/jpeg", 0.85);
}

export default function SummaryAdmin() {
  const { currentUser } = useAuth();
  const textAreaRef = useRef(null);

  const [formData, setFormData] = useState(initialFormData);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Generazione immagine di scena (per-riassunto): id del riassunto in lavorazione.
  const [sceneBusyId, setSceneBusyId] = useState(null);
  // Stile scelto per la generazione (dark fantasy comic · acquerello · epico).
  const [sceneStyle, setSceneStyle] = useState("comic");
  // Anteprima "tieni / rigenera": tiene l'immagine generata PRIMA di salvarla.
  // { summaryId, index (null=accoda / n=sostituisci), scena, dataUrl, style }
  const [pending, setPending] = useState(null);
  // Cache degli avatar-riferimento per gruppo (evita di riscaricarli a ogni rigenera).
  const refsCache = useRef({});

  useEffect(() => {
    if (!canEditSummaries(currentUser)) return;
    const unsub = onSnapshot(collection(db, "summaries"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setSummaries(list);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  if (!canEditSummaries(currentUser)) {
    return (
      <p style={{ textAlign: "center", paddingTop: "100px" }}>
        Accesso negato: solo DM.
      </p>
    );
  }

  /* ── Storage helpers ── */
  const uploadCover = async (file) => {
    if (!file?.type?.startsWith("image/")) {
      alert("Seleziona un file immagine valido.");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Immagine troppo grande (max 5MB).");
      return null;
    }
    setUploading(true);
    try {
      const safe = (file.name || "cover").replace(/[^a-z0-9._-]/gi, "_").slice(0, 40);
      const path = `summaries/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      return await getDownloadURL(ref);
    } catch (err) {
      console.error("Upload fallito:", err);
      alert("Errore upload: " + (err.message || err.code));
      return null;
    } finally {
      setUploading(false);
    }
  };

  const cleanupStorageUrl = async (url) => {
    if (!url || !url.includes("firebasestorage.googleapis.com")) return;
    try { await deleteObject(storageRef(storage, url)); }
    catch (err) { console.warn("Storage cleanup skipped:", err.code); }
  };

  const onCoverFile = async (file) => {
    const url = await uploadCover(file);
    if (url) {
      if (formData.coverImage) cleanupStorageUrl(formData.coverImage);
      setFormData((d) => ({ ...d, coverImage: url }));
    }
  };

  /* Gallery upload — accepts multiple files, appends to formData.images */
  const uploadOne = async (file) => {
    if (!file?.type?.startsWith("image/")) return null;
    if (file.size > 5 * 1024 * 1024) {
      alert(`"${file.name}" è troppo grande (max 5MB).`);
      return null;
    }
    const safe = (file.name || "img").replace(/[^a-z0-9._-]/gi, "_").slice(0, 40);
    const path = `summaries/gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, { contentType: file.type });
    return await getDownloadURL(ref);
  };

  const onGalleryFiles = async (files) => {
    setGalleryUploading(true);
    try {
      const urls = [];
      for (const f of files) {
        try {
          const url = await uploadOne(f);
          if (url) urls.push(url);
        } catch (err) {
          console.error("Upload galleria fallito:", err);
          alert(`Errore upload "${f.name}": ${err.message || err.code}`);
        }
      }
      if (urls.length) {
        setFormData((d) => ({ ...d, images: [...(d.images || []), ...urls] }));
      }
    } finally {
      setGalleryUploading(false);
    }
  };

  const removeGalleryImage = async (url) => {
    setFormData((d) => ({ ...d, images: (d.images || []).filter((u) => u !== url) }));
    cleanupStorageUrl(url);
  };

  /* Sposta un'immagine nella galleria (◀ / ▶). dir = -1 sinistra, +1 destra. */
  const moveGalleryImage = (idx, dir) => {
    setFormData((d) => {
      const imgs = [...(d.images || [])];
      const j = idx + dir;
      if (j < 0 || j >= imgs.length) return d;
      [imgs[idx], imgs[j]] = [imgs[j], imgs[idx]];
      return { ...d, images: imgs };
    });
  };

  /* ── Form handlers ── */
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setIsEditing(false);
    setEditingId(null);
    setStatus("");
  };

  const handleDelete = async (summary) => {
    if (!window.confirm(`Eliminare "${summary.title}"?`)) return;
    try {
      await cleanupStorageUrl(summary.coverImage);
      for (const url of (summary.images || [])) await cleanupStorageUrl(url);
      await deleteDoc(doc(db, "summaries", summary.id));
      setStatus(`✅ Riassunto eliminato.`);
    } catch (error) {
      setStatus(`❌ Errore: ${error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;
    setStatus("");

    try {
      if (isEditing && editingId) {
        await updateDoc(doc(db, "summaries", editingId), {
          title: formData.title,
          subTitle: formData.subTitle,
          party: formData.party,
          content: formData.content,
          order: Number(formData.order),
          date: formData.date,
          coverImage: formData.coverImage || "",
          images: formData.images || [],
          updatedAt: new Date().toISOString(),
        });
        setStatus(`✅ "${formData.title}" aggiornato.`);
      } else {
        const docId = `${formData.party}_${Date.now()}`;
        await setDoc(doc(db, "summaries", docId), {
          ...formData,
          images: formData.images || [],
          createdAt: new Date().toISOString(),
          order: Number(formData.order) || summaries.length + 1,
        });
        setStatus(`✅ "${formData.title}" creato.`);
      }
      handleReset();
    } catch (error) {
      setStatus(`❌ Errore: ${error.message}`);
    }
  };

  const handleEdit = (summary) => {
    setFormData({
      title: summary.title || "",
      subTitle: summary.subTitle || "",
      party: summary.party || "AMEA",
      content: summary.content || "",
      order: summary.order || "",
      date: summary.date || "",
      coverImage: summary.coverImage || "",
      images: Array.isArray(summary.images) ? summary.images : [],
    });
    setIsEditing(true);
    setEditingId(summary.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── Genera un'immagine da una scena a caso del riassunto ──
     1) Claude sceglie un momento vivido del testo e ne fa un prompt (EN),
        coinvolgendo i PG del gruppo. 2) Gemini disegna la scena usando gli
        avatar del party come riferimento. 3) l'immagine si accoda alle
        `images` del riassunto (in fondo, con le altre della galleria). */
  const uploadSceneDataUrl = async (dataUrl) => {
    const path = `summaries/gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-scena.jpg`;
    const ref = storageRef(storage, path);
    await uploadString(ref, dataUrl, "data_url");
    return await getDownloadURL(ref);
  };

  const uploadCoverDataUrl = async (dataUrl) => {
    const path = `summaries/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-copertina.jpg`;
    const ref = storageRef(storage, path);
    await uploadString(ref, dataUrl, "data_url");
    return await getDownloadURL(ref);
  };

  // Avatar-riferimento dei PG del gruppo (con cache per gruppo).
  const getPartyRefs = async (party) => {
    if (refsCache.current[party]) return refsCache.current[party];
    const refs = [];
    for (const m of membersOf(party)) {
      try { refs.push(await refToDataUrl(m.image)); } catch { /* avatar saltato */ }
    }
    refsCache.current[party] = refs;
    return refs;
  };

  // Pipeline pura: estrae un soggetto e ne genera il DATA URL (non salva nulla).
  // mode "scene" (varia inquadratura/PG) oppure "cover" (key art evocativa, no PG ref).
  // Ritorna { scena, dataUrl }. Aggiorna lo status a scopo informativo.
  const runScenePipeline = async (summary, styleKey, mode = "scene") => {
    const testo = stripHtml(summary.content);
    if (!testo) throw new Error("Il riassunto non ha testo da illustrare.");
    const isCover = mode === "cover";

    // 1) Estrai il soggetto dal testo (prompt in inglese).
    setStatus(isCover ? "🎬 Scelgo il soggetto della copertina…" : "🎬 Estraggo una scena dal riassunto…");
    const rScena = await fetch("/api/estrai-scena", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: testo,
        roster: rosterOf(summary.party),
        party: summary.party,
        mode,
      }),
    });
    const dScena = await rScena.json();
    if (dScena.error) throw new Error(dScena.error);
    const scena = String(dScena.scena || "").trim();
    if (!scena) throw new Error("Nessun soggetto estratto.");

    // 2) Riferimenti: gli avatar dei PG servono solo alle SCENE (per la
    //    somiglianza). La copertina è key art evocativa → nessun riferimento PG.
    setStatus(`🖌 Disegno ${isCover ? "la copertina" : "la scena"} (${styleOf(styleKey).label})…`);
    const refs = isCover ? [] : await getPartyRefs(summary.party);

    // 3) Genera l'immagine con lo stile scelto.
    const rImg = await fetch("/api/genera-immagine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: scenePromptFull(scena, styleKey), refs }),
    });
    const dImg = await rImg.json();
    if (dImg.error) throw new Error(dImg.error);
    if (!dImg.immagine) throw new Error("Nessuna immagine ricevuta.");

    return { scena, dataUrl: dImg.immagine };
  };

  // Avvia una generazione di SCENA → apre l'anteprima "tieni / rigenera".
  // index null = accoda; numero = sostituirà quella posizione della galleria.
  const startSceneGeneration = async (summary, index = null) => {
    if (sceneBusyId || pending) return;
    setSceneBusyId(summary.id);
    try {
      const { scena, dataUrl } = await runScenePipeline(summary, sceneStyle, "scene");
      setPending({ summaryId: summary.id, target: "gallery", mode: "scene", index, scena, dataUrl, style: sceneStyle });
      setStatus("");
    } catch (e) {
      setStatus(`❌ Errore immagine: ${e.message}`);
    } finally {
      setSceneBusyId(null);
    }
  };

  // Avvia una generazione di COPERTINA → anteprima "tieni / rigenera".
  const startCoverGeneration = async (summary) => {
    if (sceneBusyId || pending) return;
    setSceneBusyId(summary.id);
    try {
      const { scena, dataUrl } = await runScenePipeline(summary, sceneStyle, "cover");
      setPending({ summaryId: summary.id, target: "cover", mode: "cover", index: null, scena, dataUrl, style: sceneStyle });
      setStatus("");
    } catch (e) {
      setStatus(`❌ Errore copertina: ${e.message}`);
    } finally {
      setSceneBusyId(null);
    }
  };

  // Rigenera l'immagine nell'anteprima (soggetto e/o stile diversi) senza salvare.
  const regeneratePending = async () => {
    if (!pending || sceneBusyId) return;
    const summary = summaries.find((s) => s.id === pending.summaryId);
    if (!summary) return;
    setSceneBusyId(summary.id);
    try {
      const { scena, dataUrl } = await runScenePipeline(summary, pending.style, pending.mode || "scene");
      setPending((p) => (p ? { ...p, scena, dataUrl } : p));
      setStatus("");
    } catch (e) {
      setStatus(`❌ Errore immagine: ${e.message}`);
    } finally {
      setSceneBusyId(null);
    }
  };

  // Conferma l'anteprima: carica su storage e salva.
  // target "cover" → imposta la copertina; "gallery" → accoda/sostituisce in galleria.
  const commitPending = async () => {
    if (!pending || sceneBusyId) return;
    const p = pending;
    setSceneBusyId(p.summaryId);
    try {
      const editingThis = isEditing && editingId === p.summaryId;
      const summary = summaries.find((s) => s.id === p.summaryId);

      if (p.target === "cover") {
        const url = await uploadCoverDataUrl(p.dataUrl);
        const oldCover = editingThis ? formData.coverImage : summary?.coverImage;
        await updateDoc(doc(db, "summaries", p.summaryId), {
          coverImage: url,
          updatedAt: new Date().toISOString(),
        });
        if (oldCover) cleanupStorageUrl(oldCover); // ripulisci la vecchia copertina
        if (editingThis) setFormData((d) => ({ ...d, coverImage: url }));
        setStatus(`✅ Copertina generata${summary ? ` per "${summary.title}"` : ""}.`);
        setPending(null);
        return;
      }

      const url = await uploadSceneDataUrl(p.dataUrl);
      const base = editingThis
        ? (formData.images || [])
        : (Array.isArray(summary?.images) ? summary.images : []);

      let nextImages;
      if (p.index == null) {
        nextImages = [...base, url];
      } else {
        nextImages = [...base];
        const old = nextImages[p.index];
        nextImages[p.index] = url;
        if (old) cleanupStorageUrl(old); // ripulisci l'immagine sostituita
      }

      await updateDoc(doc(db, "summaries", p.summaryId), {
        images: nextImages,
        updatedAt: new Date().toISOString(),
      });
      if (editingThis) setFormData((d) => ({ ...d, images: nextImages }));

      setStatus(`✅ Immagine ${p.index == null ? "aggiunta" : "rigenerata"}${summary ? ` in "${summary.title}"` : ""}.`);
      setPending(null);
    } catch (e) {
      setStatus(`❌ Errore salvataggio: ${e.message}`);
    } finally {
      setSceneBusyId(null);
    }
  };

  // Scarta l'anteprima senza salvare nulla.
  const discardPending = () => {
    if (sceneBusyId) return;
    setPending(null);
    setStatus("");
  };

  // Cambia stile all'interno dell'anteprima (avrà effetto al prossimo "Rigenera").
  const setPendingStyle = (key) => setPending((p) => (p ? { ...p, style: key } : p));

  /* ── Derived data ── */
  const stats = useMemo(() => {
    const total = summaries.length;
    const views = summaries.reduce((s, x) => s + (x.viewCount || 0), 0);
    const byParty = {};
    summaries.forEach((s) => { byParty[s.party] = (byParty[s.party] || 0) + 1; });
    const topParty = Object.entries(byParty).sort(([, a], [, b]) => b - a)[0]?.[0] || "—";
    return { total, views, parties: Object.keys(byParty).length, topParty };
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    const q = search.toLowerCase().trim();
    return summaries.filter((s) => {
      if (filter !== "all" && s.party !== filter) return false;
      if (!q) return true;
      return (
        (s.title || "").toLowerCase().includes(q) ||
        (s.subTitle || "").toLowerCase().includes(q) ||
        (s.date || "").toLowerCase().includes(q)
      );
    });
  }, [summaries, filter, search]);

  const previewParty = PARTIES.find((p) => p.key === formData.party) || PARTIES[0];

  return (
    <section className="admin-summary-page sumadm">
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      {/* ── HERO ── */}
      <header className="sumadm-hero">
        <div className="sumadm-hero-titles">
          <span className="adm-eyebrow">📜 Cronache di Eldoria</span>
          <h1 className="sumadm-title">Scriptorium del Monaco</h1>
          <p className="sumadm-sub">Annota le memorie delle sessioni e i frammenti del mondo</p>
        </div>
        <div className="sumadm-stats">
          <div className="sumadm-stat"><span>Riassunti</span><strong>{stats.total}</strong></div>
          <div className="sumadm-stat"><span>Gruppi</span><strong>{stats.parties}</strong></div>
          <div className="sumadm-stat"><span>Più attivo</span><strong>{stats.topParty}</strong></div>
          <div className="sumadm-stat alt"><span>Visite tot.</span><strong>{stats.views}</strong></div>
        </div>
      </header>

      {status && (
        <div className={status.startsWith("✅") ? "admin-status-ok" : "admin-status-err"}>
          {status}
        </div>
      )}

      {/* ── WORKSHOP: editor + live preview ── */}
      <div className="sumadm-workshop">
        <section className="sumadm-card">
          <div className="sumadm-card-head">
            <h2>{isEditing ? "✎ Modifica Riassunto" : "✨ Nuova Sessione"}</h2>
            {isEditing && <span className="sumadm-edit-tag">{editingId.slice(0, 18)}…</span>}
          </div>

          <form onSubmit={handleSubmit} className="sumadm-form">
            <div className="sumadm-field">
              <label>Titolo</label>
              <input
                className="admin-field-input"
                name="title"
                placeholder="Il giorno della Fenice di sangue"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="sumadm-field">
              <label>Sottotitolo (Obia)</label>
              <input
                className="admin-field-input"
                name="subTitle"
                placeholder="…dalla penna del Monaco Errante"
                value={formData.subTitle}
                onChange={handleChange}
                required
              />
            </div>

            <div className="sumadm-row3">
              <div className="sumadm-field">
                <label>Gruppo</label>
                <select
                  className="admin-field-select"
                  name="party"
                  value={formData.party}
                  onChange={handleChange}
                >
                  {PARTIES.map((p) => (
                    <option key={p.key} value={p.key}>{p.key === "Unico" ? p.label : `${p.key} (${p.roster})`}</option>
                  ))}
                </select>
              </div>
              <div className="sumadm-field">
                <label>Data (in gioco)</label>
                <input
                  className="admin-field-input"
                  type="text"
                  name="date"
                  placeholder="14 di Eldarin 1852"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="sumadm-field">
                <label>Ordine</label>
                <input
                  className="admin-field-input"
                  type="number"
                  name="order"
                  placeholder="1"
                  value={formData.order}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="sumadm-field">
              <label>Copertina</label>
              <DropZone
                value={formData.coverImage}
                uploading={uploading}
                onFile={onCoverFile}
                onClear={() => {
                  cleanupStorageUrl(formData.coverImage);
                  setFormData((d) => ({ ...d, coverImage: "" }));
                }}
                label="Trascina la copertina"
                icon="📜"
              />
              <input
                type="url"
                className="admin-field-input sumadm-url"
                placeholder="…oppure incolla un URL diretto"
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              />
              {isEditing && editingId && (
                <button
                  type="button"
                  className="sumadm-btn primary"
                  style={{ marginTop: 10 }}
                  disabled={!!sceneBusyId || !!pending}
                  onClick={() => startCoverGeneration(
                    summaries.find((s) => s.id === editingId) || { id: editingId, ...formData },
                  )}
                >
                  {sceneBusyId === editingId ? "⏳ Genero…" : `🖼 Genera copertina AI (${styleOf(sceneStyle).label})`}
                </button>
              )}
            </div>

            <div className="sumadm-field">
              <label>Contenuto (HTML consentito)</label>
              <HtmlToolbar
                textAreaRef={textAreaRef}
                formData={formData}
                setFormData={setFormData}
                fieldName="content"
              />
              <textarea
                ref={textAreaRef}
                className="admin-field-textarea"
                name="content"
                placeholder="Cronaca della sessione…"
                value={formData.content}
                onChange={handleChange}
                rows="10"
                required
              />
            </div>

            <div className="sumadm-field">
              <label>Galleria immagini (mostrate alla fine del riassunto)</label>
              {isEditing && editingId && (
                <div className="sumadm-scene-gen">
                  <button
                    type="button"
                    className="sumadm-btn primary"
                    disabled={!!sceneBusyId || !!pending}
                    onClick={() => startSceneGeneration(
                      summaries.find((s) => s.id === editingId) || { id: editingId, ...formData },
                    )}
                  >
                    {sceneBusyId === editingId ? "⏳ Genero…" : `🎨 Genera immagine di scena (${styleOf(sceneStyle).label})`}
                  </button>
                  <div className="sumadm-scene-gen-styles">
                    {Object.entries(SCENE_STYLES).map(([key, s]) => (
                      <button
                        key={key}
                        type="button"
                        className={`sumadm-style-chip ${sceneStyle === key ? "on" : ""}`}
                        disabled={!!sceneBusyId || !!pending}
                        onClick={() => setSceneStyle(key)}
                      >
                        <span aria-hidden>{s.icon}</span> {s.label}
                      </button>
                    ))}
                  </div>
                  <small className="sumadm-gallery-hint">
                    Estrae una scena a caso dal testo e la illustra con i PG del gruppo. Potrai tenerla o rigenerarla.
                  </small>
                </div>
              )}
              <MultiDropZone
                uploading={galleryUploading}
                onFiles={onGalleryFiles}
              />
              {(formData.images || []).length > 0 && (
                <>
                  <div className="sumadm-gallery-strip">
                    {formData.images.map((url, i) => (
                      <div key={url + i} className="sumadm-gallery-thumb">
                        <img src={url} alt="" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                        <button
                          type="button"
                          className="sumadm-gallery-remove"
                          title="Rimuovi"
                          onClick={() => removeGalleryImage(url)}
                        >
                          ✕
                        </button>
                        <div className="sumadm-gallery-order">
                          <button
                            type="button"
                            title="Sposta a sinistra"
                            disabled={i === 0}
                            onClick={() => moveGalleryImage(i, -1)}
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            title="Sposta a destra"
                            disabled={i === formData.images.length - 1}
                            onClick={() => moveGalleryImage(i, +1)}
                          >
                            ▶
                          </button>
                        </div>
                        {isEditing && editingId && (
                          <button
                            type="button"
                            className="sumadm-gallery-regen"
                            title="Rigenera questa immagine con l'AI"
                            disabled={!!sceneBusyId || !!pending}
                            onClick={() => startSceneGeneration(
                              summaries.find((s) => s.id === editingId) || { id: editingId, ...formData },
                              i,
                            )}
                          >
                            ♻️
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <small className="sumadm-gallery-hint">Usa ◀ ▶ per l'ordine · ♻️ rigenera con l'AI · l'ordine si salva con “Salva modifiche”.</small>
                </>
              )}
            </div>

            <div className="sumadm-actions">
              <button type="submit" disabled={uploading} className="sumadm-btn primary">
                {uploading ? "⏳ Upload…" : isEditing ? "💾 Salva modifiche" : "🪄 Crea riassunto"}
              </button>
              {isEditing && (
                <button type="button" onClick={handleReset} className="sumadm-btn ghost">Annulla</button>
              )}
            </div>
          </form>
        </section>

        {/* LIVE PREVIEW */}
        <aside className="sumadm-preview">
          <div className="sumadm-card-head">
            <h2>👁 Anteprima</h2>
            <small>Come apparirà nelle Memorie</small>
          </div>
          <div className="sumadm-preview-card">
            {formData.coverImage ? (
              <div className="sumadm-preview-cover">
                <img src={formData.coverImage} alt="" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
              </div>
            ) : (
              <div className="sumadm-preview-cover empty">
                <span>📜</span>
                <small>Nessuna copertina</small>
              </div>
            )}
            <div className="sumadm-preview-body">
              <div className="sumadm-preview-meta">
                <span
                  className="sumadm-preview-party"
                  style={{ background: previewParty.color }}
                >
                  {previewParty.label}
                </span>
                {formData.date && <span className="sumadm-preview-date">{formData.date}</span>}
              </div>
              <h3 className="sumadm-preview-title">{formData.title || "Titolo della sessione"}</h3>
              {formData.subTitle && <p className="sumadm-preview-sub">{formData.subTitle}</p>}
              {formData.content ? (
                <div
                  className="sumadm-preview-content"
                  dangerouslySetInnerHTML={{ __html: formData.content }}
                />
              ) : (
                <p className="sumadm-preview-content placeholder">La cronaca apparirà qui…</p>
              )}
              {(formData.images || []).length > 0 && (
                <div className="summary-gallery">
                  {formData.images.map((url, i) => (
                    <a key={url + i} href={url} target="_blank" rel="noopener noreferrer" className="summary-gallery-item">
                      <img src={url} alt="" loading="lazy" onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── ARCHIVE ── */}
      <section className="sumadm-archive">
        <div className="sumadm-archive-head">
          <h2>📚 Archivio Riassunti <small>({filteredSummaries.length}/{summaries.length})</small></h2>
          <input
            type="search"
            className="admin-field-input sumadm-search"
            placeholder="🔍 Cerca per titolo, sottotitolo o data…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sumadm-style-bar">
          <span className="sumadm-style-label">🎨 Stile immagini AI</span>
          <div className="sumadm-style-chips">
            {Object.entries(SCENE_STYLES).map(([key, s]) => (
              <button
                key={key}
                type="button"
                className={`sumadm-style-chip ${sceneStyle === key ? "on" : ""}`}
                onClick={() => setSceneStyle(key)}
              >
                <span aria-hidden>{s.icon}</span> {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sumadm-filter-tabs">
          <button
            className={`sumadm-filter ${filter === "all" ? "on" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tutti
          </button>
          {PARTIES.map((p) => (
            <button
              key={p.key}
              className={`sumadm-filter ${filter === p.key ? "on" : ""}`}
              onClick={() => setFilter(p.key)}
              style={filter === p.key ? { background: p.color, borderColor: p.color, color: "#fff" } : { borderColor: p.color, color: p.color }}
            >
              {p.key}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="sumadm-empty">Caricamento memorie…</p>
        ) : filteredSummaries.length === 0 ? (
          <p className="sumadm-empty">Nessun riassunto trovato.</p>
        ) : (
          <div className="sumadm-grid">
            {filteredSummaries.map((s) => (
              <article key={s.id} className="sumadm-item" style={{ "--party-color": partyColor(s.party) }}>
                <div className="sumadm-item-cover">
                  {s.coverImage ? (
                    <img src={s.coverImage} alt={s.title} onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                  ) : (
                    <div className="sumadm-item-noimg">📜</div>
                  )}
                  <span className="sumadm-item-order">#{s.order || "—"}</span>
                  <span className="sumadm-item-party" style={{ background: partyColor(s.party) }}>
                    {s.party}
                  </span>
                </div>
                <div className="sumadm-item-body">
                  <h4 className="sumadm-item-title">{s.title}</h4>
                  {s.subTitle && <p className="sumadm-item-sub">{s.subTitle}</p>}
                  <div className="sumadm-item-foot">
                    {s.date && <span>📅 {s.date}</span>}
                    <span title="Visite totali">👁 {s.viewCount || 0}</span>
                  </div>
                  {s.content && (
                    <p className="sumadm-item-snippet">
                      {stripHtml(s.content).slice(0, 110)}{stripHtml(s.content).length > 110 ? "…" : ""}
                    </p>
                  )}
                </div>
                <div className="sumadm-item-actions">
                  <button
                    onClick={() => startSceneGeneration(s)}
                    className="sumadm-icon scene"
                    title={`Genera un'immagine di scena (${styleOf(sceneStyle).label}) con i PG del gruppo`}
                    disabled={!!sceneBusyId || !!pending}
                  >
                    {sceneBusyId === s.id ? "⏳" : "🎨"}
                  </button>
                  <button onClick={() => handleEdit(s)} className="sumadm-icon edit" title="Modifica">✎</button>
                  <button onClick={() => handleDelete(s)} className="sumadm-icon danger" title="Elimina">🗑</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── ANTEPRIMA SCENA: tieni / rigenera ── */}
      {pending && (
        <div className="sumadm-scene-backdrop" onClick={discardPending}>
          <div className="sumadm-scene-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sumadm-scene-head">
              <h3>{pending.target === "cover" ? "🖼 Copertina della sessione" : pending.index == null ? "🎨 Nuova immagine di scena" : "♻️ Rigenera immagine"}</h3>
              <button className="sumadm-scene-x" onClick={discardPending} disabled={!!sceneBusyId} title="Chiudi">✕</button>
            </div>

            <div className="sumadm-scene-figure">
              <img src={pending.dataUrl} alt="Anteprima scena generata" />
              {sceneBusyId && (
                <div className="sumadm-scene-loading">
                  <span className="sumadm-drop-spinner" />
                  <strong>Elaboro…</strong>
                </div>
              )}
            </div>

            {pending.scena && <p className="sumadm-scene-caption">“{pending.scena}”</p>}

            <div className="sumadm-scene-styles">
              {Object.entries(SCENE_STYLES).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  className={`sumadm-style-chip ${pending.style === key ? "on" : ""}`}
                  onClick={() => setPendingStyle(key)}
                  disabled={!!sceneBusyId}
                >
                  <span aria-hidden>{s.icon}</span> {s.label}
                </button>
              ))}
            </div>

            <div className="sumadm-scene-actions">
              <button className="sumadm-btn primary" onClick={commitPending} disabled={!!sceneBusyId}>
                ✅ Tieni
              </button>
              <button className="sumadm-btn" onClick={regeneratePending} disabled={!!sceneBusyId}>
                🔄 Rigenera
              </button>
              <button className="sumadm-btn ghost" onClick={discardPending} disabled={!!sceneBusyId}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
