import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { db, storage } from "../firebase";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { logAgent } from "../utils/agentLog";
import "../GeneraNPC.css";
import "./DmTools.css";
import "./admin.css";

// Gruppi di gioco (chiavi come lo Scriptorium/SummaryAdmin) con i membri e i
// loro avatar (stessi asset di Party.jsx), usati come riferimento per le immagini.
const PARTIES = [
  { key: "AMEA",  label: "AMEA",  members: [
    { name: "Garroth", image: "/assets/player/garroth2.png" },
    { name: "Tanagar", image: "/assets/player/Tanagar2.png" },
    { name: "Caius",   image: "/assets/player/caius2.jpeg" },
  ] },
  { key: "LAC",   label: "LAC",   members: [
    { name: "Horn",   image: "/assets/player/Horn.jpg" },
    { name: "Thoki",  image: "/assets/player/Thoki.jpg" },
    { name: "Cleofe", image: "/assets/player/Cleofe.jpg" },
  ] },
  { key: "LEAF",  label: "LEAF",  members: [
    { name: "Soran",  image: "/assets/player/Soran.png" },
    { name: "Zethir", image: "/assets/player/Zethir.jpeg" },
    { name: "Aksel",  image: "/assets/player/Aksel.png" },
    { name: "Dago",   image: "/assets/player/dago.jpeg" },
  ] },
  { key: "ENOX",  label: "ENOX",  members: [
    { name: "Makenna",    image: "/assets/player/Makenna.jpeg" },
    { name: "Temistocle", image: "/assets/player/Temistocle.jpeg" },
    { name: "Alaric",     image: "/assets/player/alaric.png" },
    { name: "Lael",       image: "/assets/player/lael.jpg" },
  ] },
  { key: "Unico", label: "Storia del Mondo", members: [] },
];
const membersOf = (key) => PARTIES.find((p) => p.key === key)?.members || [];
const rosterOf = (key) => membersOf(key).map((m) => m.name).join(", ");

// Converte un'immagine (anche asset relativo) in data URL ridotto: così gli
// avatar viaggiano inline verso l'API (i path relativi non sono scaricabili
// lato server) e restano leggeri per Gemini.
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

// Stili illustrativi selezionabili per le immagini della cronaca.
const IMG_STYLES = [
  { key: "darkcomic", label: "Dark Comic", suffix: "Dark-fantasy comic-book / graphic-novel art, bold inked outlines, dramatic cel shading, high-contrast moody lighting, gritty atmosphere, rich saturated accents." },
  { key: "olio",      label: "Olio epico", suffix: "Epic oil painting, cinematic dramatic lighting, rich painterly brushwork, deep colors, classic fantasy book illustration." },
  { key: "acquerello", label: "Acquerello", suffix: "Fantasy watercolor illustration, soft blended washes, delicate bleeding edges, luminous muted colors, hand-painted on rough paper." },
];
// Compone il prompt scena + stile scelto (coerente con le memorie esistenti).
const scenePromptFull = (scena, styleKey) => {
  const s = IMG_STYLES.find((x) => x.key === styleKey) || IMG_STYLES[0];
  return `${String(scena || "").trim()}. ${s.suffix} No text, no lettering, no speech bubbles, no frame, no border.`;
};

const CONTINENTI = ["Vathriddon", "Ehkia", "Ohzkie"];

// Prompt di default per la COPERTINA del luogo (vista scenografica, NON una mappa).
const cityCoverPrompt = (c) => {
  if (!c) return "";
  const firstLine = String(c.descrizione || "").split(/(?<=[.!?])\s/)[0] || "";
  return `Establishing wide landscape shot of ${c.nome || "a settlement"}, a ${c.dimensione || "town"} — ${c.carattere || ""}. ${firstLine}`.trim();
};

// Compone la descrizione HTML del luogo (stessa resa dell'Atlante — geo_archive).
const buildCityHtml = (c) => {
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const field = (label, val) => (val ? `<p><strong>${label}:</strong> ${esc(val)}</p>` : "");
  const parts = [];
  if (c.descrizione) parts.push(`<p>${esc(c.descrizione)}</p>`);
  parts.push(field("Dimensione", c.dimensione));
  parts.push(field("Carattere", c.carattere));
  parts.push(field("Governo", c.capo ? `${c.governo} — ${c.capo}` : c.governo));
  parts.push(field("Difesa", c.difesa));
  parts.push(field("Religione", c.religione));
  parts.push(field("Economia", c.economia));
  if ((c.luoghi || []).length) {
    parts.push("<p><strong>Luoghi notevoli</strong></p><ul>");
    c.luoghi.forEach((l) => parts.push(`<li><strong>${esc(l.nome)}</strong> — ${esc(l.tipo)}: ${esc(l.descrizione)}</li>`));
    parts.push("</ul>");
  }
  // NB: i "ganci narrativi" NON vengono salvati (solo a schermo per il Master).
  return parts.filter(Boolean).join("\n");
};

