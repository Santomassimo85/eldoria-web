import { useState } from "react";

// Componente DM: genera un NPC (cervello = Claude) e il suo ritratto (immagini = Gemini).
// Mettilo in una pagina/rotta del tuo sito (es. una pagina "Strumenti DM").
// I due bottoni chiamano i tuoi helper su Vercel: /api/genera-npc e /api/genera-immagine.

export default function GeneraNPC() {
  const [contesto, setContesto] = useState("taverniere in un porto di Tirrendale");
  const [npc, setNpc] = useState(null);
  const [immagine, setImmagine] = useState(null);
  const [stato, setStato] = useState("");
  const [loadingNpc, setLoadingNpc] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);

  async function generaNpc() {
    setLoadingNpc(true); setStato("Sto inventando l'NPC…"); setNpc(null); setImmagine(null);
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
      setStato("Errore: " + e.message);
    } finally {
      setLoadingNpc(false);
    }
  }

  async function generaImmagine() {
    if (!npc) return;
    setLoadingImg(true); setStato("Sto disegnando il ritratto…");
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
      setStato("Errore: " + e.message);
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

  const S = {
    wrap: { maxWidth: 560, margin: "0 auto", padding: 20, fontFamily: "sans-serif", color: "#e8e6f5" },
    h1: { fontFamily: "Georgia, serif", color: "#d9b25a", fontSize: 24, margin: "0 0 16px" },
    input: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #2e3260", background: "#171a36", color: "#e8e6f5", fontSize: 15, boxSizing: "border-box" },
    btn: { marginTop: 12, width: "100%", padding: 13, border: "none", borderRadius: 10, background: "#d9b25a", color: "#241c05", fontSize: 15, fontWeight: 600, cursor: "pointer" },
    btn2: { marginTop: 10, width: "100%", padding: 12, border: "1px solid #2e3260", borderRadius: 10, background: "#1f2347", color: "#e8e6f5", fontSize: 14, cursor: "pointer" },
    card: { marginTop: 22, background: "#171a36", border: "1px solid #2e3260", borderRadius: 14, padding: 20 },
    name: { fontFamily: "Georgia, serif", fontSize: 22, color: "#d9b25a", margin: 0 },
    role: { color: "#9a98c4", fontSize: 14, margin: "0 0 14px" },
    k: { fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "#9a98c4", margin: "12px 0 2px" },
    v: { fontSize: 15, fontWeight: 600, margin: 0, lineHeight: 1.5 },
    img: { width: "100%", borderRadius: 12, marginTop: 16 },
    msg: { marginTop: 14, color: "#9a98c4", fontSize: 14, minHeight: 18 }
  };

  return (
    <div style={S.wrap}>
      <h1 style={S.h1}>Generatore NPC</h1>

      <input style={S.input} value={contesto} onChange={e => setContesto(e.target.value)} />
      <button style={S.btn} onClick={generaNpc} disabled={loadingNpc}>
        {loadingNpc ? "…" : "Genera NPC"}
      </button>

      <div style={S.msg}>{stato}</div>

      {npc && (
        <div style={S.card}>
          <p style={S.name}>{npc.nome}</p>
          <p style={S.role}>{[npc.razza, npc.ruolo].filter(Boolean).join(" · ")}</p>

          <p style={S.k}>Aspetto</p><p style={S.v}>{npc.aspetto}</p>
          <p style={S.k}>Personalità</p><p style={S.v}>{npc.personalita}</p>
          <p style={S.k}>Voce</p><p style={S.v}>{npc.voce}</p>
          <p style={S.k}>Segreto</p><p style={S.v}>{npc.segreto}</p>
          <p style={S.k}>Statblock</p>
          <p style={S.v}>
            CA {npc.statblock?.CA} · PF {npc.statblock?.PF} · {npc.statblock?.tiri_salvezza}<br />
            {npc.statblock?.azione}
          </p>

          {immagine && <img style={S.img} src={immagine} alt={npc.nome} />}

          <button style={S.btn2} onClick={generaImmagine} disabled={loadingImg}>
            {loadingImg ? "…" : "Genera immagine"}
          </button>

          {/* <button style={S.btn2} onClick={salvaNPC}>Salva NPC</button> */}
        </div>
      )}
    </div>
  );
}
