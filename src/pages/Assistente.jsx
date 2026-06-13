import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";

/* ============================================================
   Assistente Player — chat in linguaggio naturale con Eldoria.
   Legge scheda, mercato, bacheca, NPC, luoghi, riassunti, ecc.
   Le azioni (offerte, missioni) chiedono sempre conferma.
   Backend: /api/assistente (Gemini, gratuito).
   ============================================================ */

const CSS = `
.ast{
  --panel:#fffdf8; --panel2:#faf4e6; --line:rgba(212,175,55,.45);
  --gold:#d4af37; --gold-deep:#b8860b; --red:#820a0a; --red-soft:#a32222;
  --ink:#2b2b2b; --muted:#7a6f55;
  display:flex; flex-direction:column;
  height:calc(100dvh - var(--navbar-h) - 24px); margin:calc(var(--navbar-h) + 24px) auto 0;
  max-width:760px; width:100%;
  font-family:var(--font-text),Georgia,serif; font-size:17px; color:var(--ink);
  background:var(--panel);
  border-left:1px solid var(--line); border-right:1px solid var(--line);
  box-shadow:0 0 40px rgba(0,0,0,.06);
}
.ast *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.ast-head{
  padding:16px 18px 14px; border-bottom:2px solid var(--gold);
  display:flex; align-items:center; gap:14px; flex:0 0 auto;
  background:linear-gradient(180deg,#ffffff,#faf4e6);
}
.ast-head .orb{
  width:44px;height:44px;border-radius:50%;flex:0 0 44px;
  background:radial-gradient(circle at 38% 32%,#ffe7a8,#d4af37 55%,#820a0a);
  box-shadow:0 0 14px rgba(212,175,55,.45), inset 0 0 6px rgba(255,255,255,.4);
  display:flex;align-items:center;justify-content:center;font-size:22px;
}
.ast-head .info h1{font-family:var(--font-title),'Cinzel',serif;font-size:19px;color:var(--red);margin:0;line-height:1.2;letter-spacing:.5px}
.ast-head .info p{font-size:13px;color:var(--muted);margin:3px 0 0}

/* TRACE LOG */
.ast-trace{
  margin:10px 14px 0; padding:10px 12px; border-radius:10px;
  background:var(--panel2); border:1px solid var(--line);
  font-family:ui-monospace,monospace; font-size:12px; color:var(--muted);
  flex:0 0 auto; max-height:80px; overflow-y:auto;
  transition:max-height .3s ease;
}
.ast-trace.empty{display:none}
.ast-trace-row{padding:2px 0; border-bottom:1px solid rgba(212,175,55,.2); display:flex; gap:8px}
.ast-trace-row:last-child{border:none}
.ast-trace-row .t-icon{flex:0 0 auto}
.ast-trace-row .t-text{color:#6b5f47}

/* MESSAGES */
.ast-msgs{flex:1;overflow-y:auto;padding:18px 16px;display:flex;flex-direction:column;gap:12px}
.msg{max-width:88%;display:flex;flex-direction:column;gap:4px}
.msg.user{align-self:flex-end}
.msg.bot{align-self:flex-start}
.msg-bubble{
  padding:11px 15px; border-radius:14px; line-height:1.55; font-size:16px;
}
.msg.user .msg-bubble{
  background:linear-gradient(135deg,#a32222,#820a0a);
  color:#fdf3e3; border:1px solid #6a0808; border-bottom-right-radius:4px;
  box-shadow:0 2px 8px rgba(130,10,10,.2);
}
.msg.bot .msg-bubble{
  background:#fffdf8; color:var(--ink);
  border:1px solid var(--line); border-bottom-left-radius:4px;
  box-shadow:0 1px 4px rgba(0,0,0,.05);
}
.msg.bot .msg-bubble strong{color:var(--red)}
.msg.bot .msg-bubble em{color:var(--gold-deep); font-style:italic}
.msg.user .msg-bubble strong{color:#ffe7a8}
.msg.user .msg-bubble em{color:#ffe7a8; font-style:italic}
.msg-time{font-size:11px;color:var(--muted);padding:0 4px}
.msg.user .msg-time{text-align:right}

/* TYPING */
.typing{display:flex;gap:5px;padding:14px;align-items:center}
.typing span{width:7px;height:7px;border-radius:50%;background:var(--gold-deep);animation:blink 1.2s infinite}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}

/* CONFIRM MODAL */
.ast-overlay{
  position:fixed;inset:0;background:rgba(40,20,10,.55);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:1100;padding:20px;
}
.ast-modal{
  background:var(--panel);border:2px solid var(--gold);border-radius:16px;
  padding:24px;max-width:400px;width:100%;
  box-shadow:0 20px 50px rgba(0,0,0,.3);
}
.ast-modal h3{font-family:var(--font-title),'Cinzel',serif;color:var(--red);margin:0 0 12px;font-size:19px}
.ast-modal p{color:var(--ink);margin:0 0 18px;line-height:1.5;font-size:16px}
.ast-modal .mbts{display:flex;gap:10px}
.ast-modal button{flex:1;padding:12px;border-radius:10px;font-family:var(--font-title),'Cinzel',serif;font-size:14px;cursor:pointer;border:none;transition:.15s}
.ast-modal .ok{background:linear-gradient(135deg,var(--gold),var(--gold-deep));color:#2a1a00}
.ast-modal .ok:hover{filter:brightness(1.06)}
.ast-modal .no{background:#fff;color:var(--red);border:1px solid var(--line)}
.ast-modal .no:hover{background:var(--panel2)}

/* SUGGESTIONS */
.ast-hints{display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px 4px;flex:0 0 auto}
.hint{
  padding:7px 13px;border-radius:20px;font-size:13px;cursor:pointer;
  background:var(--panel2);border:1px solid var(--line);color:var(--red);
  white-space:nowrap; transition:.15s; font-family:var(--font-text),serif;
}
.hint:hover{background:var(--red);color:#fdf3e3;border-color:var(--red)}

/* INPUT */
.ast-bar{
  padding:12px 16px 14px;border-top:2px solid var(--gold);
  display:flex;gap:10px;flex:0 0 auto;background:linear-gradient(0deg,#ffffff,#faf4e6);
}
.ast-bar textarea{
  flex:1;padding:11px 13px;border-radius:11px;border:1px solid var(--gold);
  background:#fff;color:var(--ink);font-size:16px;font-family:var(--font-text),serif;
  resize:none;height:46px;max-height:120px;overflow-y:auto;line-height:1.4;margin:0;
}
.ast-bar textarea::placeholder{color:#a89a7a}
.ast-bar textarea:focus{outline:none;border-color:var(--gold-deep);box-shadow:0 0 0 3px rgba(212,175,55,.18)}
.ast-bar button{
  width:46px;height:46px;border-radius:11px;border:none;
  background:linear-gradient(135deg,var(--red-soft),var(--red));
  color:#fdf3e3;font-size:20px;cursor:pointer;flex:0 0 46px;
  display:flex;align-items:center;justify-content:center;transition:.15s;
}
.ast-bar button:not(:disabled):hover{filter:brightness(1.12)}
.ast-bar button:disabled{opacity:.4;cursor:default}
@media(max-width:760px){
  .ast{border-left:none;border-right:none;box-shadow:none}
}
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
      <div style={{ margin: "auto", textAlign: "center", color: "#7a6f55", padding: 30 }}>
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
            <p style={{ fontSize: 14, color: "#7a6f55", margin: "-10px 0 18px" }}>Questa azione modifica i dati della campagna.</p>
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