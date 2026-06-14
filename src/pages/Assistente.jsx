import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs,
  runTransaction, writeBatch, serverTimestamp, increment,
} from "firebase/firestore";

/* ============================================================
   Assistente Player — chat in linguaggio naturale con Eldoria.
   Legge scheda, mercato, bacheca, NPC, luoghi, riassunti, ecc.
   Le azioni (offerte, missioni) chiedono sempre conferma.
   Backend: /api/assistente (Gemini, gratuito) per la CONVERSAZIONE.
   Le SCRITTURE confermate (offerta, accetta missione) avvengono
   qui lato client, dove l'utente è autenticato (le regole Firestore
   richiedono il login: il backend non potrebbe scriverle).
   ============================================================ */

// Roster party (allineato a Bacheca.jsx) per accettare missioni di gruppo.
const PARTY_ROSTER = {
  "AMEA": ["Tanagar", "Garroth Tel´Arion", "Caius Maxis-Richtofen"],
  "ENOX": ["Temistocle Sottocolle Milo", "Dante", "Roynot", "Vyger", "Timoty Bevibotte", "Alaric Voltasorte"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Makenna", "Taaras Stormrage", "Soran", "Zethir Nightwhisper"],
  "ECO":  ["Aksel", "Dago", "Ismael Van Dyke"],
};
const getPartyByCharName = (name) => {
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return "Senza Gruppo";
};

// Risolve un oggetto del mercato per id, con fallback per nome (l'id può essere
// trascritto male dall'AI). Ritorna { id, data } o null.
async function resolveItem(params) {
  if (params.item_id) {
    const snap = await getDoc(doc(db, "items", params.item_id));
    if (snap.exists()) return { id: snap.id, data: snap.data() };
  }
  const nome = (params.item_nome || "").trim();
  if (!nome) return null;
  const qs = await getDocs(query(collection(db, "items"), where("name", "==", nome)));
  const docs = qs.docs.map(d => ({ id: d.id, data: d.data() }));
  return docs.find(d => !d.data.isSold) || docs[0] || null;
}

// Piazza un'offerta in asta lato client (come ItemDetail.handleSubmitOffer).
async function doOffer(uid, params) {
  const found = await resolveItem(params);
  if (!found) return `⚠️ Non trovo "${params.item_nome || params.item_id}" al mercato. Controlla il nome.`;
  const { id, data } = found;
  if (data.isSold) return `⚠️ **${data.name}** è già stato venduto.`;
  if (data.saleType !== "auction") return `⚠️ **${data.name}** non è all'asta: non si possono fare offerte.`;
  const amount = parseInt(params.importo, 10);
  const minBid = data.startingBid || 0;
  if (!(amount >= minBid)) return `⚠️ L'offerta minima per **${data.name}** è ${minBid} MP.`;

  try {
    await runTransaction(db, async (tx) => {
      const charRef = doc(db, "characters", uid);
      const itemRef = doc(db, "items", id);
      const charSnap = await tx.get(charRef);
      const plat = charSnap.data()?.platinum || 0;
      if (plat < amount) throw new Error(`Platino insufficiente: hai ${plat} MP, ne servono ${amount}.`);
      const charName = charSnap.data()?.name || "Un eroe";
      tx.update(charRef, { platinum: plat - amount });
      tx.update(itemRef, {
        [`bids.${uid}`]: { amount, charName, timestamp: new Date().toISOString() },
      });
      const notifyRef = doc(collection(db, "notifications"));
      tx.set(notifyRef, {
        userId: uid, title: "Offerta Piazzata! 🎲",
        message: `Hai puntato ${amount} MP per "${data.name}". Incrocia le dita!`,
        read: false, timestamp: serverTimestamp(),
      });
    });
    return `✅ Offerta di **${amount} MP** su **${data.name}** piazzata! Il platino è stato bloccato; verrà rimborsato se non vinci l'asta.`;
  } catch (e) {
    return `⚠️ ${e.message || "Errore nell'invio dell'offerta."}`;
  }
}

// Accetta una missione lato client (come Bacheca.toggleQuestStatus).
async function doAcceptQuest(uid, params) {
  let qDoc = null;
  if (params.quest_id) {
    const snap = await getDoc(doc(db, "quests", params.quest_id));
    if (snap.exists()) qDoc = { id: snap.id, data: snap.data() };
  }
  if (!qDoc && params.quest_titolo) {
    const qs = await getDocs(query(collection(db, "quests"), where("title", "==", params.quest_titolo.trim())));
    if (qs.docs[0]) qDoc = { id: qs.docs[0].id, data: qs.docs[0].data() };
  }
  if (!qDoc) return `⚠️ Non trovo la missione "${params.quest_titolo || params.quest_id}".`;
  if (qDoc.data.acceptedBy) return `⚠️ La missione **${qDoc.data.title}** è già stata accettata da ${qDoc.data.acceptedBy}.`;

  const charSnap = await getDoc(doc(db, "characters", uid));
  const charName = charSnap.exists() ? (charSnap.data().name || "") : "";
  if (!charName) return "⚠️ Scheda non trovata: impossibile accettare la missione.";
  const party = getPartyByCharName(charName);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, "quests", qDoc.id), {
      acceptedBy: charName, acceptedParty: party, status: "in_progress",
    });
    // Notifica al compagni se è una missione di gruppo, altrimenti a sé stessi.
    const isPartyQuest = qDoc.data.targetParty && qDoc.data.targetParty !== "All";
    const members = isPartyQuest ? (PARTY_ROSTER[qDoc.data.targetParty] || []) : [];
    if (members.length) {
      const cs = await getDocs(query(collection(db, "characters"), where("name", "in", members)));
      cs.forEach((m) => {
        batch.set(doc(collection(db, "notifications")), {
          userId: m.id, title: "⚔️ Missione di Gruppo!",
          message: `${charName} ha accettato "${qDoc.data.title}" per il party ${party}. Preparatevi!`,
          read: false, timestamp: serverTimestamp(),
        });
      });
    } else {
      batch.set(doc(collection(db, "notifications")), {
        userId: uid, title: "📜 Incarico Accettato",
        message: `Hai preso in carico la missione: "${qDoc.data.title}".`,
        read: false, timestamp: serverTimestamp(),
      });
    }
    await batch.commit();
    return `✅ Missione **${qDoc.data.title}** accettata a nome di **${charName}** (gruppo ${party})! Buona fortuna.`;
  } catch (e) {
    return `⚠️ ${e.message || "Errore nell'accettare la missione."}`;
  }
}