// 4 stili per la MAPPA (cartografica) e 4 per la COPERTINA (illustrazione scenografica).
const MAP_STYLES = [
  { key: "antica",     label: "Cartografia antica", suffix: "Hand-drawn antique cartography, aged parchment texture, ink linework with soft watercolor washes, muted sepia and earth tones, old-world map feel." },
  { key: "realistica", label: "Vista realistica",   suffix: "Realistic top-down bird's-eye rendering, detailed rooftops and terrain, soft natural daylight, semi-photographic painterly finish." },
  { key: "inchiostro", label: "Inchiostro B&N",     suffix: "Black and white ink illustration, fine cross-hatching, high contrast, classic RPG rulebook line-art map, monochrome, no color." },
  { key: "colorata",   label: "Fantasy colorata",   suffix: "Vibrant colored fantasy game map, clean stylized shapes, saturated palette, crisp digital illustration, boardgame-style clarity." },
];
const COVER_STYLES = [
  { key: "olio",       label: "Olio epico",   suffix: "Epic oil painting, cinematic dramatic lighting, rich painterly brushwork, deep colors, classic fantasy book illustration." },
  { key: "darkcomic",  label: "Dark Comic",   suffix: "Dark-fantasy comic-book / graphic-novel art, bold inked outlines, dramatic cel shading, high-contrast moody lighting, gritty atmosphere." },
  { key: "acquerello", label: "Acquerello",   suffix: "Fantasy watercolor illustration, soft blended washes, delicate bleeding edges, luminous muted colors, hand-painted on rough paper." },
  { key: "concept",    label: "Concept art",  suffix: "Cinematic concept art, wide establishing vista, atmospheric depth, volumetric light, highly detailed digital matte painting." },
];
const styleSuffix = (list, key) => (list.find((s) => s.key === key) || list[0]).suffix;

/* ============================================================
   Strumenti DM — un'unica pagina con 3 strumenti:
   Incontri, Loot, Città (descrizione + mappa AI).
   Cervello: /api/dm-tools (Claude). Mappa: /api/genera-immagine.
   Visivamente identico a GeneraNPC.jsx.
   ============================================================ */

const API = "/api/dm-tools";

