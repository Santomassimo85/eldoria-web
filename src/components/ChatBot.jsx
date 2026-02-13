import { useState, useEffect, useRef } from "react";

/**
 * ChatBot Component
 * A fantasy-themed chatbot interface that communicates with Google's Gemini API.
 * The bot is styled as "The Sage of Eldoria" and responds to D&D 5e related questions.
 */
export default function ChatBot() {
  // State for user input field
  const [input, setInput] = useState("");

  // State for chat conversation history
  const [chatHistory, setChatHistory] = useState([
    { role: "model", text: "Salute, avventuriero. I tomi di Eldoria sono aperti per te." }
  ]);

  // State for API request loading indicator
  const [loading, setLoading] = useState(false);

  // State to control chatbot window visibility
  const [isOpen, setIsOpen] = useState(false);

  // Reference for auto-scrolling to latest message
  const scrollRef = useRef(null);

  // API key for Google Gemini from environment variables
  const API_KEY = import.meta.env.VITE_GEMINI_KEY;

  // Auto-scroll to bottom when new messages arrive or loading state changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory, loading]);

  /**
   * Handles sending user messages to the Gemini API
   * @param {Event} e - Form submission event
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setChatHistory(prev => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
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
              parts: [{ text: `Sei il Sapiente di Eldoria, un esperto di D&D 5e. Rispondi in modo epico e conciso ma soprattutto organizzato (utilizza liste dove serve e rendi il testo leggibile, utilizza anche formattazione per rendere tutto piú carino).
              
              Domanda dell'avventuriero: ${userText}` }]
            }]
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("API ERROR:", data);
        throw new Error(data.error?.message || "Unknown error");
      }

      // Extract bot response from API response
      const botResponse = data.candidates[0].content.parts[0].text;
      setChatHistory(prev => [...prev, { role: "model", text: botResponse }]);

    } catch (error) {
      console.error("ERROR CAUGHT:", error);
      setChatHistory(prev => [...prev, { role: "model", text: `❌ Le nebbie sono fitte... (${error.message})` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 1000 }}>
      {/* Chatbot toggle button */}
      {!isOpen && (
        <div onClick={() => setIsOpen(true)} className="chatBotClick">🧙‍♂️</div>
      )}

      {/* Chatbot window */}
      {isOpen && (
        <div style={{ width: "320px", height: "450px", background: "#ffffff", fontSize: "0.9rem", border: "2px solid var(--gold)", borderRadius: "10px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header with title and close button */}
          <div style={{ padding: "10px", background: "var(--gold)", color: "black", fontWeight: "bold", display: "flex", justifyContent: "space-between" }}>
            <span>📜 Sapiente di Eldoria</span>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>✕</button>
          </div>

          {/* Message display area */}
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
            {loading && <p style={{ color: "var(--gold)", fontSize: "0.6rem", padding: "10px" }}>Il saggio sta consultando le stelle...</p>}
          </div>

          {/* Input form */}
          <form onSubmit={handleSendMessage} style={{ display: "flex", borderTop: "1px solid #282424", padding: "5px", background: "#040404db" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Chiedi pure..." style={{ flex: 1, background: "transparent", color: "white", border: "none", padding: "10px" }} />
            <button type="submit" style={{ background: "var(--gold)", border: "none", padding: "5px 15px", cursor: "pointer", fontWeight: "bold" }}>➔</button>
          </form>
        </div>
      )}
    </div>
  );
}