const CSS = `
.ast{
  --panel:#fbf4e0; --panel2:#f1e7cf; --line:rgba(124,86,15,.28);
  --gold:#a9781a; --gold-deep:#7c560f; --red:#b8362a; --red-soft:#8a261c;
  --ink:#33281a; --muted:#6a5b41;
  display:flex; flex-direction:column;
  height:calc(100dvh - var(--navbar-h) - 24px); margin:calc(var(--navbar-h) + 24px) auto 0;
  max-width:760px; width:100%;
  font-family:var(--font-text),Georgia,serif; font-size:17px; color:var(--ink);
  background:var(--panel);
  border-left:1px solid var(--line); border-right:1px solid var(--line);
  box-shadow:0 0 40px rgba(86,64,30,.10);
}
.ast *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.ast-head{
  position:relative;
  padding:18px 20px 16px; border-bottom:2px solid var(--gold);
  display:flex; align-items:center; gap:16px; flex:0 0 auto;
  background:
    radial-gradient(circle at 12% 18%, rgba(169,120,26,.12), transparent 45%),
    linear-gradient(180deg,#f6edd6,#fbf4e0);
}
/* filetto araldico decorativo sotto l'header */
.ast-head::after{
  content:"";position:absolute;left:18px;right:18px;bottom:-2px;height:2px;
  background:linear-gradient(90deg,transparent,var(--red) 20%,var(--gold) 50%,var(--red) 80%,transparent);
  opacity:.6;
}
.ast-head .orb{
  width:50px;height:50px;border-radius:50%;flex:0 0 50px;
  background:radial-gradient(circle at 38% 32%,#ffe7a8,#d4af37 55%,#820a0a);
  box-shadow:0 0 16px rgba(212,175,55,.5), inset 0 0 6px rgba(255,255,255,.4), 0 0 0 2px rgba(255,240,210,.5);
  display:flex;align-items:center;justify-content:center;font-size:24px;
  animation:ast-orb-glow 3s ease-in-out infinite;
}
@keyframes ast-orb-glow{0%,100%{box-shadow:0 0 16px rgba(212,175,55,.5), inset 0 0 6px rgba(255,255,255,.4), 0 0 0 2px rgba(255,240,210,.5)}50%{box-shadow:0 0 26px rgba(212,175,55,.7), inset 0 0 6px rgba(255,255,255,.5), 0 0 0 2px rgba(255,240,210,.6)}}
.ast-head .info .eyebrow{
  display:block;font-family:var(--font-title),'Cinzel',serif;
  font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-deep);margin:0 0 3px;
}
.ast-head .info h1{font-family:var(--font-title),'Cinzel',serif;font-size:21px;color:var(--red);margin:0;line-height:1.15;letter-spacing:.5px}
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
  background:var(--panel2); color:var(--ink);
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
.ast-modal .no{background:var(--panel2);color:var(--ink);border:1px solid var(--line)}
.ast-modal .no:hover{background:var(--panel2)}

/* SUGGESTIONS */
.ast-hints{display:flex;flex-direction:column;gap:9px;padding:10px 16px 6px;flex:0 1 auto;overflow-y:auto;max-height:44vh}
.ast-hint-group{display:flex;flex-direction:column;gap:5px}
.ast-hint-label{
  font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;
  color:var(--gold-deep);font-family:var(--font-title),'Cinzel',serif;
  display:flex;align-items:center;gap:6px;
}
.ast-hint-row{display:flex;gap:6px;flex-wrap:wrap}
.hint{
  padding:6px 12px;border-radius:18px;font-size:13px;cursor:pointer;
  background:var(--panel2);border:1px solid var(--line);color:var(--red);
  transition:.15s; font-family:var(--font-text),serif;
}
.hint:hover{background:var(--red);color:#fdf3e3;border-color:var(--red)}

/* INPUT */
.ast-bar{
  padding:12px 16px 14px;border-top:2px solid var(--gold);
  display:flex;gap:10px;flex:0 0 auto;background:linear-gradient(0deg,#efe6d0,#fbf4e0);
}
.ast-bar textarea{
  flex:1;padding:11px 13px;border-radius:11px;border:1px solid var(--gold);
  background:#fffdf5;color:var(--ink);font-size:16px;font-family:var(--font-text),serif;
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

const HINT_GROUPS = [
  { icon: "📜", label: "Scheda", hints: ["Mostrami la mia scheda", "Quanti soldi ho?", "Che incantesimi ho?"] },
  { icon: "🛡️", label: "Gruppo", hints: ["Com'è messo il mio gruppo?", "Chi sono i miei compagni?"] },
  { icon: "🛒", label: "Mercato", hints: ["Cosa c'è al mercato per me?", "Cosa posso permettermi?"] },
  { icon: "⚔️", label: "Missioni", hints: ["Ci sono missioni per me?", "Quali incarichi sono disponibili?"] },
  { icon: "📖", label: "Riassunti", hints: ["Riassumi l'ultima sessione", "Cosa è successo finora?"] },
  { icon: "🧙", label: "NPC", hints: ["Chi è Hemile?", "Cerca un personaggio"] },
  { icon: "🗺️", label: "Luoghi", hints: ["Parlami di Tirrendale", "Descrivimi un luogo"] },
  { icon: "✨", label: "Divinità", hints: ["Chi venera Morgath?", "Parlami del pantheon"] },
  { icon: "🏆", label: "Arena", hints: ["Chi ha vinto l'ultimo torneo?", "Come va il torneo dell'arena?"] },
  { icon: "🃏", label: "TCG", hints: ["Come va il torneo di carte?", "Chi è il campione TCG?"] },
  { icon: "🐉", label: "World Boss", hints: ["C'è un boss attivo?", "Come sta il boss?"] },
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
    { role: "assistant", content: "Salve. Sono la memoria vivente di Eldoria. Chiedimi di missioni, mercato, personaggi, luoghi o sessioni passate. Come posso aiutarti?", time: now() }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [trace, setTrace] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [showHints, setShowHints] = useState(true);
  const greetedRef = useRef(false);
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // Saluto personalizzato col nome del personaggio (se la conversazione è ancora vergine).
  useEffect(() => {
    if (!currentUser?.uid || greetedRef.current) return;
    greetedRef.current = true;
    getDoc(doc(db, "characters", currentUser.uid)).then(snap => {
      const nome = snap.exists() ? (snap.data().name || "").trim() : "";
      if (!nome) return;
      setMessages(m => (m.length === 1 && m[0].role === "assistant")
        ? [{ ...m[0], content: `Salve, ${nome}. Sono la memoria vivente di Eldoria. Chiedimi di missioni, mercato, personaggi, luoghi o sessioni passate. Come posso aiutarti?` }]
        : m);
    }).catch(() => {});
  }, [currentUser]);

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

    // Conta la consultazione (totale + per giocatore). Fire-and-forget.
    if (currentUser?.uid) {
      setDoc(doc(db, "agent_stats", "global"), {
        total: increment(1),
        perUser: { [currentUser.uid]: increment(1) },
        lastUsed: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }

    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          uid: currentUser?.uid,
          email: currentUser?.email,
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
      const uid = currentUser?.uid;
      if (!uid) throw new Error("Devi essere loggato per eseguire questa azione.");
      // La scrittura avviene QUI lato client (utente autenticato): le regole
      // Firestore richiedono il login, quindi il backend non potrebbe scriverla.
      let reply;
      if (action.type === "fai_offerta") reply = await doOffer(uid, action.params);
      else if (action.type === "accetta_missione") reply = await doAcceptQuest(uid, action.params);
      else throw new Error("Azione non riconosciuta.");
      addTrace("✅", "Azione completata");
      setMessages(m => [...m, { role: "assistant", content: reply, time: now() }]);
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
          <span className="eyebrow">✦ Oracolo di Eldoria</span>
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
          {HINT_GROUPS.map((g, gi) => (
            <div key={gi} className="ast-hint-group">
              <div className="ast-hint-label"><span>{g.icon}</span>{g.label}</div>
              <div className="ast-hint-row">
                {g.hints.map((h, i) => (
                  <div key={i} className="hint" onClick={() => send(h)}>{h}</div>
                ))}
              </div>
            </div>
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