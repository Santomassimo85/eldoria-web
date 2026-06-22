import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { logAgent } from "../utils/agentLog";
import "../GeneraNPC.css";
import "./DmTools.css";
import "./admin.css";

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

  return (
    <div className="npcgen-page">
      <div className="npcgen-inner">
        <Link to="/dm-admin" className="adm-back">← Console del Master</Link>
        <h1 className="npcgen-title">Strumenti DM</h1>
        <p className="npcgen-sub">Genera al volo incontri, bottino e città per Eldoria.</p>

        {/* TAB */}
        <div className="dmt-tabs">
          {[["incontro", "⚔️ Incontri"], ["loot", "💰 Loot"], ["citta", "🏰 Città"]].map(([id, label]) => (
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

        <button className="npcgen-btn" style={{ marginTop: 20 }} onClick={generate} disabled={busy}>
          {busy ? "Sto generando…" : "⚒ Genera"}
        </button>

        <div className={`npcgen-status${msg.startsWith("Errore") ? " npcgen-status--error" : ""}`}>{msg}</div>

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

        </div>
      </div>
    </div>
  );
}
