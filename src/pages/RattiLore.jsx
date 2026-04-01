import React from "react";
import { Link } from "react-router-dom";

const RATTO_LEVELS = [
  { lv: 0, min: 0, name: "Estraneo", bonus: "Nessun privilegio. Sei solo un altro volto nella massa." },
  { lv: 1, min: 5, name: "Simpatizzante", bonus: "Sconto di 15 MP sul prossimo acquisto + un regalo (tira 1d100)." },
  { lv: 2, min: 15, name: "Informatore", bonus: "Accesso a slot mercato segreti (oggetti visibili solo a Lv. 2+)." },
  { lv: 3, min: 30, name: "Ricettatore", bonus: "Acquisto di un 'Boon' (Bonus temporaneo) per una sessione + un regalo (tira 1d100)." },
  { lv: 4, min: 50, name: "Veterano", bonus: "Sblocco di un secondo slot mercato extra per oggetti leggendari." },
  { lv: 5, min: 80, name: "Ombra di Obia", bonus: "+100 MP, +1 Carisma permanente e l'Occhio dell'Arcano." },
  { lv: 6, min: 110, name: "Ratto", bonus: "Coming Soon..."}
];

export default function RattiLore() {
  return (
    <section className="lore-page">
      
      <h1 style={{ color: "var(--gold)", textAlign: "center" }}>La Gilda dei Ratti</h1>
      
      <div className="lore-content" style={{ maxWidth: "800px", margin: "0 auto", lineHeight: "1.6" }}>
        <p>
          Nelle cronache di <strong>Obia</strong>, tra le macerie della prima grande guerra, si parla di uno squadrone 
          eterogeneo conosciuto come i <strong>"Ratti"</strong>. Mentre gli eserciti cadevano, questo gruppo 
          formato da rinnegati di ogni razza combatteva nell'ombra, riuscendo da solo a ricacciare nell'abisso oltre la 
          metà delle legioni demoniache e abbattendo due generali infernali.<br /><br />
        </p>
        
        <blockquote>
        <i>"Non cercavano la gloria dei serafini, ma la sopravvivenza del fango."</i>
        <br /><br />
        </blockquote>

        <p>
          Oggi, 1852 anni dopo la <em><b>Caduta delle Stelle</b></em>, la reputazione tra i Ratti non è solo un titolo, 
          ma la chiave per accedere alle risorse più rare di Exanthia. Interagire con il Mercato Nero significa dimostrare 
          la propria astuzia: ogni offerta piazzata e ogni affare concluso aumenta la tua influenza nel sottosuolo.
        </p>
        <br /><br /><br />

    <h4>
            🐀 <strong>COME FUNZIONA LA REPUTAZIONE?</strong><br />
    </h4>
        <p>
          Ogni acquisto effettuato nel Mercato Nero ti fa guadagnare Punti Ratto (PR). Più alto è il tuo livello di Ratto, 
          più vantaggi sblocchi, come sconti esclusivi, accesso a oggetti nascosti e persino poteri temporanei. 
          Ma attenzione: i Ratti sono sempre alla ricerca di nuovi membri, e la tua reputazione è la tua moneta più preziosa. Riuscirai a scalare le gerarchie del sottosuolo e diventare una leggenda tra i Ratti? <br
    /> <br />
    Ovviamente i criminali piú pericolosi di Exanthia sono continuamente alla ricerca di tesori...e questo fa di voi delle possibili prede.
          </p>

        <h2 style={{ color: "var(--red)", marginTop: "40px" }}>Gradi di Reputazione</h2>
        <table className="ratto-table" style={{ width: "100%", marginTop: "20px", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--gold)", color: "var(--gold)" }}>
              <th style={{ padding: "10px", textAlign: "left" }}>Grado</th>
              <th style={{ padding: "10px", textAlign: "left" }}>Punti</th>
              <th style={{ padding: "10px", textAlign: "left" }}>Privilegi del Sottosuolo</th>
            </tr>
          </thead>
          <tbody>
            {RATTO_LEVELS.map((l) => (
              <tr key={l.lv} style={{ borderBottom: "1px solid #333" }}>
                <td style={{ padding: "10px" }}><strong>Lv.{l.lv} - {l.name}</strong></td>
                <td style={{ padding: "10px" }}>{l.min} PR</td>
                <td style={{ padding: "10px", fontSize: "0.9rem" }}>{l.bonus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}