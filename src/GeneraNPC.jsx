import { useState } from "react";
import "./GeneraNPC.css";

// Componente DM: genera un NPC (cervello = Claude) e il suo ritratto (immagini = Gemini).
// Mettilo in una pagina/rotta del tuo sito (es. una pagina "Strumenti DM").
// I due bottoni chiamano i tuoi helper su Vercel: /api/genera-npc e /api/genera-immagine.

export default function GeneraNPC() {
  const [contesto, setContesto] = useState("taverniere in un porto di Tirrendale");
  const [npc, setNpc] = useState(null);
  const [immagine, setImmagine] = useState(null);
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState(false);
  const [loadingNpc, setLoadingNpc] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);

  async function generaNpc() {
    setLoadingNpc(true); setStato("Sto inventando l'NPC…"); setErrore(false);
    setNpc(null); setImmagine(null);
    try {
      const r = await fetch("/api/genera-npc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contesto })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setNpc(data); setStato("");
    } catch (e) {
      setStato("Errore: " + e.message); setErrore(true);
    } finally {
      setLoadingNpc(false);
    }
  }

  async function generaImmagine() {
    if (!npc) return;
    setLoadingImg(true); setStato("Sto disegnando il ritratto…"); setErrore(false);
    try {
      const r = await fetch("/api/genera-immagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ npc })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setImmagine(data.immagine); setStato("");
    } catch (e) {
      setStato("Errore: " + e.message); setErrore(true);
    } finally {
      setLoadingImg(false);
    }
  }

  // --- SALVATAGGIO SU FIRESTORE (attivalo quando vuoi) ---
  // 1. In cima al file aggiungi (adatta il percorso al tuo progetto):
  //      import { db } from "../firebase";
  //      import { collection, addDoc } from "firebase/firestore";
  // 2. Togli i commenti a questa funzione e al bottone "Salva" più sotto.
  // NOTA immagini: un ritratto base64 è grande; per Firestore conviene caricarlo
  //      prima su Firebase Storage e salvare qui solo l'URL.
  //
  // async function salvaNPC() {
  //   await addDoc(collection(db, "npc"), {
  //     ...npc,
  //     ritratto: immagine || null,
  //     creato: Date.now()
  //   });
  //   setStato("NPC salvato!");
  // }

  return (
    <div className="npcgen-page">
      <div className="npcgen-inner">
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

            {/* <button className="npcgen-btn npcgen-btn--ghost" onClick={salvaNPC}>Salva NPC</button> */}
          </div>
        )}
      </div>
    </div>
  );
}
