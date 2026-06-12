import React, { useState } from "react";

/* ============================================================
   Strumenti DM — un'unica pagina con 3 strumenti:
   Incontri (viaggio), Loot, Città (descrizione + mappa AI).
   Cervello: /api/dm-tools (Claude). Mappa: /api/genera-immagine (Gemini).
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
.dmt{
  --bg:#0a0b14; --panel:#15172b; --panel2:#1b1e38; --line:#2c2f52;
  --gold:#e0bd6b; --gold-dim:#b9974c; --arc:#9b6cd6; --arc-dim:#6f4aa6;
  --ink:#ece9f5; --muted:#9c9ac4;
  max-width:560px; margin:0 auto; padding:18px 14px 60px; min-height:100vh;
  font-family:'EB Garamond',Georgia,serif; font-size:17px; line-height:1.5; color:var(--ink);
  background:radial-gradient(900px 480px at 50% -8%,#1a1736 0%,rgba(26,23,54,0) 60%),var(--bg);
}
.dmt *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.dmt h1{font-family:'Cinzel',serif;color:var(--gold);font-size:24px;margin:4px 2px 4px}
.dmt .lead{color:var(--muted);font-size:15px;margin:0 2px 18px}
.dmt-tabs{display:flex;gap:6px;margin-bottom:18px}
.dmt-tab{flex:1;padding:11px 4px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--muted);
  font-family:'Cinzel',serif;font-size:13px;letter-spacing:.05em;text-align:center;cursor:pointer;transition:.18s}
.dmt-tab.on{background:linear-gradient(180deg,#2a2550,#1c1d3a);color:var(--gold);border-color:var(--gold-dim)}
.dmt label{display:block;font-size:13px;color:var(--muted);margin:12px 2px 5px}
.dmt input,.dmt select,.dmt textarea{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);
  background:var(--panel);color:var(--ink);font-size:15px;font-family:'EB Garamond',serif}
.dmt textarea{resize:vertical;min-height:70px;line-height:1.45}
.dmt input:focus,.dmt select:focus,.dmt textarea:focus{outline:none;border-color:var(--gold-dim)}
.dmt .row{display:flex;gap:10px}
.dmt .row>div{flex:1}
.dmt-go{margin-top:16px;width:100%;padding:13px;border:none;border-radius:11px;background:var(--gold);
  color:#241c05;font-family:'Cinzel',serif;font-size:15px;font-weight:600;cursor:pointer}
.dmt-go:disabled{opacity:.5}
.dmt-msg{margin-top:12px;color:var(--muted);font-size:14px;min-height:18px}
.dmt-msg.err{color:#ef8e87}
.dmt-card{margin-top:18px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
.dmt-title{font-family:'Cinzel',serif;color:var(--gold);font-size:21px;margin:0 0 4px}
.dmt-tag{color:var(--muted);font-size:14px;margin:0 0 12px}
.dmt-k{font-family:'Cinzel',serif;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-dim);margin:16px 0 5px;
  display:flex;align-items:center;gap:9px}
.dmt-k::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent)}
.dmt-v{font-size:15px;line-height:1.55;margin:0}
.dmt-li{padding:8px 0;border-bottom:1px solid var(--line)}
.dmt-li .n{color:var(--ink);font-size:15px}
.dmt-li .n b{color:var(--gold)}
.dmt-li .d{color:var(--muted);font-size:14px;margin-top:2px}
.dmt-pill{display:inline-block;font-family:'Cinzel',serif;font-size:11px;padding:2px 8px;border-radius:6px;margin-left:6px;
  background:rgba(155,108,214,.15);color:#c6a6f0;border:1px solid var(--arc-dim)}
.dmt-prompt{margin-top:8px;font-family:ui-monospace,monospace;font-size:13px;background:#0f1120;border-color:var(--arc-dim)}
.dmt-mini{margin-top:10px;padding:10px;border:1px solid var(--gold-dim);border-radius:9px;background:linear-gradient(180deg,#2a2550,#1c1d3a);
  color:var(--gold);font-family:'Cinzel',serif;font-size:14px;cursor:pointer;width:100%}
.dmt-map{width:100%;border-radius:12px;margin-top:14px;border:1px solid var(--gold-dim)}
`;

const API = "/api/dm-tools";

export default function DmTools() {
  const [tab, setTab] = useState("incontro");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [out, setOut] = useState(null);

  // form state
  const [enc, setEnc] = useState({ zona: "una strada nella foresta di Eldoria", livelloParty: 5, numPg: 4, momento: "giorno", difficolta: "media" });
  const [loot, setLoot] = useState({ fonte: "tesoro", riferimento: "drago giovane", livelloMedio: 5, tema: "vario" });
  const [city, setCity] = useState({ nome: "", dimensione: "cittadina", carattere: "porto commerciale sul fiume", note: "" });

  // mappa
  const [mapPrompt, setMapPrompt] = useState("");
  const [mapImg, setMapImg] = useState(null);
  const [mapBusy, setMapBusy] = useState(false);

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
    } catch (e) {
      setMsg("Errore: " + e.message);
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
    } catch (e) {
      setMsg("Errore mappa: " + e.message);
    } finally { setMapBusy(false); }
  }

  function copyPrompt() {
    navigator.clipboard?.writeText(mapPrompt);
    setMsg("Prompt copiato.");
  }

  return (
    <div className="dmt">
      <style>{CSS}</style>
      <h1>Strumenti DM</h1>
      <p className="lead">Genera al volo incontri, bottino e città per Eldoria.</p>

      <div className="dmt-tabs">
        {[["incontro", "⚔️ Incontri"], ["loot", "💰 Loot"], ["citta", "🏰 Città"]].map(([id, label]) => (
          <div key={id} className={"dmt-tab" + (tab === id ? " on" : "")}
            onClick={() => { setTab(id); setOut(null); setMsg(""); setMapImg(null); }}>
            {label}
          </div>
        ))}
      </div>

      {/* FORM */}
      {tab === "incontro" && (
        <>
          <label>Zona / luogo</label>
          <input value={enc.zona} onChange={e => setEnc({ ...enc, zona: e.target.value })} />
          <div className="row">
            <div><label>Livello party</label>
              <input type="number" value={enc.livelloParty} onChange={e => setEnc({ ...enc, livelloParty: e.target.value })} /></div>
            <div><label>N° PG</label>
              <input type="number" value={enc.numPg} onChange={e => setEnc({ ...enc, numPg: e.target.value })} /></div>
          </div>
          <div className="row">
            <div><label>Momento</label>
              <select value={enc.momento} onChange={e => setEnc({ ...enc, momento: e.target.value })}>
                <option>giorno</option><option>notte</option><option>alba/tramonto</option></select></div>
            <div><label>Difficoltà</label>
              <select value={enc.difficolta} onChange={e => setEnc({ ...enc, difficolta: e.target.value })}>
                <option>facile</option><option>media</option><option>dura</option><option>mortale</option></select></div>
          </div>
        </>
      )}

      {tab === "loot" && (
        <>
          <label>Fonte del bottino</label>
          <select value={loot.fonte} onChange={e => setLoot({ ...loot, fonte: e.target.value })}>
            <option>nemico singolo</option><option>gruppo di nemici</option><option>tesoro</option><option>mercante</option>
          </select>
          <label>Riferimento di potere</label>
          <input value={loot.riferimento} onChange={e => setLoot({ ...loot, riferimento: e.target.value })} placeholder="es. CR 3, drago giovane, bandito comune" />
          <label>Livello medio del party</label>
          <input type="number" value={loot.livelloMedio} onChange={e => setLoot({ ...loot, livelloMedio: e.target.value })} />
          <label>Tema (facoltativo)</label>
          <input value={loot.tema} onChange={e => setLoot({ ...loot, tema: e.target.value })} placeholder="es. necromanzia, pirati, nani" />
        </>
      )}

      {tab === "citta" && (
        <>
          <label>Nome (lascia vuoto per inventarlo)</label>
          <input value={city.nome} onChange={e => setCity({ ...city, nome: e.target.value })} />
          <div className="row">
            <div><label>Dimensione</label>
              <select value={city.dimensione} onChange={e => setCity({ ...city, dimensione: e.target.value })}>
                <option>villaggio</option><option>cittadina</option><option>città</option><option>metropoli</option></select></div>
            <div><label>Carattere</label>
              <input value={city.carattere} onChange={e => setCity({ ...city, carattere: e.target.value })} /></div>
          </div>
          <label>Dettagli extra (facoltativo)</label>
          <textarea value={city.note} onChange={e => setCity({ ...city, note: e.target.value })}
            placeholder="Qualcosa di specifico che vuoi nella città (un evento, un problema, un legame con la trama)… la religione la sceglie l'agent dal tuo pantheon." />
        </>
      )}

      <button className="dmt-go" onClick={generate} disabled={busy}>{busy ? "…" : "Genera"}</button>
      <div className={"dmt-msg" + (msg.startsWith("Errore") ? " err" : "")}>{msg}</div>

      {/* RISULTATI */}
      {out && tab === "incontro" && (
        <div className="dmt-card">
          <h2 className="dmt-title">{out.titolo}</h2>
          <p className="dmt-tag">{out.difficolta} · {out.ambiente}</p>
          <div className="dmt-k">Nemici</div>
          {(out.nemici || []).map((n, i) => (
            <div className="dmt-li" key={i}><div className="n"><b>×{n.numero}</b> {n.nome}</div>{n.note && <div className="d">{n.note}</div>}</div>
          ))}
          <div className="dmt-k">Tattica</div><p className="dmt-v">{out.tattica}</p>
          <div className="dmt-k">Colpo di scena</div><p className="dmt-v">{out.colpo_di_scena}</p>
          <div className="dmt-k">Ricompensa</div><p className="dmt-v">{out.ricompensa}</p>
        </div>
      )}

      {out && tab === "loot" && (
        <div className="dmt-card">
          <div className="dmt-k">Monete</div><p className="dmt-v">{out.monete}</p>
          <div className="dmt-k">Oggetti</div>
          {(out.oggetti || []).map((o, i) => (
            <div className="dmt-li" key={i}><div className="n">{o.nome}<span className="dmt-pill">{o.rarita}</span></div>
              {o.descrizione && <div className="d">{o.descrizione}</div>}</div>
          ))}
          {out.nota && (<><div className="dmt-k">Nota</div><p className="dmt-v">{out.nota}</p></>)}
        </div>
      )}

      {out && tab === "citta" && (
        <div className="dmt-card">
          <h2 className="dmt-title">{out.nome}</h2>
          <p className="dmt-tag">{out.dimensione} · {out.carattere}</p>
          <p className="dmt-v">{out.descrizione}</p>
          <div className="dmt-k">Governo</div><p className="dmt-v">{out.governo}{out.capo ? ` — ${out.capo}` : ""}</p>
          <div className="dmt-k">Difesa</div><p className="dmt-v">{out.difesa}</p>
          <div className="dmt-k">Religione</div><p className="dmt-v">{out.religione}</p>
          <div className="dmt-k">Economia</div><p className="dmt-v">{out.economia}</p>
          {(out.luoghi || []).length > 0 && <>
            <div className="dmt-k">Luoghi notevoli</div>
            {out.luoghi.map((l, i) => (<div className="dmt-li" key={i}><div className="n"><b>{l.nome}</b> — {l.tipo}</div><div className="d">{l.descrizione}</div></div>))}
          </>}
          {(out.ganci || []).length > 0 && <>
            <div className="dmt-k">Ganci narrativi</div>
            {out.ganci.map((g, i) => <p className="dmt-v" key={i}>• {g}</p>)}
          </>}

          <div className="dmt-k">Prompt mappa (modificabile)</div>
          <textarea className="dmt-prompt" rows={9} value={mapPrompt} onChange={e => setMapPrompt(e.target.value)} />
          <button className="dmt-mini" onClick={copyPrompt}>📋 Copia prompt</button>
          <button className="dmt-mini" onClick={generaMappa} disabled={mapBusy}>{mapBusy ? "Sto disegnando la mappa…" : "🗺️ Genera mappa"}</button>
          {mapImg && <img className="dmt-map" src={mapImg} alt={"Mappa di " + out.nome} />}
        </div>
      )}
    </div>
  );
}