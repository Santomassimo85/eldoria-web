/* LE SEGRETE · Manuale (2026-11-05): le regole in breve, scheda "📖 Manuale" della lobby.
   I numeri vengono dalle costanti del gioco: non scriverli a mano. */
import { MAX_PARTY, DAILY_RUNS, RUN_COUNTS_AFTER, STORY_CLASSES, DIFFICULTIES, clsStyle } from "../data/segrete";
import { STAT_BUDGET, ASI_EVERY, HERO_HP_BASE, MAX_STORY_LEVEL, XP_PER_ROOM, weaponChoices, DMG_SHORT, armorProf, ARMOR_CAT_IT, ARMORS, RESPEC_COST } from "../data/segreteKits";
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

      <Fold icon="🗝" title="Come si gioca, in 4 passi" open>
        <ol>
          <li><b>Personaggi</b>: crea un eroe per la classe che vuoi (uno per classe, resta tuo per sempre) e tira i suoi PF.</li>
          <li><b>Gruppi</b>: crea un gruppo (da 1 a {MAX_PARTY} eroi) scegliendo il dungeon, oppure entra in uno aperto. Puoi invitare altri giocatori: ricevono una notifica.</li>
          <li>Nel gruppo potete parlarvi con la <b>chat vocale</b> (tasto 🎧 Voce in basso a sinistra, in lotta in alto): microfono a «tieni premuto» o sempre aperto.</li>
          <li>Tutti premono <b>▶ Avvia</b>: quando l'hanno premuto tutti si scende.</li>
          <li>Si combatte sala dopo sala fino al boss. Se il gruppo vince, ognuno porta a casa PE, Corone, {COIN_NAME} e il bottino. <b>Se il gruppo cade, si perde tutto quello trovato.</b></li>
        </ol>
      </Fold>

      <Fold icon="⚔" title="Il combattimento">
        <ul>
          <li>Ogni round agiscono prima <b>tutti gli eroi</b> (un'azione a testa, in qualsiasi ordine), poi tutti i mostri in ordine d'iniziativa.</li>
          <li>Tocca un nemico per sceglierlo come bersaglio; <b>tienilo premuto</b> per la sua scheda (PF, CA e resistenze si vedono solo dei mostri già sconfitti almeno una volta).</li>
          <li>Se il bersaglio scelto è già caduto, il colpo va al nemico in piedi più ferito.</li>
          <li>Chi non agisce per 5 minuti si mette in difesa da solo, così il gruppo non resta fermo.</li>
          <li>Sopra gli sprite: icone verdi = bonus, rosse = malus, col numero dei round che restano. Le scritte IMMUNE / RESISTE / VULNERABILE! dicono come il nemico ha preso il colpo.</li>
          <li>Fra una sala e l'altra si recupera un po': chi era a terra si rialza al 25% dei PF e gli usi delle abilità tornano.</li>
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
          <li><b>Rimedi</b> in Bottega: 🌿 Tonico (tutto tranne la pietra), 💧 Bomba d'Acqua (tutto il gruppo: bruciatura, rallentamento, paralisi), ✨ Panacea (tutto, anche la pietra).</li>
        </ul>
      </Fold>

      <Fold icon="🧝" title="Eroi, livelli e armi">
        <ul>
          <li><b>♻ Reset dell'eroe</b>: dalla scheda dell'eroe rifai caratteristiche e abilità per {RESPEC_COST} {COIN_NAME}. Livello, PE, PF tirati ed equipaggiamento restano; non si può fare durante un dungeon. Le armi si cambiano sempre gratis.</li>
          <li>Alla creazione hai {STAT_BUDGET} punti caratteristica da distribuire e una prima abilità da scegliere. I PF si tirano col dado vita della classe, più {HERO_HP_BASE} PF fissi.</li>
          <li>Si sale di livello con i PE delle vittorie: ogni dungeon vinto dà gli stessi PE a tutti ({XP_PER_ROOM} a sala, boss compreso: 100 con 3 sale; Medio ×1,3, Leggenda ×1,6). Il Lv 2 arriva in circa 3 vittorie, poi ogni livello ne chiede un po' di più (circa 6 al Lv 10, 9 per arrivare al {MAX_STORY_LEVEL}). A ogni livello si tirano i PF nuovi; ogni {ASI_EVERY} livelli arriva +1 a una caratteristica e un'abilità in più.</li>
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
          <li><b>✦ Le armature più leggere hanno un vantaggio</b>, così non sono mai una scelta inutile: {Object.values(ARMORS).filter((x) => x.perk).map((x) => `${x.name} (${x.perk.text.split(": ")[1]})`).join(" · ")}. Valgono anche le loro versioni +1.</li>
          <li>Mezza armatura, Armatura a Stecche e Piastre si comprano in Bottega; quelle magiche (+1, resistenze ai danni, spine…) e gli scudi speciali si trovano solo nei dungeon.</li>
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
          <li><b>🤝 Come aiuto:</b> anche con i limiti pieni puoi entrare in un gruppo (per esempio se serve proprio la tua classe). Giochi normalmente, ma non prendi PE, monete, oggetti né Corone, e il dungeon non ti si conta.</li>
        </ul>
      </Fold>

      <Fold icon={COIN_ICON} title={`${COIN_NAME}, bottino e oggetti`}>
        <ul>
          <li>Ogni sala vinta: 1d{FLOOR_COINS_DIE} {COIN_NAME} a ogni eroe ancora in gioco.</li>
          <li>I mostri a volte lasciano monete o un oggetto, che va a un eroe tirato a sorte (2 eroi d4, 3 eroi d6, 4 eroi d8: 1–2 il primo, 3–4 il secondo…): gregari {DROP_CHANCE.minion.coins}% monete / {DROP_CHANCE.minion.item}% oggetto, élite {DROP_CHANCE.elite.coins}% / {DROP_CHANCE.elite.item}%, boss {DROP_CHANCE.boss.coins}% / {DROP_CHANCE.boss.item}%.</li>
          <li>Il bottino si consegna solo se il gruppo <b>vince</b> il dungeon.</li>
          <li><b>🎁 Regali:</b> dallo Zaino puoi regalare un oggetto a un altro giocatore per {GIFT_FEE} {COIN_NAME}, al massimo {GIFT_DAILY} al giorno. Un'arma montata su un eroe va prima rimessa nello zaino (tasto «↩ Nello zaino»), poi la può prendere un altro tuo eroe o la puoi regalare.</li>
          <li>Lo zaino è unico per tutti i tuoi eroi. In lotta usare un oggetto vale come l'azione del round.</li>
          <li>In Bottega ogni oggetto ha un limite di acquisti al giorno. Le armi +1 si comprano, le +2 si trovano solo nei dungeon; si equipaggiano dalla scheda dell'eroe, mai durante un dungeon.</li>
        </ul>
      </Fold>
      <p className="sgr-credits">Icone di <a href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a> (Lorc, Delapouite e altri autori), licenza <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>.</p>
    </section>
  );
}
