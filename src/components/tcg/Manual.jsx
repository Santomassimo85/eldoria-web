/* ============================================================
   Manual — colour-coded, player-friendly rules.
   2026-05-20 rewrite: each section gets a distinct accent colour
   and an icon banner so it scans like a guide, not a wall of text.
   Legacy Element-Powers section dropped — the class system now
   does that job.
   ============================================================ */
import React from "react";
import {
  ELEMENTS, ELEMENT_LABEL, ELEMENT_ICON, ELEMENT_PIP,
  RARITY_ORDER, RARITY_LABEL, RARITY_COLOR, KEYWORDS, KEYWORD_IDS,
  DICE_STATS,
} from "../../tcg/cards.js";
import {
  CLASSES, CLASS_LABEL, CLASS_ICON, CLASS_VIE,
  MULTICLASSES, MULTICLASS_DEF,
  LEVEL_THRESHOLDS,
} from "../../tcg/classes.js";

/* Coloured section wrapper — accent drives the title bar + border. */
function Section({ icon, title, accent, children }) {
  return (
    <section className="tcg-doc__sec" style={{ "--acc": accent }}>
      <header className="tcg-doc__sec-head">
        <span className="tcg-doc__sec-ico">{icon}</span>
        <h2 className="tcg-doc__sec-title">{title}</h2>
      </header>
      <div className="tcg-doc__sec-body">{children}</div>
    </section>
  );
}

/* Pill — small coloured highlight for inline key terms. */
function Tag({ tone = "gold", children }) {
  return <span className={`tcg-doc__tag tcg-doc__tag--${tone}`}>{children}</span>;
}

/* Callout — boxed important note */
function Note({ tone = "info", children }) {
  return <div className={`tcg-doc__note tcg-doc__note--${tone}`}>{children}</div>;
}

const ACCENT = {
  goal:    "#ffd66b", // gold
  klass:   "#b58cff", // purple
  xp:      "#ffaa3a", // orange
  slot:    "#4fb8ff", // cyan
  ult:     "#ff7ad4", // magenta
  mana:    "#5fd16a", // green
  combat:  "#ff7a6a", // red
  cards:   "#9ecf6a", // lime
  pila:    "#7a9fff", // azure
  rarity:  "#e0b15a", // amber
  shop:    "#ffcd5a", // gold-2
  tips:    "#c8c8c8", // grey
};

