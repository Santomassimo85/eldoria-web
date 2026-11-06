/* LE SEGRETE · "📜 Cosa c'è qui" (2026-11-06): pannello piccolo e richiudibile sotto il
   dungeon scelto. Per ogni difficoltà: livello minimo, quanto picchiano i mostri, che nemici
   si incontrano (il nome solo se quel tipo è già stato sconfitto almeno una volta), monete,
   PE, Corone, probabilità di drop e tutti gli oggetti che possono cadere con la loro %.
   I numeri escono dalle stesse costanti del motore: se cambia il bilanciamento, cambia qui. */
import { SgIcon } from "../components/GameIcon";
import { DIFF_TONE } from "../data/segreteIcons";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { DIFFICULTIES, diffOf, mergeMonsters, DEFAULT_FLOORS, MONSTER_SIZES, sizeOf } from "../data/segrete";
import { FALLBACK_MONSTERS } from "../data/segreteEngine";
import { DROP_CHANCE, FLOOR_COINS_DIE, COIN_ICON, COIN_NAME, RARITY, DIFF_RANK, ITEMS, itemOf, dropOdds, gearUsers } from "../data/segreteItems";
import { classInfo } from "../data/segrete";
import { fxLine, XP_PER_ROOM } from "../data/segreteKits";

