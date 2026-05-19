/* Manual — detailed but simple rules (Italian) */
import React from "react";
import {
  ELEMENTS, ELEMENT_LABEL, ELEMENT_ICON,
  RARITY_ORDER, RARITY_LABEL, RARITY_COLOR, KEYWORDS, KEYWORD_IDS,
} from "../../tcg/cards.js";

export default function Manual({ onBack }) {
  return (
    <div className="tcg-doc">
      <div className="tcg-doc__head">
        <button className="tcg-btn tcg-btn--ghost" onClick={onBack}>
          ‹ Indietro
        </button>
        <h1 className="tcg-doc__title">📖 Manuale</h1>
        <span />
      </div>

      <div className="tcg-doc__body">
        <section>
          <h2>Obiettivo</h2>
          <p>
            Ogni giocatore parte con <b>25 Punti Vita</b>. Vinci portando i
            Punti Vita dell'avversario a <b>0</b>.
          </p>
        </section>

        <section>
          <h2>Il mana e le Terre</h2>
          <p>
            Il mana è di <b>colore</b>: ogni colore è un{" "}
            <b>tipo di danno di D&amp;D</b> (Fuoco, Gelo, Radioso, Necrotico,
            Fulmine, Veleno). Per produrlo giochi le{" "}
            <b>Terre</b> ("Fonte di …"): puoi giocare{" "}
            <b>al massimo 1 Terra per turno</b>. Ogni Terra resta in campo e
            fornisce <b>1 mana del suo elemento</b>. Le Terre si ricaricano
            (si "stappano") all'inizio del tuo turno; il mana non speso{" "}
            <b>non si accumula</b>.
          </p>
          <p className="tcg-doc__els">
            {ELEMENTS.map((el) => (
              <span key={el} className="tcg-doc__el">
                {ELEMENT_ICON[el]} {ELEMENT_LABEL[el]}
              </span>
            ))}
          </p>
        </section>

        <section>
          <h2>Costo delle carte</h2>
          <p>
            Ogni carta ha un costo fatto di <b>simboli colorati</b> e di un
            eventuale numero <b>generico</b>. I simboli colorati vanno pagati
            con mana di <b>quell'elemento</b>; il numero generico con mana di{" "}
            <b>qualsiasi</b> elemento. Le Terre si "toccano" da sole per pagare
            (come in MTG Arena).
          </p>
        </section>

        <section>
          <h2>Tipi di carta</h2>
          <p>
            Sulla carta, accanto all'elemento, una <b>iconcina</b> indica il
            tipo (la parola "Creatura/Magia…" non è più scritta):
          </p>
          <ul>
            <li>
              <b>🐾 Creatura</b> — entra in campo, ha Forza/Costituzione (F/C).
            </li>
            <li>
              <b>📜 Magia</b> — effetto immediato a velocità normale (solo nel
              tuo turno), poi va nel cimitero.
            </li>
            <li>
              <b>⚡ Istantaneo</b> — come la Magia, ma puoi giocarlo{" "}
              <b>in qualsiasi momento</b>: nel turno avversario, in risposta
              a un'altra carta o durante il combattimento (vedi “La Pila”).
            </li>
            <li>
              <b>💠 Manufatto</b> — resta in campo con un effetto continuo.
            </li>
            <li><b>⛰️ Terra</b> — fonte di mana, gratis, 1 per turno.</li>
          </ul>
        </section>

        <section>
          <h2>Turno</h2>
          <ol>
            <li>Stappa Terre e creature, cura/effetti d'inizio turno.</li>
            <li>Pesca 1 carta (chi muove per primo salta la prima pescata).</li>
            <li>
              <b>Fase principale 1</b>: gioca 1 Terra e tutte le carte che
              puoi pagare.
            </li>
            <li>Dichiara gli attaccanti (toccano le creature che attaccano).</li>
            <li>
              L'avversario dichiara i bloccanti (anche <b>più di uno</b> sullo
              stesso attaccante). Qui si possono giocare <b>⚡ Istantanei</b>.
            </li>
            <li>I danni si risolvono simultaneamente.</li>
            <li>
              <b>Fase principale 2</b>: se non avevi giocato, puoi farlo ora
              (dopo il combattimento).
            </li>
            <li>
              Scarta fino a un massimo di <b>7 carte</b> in mano, poi premi{" "}
              <b>Fine Turno</b>.
            </li>
          </ol>
        </section>

        <section>
          <h2>Combattimento</h2>
          <p>
            Le creature appena evocate hanno la <b>fiacca da evocazione</b> e
            non possono attaccare per un turno. Una creatura non bloccata
            infligge la sua <b>Forza</b> ai Punti Vita avversari; se bloccata,
            attaccante e bloccante si infliggono danni a vicenda. Una creatura
            muore se i danni accumulati nel turno raggiungono la sua{" "}
            <b>Costituzione</b>.
          </p>
        </section>

        <section>
          <h2>La Pila (istantanei e risposte)</h2>
          <p>
            Quando qualcuno lancia un <b>incantesimo</b> (Magia o Istantaneo)
            questo non si risolve subito: va nella <b>Pila</b> (il riquadro
            al centro) e l'avversario può <b>rispondere</b> con un proprio{" "}
            <b>⚡ Istantaneo</b>. Quando entrambi <b>passano</b>, si risolve
            prima la carta <b>in cima</b> alla Pila (ultima entrata, prima
            uscita).
          </p>
          <ul>
            <li>
              Se hai priorità appare il pulsante <b>PASSA</b>; se non hai
              istantanei giocabili passi <b>in automatico</b>.
            </li>
            <li>
              <b>Contromagia</b> annulla un incantesimo ancora nella Pila.
            </li>
            <li>
              Gli istantanei sono ottimi come <b>trucchi di combattimento</b>
              {" "}(es. <b>Nebbia</b>, <b>Crescita Improvvisa</b>) giocati dopo
              gli attaccanti/bloccanti.
            </li>
          </ul>
        </section>

        <section>
          <h2>Rarità</h2>
          <p>
            Ogni carta ha una <b>rarità</b>, indicata da un pallino colorato
            sulla carta:
          </p>
          <p className="tcg-doc__els">
            {RARITY_ORDER.map((r) => (
              <span key={r} className="tcg-doc__el">
                <span
                  style={{
                    display: "inline-block", width: 10, height: 10,
                    borderRadius: "50%", background: RARITY_COLOR[r],
                    marginRight: 6, verticalAlign: "middle",
                  }}
                />
                {RARITY_LABEL[r]}
              </span>
            ))}
          </p>
          <p>
            Più alta è la rarità, più la carta è <b>rara</b> e potente — e meno
            probabile da trovare nei pacchetti.
          </p>
        </section>

        <section>
          <h2>Abilità passive (parole chiave)</h2>
          <p>
            Molte creature hanno abilità permanenti, con nomi ispirati a{" "}
            <b>Dungeons &amp; Dragons</b>:
          </p>
          <ul>
            {KEYWORD_IDS.map((k) => (
              <li key={k}>
                <b>{KEYWORDS[k].label}</b> — {KEYWORDS[k].desc}
              </li>
            ))}
          </ul>
          <p>
            Tieni premuto (o tasto destro / 🔍) su una carta per{" "}
            <b>ingrandirla</b> e leggere tutte le abilità in chiaro.
          </p>
        </section>

        <section>
          <h2>Mazzo, Negozio e Collezione</h2>
          <p>
            Il mazzo è di <b>60 carte</b>. Le Terre base sono{" "}
            <b>illimitate e gratuite</b>; delle altre carte puoi mettere fino a{" "}
            <b>4 copie</b> (se le possiedi). Nel <b>Negozio</b> ogni{" "}
            <b>pacchetto</b> contiene <b>15 carte di un solo elemento</b>, con
            rarità casuale (le rarità alte sono molto più rare); i pacchetti di{" "}
            <b>{ELEMENT_LABEL.light}</b> e <b>{ELEMENT_LABEL.darkness}</b>{" "}
            costano di più. Le carte escono{" "}
            <b>coperte</b>: toccale una per una per scoprirle, o usa{" "}
            “Scopri tutte”. Le <b>monete</b> si guadagnano in battaglia. In{" "}
            <b>Mazzo</b> puoi costruire a mano, usare la{" "}
            <b>creazione automatica</b> e scegliere il <b>dorso</b> delle carte.
          </p>
        </section>

        <section>
          <h2>Consigli</h2>
          <ul>
            <li>Gioca una Terra ogni turno: senza mana non fai nulla.</li>
            <li>Tieni circa 22–24 Terre nei colori che usi davvero.</li>
            <li>Non scendere sotto pochi colori: due elementi sono già tanti.</li>
            <li>Cura la curva: tante carte da 1–3 mana, poche grosse.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
