import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";

/* ============================================================
   Assistente Player — chat in linguaggio naturale con Eldoria.
   Legge scheda, mercato, bacheca, NPC, luoghi, riassunti, ecc.
   Le azioni (offerte, missioni) chiedono sempre conferma.
   Backend: /api/assistente (Gemini, gratuito).
   ============================================================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');
.ast{
  --bg:#0a0b14; --panel:#15172b; --panel2:#1b1e38; --line:#2c2f52;
  --gold:#e0bd6b; --gold-dim:#b9974c; --arc:#9b6cd6; --arc-dim:#6f4aa6;
  --ink:#ece9f5; --muted:#9c9ac4; --hp:#cf5a52;
  display:flex; flex-direction:column; height:100dvh; max-width:600px; margin:0 auto;
  font-family:'EB Garamond',Georgia,serif; font-size:17px; color:var(--ink);
  background:radial-gradient(700px 400px at 50% -5%,#1a1736,rgba(26,23,54,0) 60%),var(--bg);
}
.ast *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.ast-head{
  padding:14px 16px 12px; border-bottom:1px solid var(--line);
  display:flex; align-items:center; gap:12px; flex:0 0 auto;
  background:var(--bg);
}
.ast-head .orb{
  width:40px;height:40px;border-radius:50%;flex:0 0 40px;
  background:radial-gradient(circle at 40% 35%,#c4a0f5,#6f4aa6 60%,#2a1a4a);
  box-shadow:0 0 16px rgba(155,108,214,.5);
  display:flex;align-items:center;justify-content:center;font-size:20px;
}
.ast-head .info h1{font-family:'Cinzel',serif;font-size:17px;color:var(--gold);margin:0;line-height:1.2}
.ast-head .info p{font-size:13px;color:var(--muted);margin:2px 0 0}

/* TRACE LOG */
.ast-trace{
  margin:0 12px 0; padding:10px 12px; border-radius:10px;
  background:rgba(27,30,56,.8); border:1px solid var(--line);
  font-family:ui-monospace,monospace; font-size:12px; color:var(--muted);
  flex:0 0 auto; max-height:80px; overflow-y:auto;
  transition:max-height .3s ease;
}
.ast-trace.empty{display:none}
.ast-trace-row{padding:2px 0; border-bottom:1px solid rgba(44,47,82,.5); display:flex; gap:8px}
.ast-trace-row:last-child{border:none}
.ast-trace-row .t-icon{color:var(--arc);flex:0 0 auto}
.ast-trace-row .t-text{color:#b0aed4}

/* MESSAGES */
.ast-msgs{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:12px}
.msg{max-width:88%;display:flex;flex-direction:column;gap:4px}
.msg.user{align-self:flex-end}
.msg.bot{align-self:flex-start}
.msg-bubble{
  padding:11px 14px; border-radius:14px; line-height:1.55; font-size:16px;
}
.msg.user .msg-bubble{
  background:linear-gradient(135deg,#2a2550,#1c1d3a);
  border:1px solid var(--arc-dim); border-bottom-right-radius:4px;
}
.msg.bot .msg-bubble{
  background:var(--panel); border:1px solid var(--line); border-bottom-left-radius:4px;
}
.msg-bubble strong{color:var(--gold)}
.msg-bubble em{color:var(--arc); font-style:normal}
.msg-time{font-size:11px;color:var(--muted);padding:0 4px}
.msg.user .msg-time{text-align:right}

/* TYPING */
.typing{display:flex;gap:5px;padding:14px;align-items:center}
.typing span{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:blink 1.2s infinite}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.2}40%{opacity:1}}

