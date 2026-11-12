import { createRoot } from "react-dom/client";
import "../src/styles/covo.css";
import "../src/pages/Segrete.css";
import "./demo.css";
import DemoApp from "./DemoApp";

document.body.classList.add("theme-dark");
// niente menu contestuale né selezione: è un gioco
window.addEventListener("contextmenu", (e) => { if (!e.target.closest?.("input, textarea")) e.preventDefault(); });
createRoot(document.getElementById("root")).render(<DemoApp />);
