import React, { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Inserisci qui la tua API Key senza spazi
const API_KEY = "AIzaSyDfzU0B4FqQ34BEgAMRuklIAYBUxZl7R4c"; 
const genAI = new GoogleGenerativeAI(API_KEY);

export default function ChatBot() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: "model", text: "Salute, cercatore di conoscenza. Cosa desideri sapere su Eldoria o sulle leggi del fato (D&D)?" }
  ]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll verso il basso
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, loading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
      // Usiamo gemini-1.5-flash-latest per massimizzare la compatibilità
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      
      const systemPrompt = "Sei il Sapiente di Eldoria, esperto di D&D 5e. Rispondi in modo epico e fantasy.";
      const promptCompleto = `${systemPrompt}\n\nUtente: ${userText}`;
      
      const result = await model.generateContent(promptCompleto);
      const response = await result.response;
      const text = response.text();

      setChatHistory((prev) => [...prev, { role: "model", text }]);
    } catch (error) {
      console.error("ERRORE API GEMINI:", error);
      
      // Fallback per gemini-pro se flash fallisce ancora
      try {
        const backupModel = genAI.getGenerativeModel({ model: "gemini-pro" });
        const backupResult = await backupModel.generateContent(userText);
        const backupText = backupResult.response.text();
        setChatHistory((prev) => [...prev, { role: "model", text: backupText }]);
      } catch (innerError) {
        setChatHistory((prev) => [...prev, { role: "model", text: "Le nebbie magiche sono troppo fitte. (Errore: " + error.message + ")" }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 1000 }}>
      {!isOpen && (
        <div onClick={() => setIsOpen(true)} style={{ cursor: "pointer", fontSize: "40px", background: "var(--gold)", borderRadius: "50%", width: "60px", height: "60px", display: "flex", justifyContent: "center", alignItems: "center", boxShadow: "0 0 15px rgba(0,0,0,0.5)" }}>
          🧙‍♂️
        </div>
      )}

      {isOpen && (
        <div style={{ width: "320px", height: "450px", background: "#1a1a1a", border: "2px solid var(--gold)", borderRadius: "10px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
          <div style={{ padding: "10px", background: "var(--gold)", color: "black", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📜 Il Sapiente di Eldoria</span>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "1.2rem" }}>✕</button>
          </div>
          
          <div ref={scrollRef} style={{ flex: 1, padding: "10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.9rem" }}>
            {chatHistory.map((msg, i) => (
              <div 
                key={i} 
                style={{ 
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start", 
                  background: msg.role === "user" ? "#5d0000" : "#f3d997", 
                  color: msg.role === "user" ? "#FFFFFF" : "#2f2e2e",
                  padding: "10px", 
                  borderRadius: "8px", 
                  maxWidth: "85%",
                  boxShadow: "2px 2px 5px rgba(0,0,0,0.3)",
                  lineHeight: "1.4",
                  whiteSpace: "pre-wrap"
                }}
              >
                {msg.text}
              </div>
            ))}
            {loading && <p style={{ fontSize: "0.8rem", color: "var(--gold)", fontStyle: "italic", padding: "10px" }}>Il saggio consulta i tomi...</p>}
          </div>

          <form onSubmit={handleSendMessage} style={{ display: "flex", borderTop: "1px solid #333", padding: "5px", background: "#222" }}>
            <input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Chiedi al saggio..." 
              style={{ flex: 1, padding: "10px", background: "transparent", color: "white", border: "none", outline: "none" }}
            />
            <button type="submit" disabled={loading} style={{ padding: "10px 15px", background: "var(--gold)", color: "black", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>➔</button>
          </form>
        </div>
      )}
    </div>
  );
}