import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./style.css";
import "./styles/theme.css"; // design system "Arcanum Nocturne" — dopo style.css per rimappare i token
import "./styles/shell.css"; // restyle header/navigazione (scuro premium + drawer mobile)
import "./styles/light-theme.css"; // tema chiaro "Pergamena Antica" — caricato per ultimo (vince)
import "./styles/layout.css"; // posizionamento flottanti coerente + safe-area iOS
import "./styles/nesso.css"; // Prototipo J "Il Nesso" — il vuoto arcano, varchi esagonali (solo tema chiaro)

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
