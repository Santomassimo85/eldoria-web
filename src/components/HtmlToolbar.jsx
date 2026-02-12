import React from "react";

export default function HtmlToolbar({ textAreaRef, formData, setFormData, fieldName }) {
  const insertTag = (tagOpen, tagClose = "") => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    // Prendiamo le coordinate del cursore
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Il testo attuale nello stato di React
    const text = formData[fieldName] || "";
    
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);

    // Costruiamo il nuovo testo
    const newText = `${before}${tagOpen}${selected}${tagClose}${after}`;

    // AGGIORNAMENTO FONDAMENTALE: aggiorna lo stato del componente padre
    setFormData({
      ...formData,
      [fieldName]: newText
    });

    // Riportiamo il focus sulla textarea dopo un micro-secondo
    setTimeout(() => {
      textarea.focus();
      // Riposizioniamo il cursore dopo il tag aperto (se non c'era selezione) 
      // o dopo il tag chiuso (se c'era selezione)
      const newCursorPos = start + tagOpen.length + selected.length + tagClose.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  return (
    <div className="html-toolbar" style={{ marginBottom: "8px", display: "flex", gap: "5px", flexWrap: "wrap" }}>
      <button type="button" onClick={() => insertTag("<b>", "</b>")} style={btnStyle}><b>B</b></button>
      <button type="button" onClick={() => insertTag("<i>", "</i>")} style={btnStyle}><i>I</i></button>
      <button type="button" onClick={() => insertTag("<br>", "")} style={btnStyle}>A Capo</button>
      <button type="button" onClick={() => insertTag("<ul>\n  <li>", "</li>\n</ul>")} style={btnStyle}>Lista</button>
      <button type="button" onClick={() => insertTag('<span style="color:var(--gold)">', "</span>")} style={btnStyle}>Oro</button>
      <button type="button" onClick={() => insertTag('<h3 style="color:var(--gold)">', "</h3>")} style={btnStyle}>Titolo H3</button>
    </div>
  );
}

const btnStyle = {
  background: "#333",
  color: "#f3d997",
  border: "1px solid #f3d997",
  padding: "4px 8px",
  cursor: "pointer",
  borderRadius: "4px",
  fontSize: "0.8rem"
};