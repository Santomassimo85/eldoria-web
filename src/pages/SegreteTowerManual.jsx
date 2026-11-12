import { MAX_PARTY, TOWER_MAX_FLOORS, TOWER_WEEKLY_FREE, TOWER_BOSS_EVERY } from "../data/segrete";

export default function SegreteTowerManual() {
  return <section className="sgr-block sgm">
    <h2 className="sgr-h2">📖 Manuale della Torre</h2>
    <ul className="sgm-list">
      <li><b>Prepara l’eroe.</b> Usa un personaggio delle Segrete con razza scelta e PF tirati. Gioca da solo o in gruppo fino a {MAX_PARTY} eroi, poi tutti premono <b>Avvia Scalata</b>.</li>
      <li><b>Ingresso.</b> Solo il capo spende un Sigillo per aprire la Torre al gruppo. Ha {TOWER_WEEKLY_FREE} ingressi gratuiti a settimana. I Sigilli extra si comprano in Bottega o si trovano nei dungeon Medio e Leggenda.</li>
      <li><b>La sfida.</b> {TOWER_MAX_FLOORS} piani tarati per 4 eroi, con difficoltà crescente e un Guardiano ogni {TOWER_BOSS_EVERY} piani. In solitaria serve un livello superiore. Anche in quattro, livello ed equipaggiamento devono essere adeguati.</li>
      <li><b>Esperienza.</b> I piani superati danno PE, che conservi anche se il gruppo viene sconfitto.</li>
      <li><b>Attenzione ai nuovi tentativi.</b> Ogni scalata riparte dal piano 1. L’ultimo risultato sostituisce quello precedente per i premi settimanali, anche se è più basso.</li>
      <li><b>Premi e reset.</b> Domenica alle <b>23:00, ora italiana</b>, ricevi il premio del piano registrato e un’armatura per la tua classe a ogni soglia di 20 piani raggiunta. Apri <b>Premi &amp; Reliquie</b> per vedere fasce e ricompense.</li>
    </ul>
  </section>;
}
