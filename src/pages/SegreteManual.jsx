/* LE SEGRETE · Manuale (2026-11-05): le regole in breve, scheda "📖 Manuale" della lobby.
   I numeri vengono dalle costanti del gioco: non scriverli a mano. */
import { MAX_PARTY, COMPANY, companyLines, DAILY_RUNS, RUN_COUNTS_AFTER, STORY_CLASSES, DIFFICULTIES, clsStyle } from "../data/segrete";
import { STAT_BUDGET, ASI_EVERY, HERO_HP_BASE, MAX_STORY_LEVEL, XP_PER_ROOM, weaponChoices, DMG_SHORT, armorProf, ARMOR_CAT_IT, ARMORS, RESPEC_COST, SUBCLASS_COST, SUBCLASS_LEVEL, SUBCLASSES } from "../data/segreteKits";
import { MIMIC_CHANCE } from "../data/segreteEngine";
import { DUNGEON_PROFILES } from "../data/segreteProfiles";
import { COIN_ICON, COIN_NAME, FLOOR_COINS_DIE, DROP_CHANCE, GIFT_FEE, GIFT_DAILY } from "../data/segreteItems";

function Fold({ icon, title, children, open = false }) {
  return (
    <details className="sgm-fold" open={open}>
      <summary><span aria-hidden="true">{icon}</span> {title}</summary>
      <div className="sgm-body">{children}</div>
    </details>
  );
}