// dati letti una volta per sessione (bestiario, mostri conosciuti, forziere del Master)
let cache = null;
function loadAll() {
  if (cache) return cache;
  cache = Promise.all([
    getDocs(collection(db, "dungeon_monsters")).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
    getDoc(doc(db, "dungeon_meta", "known")).then((s) => (s.exists() ? s.data().sources || {} : {})).catch(() => ({})),
    getDocs(query(collection(db, "segrete_loot"), where("status", "==", "pool"))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
  ]).then(([monsters, known, chest]) => ({ monsters: mergeMonsters(monsters), known, chest }));
  setTimeout(() => { cache = null; }, 5 * 60 * 1000);
  return cache;
}

const ROLE_IT = { minion: "Gregari", elite: "Élite", boss: "Boss" };
const ROLE_ONE = { minion: "gregario", elite: "élite", boss: "boss" };
const pctTxt = (p) => (p >= 10 ? `${Math.round(p)}%` : p >= 1 ? `${p.toFixed(1).replace(".", ",")}%` : `${p.toFixed(2).replace(".", ",")}%`);
const num = (x) => String(Math.round(x * 10) / 10).replace(".", ",");

export default function SegreteDungeonInfo({ dungeon, diff = "facile" }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(diff);
  const [role, setRole] = useState("boss");
  useEffect(() => { setTab(diff); }, [diff]);
  useEffect(() => { let on = true; loadAll().then((d) => on && setData(d)); return () => { on = false; }; }, []);
  const D = diffOf(tab);
  const key = dungeon?.key;
  const floors = Number(dungeon?.floors) || DEFAULT_FLOORS;

  const foes = useMemo(() => {
    if (!data || !key) return null;
    const own = data.monsters.filter((m) => (m.dungeons || []).includes(key));
    return own.length ? own : FALLBACK_MONSTERS;
  }, [data, key]);

  const odds = useMemo(() => {
    const list = dropOdds({ dungeon: key, rank: DIFF_RANK[D.key] || 0, boost: D.boost }, role);
    // armi +1/+2 e armature generiche: una riga sola ciascuna (sono tante)
    const rows = [];
    let wg = 0; let ag = 0;
    list.forEach((o) => {
      const it = ITEMS[o.id];
      if (it.group === "weapon") wg += o.pct;
      else if (it.group === "armor") ag += o.pct;
      else rows.push(o);
    });
    if (wg) rows.push({ id: "__weapons", pct: wg });
    if (ag) rows.push({ id: "__armors", pct: ag });
    return rows.sort((a, b) => b.pct - a.pct);
  }, [key, D, role]);

  if (!dungeon) return null;
  const ch = DROP_CHANCE[role];
  const corone = Math.round((Number.isFinite(Number(dungeon.corone)) ? Number(dungeon.corone) : 5) * D.corone);
  const chest = Math.min(100, (Number.isFinite(Number(dungeon.lootChance)) ? Number(dungeon.lootChance) : 35) * D.chest);
  const chestItems = (data?.chest || []).filter((l) => !(l.dungeons || []).length || l.dungeons.includes(key));
  const xpWin = Math.round(XP_PER_ROOM * (floors + 1) * D.xp);
  const hasBoss = (foes || []).some((m) => m.role === "boss");

  return (
    <details className="sgi">
      <summary>📜 Cosa c'è qui <small>· nemici, difficoltà e bottino di {dungeon.icon} {dungeon.name}</small></summary>
      <div className="sgi-body">
        <div className="sgi-tabs" role="group" aria-label="Difficoltà da guardare">
          {DIFFICULTIES.map((d) => (
            <button key={d.key} type="button" aria-pressed={tab === d.key} className={`sgi-tab${tab === d.key ? " is-on" : ""}${d.key === diff ? " is-sel" : ""}`} onClick={() => setTab(d.key)}>
              <SgIcon kind="diff" of={d} color={DIFF_TONE[d.key]} /> {d.name}{d.key === diff ? " ✓" : ""}
            </button>
          ))}
        </div>

        <p className="sgi-line"><b><SgIcon kind="diff" of={D} color={DIFF_TONE[D.key]} /> {D.name}</b> · {D.minLevel > 1 ? `serve Lv ${D.minLevel}+ per ogni eroe` : "per tutti i livelli"} · {floors} sale + il boss</p>
        <p className="sgi-line sgi-danger">
          <span className="sgi-meter" aria-label={`Pericolo ${D.rank + 1} su 3`}>{[0, 1, 2].map((i) => <i key={i} className={i <= D.rank ? "on" : ""} />)}</span>
          {D.rank === 0 ? "Mostri tarati sul vostro gruppo." : `Mostri: PF ×${num(D.hp)} · danni ×${num(D.dmg)}${D.plus ? ` · +${D.plus} a colpire, CA, CD e TS` : ""} · élite più spesso (${Math.round(D.elite * 100)}%).`}
        </p>

        <h4 className="sgi-h">👹 Chi incontrerete</h4>
        {!foes ? <p className="sgi-line">Carico il bestiario…</p> : (
          <div className="sgi-roles">
            {["minion", "elite", "boss"].map((r) => {
              const list = foes.filter((m) => (m.role || "minion") === r);
              return (
                <div key={r} className="sgi-role">
                  <small>{ROLE_IT[r]}</small>
                  <ul>
                    {list.map((m) => {
                      const k = !!data?.known?.[m.id];
                      return (
                        <li key={m.id} title={k ? m.desc || m.name : "Non ancora sconfitto da nessuno: il nome si scopre combattendo."}>
                          {k && m.imageUrl ? <img src={m.imageUrl} alt="" /> : k ? <SgIcon kind="monster" of={m} fallback={m.icon || "👹"} size="md" /> : <span aria-hidden="true">❔</span>}
                          <b>{k ? m.name : "???"}</b>
                          <em>{MONSTER_SIZES.find((x) => x.key === sizeOf(m))?.label || ""}</em>
                        </li>
                      );
                    })}
                    {!list.length && <li className="sgi-none">{r === "boss" && !hasBoss ? "il boss di un altro dungeon" : r === "elite" ? "nessuna" : "—"}</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <h4 className="sgi-h">🏆 Premi se il gruppo vince</h4>
        <ul className="sgi-prizes">
          <li>⭐ PE: <b>{xpWin}</b> a eroe, uguali per tutti i livelli</li>
          <li>👑 Corone: <b>{corone}</b> a eroe</li>
          <li>{COIN_ICON} {COIN_NAME}: <b>1d{FLOOR_COINS_DIE}{D.coins !== 1 ? ` ×${num(D.coins)}` : ""}</b> a sala ripulita (in media ~{Math.round(10.5 * D.coins * (floors + 1))} a dungeon) + quelle dei mostri</li>
          {["minion", "elite", "boss"].map((r) => {
            const c = DROP_CHANCE[r];
            return <li key={r}>💀 Un {ROLE_ONE[r]} che cade: <b>{c.coins}%</b> monete ({c.coinDice[0]}d{c.coinDice[1]}{D.coins !== 1 ? ` ×${num(D.coins)}` : ""}) · <b>{pctTxt(Math.min(95, c.item * D.item))}</b> un oggetto</li>;
          })}
          <li>🎁 Forziere del Master: <b>{Math.round(chest)}%</b> alla vittoria{chestItems.length ? ` · in palio: ${chestItems.map((l) => l.name).join(", ")}` : " · per ora è vuoto"}</li>
        </ul>

        <h4 className="sgi-h">🎒 Oggetti che possono cadere</h4>
        <div className="sgi-tabs sgi-tabs--sm" role="group" aria-label="Da quale mostro">
          {["minion", "elite", "boss"].map((r) => (
            <button key={r} type="button" aria-pressed={role === r} className={`sgi-tab${role === r ? " is-on" : ""}`} onClick={() => setRole(r)}>da un {ROLE_ONE[r]}</button>
          ))}
        </div>
        <p className="sgi-line"><small>Quando un {ROLE_ONE[role]} lascia un oggetto ({pctTxt(Math.min(95, ch.item * D.item))} delle volte), ecco cosa può essere. Armi e armature escono solo se qualcuno del gruppo le sa usare.</small></p>
        <ul className="sgi-items">
          {odds.map((o) => {
            if (o.id === "__weapons") return <li key={o.id}><SgIcon kind="weapon" of="spada_lunga" frame size="sm" /><span className="sgi-it"><b>Arma +1 o +2</b><small>del tipo usato da qualcuno del gruppo</small></span><em>{pctTxt(o.pct)}</em></li>;
            if (o.id === "__armors") return <li key={o.id}><SgIcon kind="armor" of="scudo" frame size="sm" /><span className="sgi-it"><b>Armatura o scudo magici</b><small>Mezza armatura, Stecche, Piastre, armature +1, Scudo +1</small></span><em>{pctTxt(o.pct)}</em></li>;
            const it = itemOf(o.id);
            const users = it.kind === "weapon" || it.kind === "armor" || it.kind === "shield" ? gearUsers(it).map((c) => classInfo(c)?.icon).join("") : "";
            return (
              <li key={o.id} title={it.desc}>
                <SgIcon kind="item" of={it} frame size="sm" className={`gi-r-${it.rarity}`} />
                <span className="sgi-it">
                  <b style={{ "--rc": RARITY[it.rarity]?.color }}>{it.name}</b>
                  <small>
                    {it.dungeons ? <i className="sgi-tag">★ di questo dungeon</i> : null}
                    {it.minDiff ? <i className="sgi-tag sgi-tag--hot">solo {diffOf(it.minDiff).name}+</i> : null}
                    {it.fx ? fxLine(it.fx) : it.kind === "armor" || it.kind === "shield" ? it.desc : RARITY[it.rarity]?.it}
                    {users ? ` · ${users}` : ""}
                  </small>
                </span>
                <em>{pctTxt(o.pct)}</em>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
