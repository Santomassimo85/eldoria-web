/* LE SEGRETE · Manuale (2026-11-05): le regole in breve, scheda "📖 Manuale" della lobby.
   I numeri vengono dalle costanti del gioco: non scriverli a mano. */
import { MAX_PARTY, DAILY_RUNS, DAILY_TOTAL, WEEKLY_RUNS, RUN_COUNTS_AFTER, STORY_CLASSES, clsStyle } from "../data/segrete";
import { STAT_BUDGET, ASI_EVERY, HERO_HP_BASE, MAX_STORY_LEVEL, weaponChoices, DMG_SHORT } from "../data/segreteKits";
import { COIN_ICON, COIN_NAME, FLOOR_COINS_DIE, DROP_CHANCE } from "../data/segreteItems";

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

      <Fold icon="🧝" title="Eroi, livelli e armi">
        <ul>
          <li>Alla creazione hai {STAT_BUDGET} punti caratteristica da distribuire e una prima abilità da scegliere. I PF si tirano col dado vita della classe, più {HERO_HP_BASE} PF fissi.</li>
          <li>Si sale di livello con i PE delle vittorie (servono circa 3 vittorie a livello, fino al {MAX_STORY_LEVEL}). A ogni livello si tirano i PF nuovi; ogni {ASI_EVERY} livelli arriva +1 a una caratteristica e un'abilità in più.</li>
          <li>Gli eroi con qualcosa da sistemare hanno l'etichetta gialla (❤ PF, ⭐ caratteristica, ✨ abilità) nella scheda Personaggi.</li>
          <li>I livelli <b>non si azzerano</b>: la domenica alle 23:00 si azzerano solo i gruppi e i conteggi dei dungeon.</li>
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

      <Fold icon="📅" title="Quanti dungeon si possono fare">
        <ul>
          <li>Con ogni classe: <b>{DAILY_RUNS} al giorno</b> e <b>{WEEKLY_RUNS} a settimana</b>.</li>
          <li>In tutto, con tutti i tuoi eroi: al massimo <b>{DAILY_TOTAL} dungeon finiti al giorno</b>.</li>
          <li>Un dungeon conta solo dopo aver ripulito {RUN_COUNTS_AFTER} sale (o vinto): se il gruppo cade prima, si può riprovare.</li>
          <li>Se un eroe ha finito i suoi dungeon, puoi giocare con un eroe di un'altra classe.</li>
        </ul>
      </Fold>

      <Fold icon={COIN_ICON} title={`${COIN_NAME}, bottino e oggetti`}>
        <ul>
          <li>Ogni sala vinta: 1d{FLOOR_COINS_DIE} {COIN_NAME} a ogni eroe ancora in gioco.</li>
          <li>I mostri a volte lasciano monete o un oggetto, che va a un eroe tirato a sorte (2 eroi d4, 3 eroi d6, 4 eroi d8: 1–2 il primo, 3–4 il secondo…): gregari {DROP_CHANCE.minion.coins}% monete / {DROP_CHANCE.minion.item}% oggetto, élite {DROP_CHANCE.elite.coins}% / {DROP_CHANCE.elite.item}%, boss {DROP_CHANCE.boss.coins}% / {DROP_CHANCE.boss.item}%.</li>
          <li>Il bottino si consegna solo se il gruppo <b>vince</b> il dungeon.</li>
          <li>Lo zaino è unico per tutti i tuoi eroi. In lotta usare un oggetto vale come l'azione del round.</li>
          <li>In Bottega ogni oggetto ha un limite di acquisti al giorno. Le armi +1 si comprano, le +2 si trovano solo nei dungeon; si equipaggiano dalla scheda dell'eroe, mai durante un dungeon.</li>
        </ul>
      </Fold>
    </section>
  );
}
