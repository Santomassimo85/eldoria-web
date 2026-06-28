import { useState } from "react";
import { Link } from "react-router-dom";
import { db, storage } from "./firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { logAgent } from "./utils/agentLog";
import { CITIES_HUB } from "./data/citiesHub";
import "./GeneraNPC.css";
import "./pages/admin.css";

const initialDest = { name: "", faction: "", location: "", linkedCity: "", description: "" };

export default function GeneraNPC() {
  const [contesto, setContesto] = useState("taverniere in un porto di Tirrendale");
  const [npc, setNpc] = useState(null);
  const [immagine, setImmagine] = useState(null);
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState(false);
  const [loadingNpc, setLoadingNpc] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [salvato, setSalvato] = useState(false);
  // Scheda d'archivio modificabile prima del salvataggio (stessi campi di Geo/NPC)
  const [dest, setDest] = useState(initialDest);

  async function generaNpc() {
    setLoadingNpc(true); setStato("Sto evocando l'NPC…"); setErrore(false);
    setNpc(null); setImmagine(null); setSalvato(false);
    try {
      const r = await fetch("/api/genera-npc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contesto })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setNpc(data); setStato("");
      // Prefill della scheda d'archivio coi dati generati (il Master può ritoccarli)
      setDest({
        name: data.nome || "",
        faction: data.razza || "",
        location: data.ruolo || "",
        linkedCity: "",
        description: [
          data.aspetto,
          data.personalita,
          data.voce,
          data.segreto ? `🔒 ${data.segreto}` : null
        ].filter(Boolean).join(" — "),
      });
      logAgent("genera-npc", "success", `NPC generato: ${data.nome || "senza nome"} (${[data.razza, data.ruolo].filter(Boolean).join(", ")}) — contesto: "${contesto}"`, {}, { count: true });
    } catch (e) {
      setStato("Errore: " + e.message); setErrore(true);
      logAgent("genera-npc", "error", e.message);
    } finally {
      setLoadingNpc(false);
    }
  }

  async function generaImmagine() {
    if (!npc) return;
    setLoadingImg(true); setStato("Sto dipingendo il ritratto…"); setErrore(false);
    try {
      const r = await fetch("/api/genera-immagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ npc })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setImmagine(data.immagine); setStato("");
      logAgent("genera-immagine", "success", `Ritratto generato per ${npc.nome || "un NPC"}`, {}, { count: true });
    } catch (e) {
      setStato("Errore: " + e.message); setErrore(true);
      logAgent("genera-immagine", "error", e.message);
    } finally {
      setLoadingImg(false);
    }
  }

  async function salvaInNpcs() {
    if (!npc || salvato) return;
    if (!dest.name.trim()) { setStato("Dai un nome all'NPC prima di salvarlo."); setErrore(true); return; }
    setLoadingSave(true); setStato("Salvataggio in corso…"); setErrore(false);
    try {
      // Il ritratto è un data URL base64 troppo grande per Firestore (limite ~1MB
      // per documento): va caricato su Storage e nel doc si salva solo l'URL.
      let imageUrl = immagine || "";
      if (imageUrl.startsWith("data:")) {
        setStato("Carico il ritratto…");
        const safe = (dest.name.trim() || "npc").replace(/[^a-z0-9._-]/gi, "_").slice(0, 36);
        const path = `npcs/${Date.now()}-${safe}.png`;
        const ref = storageRef(storage, path);
        await uploadString(ref, imageUrl, "data_url");
        imageUrl = await getDownloadURL(ref);
        setStato("Salvataggio in corso…");
      }
      // Se è collegato a una città hub, il pin sulla mappa eredita le sue coordinate
      const coords = CITIES_HUB.find((c) => c.name === dest.linkedCity);
      await addDoc(collection(db, "npcs"), {
        name: dest.name.trim(),
        image: imageUrl,
        faction: dest.faction || "",
        location: dest.location || "",
        description: dest.description || "",
        linkedCity: dest.linkedCity || "",
        mapX: coords ? coords.x : 50,
        mapY: coords ? coords.y : 50,
        statblock: npc.statblock || {},
        generato: true,
        creato: Date.now()
      });
      setSalvato(true);
      setStato(
        dest.linkedCity
          ? `✅ "${dest.name}" archiviato a ${dest.linkedCity}!`
          : `✅ "${dest.name}" aggiunto all'archivio NPC (Erranti)!`
      );
    } catch (e) {
      setStato("Errore salvataggio: " + e.message); setErrore(true);
    } finally {
      setLoadingSave(false);
    }
  }

  return (
    <div className="npcgen-page">
      <div className="npcgen-inner">
        <Link to="/dm-admin" className="adm-back">← Console del Master</Link>
        <h1 className="npcgen-title">Generatore NPC</h1>
        <p className="npcgen-sub">
          Descrivi il personaggio che ti serve: ci pensa l'oracolo a dargli
          nome, volto e segreti.
        </p>

        <label className="npcgen-label" htmlFor="npcgen-contesto">
          Contesto
        </label>
        <input
          id="npcgen-contesto"
          className="npcgen-input"
          value={contesto}
          placeholder="es. taverniere in un porto di Tirrendale"
          onChange={e => setContesto(e.target.value)}
        />
        <button className="npcgen-btn" onClick={generaNpc} disabled={loadingNpc}>
          {loadingNpc ? "Sto evocando…" : "⚒ Genera NPC"}
        </button>

        <div className={`npcgen-status${errore ? " npcgen-status--error" : ""}`}>
          {stato}
        </div>

        {npc && (
          <div className="npcgen-card">
            <p className="npcgen-name">{npc.nome}</p>
            <p className="npcgen-role">
              {[npc.razza, npc.ruolo].filter(Boolean).join(" · ")}
            </p>
            <hr className="npcgen-divider" />

            <p className="npcgen-k">Aspetto</p>
            <p className="npcgen-v">{npc.aspetto}</p>
            <p className="npcgen-k">Personalità</p>
            <p className="npcgen-v">{npc.personalita}</p>
            <p className="npcgen-k">Voce</p>
            <p className="npcgen-v">{npc.voce}</p>
            <p className="npcgen-k">Segreto</p>
            <p className="npcgen-v">{npc.segreto}</p>

            <p className="npcgen-k">Statblock</p>
            <div className="npcgen-stats">
              <span className="npcgen-chip">CA {npc.statblock?.CA}</span>
              <span className="npcgen-chip">PF {npc.statblock?.PF}</span>
            </div>
            <p className="npcgen-v">
              {npc.statblock?.tiri_salvezza}
              {npc.statblock?.tiri_salvezza && npc.statblock?.azione ? <br /> : null}
              {npc.statblock?.azione}
            </p>

            {immagine && (
              <img className="npcgen-img" src={immagine} alt={npc.nome} />
            )}

            <button
              className="npcgen-btn npcgen-btn--ghost"
              onClick={generaImmagine}
              disabled={loadingImg}
            >
              {loadingImg ? "Sto dipingendo…" : "🎨 Genera ritratto"}
            </button>

            {/* ── Scheda d'archivio: stessi campi di Geo/NPC, ritoccabili ── */}
            <hr className="npcgen-divider" />
            <p className="npcgen-k">📖 Scheda d'archivio</p>
            <p className="npcgen-archive-hint">
              Controlla i dati e scegli dove inserirlo prima di salvarlo
              nell'anagrafe (la stessa di Eroi → NPC).
            </p>

            <div className="npcgen-form-grid">
              <div className="npcgen-fld">
                <label className="npcgen-label" htmlFor="dest-name">Nome NPC</label>
                <input
                  id="dest-name"
                  className="npcgen-input"
                  value={dest.name}
                  placeholder="Es. Maestro Aldwin"
                  onChange={e => setDest({ ...dest, name: e.target.value })}
                />
              </div>

              <div className="npcgen-fld">
                <label className="npcgen-label" htmlFor="dest-city">Città Hub</label>
                <select
                  id="dest-city"
                  className="npcgen-input"
                  value={dest.linkedCity}
                  onChange={e => setDest({ ...dest, linkedCity: e.target.value })}
                >
                  <option value="">— Errante (nessuna città) —</option>
                  {CITIES_HUB.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="npcgen-fld">
                <label className="npcgen-label" htmlFor="dest-faction">Fazione / Razza</label>
                <input
                  id="dest-faction"
                  className="npcgen-input"
                  value={dest.faction}
                  placeholder="Es. Ordine del Velo"
                  onChange={e => setDest({ ...dest, faction: e.target.value })}
                />
              </div>

              <div className="npcgen-fld">
                <label className="npcgen-label" htmlFor="dest-location">Posizione</label>
                <input
                  id="dest-location"
                  className="npcgen-input"
                  value={dest.location}
                  placeholder="Es. Locanda del Drago"
                  onChange={e => setDest({ ...dest, location: e.target.value })}
                />
              </div>

              <div className="npcgen-fld npcgen-fld--full">
                <label className="npcgen-label" htmlFor="dest-desc">Note / Descrizione</label>
                <textarea
                  id="dest-desc"
                  className="npcgen-input npcgen-textarea"
                  value={dest.description}
                  rows="4"
                  placeholder="Aspetto, personalità, segreti…"
                  onChange={e => setDest({ ...dest, description: e.target.value })}
                />
              </div>
            </div>

            <button
              className="npcgen-btn npcgen-btn--ghost"
              onClick={salvaInNpcs}
              disabled={loadingSave || salvato}
              style={salvato ? { opacity: 0.6, cursor: "default" } : {}}
            >
              {loadingSave ? "Salvataggio…" : salvato ? "✅ Aggiunto all'archivio" : "📖 Salva nell'anagrafe NPC"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}