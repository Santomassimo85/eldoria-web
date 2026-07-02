import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { db, storage } from "../firebase";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { logAgent } from "../utils/agentLog";
import "../GeneraNPC.css";
import "./DmTools.css";
import "./admin.css";

// Gruppi di gioco (stesso elenco dello Scriptorium / SummaryAdmin).
const PARTIES = [
  { key: "AMEA",  label: "AMEA",  roster: "Garroth, Tanagar, Caius, Sylva" },
  { key: "LAC",   label: "LAC",   roster: "Horn, Thoki, Cleofe" },
  { key: "LEAF",  label: "LEAF",  roster: "Soran, Zenthir, Taaras" },
  { key: "ENOX",  label: "ENOX",  roster: "Makenna, Temistocle, Alaric, Lael" },
  { key: "ECO",   label: "ECO",   roster: "Aksel, Dago, Ismael" },
  { key: "Unico", label: "Storia del Mondo", roster: "Cronache globali" },
];
const rosterOf = (key) => PARTIES.find((p) => p.key === key)?.roster || "";

// Stile-cornice per la copertina della cronaca (coerente con le memorie esistenti).
const coverPrompt = (scena) =>
  `${String(scena || "").trim()}. Epic dark-fantasy chronicle illustration, painterly oil style, cinematic dramatic lighting, rich deep colors, no text, no lettering, no frame.`;

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

  // ── Tab "Cronaca" (riassunto di sessione) ──
  const [ria, setRia]           = useState({ party: "AMEA", date: "", linee: "" });
  const [riaOut, setRiaOut]     = useState(null);   // { title, subTitle, contentHtml, scenePrompt }
  const [riaBusy, setRiaBusy]   = useState(false);
  const [riaMsg, setRiaMsg]     = useState("");
  const [scena, setScena]       = useState("");     // prompt scena (modificabile)
  const [riaImg, setRiaImg]     = useState(null);   // data URL copertina
  const [imgBusy, setImgBusy]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [allSummaries, setAllSummaries] = useState([]);

  // Carica una volta l'elenco riassunti (per numero di sessione + ordine).
  useEffect(() => {
    getDocs(collection(db, "summaries"))
      .then((snap) => setAllSummaries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  const sessionNumber = allSummaries.filter((s) => (s.party || "AMEA") === ria.party).length + 1;

  const resultRef = useRef(null);
  useEffect(() => {
    if (out && resultRef.current && window.innerWidth < 840) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [out]);

  async function generate() {
    setBusy(true); setMsg("Sto generando…"); setOut(null); setMapImg(null); setMapPrompt("");
    const input = tab === "incontro" ? enc : tab === "loot" ? loot : city;
    try {
      const r = await fetch(API, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: tab, input })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setOut(data); setMsg("");
      if (tab === "citta" && data.mapPrompt) setMapPrompt(data.mapPrompt);
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
      const r = await fetch("/api/genera-immagine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: mapPrompt })
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
      setScena(data.scenePrompt || "");
      setRiaImg(null);
      setRiaMsg("");
      logAgent("genera-riassunto", "success", `Cronaca generata (${data.title || ria.party})`, { party: ria.party }, { count: true });
    } catch (e) {
      setRiaMsg("Errore: " + e.message);
      logAgent("genera-riassunto", "error", e.message, { party: ria.party });
    } finally { setRiaBusy(false); }
  }

  // ── Cronaca: genera / rifai l'immagine di copertina ──
  async function generaImmagineScena(usaSuggerita) {
    const base = usaSuggerita ? (riaOut?.scenePrompt || scena) : scena;
    if (!base.trim()) { setRiaMsg("Descrivi una scena (o usa quella suggerita) per l'immagine."); return; }
    if (usaSuggerita && riaOut?.scenePrompt) setScena(riaOut.scenePrompt);
    setImgBusy(true); setRiaMsg("");
    try {
      const r = await fetch("/api/genera-immagine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: coverPrompt(base) })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setRiaImg(data.immagine);
      logAgent("genera-immagine", "success", "Copertina cronaca generata", { party: ria.party }, { count: true });
    } catch (e) {
      setRiaMsg("Errore immagine: " + e.message);
      logAgent("genera-immagine", "error", e.message);
    } finally { setImgBusy(false); }
  }

  // ── Cronaca: carica nelle Memorie (numero sessione + titolo automatici) ──
  async function caricaRiassunto() {
    if (!riaOut || saving) return;
    if (!riaOut.title?.trim()) { setRiaMsg("La cronaca non ha un titolo: rigenera."); return; }
    setSaving(true); setRiaMsg("Carico nelle Memorie…");
    try {
      // Copertina: il data URL base64 è troppo grande per Firestore → va su Storage.
      let coverImage = "";
      if (riaImg && riaImg.startsWith("data:")) {
        const safe = (riaOut.title.trim() || "cronaca").replace(/[^a-z0-9._-]/gi, "_").slice(0, 36);
        const path = `summaries/${Date.now()}-${safe}.png`;
        const sref = storageRef(storage, path);
        await uploadString(sref, riaImg, "data_url");
        coverImage = await getDownloadURL(sref);
      }
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
        images: [],
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
              onClick={() => { setTab(id); setOut(null); setMsg(""); setMapImg(null); }}>
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
                  <option key={p.key} value={p.key}>{p.key === "Unico" ? p.label : `${p.key} (${p.roster})`}</option>
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
              <p className="npcgen-k">Difesa</p><p className="npcgen-v">{out.difesa}</p>
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
              <p className="npcgen-k">Prompt mappa (modificabile)</p>
              <textarea className="npcgen-input dmt-prompt" rows={8} value={mapPrompt} onChange={e => setMapPrompt(e.target.value)} />
              <button className="npcgen-btn npcgen-btn--ghost" style={{ marginTop: 10 }} onClick={copyPrompt}>📋 Copia prompt</button>
              <button className="npcgen-btn npcgen-btn--ghost" style={{ marginTop: 8 }} onClick={generaMappa} disabled={mapBusy}>
                {mapBusy ? "Sto disegnando la mappa…" : "🗺️ Genera mappa"}
              </button>
              {mapImg && <img className="npcgen-img" src={mapImg} alt={"Mappa di " + out.nome} />}
            </div>
          )}

          {tab === "cronaca" && riaOut && (
            <div className="npcgen-card dmt-cronaca">
              {riaImg && <img className="npcgen-img dmt-cronaca-cover" src={riaImg} alt={"Copertina — " + riaOut.title} />}
              <p className="dmt-cronaca-eyebrow">❦ Cronache di Eldoria · Gruppo {ria.party}{ria.date ? ` · ${ria.date}` : ""}</p>
              <p className="npcgen-name">{riaOut.title}</p>
              {riaOut.subTitle && <p className="npcgen-role">{riaOut.subTitle}</p>}
              <hr className="npcgen-divider" />
              <div className="dmt-cronaca-body rs-summary-html" dangerouslySetInnerHTML={{ __html: riaOut.contentHtml }} />

              {/* IMMAGINE DI COPERTINA */}
              <p className="npcgen-k">Immagine della cronaca</p>
              <textarea className="npcgen-input dmt-prompt" rows={4} value={scena}
                onChange={e => setScena(e.target.value)}
                placeholder="Descrivi (in inglese) la scena da illustrare, oppure usa quella suggerita dall'AI." />
              <div className="dmt-img-actions">
                <button className="npcgen-btn npcgen-btn--ghost" onClick={() => generaImmagineScena(true)} disabled={imgBusy}>
                  {imgBusy ? "Disegno…" : "🎲 Scena casuale"}
                </button>
                <button className="npcgen-btn npcgen-btn--ghost" onClick={() => generaImmagineScena(false)} disabled={imgBusy || !scena.trim()}>
                  {imgBusy ? "Disegno…" : riaImg ? "↻ Rifai immagine" : "🖼 Genera scena"}
                </button>
              </div>

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