export default function Manual({ onBack }) {
  return (
    <div className="tcg-doc">
      <div className="tcg-doc__head">
        <button className="tcg-btn tcg-btn--ghost" onClick={onBack}>
          ‹ Indietro
        </button>
        <h1 className="tcg-doc__title">📖 Manuale del TCG</h1>
        <span />
      </div>

      <div className="tcg-doc__body">

        {/* ─── Quick-start hero card ─── */}
        <div className="tcg-doc__hero">
          <h2>In 30 secondi</h2>
          <div className="tcg-doc__hero-grid">
            <div className="tcg-doc__hero-card" style={{ "--acc": ACCENT.goal }}>
              <span className="tcg-doc__hero-ico">🎯</span>
              <b>Obiettivo</b>
              <small>Riduci l'avversario da <b>30</b> a <b>0</b> PV</small>
            </div>
            <div className="tcg-doc__hero-card" style={{ "--acc": ACCENT.klass }}>
              <span className="tcg-doc__hero-ico">🎓</span>
              <b>Classe dal mazzo</b>
              <small>Classe e via si scelgono a ogni partita in base ai <i>colori del tuo mazzo</i></small>
            </div>
            <div className="tcg-doc__hero-card" style={{ "--acc": ACCENT.xp }}>
              <span className="tcg-doc__hero-ico">⚡</span>
              <b>XP &amp; Livelli</b>
              <small>Sali livello giocando · al lv5 sblocchi l'ultimate</small>
            </div>
            <div className="tcg-doc__hero-card" style={{ "--acc": ACCENT.slot }}>
              <span className="tcg-doc__hero-ico">🔮</span>
              <b>Spell Slot</b>
              <small>Spell e reazioni costano mana <i>e</i> uno slot</small>
            </div>
          </div>
        </div>

        {/* ─── 1. Obiettivo ─── */}
        <Section icon="🎯" title="Obiettivo" accent={ACCENT.goal}>
          <p>
            Ogni giocatore parte con <Tag tone="gold">30 Punti Vita</Tag>.
            Vinci portando i PV dell'avversario a <Tag tone="red">0</Tag>.
            Se entrambi cadono nello stesso turno: <b>pareggio</b>.
          </p>
        </Section>

        {/* ─── 2. Classi, Multiclassi e Vie ─── */}
        <Section icon="🎓" title="Classi, Multiclassi &amp; Vie" accent={ACCENT.klass}>
          <p>
            La <Tag tone="purple">Classe</Tag> non è più fissa: a ogni partita
            il gioco rileva i <b>colori del tuo mazzo</b> e ti mostra le classi
            (e multiclassi) che puoi giocare. Scegli quella che preferisci e poi
            la <Tag tone="purple">Via</Tag> (sottoclasse D&amp;D), che determina
            il percorso di livellamento.
          </p>

          <h3>Le 5 classi base</h3>
          <p style={{ opacity: .8, fontSize: 13, marginTop: -4 }}>
            Basta avere <b>almeno un colore</b> della classe nel mazzo per
            poterla selezionare.
          </p>
          <ul className="tcg-doc__classes">
            {CLASSES.map((k) => {
              const vie = CLASS_VIE[k];
              return (
                <li key={k} className="tcg-doc__class">
                  <span className="tcg-doc__class-ico">{CLASS_ICON[k]}</span>
                  <span className="tcg-doc__class-name">
                    <b>{CLASS_LABEL[k]}</b>
                    {" — "}
                    {Object.entries(vie).map(([vk, v], i, a) => (
                      <React.Fragment key={vk}>
                        <span
                          className="tcg-doc__via"
                          style={{ color: ELEMENT_PIP[v.element] }}
                        >
                          {ELEMENT_ICON[v.element]} {v.label}
                        </span>
                        {i < a.length - 1 ? " · " : ""}
                      </React.Fragment>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>

          <h3>Le 5 multiclassi</h3>
          <p style={{ opacity: .8, fontSize: 13, marginTop: -4 }}>
            Si sbloccano quando il mazzo contiene <b>tutti e tre</b> i colori
            della combo. Eredite le 4 vie delle classi sorgenti e ottieni
            un'<b>ultimate dedicata</b> al livello 5.
          </p>
          <ul className="tcg-doc__classes">
            {MULTICLASSES.map((k) => {
              const m = MULTICLASS_DEF[k];
              return (
                <li key={k} className="tcg-doc__class">
                  <span className="tcg-doc__class-ico">{m.icon}</span>
                  <span className="tcg-doc__class-name">
                    <b>{m.label}</b>
                    {" — "}
                    {m.elements.map((el, i, a) => (
                      <React.Fragment key={el}>
                        <span style={{ color: ELEMENT_PIP[el] }}>
                          {ELEMENT_ICON[el]} {ELEMENT_LABEL[el]}
                        </span>
                        {i < a.length - 1 ? " · " : ""}
                      </React.Fragment>
                    ))}
                    <br />
                    <small style={{ opacity: .65, fontStyle: "italic" }}>
                      {m.desc}{" "}
                      <b style={{ color: "#ff7ad4" }}>
                        Ultimate: {m.ultimate.icon} {m.ultimate.name}.
                      </b>
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>

          <Note tone="info">
            <b>Il deck è libero!</b> Puoi mescolare carte di qualunque colore
            (basta avere le terre giuste per il mana). I bonus di livellamento
            seguono la classe + via che scegli a inizio match.
          </Note>
          <Note tone="warn">
            ⚠️ <b>Mazzo senza copertura.</b> Se non hai abbastanza carte
            colorate per sbloccare nessuna classe, puoi comunque giocare ma{" "}
            <b>NON otterrai XP, spell slot né ultimate</b>. Il picker te lo
            segnala prima della partita.
          </Note>
        </Section>

        {/* ─── 3. XP e Livelli ─── */}
        <Section icon="⚡" title="Esperienza (XP) &amp; Livelli" accent={ACCENT.xp}>
          <p>
            Durante la partita guadagni XP che ti fa salire di livello{" "}
            <Tag tone="orange">fino al 5</Tag>. Tutto si resetta a fine match.
          </p>

          <div className="tcg-doc__xpgrid">
            <div className="tcg-doc__xpcard">
              <span className="tcg-doc__xpico">⚔️</span>
              <b>+1 XP</b>
              <small>per ogni punto di danno all'eroe avversario</small>
            </div>
            <div className="tcg-doc__xpcard">
              <span className="tcg-doc__xpico">💀</span>
              <b>+CMC XP</b>
              <small>quando uccidi una creatura nemica</small>
            </div>
            <div className="tcg-doc__xpcard">
              <span className="tcg-doc__xpico">⚡</span>
              <b>+1 XP</b>
              <small>per ogni reazione (instant) lanciata</small>
            </div>
            <div className="tcg-doc__xpcard">
              <span className="tcg-doc__xpico">🌅</span>
              <b>+1 XP</b>
              <small>a ogni inizio del tuo turno (sopravvivenza)</small>
            </div>
          </div>

          <div className="tcg-doc__lvline">
            {LEVEL_THRESHOLDS.slice(2).map((th, i) => (
              <span key={i} className="tcg-doc__lvpip">
                <b>Lv {i + 2}</b>
                <small>{th} XP</small>
              </span>
            ))}
          </div>

          <Note tone="warn">
            Ai livelli <b>3</b> e <b>5</b> sblocchi rispettivamente gli{" "}
            <b>spell slot tier 2</b> e <b>tier 3</b>, oltre a una ricompensa
            di via. Al <b>livello 5</b> ottieni anche l'<b>Ultimate</b>.
          </Note>
        </Section>

        {/* ─── 4. Spell Slot ─── */}
        <Section icon="🔮" title="Spell Slot" accent={ACCENT.slot}>
          <p>
            Spell e reazioni costano <b>mana</b> come prima, ma anche uno{" "}
            <Tag tone="cyan">spell slot</Tag> del tier corrispondente. Le{" "}
            <Tag tone="lime">creature</Tag>, i <Tag tone="lime">manufatti</Tag>{" "}
            e le <Tag tone="lime">terre</Tag> <b>NON</b> usano slot.
          </p>

          <div className="tcg-doc__slotgrid">
            <div className="tcg-doc__slotcard" style={{ "--acc": "#9ecf6a" }}>
              <span className="tcg-doc__slotn">S1</span>
              <b>Tier 1</b>
              <small>CMC 1–2 · sempre disponibile</small>
            </div>
            <div className="tcg-doc__slotcard" style={{ "--acc": "#6ab8e0" }}>
              <span className="tcg-doc__slotn">S2</span>
              <b>Tier 2</b>
              <small>CMC 3–4 · si sblocca al livello 3</small>
            </div>
            <div className="tcg-doc__slotcard" style={{ "--acc": "#e07ab8" }}>
              <span className="tcg-doc__slotn">S3</span>
              <b>Tier 3</b>
              <small>CMC 5+ · si sblocca al livello 5</small>
            </div>
          </div>

          <p>
            Ogni inizio turno guadagni <b>1 slot S1</b> (e 1 di ciascun tier
            sbloccato). Il <b>cap</b> dipende dalla tua classe:
          </p>
          <ul>
            <li>
              <Tag tone="red">Marziali</Tag> (Guerriero, Ladro): cap <b>2</b>
            </li>
            <li>
              <Tag tone="purple">Caster &amp; semi-caster</Tag> (Mago, Chierico,
              Druido): cap <b>3</b>
            </li>
            <li>
              Il <Tag tone="gold">Mago</Tag> (caster pieno) ottiene anche{" "}
              <b>−1 mana generico</b> su ogni spell.
            </li>
            <li>
              <Tag tone="pink">Multiclassi</Tag>: cap e bonus seguono la{" "}
              <b>via</b> scelta (es. via di Mago → cap 3 + sconto; via di
              Guerriero → cap 2).
            </li>
          </ul>

          <Note tone="info">
            Sulla carta in mano vedi un piccolo badge <b>S1 / S2 / S3</b>: ti
            dice quale tier serve. Sul <b>pannello classe</b> vedi quanti slot
            hai (pallini pieni = pronti, vuoti = consumati, 🔒 = non sbloccati).
          </Note>
        </Section>

        {/* ─── 5. Ultimate ─── */}
        <Section icon="⭐" title="Ultimate" accent={ACCENT.ult}>
          <p>
            Al <Tag tone="pink">livello 5</Tag> ogni via riceve la sua{" "}
            <Tag tone="pink">ULTIMATE</Tag>: un effetto potente, attivabile{" "}
            <b>una sola volta per partita</b>. Appare un bottone sotto il tuo
            pannello classe con il nome (es. "🌋 Esplosione Vulcanica").
          </p>
          <p>
            Si attiva <b>solo nel tuo turno</b>, in <b>fase principale</b>, con
            la <b>pila vuota</b>. Se il bottone è grigio leggi la sotto-scritta
            che ti dice perché.
          </p>
          <Note tone="info">
            <b>Multiclassi:</b> al lv5 NON ottieni l'ultimate della via, ma
            quella dedicata della multiclasse (es. Templare → ⚖️ Giudizio
            Sacro, indipendentemente da quale via hai scelto).
          </Note>
        </Section>

        {/* ─── 6. Mana e Terre ─── */}
        <Section icon="💎" title="Mana &amp; Terre" accent={ACCENT.mana}>
          <p>
            Il mana è di <b>colore</b>: i cinque elementi sono:
          </p>
          <p className="tcg-doc__els">
            {ELEMENTS.map((el) => (
              <span
                key={el}
                className="tcg-doc__el tcg-doc__el--big"
                style={{ "--pip": ELEMENT_PIP[el] }}
              >
                {ELEMENT_ICON[el]} {ELEMENT_LABEL[el]}
              </span>
            ))}
          </p>
          <p>
            Per produrlo giochi le <Tag tone="green">Terre</Tag> ("Fonte
            di …"): <b>al massimo 1 per turno</b> (eccezione: Druido — Circolo
            della Terra al lv2 ne ottiene <b>+1 extra</b>). Ogni Terra resta in
            campo e fornisce <b>1 mana</b> del suo elemento. Si ricaricano
            all'inizio del tuo turno; il mana non speso <b>non si accumula</b>.
          </p>
          <Note tone="info">
            <b>Costo delle carte:</b> i simboli colorati vanno pagati con mana
            di <i>quell'</i>elemento, il numero generico con mana di{" "}
            <i>qualsiasi</i> colore. Le Terre si toccano da sole (come in
            MTGA).
          </Note>
        </Section>

        {/* ─── 7. Tipi di carta ─── */}
        <Section icon="🎴" title="Tipi di carta" accent={ACCENT.cards}>
          <ul className="tcg-doc__types">
            <li>
              <span className="tcg-doc__t-ico">🐾</span>
              <b>Creatura</b> — entra in campo con F/C (Forza/Costituzione).
            </li>
            <li>
              <span className="tcg-doc__t-ico">📜</span>
              <b>Magia</b> — effetto immediato, solo nel tuo turno, poi va al
              cimitero.
            </li>
            <li>
              <span className="tcg-doc__t-ico">⚡</span>
              <b>Istantaneo / Reazione</b> — giocabile{" "}
              <b>in qualunque momento</b> (turno avversario, risposta, combat).
            </li>
            <li>
              <span className="tcg-doc__t-ico">💠</span>
              <b>Manufatto</b> — resta in campo, effetto continuo.
            </li>
            <li>
              <span className="tcg-doc__t-ico">⛰️</span>
              <b>Terra</b> — fonte di mana, gratis, 1 per turno (di norma).
            </li>
          </ul>
        </Section>

        {/* ─── 8. Combattimento ─── */}
        <Section icon="⚔️" title="Combattimento" accent={ACCENT.combat}>
          <p>
            Le creature appena evocate hanno la <Tag tone="red">fiacca da
            evocazione</Tag> (non possono attaccare per un turno).
          </p>
          <ul>
            <li>
              Una creatura <b>non bloccata</b> infligge la sua Forza ai PV
              avversari.
            </li>
            <li>
              Se <b>bloccata</b>, attaccante e bloccante si infliggono danni a
              vicenda (uno o <b>più bloccanti</b> sullo stesso attaccante!).
            </li>
            <li>
              Una creatura muore se i danni accumulati nel turno raggiungono
              la sua Costituzione.
            </li>
          </ul>

          {DICE_STATS && (
            <>
              <h3>🎲 Forza e Costituzione a dadi</h3>
              <p>
                Le creature in mano mostrano <b>base + 1dN</b> (es. 3+1d6).
                Quando le <b>evochi</b>, il gioco tira i dadi <b>una volta
                sola</b>: quei numeri restano fissi per il resto della partita.
                La media equivale ai vecchi valori, l'equilibrio è preservato.
              </p>
            </>
          )}
        </Section>

        {/* ─── 9. Pila e reazioni ─── */}
        <Section icon="🌀" title="La Pila (priorità e risposte)" accent={ACCENT.pila}>
          <p>
            Quando lanci un incantesimo (Magia o Istantaneo) <b>non si risolve
            subito</b>: va nella <Tag tone="azure">Pila</Tag>. L'avversario
            può rispondere con un proprio <b>⚡ Istantaneo</b>. Quando entrambi
            <b> passano</b>, si risolve la carta in <b>cima</b> alla Pila
            (LIFO: ultima entrata, prima uscita).
          </p>
          <ul>
            <li>Se hai priorità appare <Tag tone="azure">PASSA</Tag>; se non hai istantanei giocabili, il gioco passa <b>in automatico</b>.</li>
            <li><b>Contromagia</b> annulla un incantesimo ancora nella Pila.</li>
            <li>Gli istantanei brillano come <b>trucchi di combattimento</b> dopo bloccanti/attaccanti.</li>
          </ul>
        </Section>

        {/* ─── 10. Rarità ─── */}
        <Section icon="💎" title="Rarità" accent={ACCENT.rarity}>
          <p>
            Indicata da un angolo colorato in alto a destra della carta:
          </p>
          <p className="tcg-doc__els">
            {RARITY_ORDER.map((r) => (
              <span key={r} className="tcg-doc__el">
                <span
                  style={{
                    display: "inline-block", width: 12, height: 12,
                    borderRadius: "50%", background: RARITY_COLOR[r],
                    marginRight: 6, verticalAlign: "middle",
                    boxShadow: `0 0 6px ${RARITY_COLOR[r]}`,
                  }}
                />
                <b>{RARITY_LABEL[r]}</b>
              </span>
            ))}
          </p>
          <small>
            Più alta è la rarità, più la carta è potente e meno frequente nei
            pacchetti.
          </small>
        </Section>

        {/* ─── 11. Abilità chiave ─── */}
        <Section icon="📚" title="Abilità (parole chiave D&amp;D)" accent={ACCENT.cards}>
          <p>
            Molte creature hanno abilità permanenti con nomi ispirati a{" "}
            <b>Dungeons &amp; Dragons</b>:
          </p>
          <ul className="tcg-doc__kw">
            {KEYWORD_IDS.map((k) => (
              <li key={k}>
                <Tag tone="lime">{KEYWORDS[k].label}</Tag> {KEYWORDS[k].desc}
              </li>
            ))}
          </ul>
          <Note tone="info">
            Tieni premuto (o tasto destro / 🔍) su una carta per ingrandirla.
          </Note>
        </Section>

        {/* ─── 12. Mazzo, Negozio, Collezione ─── */}
        <Section icon="🛒" title="Mazzo, Negozio &amp; Collezione" accent={ACCENT.shop}>
          <p>
            Il mazzo è di <Tag tone="gold">60 carte</Tag>. Terre base{" "}
            <b>illimitate e gratuite</b>; massimo <b>4 copie</b> per ogni altra
            carta posseduta.
          </p>
          <p>
            Nel <b>Negozio</b> trovi due tipi di pacchetto:
          </p>
          <ul>
            <li>
              <Tag tone="gold">Pacchetti di Classe</Tag> — 15 carte dei{" "}
              <b>2 colori</b> della classe scelta (es. Mago = Fuoco + Natura).
            </li>
            <li>
              <Tag tone="orange">Pacchetti Elemento</Tag> — 15 carte di un{" "}
              <b>solo</b> elemento; <i>Luce</i> e <i>Ombra</i> sono Premium e
              costano di più.
            </li>
          </ul>
          <Note tone="info">
            Le <b>multiclassi</b> non hanno pacchetti dedicati: si sbloccano
            mescolando carte dei <b>3 colori</b> della combo (es. Templare =
            🔥 + ☀️ + 🌑 → unisci un pack Guerriero a un pack Chierico).
          </Note>
          <p>
            In <b>Mazzo</b> puoi costruire a mano, usare i filtri/ordinamento,
            l'<b>auto-build di classe</b>, scegliere il <b>dorso</b> delle
            carte e vedere la <b>curva di mana</b>, i colori e i tipi del tuo
            mazzo. Le monete si guadagnano in battaglia.
          </p>
        </Section>

        {/* ─── 13. Consigli ─── */}
        <Section icon="💡" title="Consigli" accent={ACCENT.tips}>
          <ul>
            <li>🎯 Gioca una Terra ogni turno: senza mana non fai nulla.</li>
            <li>📏 Tieni 22–24 Terre nei colori che usi davvero.</li>
            <li>🌈 Due elementi sono già un bel mix; il tri-colore apre alle <b>multiclassi</b>, ma serve mana stabile.</li>
            <li>📈 Cura la curva: tante carte da 1–3 mana, poche grosse.</li>
            <li>⚡ Conserva una reazione per il turno avversario quando puoi.</li>
            <li>⭐ Pianifica l'ultimate: aspetta il momento giusto, è una sola.</li>
            <li>🎓 Vuoi una classe specifica? Controlla che il mazzo abbia i suoi colori — il picker mostra subito quali classi/multiclassi sono sbloccate.</li>
          </ul>
        </Section>

      </div>
    </div>
  );
}