/* CONFIRM MODAL */
.ast-overlay{
  position:fixed;inset:0;background:rgba(5,5,15,.75);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:99;padding:20px;
}
.ast-modal{
  background:var(--panel);border:1px solid var(--gold-dim);border-radius:16px;
  padding:22px;max-width:380px;width:100%;
}
.ast-modal h3{font-family:'Cinzel',serif;color:var(--gold);margin:0 0 10px;font-size:18px}
.ast-modal p{color:var(--ink);margin:0 0 18px;line-height:1.5;font-size:16px}
.ast-modal .mbts{display:flex;gap:10px}
.ast-modal button{flex:1;padding:12px;border-radius:10px;font-family:'Cinzel',serif;font-size:14px;cursor:pointer;border:none}
.ast-modal .ok{background:var(--gold);color:#241c05}
.ast-modal .no{background:var(--panel2);color:var(--muted);border:1px solid var(--line)}

/* SUGGESTIONS */
.ast-hints{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px 0;flex:0 0 auto}
.hint{
  padding:6px 12px;border-radius:20px;font-size:13px;cursor:pointer;
  background:var(--panel2);border:1px solid var(--line);color:var(--muted);
  white-space:nowrap; transition:.15s;
}
.hint:hover{border-color:var(--gold-dim);color:var(--gold)}

/* INPUT */
.ast-bar{
  padding:12px 14px 14px;border-top:1px solid var(--line);
  display:flex;gap:10px;flex:0 0 auto;background:var(--bg);
}
.ast-bar textarea{
  flex:1;padding:11px 13px;border-radius:11px;border:1px solid var(--line);
  background:var(--panel);color:var(--ink);font-size:16px;font-family:'EB Garamond',serif;
  resize:none;height:46px;max-height:120px;overflow-y:auto;line-height:1.4;
}
.ast-bar textarea:focus{outline:none;border-color:var(--gold-dim)}
.ast-bar button{
  width:46px;height:46px;border-radius:11px;border:none;
  background:linear-gradient(180deg,#d9b46a,#b99050);
  color:#241c05;font-size:20px;cursor:pointer;flex:0 0 46px;
  display:flex;align-items:center;justify-content:center;
}
.ast-bar button:disabled{opacity:.45}
@media(prefers-reduced-motion:reduce){.ast *{animation:none!important;transition:none!important}}
`;

const HINTS = [
  "Mostrami la mia scheda",
  "Cosa c'è al mercato nero?",
  "Ci sono missioni per me?",
  "Chi è Hemile?",
  "Riassumi l'ultima sessione",
  "Dimmi di Tirrendale",
  "Chi venera Morgath?",
  "Com'è messo il party?",
];

function formatText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

function now() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export default function Assistente() {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Salve, avventuriero. Sono la memoria vivente di Eldoria. Chiedimi di missioni, mercato, personaggi, luoghi o sessioni passate. Come posso aiutarti?", time: now() }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [trace, setTrace] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [showHints, setShowHints] = useState(true);
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  function addTrace(icon, text) {
    setTrace(t => [...t.slice(-8), { icon, text, id: Date.now() }]);
  }

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    setShowHints(false);
    if (taRef.current) taRef.current.style.height = "46px";

    const userMsg = { role: "user", content: msg, time: now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);
    setTrace([]);
    addTrace("🔍", "Invio richiesta…");

    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          uid: currentUser?.uid
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);

      addTrace("✅", "Risposta ricevuta");
      if (data.pendingAction) {
        addTrace("⚠️", `Azione in attesa: ${data.pendingAction.type}`);
        setPendingAction(data.pendingAction);
      }
      setMessages(m => [...m, { role: "assistant", content: data.reply, time: now() }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: `⚠️ Errore: ${e.message}`, time: now() }]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmAction() {
    const action = pendingAction;
    setPendingAction(null);
    setLoading(true);
    addTrace("⚡", `Eseguo: ${action.type}`);
    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uid: currentUser?.uid, confirmedAction: action })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      addTrace("✅", "Azione completata");
      setMessages(m => [...m, { role: "assistant", content: data.reply, time: now() }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: `⚠️ Errore: ${e.message}`, time: now() }]);
    } finally {
      setLoading(false);
    }
  }

  function actionLabel(a) {
    if (!a) return "";
    if (a.type === "fai_offerta") return `Fare un'offerta di **${a.params.importo} mp** su **${a.params.item_nome}**`;
    if (a.type === "accetta_missione") return `Accettare la missione **${a.params.quest_titolo}**`;
    return a.type;
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function autoResize(e) {
    e.target.style.height = "46px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  if (!currentUser) return (
    <div className="ast"><style>{CSS}</style>
      <div style={{ margin: "auto", textAlign: "center", color: "#9c9ac4", padding: 30 }}>
        Accedi per usare l'assistente.
      </div>
    </div>
  );

  return (
    <div className="ast">
      <style>{CSS}</style>

      {/* HEADER */}
      <div className="ast-head">
        <div className="orb">🔮</div>
        <div className="info">
          <h1>Assistente di Eldoria</h1>
          <p>Mercato · Missioni · NPC · Luoghi · Sessioni</p>
        </div>
      </div>

      {/* TRACE LOG */}
      <div className={"ast-trace" + (trace.length ? "" : " empty")} id="trace">
        {trace.map(t => (
          <div key={t.id} className="ast-trace-row">
            <span className="t-icon">{t.icon}</span>
            <span className="t-text">{t.text}</span>
          </div>
        ))}
      </div>

      {/* MESSAGGI */}
      <div className="ast-msgs">
        {messages.map((m, i) => (
          <div key={i} className={"msg " + (m.role === "user" ? "user" : "bot")}>
            <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: formatText(m.content) }} />
            <span className="msg-time">{m.time}</span>
          </div>
        ))}
        {loading && (
          <div className="msg bot">
            <div className="msg-bubble"><div className="typing"><span/><span/><span/></div></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* SUGGERIMENTI */}
      {showHints && (
        <div className="ast-hints">
          {HINTS.map((h, i) => (
            <div key={i} className="hint" onClick={() => send(h)}>{h}</div>
          ))}
        </div>
      )}

      {/* INPUT */}
      <div className="ast-bar">
        <textarea ref={taRef} value={input} placeholder="Chiedimi qualcosa…"
          onChange={e => { setInput(e.target.value); autoResize(e); }}
          onKeyDown={onKey} rows={1} />
        <button onClick={() => send()} disabled={loading || !input.trim()}>➤</button>
      </div>

      {/* MODAL CONFERMA */}
      {pendingAction && (
        <div className="ast-overlay">
          <div className="ast-modal">
            <h3>⚠️ Conferma azione</h3>
            <p dangerouslySetInnerHTML={{ __html: formatText(actionLabel(pendingAction)) }} />
            <p style={{ fontSize: 14, color: "#9c9ac4", margin: "-10px 0 18px" }}>Questa azione modifica i dati della campagna.</p>
            <div className="mbts">
              <button className="no" onClick={() => setPendingAction(null)}>❌ Annulla</button>
              <button className="ok" onClick={confirmAction}>✅ Conferma</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}