export default function SegreteManual() {
  return (
    <section className="sgr-block sgm">
      <h2 className="sgr-h2">📖 Manuale delle Segrete</h2>
      <p className="sgr-hint">Tocca un capitolo per aprirlo.</p>

      <Fold icon="🗝" title="Come si gioca, in 5 passi" open>
        <ol>
          <li><b>Personaggi</b>: crea un eroe per la classe che vuoi (uno per classe, resta tuo per sempre) e tira i suoi PF.</li>
          <li><b>Gruppi</b>: crea un gruppo (da 1 a {MAX_PARTY} eroi) scegliendo il dungeon, oppure entra in uno aperto. Puoi invitare altri giocatori: ricevono una notifica.</li>
          <li>Nel gruppo potete parlarvi con la <b>chat vocale</b>: tasto 🎧 in alto nella testata (in lotta sotto il ☰). Il microfono è aperto di base; dal pannello puoi passare a «tieni premuto».</li>
          <li>Tutti premono <b>▶ Avvia</b>: quando l'hanno premuto tutti si scende.</li>
          <li><b>🤝 Più siete, meglio è</b>: in gruppo ognuno ha il bonus <b>Compagnia</b> (vedi sotto).</li>
          <li>Si combatte sala dopo sala fino al boss. Se il gruppo vince, ognuno porta a casa PE, {COIN_NAME} e il bottino. <b>Se il gruppo cade prima dello scrigno, si perde tutto quello trovato.</b></li>
        </ol>
      </Fold>

      <Fold icon="🤝" title="Compagnia: i bonus del gruppo">
        <p>Le Segrete sono fatte per il gruppo: si può entrare da soli, ma in compagnia ognuno ha dei piccoli bonus che crescono con il numero di eroi. I mostri sono già tarati su quanti siete, quindi questi bonus sono un vantaggio vero.</p>
        <ul>
          {Object.keys(COMPANY).map((n) => (
            <li key={n}><b>{n === "1" ? "Da soli" : `In ${n}`}</b>: {Number(n) === 1 ? "nessun bonus (in compenso PF ×1,2, ma PE ×0,75)" : companyLines(Number(n)).join(" · ")}.</li>
          ))}
          <li>Il numero si fissa all'inizio del dungeon e resta uguale anche se qualcuno cade o fugge.</li>
          <li>Chi entra <b>come aiuto</b> conta per la Compagnia: chiamare un amico conviene anche quando lui ha finito i suoi dungeon. I bonus su monete e PE vanno solo a chi prende i premi.</li>
          <li>In più, lo scrigno finale ha 2 oggetti in più per ogni eroe oltre il primo.</li>
        </ul>
      </Fold>

      <Fold icon="🙌" title="Paladino: Punizione e riserva di cura">
        <ul>
          <li><b>Punizione Divina</b>: danno normale dell'arma, con i suoi bonus, più danno <b>radioso</b>. Le difese del bersaglio si applicano separatamente alle due parti, anche sul colpo mortale.</li>
          <li><b>Imposizione delle Mani</b>: all'inizio del dungeon la riserva contiene <b>PF massimi + livello</b>. Scegli te stesso o un alleato, poi quanti PF curare. Puoi anche rialzare un alleato a terra.</li>
          <li>Consuma solo i PF effettivamente recuperati, senza superare quelli mancanti al bersaglio. Non ci sono cariche: la usi finché restano punti nella riserva, spendendo la normale azione del round. Anche Cura Ferite usa la stessa riserva.</li>
          <li>La riserva non si ricarica passando di sala; torna piena nella prossima spedizione e aumenta con PF massimi e livello.</li>
        </ul>
      </Fold>

      <Fold icon="🌒" title="Ladro e Bardo">
        <ul>
          <li><b>Attacco Furtivo</b>: scatta da solo una volta per round, sul primo colpo d'arma a segno, se hai vantaggio o se nel gruppo c'è un altro eroe in piedi. Danno: +1d6 ogni 2 livelli (Lv 1: 1d6, Lv 5: 3d6, Lv 19: 10d6), doppio col critico.</li>
          <li><b>🎯 Colpo Mirato</b> (Ladro, 3 per sala): vantaggio per 2 turni, così il furtivo scatta anche da solo.</li>
          <li><b>🤸 Elusione</b> (Ladro dal Lv 7): contro le aree dei mostri niente danni se superi il TS, metà se lo fallisci.</li>
          <li><b>🎶 Ispirazione Bardica</b> (Bardo, sempre, 3 per sala): un alleato ha vantaggio e +3 danni per 2 turni. <b>Beffa Crudele</b> fa 1d6 (cresce coi livelli).</li>
        </ul>
      </Fold>

      <Fold icon="🗺" title="Dungeon: sfide e premi diversi">
        <p>Ogni luogo ha un profilo che si somma a Facile, Medio o Leggenda. I bonus di ricompensa del dungeon arrivano al massimo a +25%. Nello scrigno c'è anche un oggetto caratteristico in più per il gruppo; se il Mimic vi sconfigge, perdete anche quello.</p>
        <ul>{DUNGEON_PROFILES.map((p) => <li key={p.key}><b>{p.name}</b> · PE ×{p.xp}, monete ×{p.coins}. {p.desc}</li>)}</ul>
        <p>Controlla «Cosa c'è qui» prima di partire: mostra il profilo attivo, i premi e le probabilità effettive. Il Master può cambiare il profilo dall'admin. Le spedizioni già partite conservano le regole iniziali.</p>
      </Fold>

      <Fold icon="🎓" title="Le sottoclassi">
        <p>Dal Lv {SUBCLASS_LEVEL}, {SUBCLASS_COST.toLocaleString("it-IT")} {COIN_NAME} l'una. Tratto passivo e azioni (Lv 5 · Lv 11):</p>
        <ul>
          {STORY_CLASSES.filter((c) => SUBCLASSES[c.key]).map((c) => SUBCLASSES[c.key].map((sc) => (
            <li key={`${c.key}-${sc.key}`} style={clsStyle(c.key)}><b>{c.it} · {sc.icon} {sc.name}</b>: {sc.passiveTxt} · {sc.actions.map((a) => a.name).join(" · ")}</li>
          )))}
        </ul>
      </Fold>

      <Fold icon="⚔" title="Il combattimento">
        <ul>
          <li>Ogni round agiscono prima <b>tutti gli eroi</b> (un'azione a testa, in qualsiasi ordine), poi tutti i mostri in ordine d'iniziativa.</li>
          <li>Tocca un nemico per sceglierlo come bersaglio; <b>tienilo premuto</b> per la sua scheda (PF, CA e resistenze si vedono solo dei mostri già sconfitti almeno una volta).</li>
          <li>Se il bersaglio scelto è già caduto, il colpo va al nemico in piedi più ferito.</li>
          <li>Chi non agisce per 5 minuti si mette in difesa da solo, così il gruppo non resta fermo.</li>
          <li>Sopra gli sprite: icone verdi = bonus, rosse = malus, col numero dei round che restano. Le scritte IMMUNE / RESISTE / VULNERABILE! dicono come il nemico ha preso il colpo.</li>
          <li>Fra una sala e l'altra si recupera un po': +30% dei PF, chi era a terra si rialza al 25% e gli usi delle abilità tornano.</li>
          <li>«🏃 Abbandona» toglie il tuo eroe dalla spedizione: conta come a terra e non prende premi.</li>
        </ul>
      </Fold>

      <Fold icon="🧪" title="Stati: bruciato, congelato, pietrificato…">
        <ul>
          <li><b>🔥 Bruciato</b>: danni da fuoco all'inizio di ogni suo turno. Si toglie col Tonico o con la Bomba d'Acqua.</li>
          <li><b>☠ Avvelenato</b>: danni da veleno a ogni turno (niente svantaggio). Si toglie col Tonico.</li>
          <li><b>🧊 Congelato</b>: salta 2 turni con −2 CA. Lo libera solo il Tonico, oppure un colpo di fuoco.</li>
          <li><b>⚡ Paralizzato</b>: salta il turno e chi lo attacca ha vantaggio; a ogni turno tira un TS per liberarsi (al massimo 3 turni). Tonico o Bomba d'Acqua.</li>
          <li><b>🗿 Pietrificato</b>: diventa grigio, fermo per 3 turni, prende metà dei danni e chi lo attacca ha vantaggio. Solo la <b>Panacea</b> lo libera prima.</li>
          <li><b>😱 Spaventato</b>: svantaggio, e non riesce a curare né ad aiutare gli altri. <b>🌑 Accecato</b>: svantaggio, e chi lo attacca ha vantaggio. <b>🐌 Rallentato</b>: svantaggio.</li>
          <li><b>😵 Confuso</b>: scegli tu l'azione, ma il bersaglio esce a caso, anche un compagno (o te lo cura un nemico!).</li>
          <li>I mostri portano lo stato del loro tipo di danno (fuoco brucia, gelo congela, veleno avvelena, necrotico spaventa, fulmine paralizza, psichico confonde, acido acceca): si evita col tiro salvezza. I boss evitano metà degli stati.</li>
          <li><b>Corrosione:</b> l’acido infligge ×1,5 danni a chi indossa un’armatura metallica o ha il corpo di metallo. Le sole armi, gli scudi e i piccoli accessori non contano. Il bonus vale anche contro gli eroi e si combina con resistenze e vulnerabilità; l’immunità annulla sempre il danno.</li>
          <li><b>Rimedi</b> in Bottega: 🌿 Tonico (tutto tranne la pietra), 💧 Bomba d'Acqua (tutto il gruppo: bruciatura, rallentamento, paralisi), ✨ Panacea (tutto, anche la pietra).</li>
        </ul>
      </Fold>

      <Fold icon="🧝" title="Eroi, livelli e armi">
        <ul>
          <li><b>♻ Reset dell'eroe</b>: dalla scheda dell'eroe rifai caratteristiche e abilità per {RESPEC_COST} {COIN_NAME}. Livello, PE, PF tirati ed equipaggiamento restano; non si può fare durante un dungeon. Le armi si cambiano sempre gratis.</li>
          <li>Alla creazione hai {STAT_BUDGET} punti caratteristica da distribuire e una prima abilità da scegliere. I PF si tirano col dado vita della classe, più {HERO_HP_BASE} PF fissi.</li>
          <li>Si sale di livello con i PE delle vittorie: ogni dungeon vinto dà gli stessi PE a tutti ({XP_PER_ROOM} a sala, boss compreso: 100 con 3 sale; Medio ×1,3, Leggenda ×1,6, poi il moltiplicatore del profilo dungeon). Chi entra da solo prende un po' meno PE (×0,75), in gruppo un po' di più (Compagnia: fino a +{Math.round((COMPANY[4].xp - 1) * 100)}% in 4). Il Lv 2 arriva in circa 3 vittorie, poi ogni livello ne chiede un po' di più (circa 6 al Lv 10, 9 per arrivare al {MAX_STORY_LEVEL}). A ogni livello si tirano i PF nuovi; ogni {ASI_EVERY} livelli arriva +1 a una caratteristica e un'abilità in più.</li>
          <li><b>🎓 Sottoclassi</b>: dal Lv {SUBCLASS_LEVEL} ogni classe può comprarne due (dalla scheda dell'eroe, {SUBCLASS_COST.toLocaleString("it-IT")} {COIN_NAME} l'una). Ognuna dà un tratto sempre attivo e due azioni nuove (al Lv 5 e al Lv 11). Comprate restano tue: ne usi una alla volta e la cambi gratis fuori dai dungeon.</li>
          <li>Gli eroi con qualcosa da sistemare hanno l'etichetta gialla (❤ PF, ⭐ caratteristica, ✨ abilità) nella scheda Personaggi.</li>
          <li>I livelli <b>non si azzerano</b> mai, e la domenica non si cancella niente: i gruppi restano finché non li sciogliete.</li>
        </ul>
        <div className="sgm-classes">
          {STORY_CLASSES.map((c) => (
            <span key={c.key} className="sgm-cls" style={clsStyle(c.key)}>
              <b>{c.icon} {c.it}</b>
              <small>{weaponChoices(c.key).map((w) => `${w.name} ${w.dice} ${DMG_SHORT[w.dmg]}`).join(" · ")}</small>
            </span>
          ))}
        </div>
      </Fold>

      <Fold icon="🛡" title="Armature e scudi">
        <ul>
          <li>Ogni classe porta le armature del manuale D&D: le scegli quando crei l'eroe e le cambi dal riquadro <b>🎒 Equipaggiamento</b> della sua scheda (mai durante un dungeon). Dallo Zaino il tasto «🛡 Equipaggia» mette un oggetto su un tuo eroe.</li>
          <li>Leggere: CA base + DES. Medie: CA base + DES fino a +2. Pesanti: CA fissa. Barbaro e Monaco hanno anche la <b>Difesa senz'armatura</b>; Mago e Stregone l'<b>Armatura Magica</b> (13 + DES).</li>
          <li><b>Scudo</b> +2 CA, solo con un'arma a una mano.</li>
          <li><b>✊ Impugna a due mani</b>: chi non è un incantatore (Guerriero, Barbaro, Paladino, Ranger, Ladro, Monaco) con <b>Spada Lunga</b> o <b>Bastone</b> in lotta può impugnarla a due mani: Spada Lunga 1d10 invece di 1d8, Bastone 1d8 invece di 1d6, ma lo scudo va via con la sua CA. Cambiare presa è gratis e non consuma il turno, però solo prima di agire nel round.</li>
          <li><b>✦ Le armature più leggere hanno un vantaggio</b>, così non sono mai una scelta inutile: {Object.values(ARMORS).filter((x) => x.perk).map((x) => `${x.name} (${x.perk.text.split(": ")[1]})`).join(" · ")}. Valgono anche le loro versioni +1.</li>
          <li>Il Paladino e il Guerriero possono scegliere anche l’Armatura Completa di Piastre. Tutte le pesanti hanno ingombro a ogni tiro per colpire: 50% normale, 25% -1, 25% svantaggio. Mezza armatura e Armatura a Stecche si comprano in Bottega; quelle magiche (+1, resistenze ai danni, spine…) e gli scudi speciali si trovano solo nei dungeon.</li>
        </ul>
        <div className="sgm-classes">
          {STORY_CLASSES.map((c) => (
            <span key={c.key} className="sgm-cls" style={clsStyle(c.key)}>
              <b>{c.icon} {c.it}</b>
              <small>{armorProf(c.key).cats.map((k) => ARMOR_CAT_IT[k]).join(", ")}{(armorProf(c.key).no || []).length ? " (niente metallo)" : ""}{armorProf(c.key).shield ? ", scudo" : ""}</small>
            </span>
          ))}
        </div>
      </Fold>

      <Fold icon="🔥" title="Difficoltà e bottino dei dungeon">
        <ul>
          {DIFFICULTIES.map((d) => (
            <li key={d.key}><b>{d.icon} {d.name}</b>{d.minLevel > 1 ? ` (ogni eroe almeno Lv ${d.minLevel})` : ""}: {d.desc}{d.rank > 0 ? ` Mostri con PF ×${String(d.hp).replace(".", ",")} e danni ×${String(d.dmg).replace(".", ",")}${d.plus ? `, +${d.plus} a colpire e CA` : ""}; monete ×${String(d.coins).replace(".", ",")}, PE ×${String(d.xp).replace(".", ",")}, oggetti ×${String(d.item).replace(".", ",")}.` : ""}</li>
          ))}
          <li>La sceglie il capo del gruppo. Sotto ogni dungeon c'è il riquadro <b>📜 Cosa c'è qui</b>: nemici, premi e tutti gli oggetti che possono cadere con la loro probabilità.</li>
          <li>Ogni dungeon ha oggetti suoi (★), e alcuni escono solo a Medio o Leggenda.</li>
          <li><b>Armi speciali</b>: alcune bruciano o avvelenano (danno a ogni turno del mostro), rallentano (svantaggio), stordiscono, curano chi le usa o fanno colpi in più. I boss evitano lo stordimento metà delle volte.</li>
        </ul>
      </Fold>

      <Fold icon="📅" title="Quanti dungeon si possono fare">
        <ul>
          <li>Con ogni classe: <b>{DAILY_RUNS} dungeon completi al giorno</b>. Nessun limite settimanale, e la domenica non si azzera niente.</li>
          <li>Un dungeon conta solo dopo aver ripulito {RUN_COUNTS_AFTER} sale (o vinto): se il gruppo cade prima, si può riprovare.</li>
          <li>Se un eroe ha finito i suoi dungeon, puoi giocare con un eroe di un'altra classe.</li>
          <li><b>🤝 Come aiuto:</b> anche con i limiti pieni puoi entrare in un gruppo (per esempio se serve proprio la tua classe). Giochi normalmente, ma non prendi PE, monete o oggetti, e il dungeon non ti si conta.</li>
        </ul>
      </Fold>

      <Fold icon={COIN_ICON} title={`${COIN_NAME}, bottino e oggetti`}>
        <ul>
          <li>Ogni sala vinta: 1d{FLOOR_COINS_DIE} {COIN_NAME} a ogni eroe ancora in gioco. Tutte le monete (sale, mostri, scrigno) salgono con la Compagnia: {[2, 3, 4].map((n) => `+${Math.round((COMPANY[n].coins - 1) * 100)}% in ${n}`).join(", ")}.</li>
          <li>I mostri a volte lasciano monete o un oggetto, che va a un eroe tirato a sorte (2 eroi d4, 3 eroi d6, 4 eroi d8: 1–2 il primo, 3–4 il secondo…): gregari {DROP_CHANCE.minion.coins}% monete / {DROP_CHANCE.minion.item}% oggetto, élite {DROP_CHANCE.elite.coins}% / {DROP_CHANCE.elite.item}%, boss {DROP_CHANCE.boss.coins}% / {DROP_CHANCE.boss.item}%.</li>
          <li>Il bottino si consegna se il gruppo <b>vince</b> il dungeon. Da soli gli oggetti dello scrigno si assegnano direttamente, senza dadi; in gruppo il premio si rivela dopo il sorteggio e gli eventuali spareggi. Lo scrigno finale ha il <b>{Math.round(MIMIC_CHANCE * 100)}%</b> di essere un Mimic: se vi sconfigge conservate bottino precedente e PE, perdendo solo lo scrigno; se lo uccidete ricevete anche il tesoro. Le Segrete assegnano solo Monete Antiche, mai Corone del Mercato Nero.</li>
          <li><b>🎁 Regali:</b> dallo Zaino puoi regalare un oggetto a un altro giocatore per {GIFT_FEE} {COIN_NAME}, al massimo {GIFT_DAILY} al giorno. Un'arma montata su un eroe va prima rimessa nello zaino (tasto «↩ Nello zaino»), poi la può prendere un altro tuo eroe o la puoi regalare.</li>
          <li><b>Vendita:</b> nella Bottega scegli «Vendi dallo zaino»: ogni copia vale un terzo del prezzo, arrotondato per difetto. Per il solo bottino si usa un valore di riferimento (comune 30, non comune 90, raro 300, molto raro 900), personalizzabile dal Master. La riga mostra sempre valore e ricavo. Gli oggetti equipaggiati vanno prima rimossi dall'eroe.</li>
          <li>Lo zaino è unico per tutti i tuoi eroi. In lotta usare un oggetto vale come l'azione del round.</li>
          <li>In Bottega ogni oggetto ha un limite di acquisti al giorno. Le armi +1 si comprano, le +2 si trovano solo nei dungeon; si equipaggiano dalla scheda dell'eroe, mai durante un dungeon.</li>
        </ul>
      </Fold>
      <p className="sgr-credits">Icone di <a href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a> (Lorc, Delapouite e altri autori), licenza <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>.</p>
    </section>
  );
}
