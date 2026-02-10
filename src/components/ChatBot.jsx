import React, { useState, useEffect, useRef } from "react";

export default function ChatBot() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: "model", text: "Salute, avventuriero. I tomi di Eldoria sono aperti per te." }
  ]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef(null);

  // --- IMPORTANTE: INSERISCI QUI LA TUA CHIAVE ---
  const API_KEY = "AIzaSyDfzU0B4FqQ34BEgAMRuklIAYBUxZl7R4c"; 

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory, loading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setChatHistory(prev => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
      // USIAMO IL MODELLO CHE ABBIAMO VISTO NELLA TUA LISTA: gemini-2.5-flash
      const MODEL_NAME = "gemini-2.5-flash"; 
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `Sei il Sapiente di Eldoria, un esperto di D&D 5e. Rispondi in modo epico e conciso.
              
              Domanda dell'avventuriero: ${userText}` }]
            }]
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("ERRORE GOOGLE:", data);
        throw new Error(data.error?.message || "Errore sconosciuto");
      }

      // Estraiamo la risposta
      const botResponse = data.candidates[0].content.parts[0].text;
      setChatHistory(prev => [...prev, { role: "model", text: botResponse }]);

    } catch (error) {
      console.error("ERRORE CATTURATO:", error);
      setChatHistory(prev => [...prev, { role: "model", text: `❌ Le nebbie sono fitte... (${error.message})` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 1000 }}>
      {!isOpen && (
        <div onClick={() => setIsOpen(true)} className="chatBotClick">🧙‍♂️</div>
      )}

      {isOpen && (
        <div style={{ width: "320px", height: "450px", background: "#ffffff", border: "2px solid var(--gold)", borderRadius: "10px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px", background: "var(--gold)", color: "black", fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
            <span>📜 Sapiente di Eldoria</span>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>✕</button>
          </div>
          
          <div ref={scrollRef} style={{ flex: 1, padding: "10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ 
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start", 
                background: msg.role === "user" ? "#5d0000" : "#f3d997", 
                color: msg.role === "user" ? "#fff" : "#000000a3",
                padding: "8px", borderRadius: "5px", maxWidth: "85%",
                whiteSpace: "pre-wrap"
              }}>
                {msg.text}
              </div>
            ))}
            {loading && <p style={{color: "var(--gold)", fontSize: "0.8rem", padding: "10px"}}>Il saggio sta consultando le stelle...</p>}
          </div>

          <form onSubmit={handleSendMessage} style={{ display: "flex", borderTop: "1px solid #282424", padding: "5px", background: "#040404db" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Chiedi pure..." style={{ flex: 1, background: "transparent", color: "white", border: "none", padding: "10px" }} />
            <button type="submit" style={{ background: "var(--gold)", border: "none", padding: "5px 15px", cursor: "pointer", fontWeight: "bold" }}>➔</button>
          </form>
        </div>
      )}
    </div>
  );
}