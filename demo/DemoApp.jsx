/* DEMO GIOCABILE delle Segrete: un eroe, due sale e il primo boss.
   Il motore è quello vero, ma gira tutto nel browser (fake/*): niente account, niente server,
   niente sprite né dati del sito. */
import { useEffect, useState } from "react";
import DiceRollHost from "../src/components/DiceRoll";
import SegreteHero from "../src/pages/SegreteHero";
import SegreteCrawler from "../src/pages/SegreteCrawler";
import { STORY_CLASSES, heroOf, clsStyle } from "../src/data/segrete";
import { hpPending } from "../src/data/segreteKits";
import { hasRace } from "../src/data/segreteRaces";
import { readDoc, writeDoc, watchDoc } from "./fake/store";
import { DEMO_UID, DEMO_ROOM, DEMO_BAG } from "./demoConfig";

writeDoc("characters", DEMO_UID, { name: "Avventuriero", storyCoins: 0, storyBag: { ...DEMO_BAG }, storyChars: {} });

function useChar() {
  const [c, setC] = useState(() => readDoc("characters", DEMO_UID));
  useEffect(() => watchDoc("characters", DEMO_UID, () => setC(readDoc("characters", DEMO_UID))), []);
  return c;
}

export default function DemoApp() {
  const char = useChar();
  const [step, setStep] = useState("intro"); // intro · eroe · dungeon
  const [cls, setCls] = useState("");
  const [name, setName] = useState("");
  const [room, setRoom] = useState(null);

  useEffect(() => {
    const back = () => { setRoom(null); setStep("eroe"); };
    window.addEventListener("demo:menu", back);
    return () => window.removeEventListener("demo:menu", back);
  }, []);

  const hero = cls ? heroOf(char, cls) : null;
  const ready = !!hero && hasRace(hero) && hpPending(hero) <= 0;

  const start = () => {
    const key = Date.now();
    // ogni partita riparte con lo zaino pieno della demo
    writeDoc("characters", DEMO_UID, { ...readDoc("characters", DEMO_UID), storyBag: { ...DEMO_BAG } });
    const r = { id: DEMO_ROOM, type: "segrete", status: "running", startKey: key, difficulty: "facile",
      members: [{ uid: DEMO_UID, name: name.trim() || "Avventuriero", cls, ready: true }], memberIds: [DEMO_UID] };
    writeDoc("dungeon_rooms", DEMO_ROOM, r);
    writeDoc("dungeon_runs", DEMO_ROOM, null);
    setRoom({ ...r, startedAt: { toMillis: () => key } });
    setStep("dungeon");
  };

  const quit = <div className="demo-tools">
    <button type="button" className="sgb-btn sgb-btn--ghost" onClick={() => window.dispatchEvent(new CustomEvent("demo:menu"))}>⏏ Esci dalla demo</button>
  </div>;

  return (
    <>
      <DiceRollHost />
      {step === "dungeon" && room && <SegreteCrawler key={room.startKey} room={room} uid={DEMO_UID} charData={char} tools={quit} />}
      {step !== "dungeon" && <main className="sgr-page demo-page">
        <header className="demo-head">
          <p className="demo-tag">DEMO · versione di prova</p>
          <h1>🗝 Le Segrete</h1>
          <p className="sgr-lead">Un dungeon crawler a turni in prima persona, con regole alla D&amp;D: dadi veri, classi, armi e incantesimi.</p>
        </header>

        {step === "intro" && <section className="demo-card">
          <h2>Come si gioca</h2>
          <ol className="demo-steps">
            <li>Scegli una <b>classe</b> e crea il tuo eroe: caratteristiche, arma, armatura, prima abilità.</li>
            <li>Scegli la <b>razza</b> e tira i <b>punti ferita</b>.</li>
            <li>Entra nelle Segrete: <b>due sale</b> di mostri, poi il <b>boss</b> e lo scrigno.</li>
            <li>In lotta tocca un'azione, poi il bersaglio. Tieni premuto su un nemico per la sua scheda.</li>
          </ol>
          <p className="demo-note">Nella demo l'eroe non si salva: ricaricando la pagina si riparte da zero. Nel gioco completo gli eroi crescono di livello, si gioca in gruppo fino a 4 e ci sono molti più dungeon.</p>
          <button type="button" className="sgr-cta" onClick={() => setStep("eroe")}>▶ Inizia</button>
        </section>}

        {step === "eroe" && <>
          <section className="demo-card">
            <h2>① Il tuo nome</h2>
            <input className="demo-input" maxLength={24} placeholder="Avventuriero" value={name} onChange={(e) => setName(e.target.value)} />
            <h2>② La classe</h2>
            <div className="demo-classes">
              {STORY_CLASSES.map((c) => {
                const h = heroOf(char, c.key);
                return <button key={c.key} type="button" style={clsStyle(c.key)} aria-pressed={cls === c.key}
                  className={`demo-class${cls === c.key ? " is-on" : ""}`} onClick={() => setCls(c.key)}>
                  <span className="demo-class-ico">{c.icon}</span><span>{c.it}</span>{h && <small>✓ creato</small>}
                </button>;
              })}
            </div>
          </section>
          {cls && <section className="demo-card" style={clsStyle(cls)}>
            <SegreteHero key={cls} cls={cls} charData={char} />
            {ready && <button type="button" className="sgr-cta is-ready demo-go" onClick={start}>⚔ Entra nelle Segrete</button>}
            {hero && !ready && <p className="demo-note">Completa l'eroe qui sopra (razza e punti ferita) per entrare.</p>}
          </section>}
        </>}
        <footer className="demo-foot">Demo privata · non distribuire · icone: game-icons.net (CC BY 3.0)</footer>
      </main>}
    </>
  );
}
