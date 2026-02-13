import React from "react";

export default function HtmlToolbar({ textAreaRef, formData, setFormData, fieldName }) {
  const insertTag = (tagOpen, tagClose = "") => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData[fieldName] || "";
    
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${tagOpen}${selected}${tagClose}${after}`;

    setFormData({
      ...formData,
      [fieldName]: newText
    });

    setTimeout(() => {
      textarea.focus();
      const cursorOffset = tagOpen.length + selected.length + tagClose.length;
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 10);
  };

  // Funzione per inserire un colore a scelta
  const insertColor = () => {
    const color = prompt("Inserisci codice colore (es: #ff0000 o gold):", "var(--gold)");
    if (color) {
      insertTag(`<span style="color:${color}">`, "</span>");
    }
  };

  return (
    <div className="html-toolbar" style={{ marginBottom: "10px", display: "flex", gap: "5px", flexWrap: "wrap", background: "#222", padding: "5px", borderRadius: "5px" }}>
      {/* Formattazione Base */}
      <button type="button" onClick={() => insertTag("<b>", "</b>")} style={btnStyle} title="Grassetto">B</button>
      <button type="button" onClick={() => insertTag("<i>", "</i>")} style={btnStyle} title="Corsivo">I</button>
      <button type="button" onClick={() => insertTag("<u>", "</u>")} style={btnStyle} title="Sottolineato">U</button>
      
      {/* Colori e Stili Speciali */}
      <button type="button" onClick={() => insertTag('<span style="color:var(--gold)">', "</span>")} style={{...btnStyle, color: "var(--gold)"}} title="Testo Oro">Oro</button>
      <button type="button" onClick={insertColor} style={btnStyle} title="Colore Personalizzato">🎨 Colore</button>
      
      {/* Struttura */}
      <button type="button" onClick={() => insertTag('<span class="start">', "</span>")} style={{...btnStyle, border: "1px solid var(--gold)"}} title="Capolettera Grande">A (DropCap)</button>
      <button type="button" onClick={() => insertTag("<br>", "")} style={btnStyle}>A Capo</button>
      <button type="button" onClick={() => insertTag('<hr style="border: 0; border-top: 1px solid #444; margin: 20px 0;">', "")} style={btnStyle}>Linea —</button>
      
      {/* Liste */}
      <button type="button" onClick={() => insertTag("<ul>\n  <li>", "</li>\n</ul>")} style={btnStyle}>Lista •</button>
      <button type="button" onClick={() => insertTag('<h3 style="color:var(--gold); border-bottom: 1px solid #444; padding-bottom: 5px;">', "</h3>")} style={btnStyle}>Titolo H3</button>
    </div>
  );
}

const btnStyle = { 
  background: "#333", 
  color: "#fff", 
  border: "1px solid #555", 
  padding: "4px 10px", 
  cursor: "pointer", 
  borderRadius: "3px",
  fontSize: "0.85rem",
  fontWeight: "bold"
};