export default function DmTools() {
  const [tab, setTab]   = useState("incontro");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState("");
  const [out, setOut]   = useState(null);

  const [enc,  setEnc]  = useState({ zona: "una strada nella foresta di Eldoria", livelloParty: 5, numPg: 4, momento: "giorno", difficolta: "media" });
  const [loot, setLoot] = useState({ fonte: "tesoro", riferimento: "drago giovane", livelloMedio: 5, tema: "vario" });
  const [city, setCity] = useState({ nome: "", dimensione: "cittadina", carattere: "porto commerciale sul fiume", note: "" });

  const [mapPrompt, setMapPrompt] = useState("");
  const [mapImg,    setMapImg]    = useState(null);
  const [mapBusy,   setMapBusy]   = useState(false);

  // ── Città: continente, copertina (NON è la mappa) e salvataggio nell'Atlante ──
  const [cityContinent, setCityContinent] = useState("Vathriddon");
  const [coverPrompt,   setCoverPrompt]   = useState("");
  const [coverImg,      setCoverImg]      = useState(null);
  const [coverBusy,     setCoverBusy]     = useState(false);
  const [mapStyle,      setMapStyle]      = useState("antica");
  const [coverStyle,    setCoverStyle]    = useState("olio");
  const [citySaving,    setCitySaving]    = useState(false);
  const [citySaved,     setCitySaved]     = useState(false);
  const [cityMsg,       setCityMsg]       = useState("");

  // ── Tab "Cronaca" (riassunto di sessione) ──
  const [ria, setRia]           = useState({ party: "AMEA", date: "", linee: "" });
  const [riaOut, setRiaOut]     = useState(null);   // { title, subTitle, contentHtml, scenePrompt }
  const [riaBusy, setRiaBusy]   = useState(false);
  const [riaMsg, setRiaMsg]     = useState("");
  const [scena, setScena]       = useState("");        // prompt scena (modificabile)
  const [imgStyle, setImgStyle] = useState("darkcomic");// stile illustrativo
  const [gallery, setGallery]   = useState([]);        // [{ url:dataURL, cover:bool }]
  const [sceneIdx, setSceneIdx] = useState(0);         // scorre le scene suggerite
  const [imgBusy, setImgBusy]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [allSummaries, setAllSummaries] = useState([]);
  const [refOff, setRefOff]     = useState({});        // { [name]: true } = escluso dai riferimenti

  // Carica una volta l'elenco riassunti (per numero di sessione + ordine).
  useEffect(() => {
    getDocs(collection(db, "summaries"))
      .then((snap) => setAllSummaries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  const sessionNumber = allSummaries.filter((s) => (s.party || "AMEA") === ria.party).length + 1;

  // Membri del gruppo selezionato = avatar di riferimento per le immagini.
  const partyChars = membersOf(ria.party);

  const resultRef = useRef(null);
  useEffect(() => {
    if (out && resultRef.current && window.innerWidth < 840) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [out]);

  async function generate() {
    setBusy(true); setMsg("Sto generando…"); setOut(null); setMapImg(null); setMapPrompt("");
    setCoverImg(null); setCoverPrompt(""); setCitySaved(false); setCityMsg("");
    let input = tab === "incontro" ? enc : tab === "loot" ? loot : city;
    // Città: allega gli NPC già creati in questa località, così Claude usa i
    // personaggi salvati (re, locandieri, ecc.) invece di inventarli.
    if (tab === "citta" && city.nome?.trim()) {
      try {
        const snap = await getDocs(collection(db, "npcs"));
        const target = city.nome.trim().toLowerCase();
        const found = snap.docs.map((d) => d.data()).filter((n) => {
          const lc = (n.linkedCity || "").trim().toLowerCase();
          const loc = (n.location || "").trim().toLowerCase();
          return (lc && lc === target) || (loc && loc.includes(target)) || (target && (n.description || "").toLowerCase().includes(target));
        }).map((n) => ({
          name: n.name || "",
          location: n.location || "",
          faction: n.faction || "",
          description: n.description || "",
        }));
        if (found.length) {
          input = { ...city, npcs: found };
          setMsg(`Sto generando… (uso ${found.length} PNG già salvati in ${city.nome.trim()})`);
        }
      } catch { /* se il fetch NPC fallisce, genera comunque senza */ }
    }
    try {
      const r = await fetch(API, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: tab, input })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setOut(data); setMsg("");
      if (tab === "citta") {
        if (data.mapPrompt) setMapPrompt(data.mapPrompt);
        setCoverPrompt(cityCoverPrompt(data));
      }
      const etichetta = tab === "incontro" ? "Incontro" : tab === "loot" ? "Loot" : "Città";
      logAgent("dm-tools", "success", `${etichetta} generato (${data.nome || data.titolo || tab})`, { tipo: tab }, { count: true });
    } catch (e) {
      setMsg("Errore: " + e.message);
      logAgent("dm-tools", "error", e.message, { tipo: tab });
    } finally { setBusy(false); }
  }

  async function generaMappa() {
    if (!mapPrompt.trim()) return;
    setMapBusy(true); setMapImg(null);
    try {
      const fullPrompt = `${mapPrompt.trim()}. ${styleSuffix(MAP_STYLES, mapStyle)} No text, no lettering, no labels, no grid, no border.`;
      const r = await fetch("/api/genera-immagine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setMapImg(data.immagine);
      logAgent("genera-immagine", "success", `Mappa città generata`, {}, { count: true });
    } catch (e) {
      setMsg("Errore mappa: " + e.message);
      logAgent("genera-immagine", "error", e.message);
    } finally { setMapBusy(false); }
  }

  function copyPrompt() {
    navigator.clipboard?.writeText(mapPrompt);
    setMsg("Prompt copiato.");
  }

  // Scarica la mappa generata (NON viene salvata online: serve al Master su Foundry).
  function scaricaMappa() {
    if (!mapImg) return;
    const a = document.createElement("a");
    a.href = mapImg;
    a.download = `mappa-${(out?.nome || "citta").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Genera la COPERTINA del luogo (immagine scenografica, diversa dalla mappa).
  async function generaCopertina() {
    if (!coverPrompt.trim()) return;
    setCoverBusy(true); setCoverImg(null); setCityMsg("");
    try {
      const fullPrompt = `${coverPrompt.trim()}. ${styleSuffix(COVER_STYLES, coverStyle)} No text, no lettering, no map, no grid, no frame, no border.`;
      const r = await fetch("/api/genera-immagine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setCoverImg(data.immagine);
      setCitySaved(false);
      logAgent("genera-immagine", "success", "Copertina città generata", {}, { count: true });
    } catch (e) {
      setCityMsg("Errore copertina: " + e.message);
      logAgent("genera-immagine", "error", e.message);
    } finally { setCoverBusy(false); }
  }

  // Salva il luogo generato nell'Atlante (geo_archive), nel continente scelto.
  // La copertina (se generata) viene caricata su Storage; la mappa NON viene salvata.
  async function salvaCitta() {
    if (!out || tab !== "citta" || citySaving) return;
    if (!out.nome?.trim()) { setCityMsg("La città non ha un nome: rigenera."); return; }
    setCitySaving(true); setCityMsg("Salvo nell'Atlante…");
    try {
      let imageUrl = "";
      if (coverImg?.startsWith("data:")) {
        const safe = (out.nome.trim() || "luogo").replace(/[^a-z0-9._-]/gi, "_").slice(0, 36);
        const path = `geo-archive/${Date.now()}-${safe}.png`;
        const sref = storageRef(storage, path);
        await uploadString(sref, coverImg, "data_url");
        imageUrl = await getDownloadURL(sref);
      }
      const docId = out.nome.trim().replace(/\s+/g, "_").toLowerCase();
      await setDoc(doc(db, "geo_archive", docId), {
        name: out.nome.trim(),
        image: imageUrl,
        description: buildCityHtml(out),
        continent: cityContinent,
        pointsOfInterest: [],
        generato: true,
        createdAt: new Date().toISOString(),
      });
      setCitySaved(true);
      setCityMsg(`✅ "${out.nome.trim()}" salvato in ${cityContinent} (Atlante dei Mondi).`);
      logAgent("dm-tools", "success", `Luogo salvato nell'Atlante (${out.nome.trim()} · ${cityContinent})`, {}, { count: true });
    } catch (e) {
      setCityMsg("Errore salvataggio: " + e.message);
    } finally { setCitySaving(false); }
  }

  // ── Cronaca: genera / rigenera il riassunto dalle linee guida ──
  async function generaCronaca() {
    if (!ria.linee.trim()) { setRiaMsg("Scrivi prima le linee guida della sessione."); return; }
    setRiaBusy(true); setRiaMsg("Il Monaco Errante sta scrivendo…"); setSaved(false);
    try {
      const r = await fetch("/api/genera-riassunto", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ party: ria.party, roster: rosterOf(ria.party), date: ria.date, linee: ria.linee })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setRiaOut(data);
      setScena((data.scenePrompts && data.scenePrompts[0]) || data.scenePrompt || "");
      setSceneIdx(1); // la prossima "scena casuale" pesca la 2ª scena
      setGallery([]);
      setRiaMsg("");
      logAgent("genera-riassunto", "success", `Cronaca generata (${data.title || ria.party})`, { party: ria.party }, { count: true });
    } catch (e) {
      setRiaMsg("Errore: " + e.message);
      logAgent("genera-riassunto", "error", e.message, { party: ria.party });
    } finally { setRiaBusy(false); }
  }

  // ── Cronaca: pesca una scena DIVERSA tra quelle suggerite e la genera ──
  function scenaCasuale() {
    const list = (riaOut?.scenePrompts && riaOut.scenePrompts.length)
      ? riaOut.scenePrompts
      : (riaOut?.scenePrompt ? [riaOut.scenePrompt] : []);
    if (!list.length) { generaScena(scena); return; }
    const picked = list[sceneIdx % list.length];
    setSceneIdx((i) => i + 1);
    setScena(picked);       // mostra nel riquadro quale scena è stata scelta
    generaScena(picked);
  }

  // ── Cronaca: genera una nuova immagine di scena (si accoda alla galleria) ──
  // scenaText: se fornito usa quello; altrimenti il testo del riquadro.
  async function generaScena(scenaText) {
    const base = String(scenaText != null ? scenaText : scena).trim();
    if (!base) { setRiaMsg("Descrivi una scena (o usa quella suggerita) per l'immagine."); return; }
    setImgBusy(true); setRiaMsg("");
    try {
      // Avatar attivi → data URL (ridotti) da passare come riferimento a Gemini.
      const attivi = partyChars.filter((c) => !refOff[c.name]);
      const refs = [];
      for (const c of attivi) {
        try { refs.push(await refToDataUrl(c.image)); } catch { /* avatar saltato */ }
      }
      const r = await fetch("/api/genera-immagine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: scenePromptFull(base, imgStyle), refs })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      // La prima immagine generata diventa copertina di default.
      setGallery((g) => [...g, { url: data.immagine, cover: g.length === 0 }]);
      logAgent("genera-immagine", "success", "Immagine cronaca generata", { party: ria.party, stile: imgStyle }, { count: true });
    } catch (e) {
      setRiaMsg("Errore immagine: " + e.message);
      logAgent("genera-immagine", "error", e.message);
    } finally { setImgBusy(false); }
  }

  const setCover = (idx) => setGallery((g) => g.map((im, i) => ({ ...im, cover: i === idx })));
  const removeImg = (idx) => setGallery((g) => {
    const next = g.filter((_, i) => i !== idx);
    if (next.length && !next.some((im) => im.cover)) next[0].cover = true; // garantisci una copertina
    return next;
  });

  // ── Cronaca: carica nelle Memorie (numero sessione + titolo automatici) ──
  async function caricaRiassunto() {
    if (!riaOut || saving) return;
    if (!riaOut.title?.trim()) { setRiaMsg("La cronaca non ha un titolo: rigenera."); return; }
    setSaving(true); setRiaMsg("Carico nelle Memorie…");
    try {
      // Le immagini (data URL base64) sono troppo grandi per Firestore → Storage.
      const safe = (riaOut.title.trim() || "cronaca").replace(/[^a-z0-9._-]/gi, "_").slice(0, 36);
      const uploaded = []; // { url, cover }
      for (let i = 0; i < gallery.length; i++) {
        const im = gallery[i];
        if (!im.url?.startsWith("data:")) continue;
        const path = `summaries/${Date.now()}-${i}-${safe}.png`;
        const sref = storageRef(storage, path);
        await uploadString(sref, im.url, "data_url");
        uploaded.push({ url: await getDownloadURL(sref), cover: im.cover });
      }
      // Copertina = quella scelta (o la prima); il resto va a fine riassunto.
      const coverEntry = uploaded.find((u) => u.cover) || uploaded[0] || null;
      const coverImage = coverEntry ? coverEntry.url : "";
      const images = uploaded.filter((u) => u.url !== coverImage).map((u) => u.url);
      // order globale = max+1 → la cronaca diventa l'ultima sessione del gruppo.
      const maxOrder = allSummaries.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0);
      const order = maxOrder + 1;
      const docId = `${ria.party}_${Date.now()}`;
      await setDoc(doc(db, "summaries", docId), {
        title: riaOut.title.trim(),
        subTitle: (riaOut.subTitle || "").trim(),
        party: ria.party,
        date: ria.date || "",
        content: riaOut.contentHtml || "",
        coverImage,
        images,
        order,
        generato: true,
        createdAt: new Date().toISOString(),
      });
      // aggiorna la cache locale così il prossimo numero di sessione è corretto
      setAllSummaries((prev) => [...prev, { id: docId, party: ria.party, order }]);
      setSaved(true);
      setRiaMsg(`✅ Sessione #${sessionNumber} del gruppo ${ria.party} archiviata nelle Memorie.`);
    } catch (e) {
      setRiaMsg("Errore salvataggio: " + e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="npcgen-page">
      <div className="npcgen-inner">
        <Link to="/dm-admin" className="adm-back">← Console del Master</Link>
        <h1 className="npcgen-title">Strumenti DM</h1>
        <p className="npcgen-sub">Genera al volo incontri, bottino e città per Eldoria.</p>

        {/* TAB */}
        <div className="dmt-tabs">
          {[["incontro", "⚔️ Incontri"], ["loot", "💰 Loot"], ["citta", "🏰 Città"], ["cronaca", "📜 Cronaca"]].map(([id, label]) => (
            <div key={id} className={"dmt-tab" + (tab === id ? " on" : "")}
              onClick={() => { setTab(id); setOut(null); setMsg(""); setMapImg(null); setCoverImg(null); setCitySaved(false); setCityMsg(""); }}>
              {label}
            </div>
          ))}
        </div>

        {/* FORM INCONTRO */}
        {tab === "incontro" && (<>
          <div className="dmt-field">
            <label className="npcgen-label">Zona / luogo</label>
            <input className="npcgen-input" value={enc.zona} onChange={e => setEnc({ ...enc, zona: e.target.value })} />
          </div>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Livello party</label>
              <input className="npcgen-input" type="number" value={enc.livelloParty} onChange={e => setEnc({ ...enc, livelloParty: e.target.value })} />
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">N° PG</label>
              <input className="npcgen-input" type="number" value={enc.numPg} onChange={e => setEnc({ ...enc, numPg: e.target.value })} />
            </div>
          </div>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Momento</label>
              <select className="npcgen-input" value={enc.momento} onChange={e => setEnc({ ...enc, momento: e.target.value })}>
                <option>giorno</option><option>notte</option><option>alba/tramonto</option>
              </select>
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">Difficoltà</label>
              <select className="npcgen-input" value={enc.difficolta} onChange={e => setEnc({ ...enc, difficolta: e.target.value })}>
                <option>facile</option><option>media</option><option>dura</option><option>mortale</option>
              </select>
            </div>
          </div>
        </>)}

        {/* FORM LOOT */}
        {tab === "loot" && (<>
          <div className="dmt-field">
            <label className="npcgen-label">Fonte del bottino</label>
            <select className="npcgen-input" value={loot.fonte} onChange={e => setLoot({ ...loot, fonte: e.target.value })}>
              <option>nemico singolo</option><option>gruppo di nemici</option><option>tesoro</option><option>mercante</option>
            </select>
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Riferimento di potere</label>
            <input className="npcgen-input" value={loot.riferimento} onChange={e => setLoot({ ...loot, riferimento: e.target.value })} placeholder="es. CR 3, drago giovane, bandito comune" />
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Livello medio del party</label>
            <input className="npcgen-input" type="number" value={loot.livelloMedio} onChange={e => setLoot({ ...loot, livelloMedio: e.target.value })} />
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Tema (facoltativo)</label>
            <input className="npcgen-input" value={loot.tema} onChange={e => setLoot({ ...loot, tema: e.target.value })} placeholder="es. necromanzia, pirati, nani" />
          </div>
        </>)}

        {/* FORM CITTÀ */}
        {tab === "citta" && (<>
          <div className="dmt-field">
            <label className="npcgen-label">Nome (lascia vuoto per inventarlo)</label>
            <input className="npcgen-input" value={city.nome} onChange={e => setCity({ ...city, nome: e.target.value })} />
          </div>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Dimensione</label>
              <select className="npcgen-input" value={city.dimensione} onChange={e => setCity({ ...city, dimensione: e.target.value })}>
                <option>villaggio</option><option>cittadina</option><option>città</option><option>metropoli</option>
              </select>
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">Carattere</label>
              <input className="npcgen-input" value={city.carattere} onChange={e => setCity({ ...city, carattere: e.target.value })} />
            </div>
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Dettagli extra (facoltativo)</label>
            <textarea className="npcgen-input" value={city.note} onChange={e => setCity({ ...city, note: e.target.value })}
              placeholder="Qualcosa di specifico che vuoi nella città (un evento, un problema, un legame con la trama)…" />
          </div>
        </>)}

        {/* FORM CRONACA */}
        {tab === "cronaca" && (<>
          <div className="dmt-row">
            <div className="dmt-field">
              <label className="npcgen-label">Gruppo</label>
              <select className="npcgen-input" value={ria.party}
                onChange={e => { setRia({ ...ria, party: e.target.value }); }}>
                {PARTIES.map(p => (
                  <option key={p.key} value={p.key}>{p.members.length ? `${p.key} (${rosterOf(p.key)})` : p.label}</option>
                ))}
              </select>
            </div>
            <div className="dmt-field">
              <label className="npcgen-label">Data (in gioco)</label>
              <input className="npcgen-input" value={ria.date} placeholder="14 di Eldarin 1852"
                onChange={e => setRia({ ...ria, date: e.target.value })} />
            </div>
          </div>
          <div className="dmt-field">
            <label className="npcgen-label">Linee guida — cosa è successo nell'ultima sessione</label>
            <textarea className="npcgen-input" rows={8} value={ria.linee}
              onChange={e => setRia({ ...ria, linee: e.target.value })}
              placeholder="Elenca gli eventi salienti: dove sono andati, chi hanno incontrato, cosa hanno scoperto, i colpi di scena, come si è chiusa la sessione… Il Monaco Errante li trasformerà in cronaca." />
            <small className="dmt-hint">Sessione automatica: <b>#{sessionNumber}</b> del gruppo {ria.party}. Titolo e numero vengono assegnati al momento del caricamento.</small>
          </div>
          <button className="npcgen-btn" style={{ marginTop: 20 }} onClick={generaCronaca} disabled={riaBusy}>
            {riaBusy ? "Sto scrivendo…" : riaOut ? "↻ Rigenera cronaca" : "⚒ Genera cronaca"}
          </button>
        </>)}

        {tab !== "cronaca" && (<>
          <button className="npcgen-btn" style={{ marginTop: 20 }} onClick={generate} disabled={busy}>
            {busy ? "Sto generando…" : "⚒ Genera"}
          </button>
          <div className={`npcgen-status${msg.startsWith("Errore") ? " npcgen-status--error" : ""}`}>{msg}</div>
        </>)}

        {tab === "cronaca" && riaMsg && (
          <div className={`npcgen-status${riaMsg.startsWith("Errore") ? " npcgen-status--error" : ""}`}>{riaMsg}</div>
        )}

        {/* RISULTATI */}
        <div ref={resultRef} className="dmt-result">

          {out && tab === "incontro" && (
            <div className="npcgen-card">
              <p className="npcgen-name">{out.titolo}</p>
              <p className="npcgen-role">{out.difficolta} · {out.ambiente}</p>
              <hr className="npcgen-divider" />
              <p className="npcgen-k">Nemici</p>
              {(out.nemici || []).map((n, i) => (
                <div className="dmt-li" key={i}>
                  <div className="n"><b>×{n.numero}</b> {n.nome}</div>
                  {n.note && <div className="d">{n.note}</div>}
                </div>
              ))}
              <p className="npcgen-k">Tattica</p><p className="npcgen-v">{out.tattica}</p>
              <p className="npcgen-k">Colpo di scena</p><p className="npcgen-v">{out.colpo_di_scena}</p>
              <p className="npcgen-k">Ricompensa</p><p className="npcgen-v">{out.ricompensa}</p>
            </div>
          )}

          {out && tab === "loot" && (
            <div className="npcgen-card">
              <p className="npcgen-k">Monete</p><p className="npcgen-v">{out.monete}</p>
              <p className="npcgen-k">Oggetti</p>
              {(out.oggetti || []).map((o, i) => (
                <div className="dmt-li" key={i}>
                  <div className="n">{o.nome}<span className="npcgen-chip dmt-pill">{o.rarita}</span></div>
                  {o.descrizione && <div className="d">{o.descrizione}</div>}
                </div>
              ))}
              {out.nota && (<><p className="npcgen-k">Nota</p><p className="npcgen-v">{out.nota}</p></>)}
            </div>
          )}

          {out && tab === "citta" && (
            <div className="npcgen-card">
              <p className="npcgen-name">{out.nome}</p>
              <p className="npcgen-role">{out.dimensione} · {out.carattere}</p>
              <hr className="npcgen-divider" />
              <p className="npcgen-v">{out.descrizione}</p>
              <p className="npcgen-k">Governo</p><p className="npcgen-v">{out.governo}{out.capo ? ` — ${out.capo}` : ""}</p>
              {out.difesa && <><p className="npcgen-k">Difesa</p><p className="npcgen-v">{out.difesa}</p></>}
              <p className="npcgen-k">Religione</p><p className="npcgen-v">{out.religione}</p>
              <p className="npcgen-k">Economia</p><p className="npcgen-v">{out.economia}</p>
              {(out.luoghi || []).length > 0 && (<>
                <p className="npcgen-k">Luoghi notevoli</p>
                {out.luoghi.map((l, i) => (
                  <div className="dmt-li" key={i}>
                    <div className="n"><b>{l.nome}</b> — {l.tipo}</div>
                    <div className="d">{l.descrizione}</div>
                  </div>
                ))}
              </>)}
              {(out.ganci || []).length > 0 && (<>
                <p className="npcgen-k">Ganci narrativi</p>
                {out.ganci.map((g, i) => <p className="npcgen-v" key={i}>• {g}</p>)}
              </>)}
              <p className="npcgen-k">Mappa per Foundry <small>(non viene salvata: scaricala tu)</small></p>
              <textarea className="npcgen-input dmt-prompt" rows={8} value={mapPrompt} onChange={e => setMapPrompt(e.target.value)} />
              <div className="dmt-style-row">
                {MAP_STYLES.map((s) => (
                  <button key={s.key} type="button"
                    className={"dmt-style" + (mapStyle === s.key ? " on" : "")}
                    onClick={() => setMapStyle(s.key)}>{s.label}</button>
                ))}
              </div>
              <button className="npcgen-btn npcgen-btn--ghost" style={{ marginTop: 10 }} onClick={copyPrompt}>📋 Copia prompt</button>
              <button className="npcgen-btn npcgen-btn--ghost" style={{ marginTop: 8 }} onClick={generaMappa} disabled={mapBusy}>
                {mapBusy ? "Sto disegnando la mappa…" : "🗺️ Genera mappa"}
              </button>
              {mapImg && <>
                <img className="npcgen-img" src={mapImg} alt={"Mappa di " + out.nome} />
                <button className="npcgen-btn npcgen-btn--ghost" style={{ marginTop: 8 }} onClick={scaricaMappa}>⬇️ Scarica mappa</button>
              </>}

              <hr className="npcgen-divider" />

              {/* ── SALVATAGGIO NELL'ATLANTE ── */}
              <p className="npcgen-k">Copertina del luogo <small>(immagine mostrata nell'Atlante — non è la mappa)</small></p>
              <textarea className="npcgen-input dmt-prompt" rows={4} value={coverPrompt} onChange={e => setCoverPrompt(e.target.value)}
                placeholder="Descrizione (in inglese) della copertina scenografica del luogo." />
              <div className="dmt-style-row">
                {COVER_STYLES.map((s) => (
                  <button key={s.key} type="button"
                    className={"dmt-style" + (coverStyle === s.key ? " on" : "")}
                    onClick={() => setCoverStyle(s.key)}>{s.label}</button>
                ))}
              </div>
              <button className="npcgen-btn npcgen-btn--ghost" style={{ marginTop: 8 }} onClick={generaCopertina} disabled={coverBusy || !coverPrompt.trim()}>
                {coverBusy ? "Sto disegnando la copertina…" : "🖼 Genera copertina"}
              </button>
              {coverImg && <img className="npcgen-img" src={coverImg} alt={"Copertina di " + out.nome} />}

              <div className="dmt-row" style={{ marginTop: 12 }}>
                <div className="dmt-field">
                  <label className="npcgen-label">Continente</label>
                  <select className="npcgen-input" value={cityContinent} onChange={e => setCityContinent(e.target.value)}>
                    {CONTINENTI.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button className="npcgen-btn" style={{ marginTop: 12 }} onClick={salvaCitta} disabled={citySaving || citySaved}>
                {citySaving ? "Salvo…" : citySaved ? "✅ Salvato nell'Atlante" : "💾 Salva luogo nell'Atlante"}
              </button>
              {cityMsg && (
                <div className={`npcgen-status${cityMsg.startsWith("Errore") ? " npcgen-status--error" : ""}`}>{cityMsg}</div>
              )}
            </div>
          )}

          {tab === "cronaca" && riaOut && (
            <div className="npcgen-card dmt-cronaca">
              {gallery.find((im) => im.cover) && (
                <img className="npcgen-img dmt-cronaca-cover" src={gallery.find((im) => im.cover).url} alt={"Copertina — " + riaOut.title} />
              )}
              <p className="dmt-cronaca-eyebrow">❦ Cronache di Eldoria · Gruppo {ria.party}{ria.date ? ` · ${ria.date}` : ""}</p>
              <p className="npcgen-name">{riaOut.title}</p>
              {riaOut.subTitle && <p className="npcgen-role">{riaOut.subTitle}</p>}
              <hr className="npcgen-divider" />
              <div className="dmt-cronaca-body rs-summary-html" dangerouslySetInnerHTML={{ __html: riaOut.contentHtml }} />

              {/* IMMAGINI DELLA CRONACA */}
              <p className="npcgen-k">Immagini della cronaca</p>

              <div className="dmt-style-row">
                {IMG_STYLES.map((s) => (
                  <button key={s.key} type="button"
                    className={"dmt-style" + (imgStyle === s.key ? " on" : "")}
                    onClick={() => setImgStyle(s.key)}>{s.label}</button>
                ))}
              </div>

              {partyChars.length > 0 && (<>
                <small className="dmt-hint">Personaggi da usare come riferimento negli avatar (tocca per includere/escludere):</small>
                <div className="dmt-ref-row">
                  {partyChars.map((c) => (
                    <button key={c.name} type="button"
                      className={"dmt-ref" + (refOff[c.name] ? " off" : "")}
                      title={c.name}
                      onClick={() => setRefOff((o) => ({ ...o, [c.name]: !o[c.name] }))}>
                      <img src={c.image} alt={c.name} onError={(e) => { e.target.src = "/assets/placeholder.jpg"; }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </>)}

              <textarea className="npcgen-input dmt-prompt" rows={4} value={scena}
                onChange={e => setScena(e.target.value)}
                placeholder="Descrivi (in inglese) la scena da illustrare, oppure usa quella suggerita dall'AI." />
              <div className="dmt-img-actions">
                <button className="npcgen-btn npcgen-btn--ghost" onClick={scenaCasuale} disabled={imgBusy}>
                  {imgBusy ? "Disegno…" : "🎲 Scena diversa"}
                </button>
                <button className="npcgen-btn npcgen-btn--ghost" onClick={() => generaScena()} disabled={imgBusy || !scena.trim()}>
                  {imgBusy ? "Disegno…" : "🖼 Genera questa scena"}
                </button>
              </div>

              {gallery.length > 0 && (
                <div className="dmt-gallery">
                  {gallery.map((im, i) => (
                    <div key={i} className={"dmt-gitem" + (im.cover ? " cover" : "")}>
                      <img src={im.url} alt={"scena " + (i + 1)} />
                      <div className="dmt-gitem-actions">
                        <button type="button" className={"dmt-gcover" + (im.cover ? " on" : "")}
                          onClick={() => setCover(i)}>{im.cover ? "★ Copertina" : "☆ Copertina"}</button>
                        <button type="button" className="dmt-grem" onClick={() => removeImg(i)} title="Rimuovi">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CARICA */}
              <button className="npcgen-btn" style={{ marginTop: 16 }} onClick={caricaRiassunto} disabled={saving || saved}>
                {saving ? "Carico…" : saved ? "✅ Caricato" : "📤 Carica nelle Memorie"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
