import { heroIdentity } from "../utils/segreteIdentity";
/* LE SEGRETE · Bottega e zaino (2026-11-04)
   Monete Antiche (characters.storyCoins) e zaino (characters.storyBag) del giocatore, per
   tutti i suoi eroi. Si compra col server (segreteDo op shopBuy); le armi magiche si
   equipaggiano dalla scheda dell'eroe. */
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { isHiddenChar } from "../data/hiddenPlayers";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { ITEMS, SHOP_ITEMS, RARITY, COIN_ICON, COIN_NAME, FLOOR_COINS_DIE, bagOf, coinsOf, itemOf, boughtToday, dailyLimit, GIFT_FEE, GIFT_DAILY, giftsToday, isGear, gearUsers, sellPriceOf, tradeValueOf } from "../data/segreteItems";
import { WEAPON_CHOICES, fxLine } from "../data/segreteKits";
import { classInfo, clsStyle } from "../data/segrete";
import { SgIcon } from "../components/GameIcon";

let callable = null;
const segreteDo = (data) => { callable = callable || httpsCallable(functions, "segreteDo"); return callable(data).then((r) => r.data); };

// chi usa un equipaggiamento: "Guerriero, Bardo"
const usersOf = (it) => gearUsers(it).map((c) => classInfo(c)?.it).filter(Boolean).join(", ");

// tipologie degli oggetti, nell'ordine in cui si mostrano (bottega e zaino)
const CATEGORIES = [
  { key: "cure", label: "❤ Cure e rianimazione", kinds: ["heal", "revive"] },
  { key: "purif", label: "🌿 Purificanti", kinds: ["cleanse", "cleanse_party", "panacea"] },
  { key: "buff", label: "🛡 Potenziamenti", kinds: ["buff"] },
  { key: "throw", label: "🔥 Da lancio", kinds: ["throw", "throw_area"] },
  { key: "weapon", label: "⚔ Armi", kinds: ["weapon"] },
  { key: "armor", label: "🧥 Armature", kinds: ["armor"] },
  { key: "shield", label: "🛡 Scudi", kinds: ["shield"] },
];
const catOf = (it) => CATEGORIES.find((c) => c.kinds.includes(it?.kind))?.key || "other";
function groupByCat(ids) {
  const out = CATEGORIES.map((c) => ({ ...c, ids: ids.filter((id) => catOf(itemOf(id)) === c.key) }));
  const other = ids.filter((id) => catOf(itemOf(id)) === "other");
  if (other.length) out.push({ key: "other", label: "✦ Altro", ids: other });
  return out.filter((g) => g.ids.length);
}

export function ItemRow({ id, n, onBuy, onSell, onGift, onEquip, busy, coins, charData }) {
  const it = itemOf(id);
  const r = RARITY[it.rarity];
  return (
    <li className="sgs-item">
      <SgIcon kind="item" of={it} frame size="md" className={`sgs-ico gi-r-${it.rarity}`} />
      <span className="sgs-main">
        <b>{it.name}</b> <em style={{ color: r.color }}>{r.it}</em>
        <small>{it.fx ? `${fxLine(it.fx)} · ` : ""}{it.desc}{isGear(it) ? ` · ${usersOf(it)}` : ""}</small>
      </span>
      {n != null && <span className="sgs-n">×{n}</span>}
      {onEquip && isGear(it) && <button type="button" className="sgr-btn sgs-gift" disabled={busy} onClick={() => onEquip(id)}>🛡 Equipaggia</button>}
      {onGift && <button type="button" className="sgr-btn sgr-btn--ghost sgs-gift" disabled={busy} onClick={() => onGift(id)}>🎁 Regala</button>}
      {onSell && <span className="sgs-buy">
        <button type="button" className="sgr-btn" disabled={busy || !sellPriceOf(it)} onClick={() => onSell(id)}>
          Vendi 1 · {COIN_ICON} {sellPriceOf(it)}
        </button>
        <small>valore {tradeValueOf(it)} · un terzo</small>
      </span>}
      {onBuy && (() => {
        const had = boughtToday(charData, id);
        const lim = dailyLimit(id);
        const full = had >= lim;
        return (
          <span className="sgs-buy">
            <button type="button" className="sgr-btn" disabled={busy || full || coins < it.price} onClick={() => onBuy(id)}>
              {full ? "✓ oggi basta" : `${COIN_ICON} ${it.price}`}
            </button>
            <small>oggi {had}/{lim}</small>
          </span>
        );
      })()}
    </li>
  );
}

/* Legenda (2026-11-06): nelle descrizioni gli stati sono solo icone, le stesse che si vedono in lotta */
const LEGEND = [["🔥", "bruciato"], ["☠", "avvelenato"], ["🧊", "congelato"], ["⚡", "paralizzato"], ["🗿", "pietrificato"], ["😱", "spaventato"], ["🌑", "accecato"], ["🐌", "rallentato"], ["😵", "confuso"], ["🌫", "svantaggio"], ["💫", "stordito"], ["😤", "irruento"], ["🛡", "CA"], ["🎯", "vantaggio"], ["❤", "PF"]];
function IconLegend() {
  return (
    <details className="sgs-legend">
      <summary>Cosa vogliono dire le icone</summary>
      <ul>{LEGEND.map(([i, t]) => <li key={t}>{i} {t}</li>)}</ul>
    </details>
  );
}

/* Regalo a un altro giocatore (2026-11-05): scegli a chi, costa GIFT_FEE Monete, GIFT_DAILY al giorno */
function GiftBox({ id, uid, charData, busy, onSend, onClose }) {
  const it = itemOf(id);
  const [players, setPlayers] = useState(null);
  const [to, setTo] = useState("");
  useEffect(() => {
    getDocs(collection(db, "characters")).then((s) => setPlayers(s.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .filter((c) => c.name && c.uid !== uid && !isHiddenChar({ id: c.uid, name: c.name }) && !String(c.name).toLowerCase().includes("master"))
      .sort((a, b) => String(a.name).localeCompare(b.name)))).catch(() => setPlayers([]));
  }, [uid]);
  const coins = coinsOf(charData);
  const left = GIFT_DAILY - giftsToday(charData);
  const why = left <= 0 ? `Oggi hai già fatto ${GIFT_DAILY} regali: torna domani.` : coins < GIFT_FEE ? `Servono ${GIFT_FEE} ${COIN_NAME}, ne hai ${coins}.` : "";
  return (
    <div className="sgs-giftbox" role="dialog" aria-label={`Regala ${it.name}`}>
      <p className="sgs-gift-title">🎁 Regala {it.icon} <b>{it.name}</b></p>
      <p className="sgr-hint">Costa {COIN_ICON} {GIFT_FEE} {COIN_NAME} (le paghi tu) · regali rimasti oggi: {Math.max(0, left)}/{GIFT_DAILY}. Chi lo riceve ha una notifica.</p>
      {!players ? <p className="sgr-hint">Carico i giocatori…</p> : (
        <select className="sgr-input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="A chi">
          <option value="">— a chi? —</option>
          {players.map((p) => <option key={p.uid} value={p.uid}>{p.name}</option>)}
        </select>
      )}
      {why && <p className="sgr-err">{why}</p>}
      <div className="sgr-room-actions">
        <button type="button" className="sgr-btn" disabled={busy || !to || !!why}
          onClick={() => onSend(id, to, players.find((p) => p.uid === to)?.name || "")}>🎁 Regala per {COIN_ICON} {GIFT_FEE}</button>
        <button type="button" className="sgr-btn sgr-btn--ghost" onClick={onClose}>Annulla</button>
      </div>
    </div>
  );
}

/* Equipaggia dallo zaino (2026-11-06): gli eroi del giocatore che possono usare quell'oggetto */
function EquipBox({ id, charData, busy, onEquip, onClose }) {
  const it = itemOf(id);
  const mine = Object.keys(charData?.storyChars || {});
  const users = gearUsers(it).filter((c) => mine.includes(c));
  const slot = it.kind === "armor" ? "armor" : it.kind === "shield" ? "shield" : "weapon";
  const field = slot === "armor" ? "armorItem" : slot === "shield" ? "shieldItem" : "weaponItem";
  return (
    <div className="sgs-giftbox" role="dialog" aria-label={`Equipaggia ${it.name}`}>
      <p className="sgs-gift-title">🛡 Su quale eroe metti {it.icon} <b>{it.name}</b>?</p>
      {!users.length ? <p className="sgr-hint">Nessuno dei tuoi eroi può usarlo. Classi che possono: {usersOf(it) || "nessuna"}.</p> : (
        <div className="sgr-room-actions">
          {users.map((c) => {
            const has = charData.storyChars[c]?.[field] === id;
            return (
              <button key={c} type="button" className="sgr-btn" style={clsStyle(c)} disabled={busy || has} onClick={() => onEquip(c, slot, id)}>
                <SgIcon kind="cls" of={c} fallback={classInfo(c)?.icon} /> {heroIdentity(c, charData?.storyChars?.[c])}{has ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      )}
      <p className="sgr-hint">L'oggetto che l'eroe usava in quello slot torna nello zaino.</p>
      <button type="button" className="sgr-btn sgr-btn--ghost" onClick={onClose}>Annulla</button>
    </div>
  );
}

export default function SegreteShop({ charData, view = "zaino", uid }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const tab = view;
  const [shopMode, setShopMode] = useState("buy");
  const [category, setCategory] = useState("all");
  const [wFilter, setWFilter] = useState(false);
  const [gift, setGift] = useState(null);
  const [equip, setEquip] = useState(null);
  const doEquip = async (cls, slot, id) => {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await segreteDo({ op: "heroEquip", cls, slot, itemId: id }); setMsg(`✓ ${itemOf(id).name} equipaggiato sul tuo ${heroIdentity(cls, charData?.storyChars?.[cls])}.`); setEquip(null); }
    catch (e) { setMsg(e.message || "Non riuscito."); }
    finally { setBusy(false); }
  };
  const sendGift = async (id, toUid, toName) => {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await segreteDo({ op: "giftItem", itemId: id, toUid }); setMsg(`🎁 ${itemOf(id).name} regalato a ${toName}.`); setGift(null); }
    catch (e) { setMsg(e.message || "Regalo non riuscito."); }
    finally { setBusy(false); }
  };
  const unequip = async (cls, slot = "weapon") => {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await segreteDo({ op: "heroEquip", cls, slot, itemId: null }); setMsg("↩ Rimesso nello zaino: ora lo può prendere un altro eroe dalla sua scheda (o lo puoi regalare)."); }
    catch (e) { setMsg(e.message || "Non riuscito."); }
    finally { setBusy(false); }
  };
  const SLOTS = [["weapon", "weaponItem"], ["armor", "armorItem"], ["shield", "shieldItem"]];
  const worn = Object.entries(charData?.storyChars || {}).flatMap(([cls, h]) => SLOTS.filter(([, f]) => h?.[f] && itemOf(h[f])).map(([slot, f]) => ({ cls, slot, id: h[f] })));
  const coins = coinsOf(charData);
  const bag = bagOf(charData);
  const bagIds = Object.keys(bag);
  const buy = async (id) => {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await segreteDo({ op: "shopBuy", itemId: id, qty: 1 }); setMsg(`✓ Comprato: ${itemOf(id).name}.`); }
    catch (e) { setMsg(e.message || "Acquisto non riuscito."); }
    finally { setBusy(false); }
  };
  const sell = async (id) => {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      const result = await segreteDo({ op: "shopSell", itemId: id, qty: 1 });
      setMsg(`Venduto: ${result.name}. +${result.earned} ${COIN_NAME}.`);
    } catch (e) { setMsg(e.message || "Vendita non riuscita."); }
    finally { setBusy(false); }
  };
  const myBases = new Set(Object.keys(charData?.storyChars || {}).flatMap((c) => WEAPON_CHOICES[c] || []));
  const shop = SHOP_ITEMS.filter((id) => !isGear(ITEMS[id]));
  const myClasses = Object.keys(charData?.storyChars || {});
  const shopArmors = SHOP_ITEMS.filter((id) => (ITEMS[id].kind === "armor" || ITEMS[id].kind === "shield") && (!wFilter || gearUsers(ITEMS[id]).some((c) => myClasses.includes(c))));
  const shopWeapons = SHOP_ITEMS.filter((id) => ITEMS[id].kind === "weapon" && (!wFilter || myBases.has(ITEMS[id].base)));
  const availableIds = tab === "zaino" || shopMode === "sell" ? bagIds : [...shop, ...shopWeapons, ...shopArmors];
  const categories = groupByCat(availableIds);
  const visibleGroups = (ids) => groupByCat(ids).filter((g) => category === "all" || g.key === category);
  return (
    <section className="sgr-block" id="sgr-bottega">
      <h2 className="sgr-h2">{tab === "zaino" ? "🎒 Il tuo zaino" : "🏪 La Bottega"} <span className="sgr-coins">{COIN_ICON} {coins} {COIN_NAME}</span></h2>
      <p className="sgr-hint">{tab === "zaino"
        ? "Lo zaino è unico per tutti i tuoi eroi."
        : `Si paga in ${COIN_NAME}: 1d${FLOOR_COINS_DIE} a ogni eroe per sala vinta, più quelle che lasciano i mostri (si portano a casa solo se il gruppo vince). Ogni oggetto ha un limite di acquisti al giorno.`}</p>
      <IconLegend />
      {msg && <p className="sgr-hint" role="status">{msg}</p>}
      {tab !== "zaino" && <div className="sgs-tabs" role="group" aria-label="Operazione in Bottega">
        <button type="button" className={`sgr-btn${shopMode === "buy" ? " is-on" : ""}`} aria-pressed={shopMode === "buy"} onClick={() => { setShopMode("buy"); setCategory("all"); }}>Compra</button>
        <button type="button" className={`sgr-btn${shopMode === "sell" ? " is-on" : ""}`} aria-pressed={shopMode === "sell"} onClick={() => { setShopMode("sell"); setCategory("all"); }}>Vendi dallo zaino</button>
      </div>}
      <div className="sgs-categories" role="group" aria-label="Categorie oggetti">
        {[{ key: "all", label: "Tutti" }, ...CATEGORIES, { key: "other", label: "Altro" }].filter((c) => c.key !== "other" || categories.some((g) => g.key === "other")).map((c) => (
          <button key={c.key} type="button" className={`sgr-btn sgr-btn--ghost${category === c.key ? " is-on" : ""}`} aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>
            {c.label} ({c.key === "all" ? availableIds.length : categories.find((g) => g.key === c.key)?.ids.length || 0})
          </button>
        ))}
      </div>
      {!visibleGroups(availableIds).length && <p className="sgr-empty">Nessun oggetto in questa categoria.</p>}
      {tab === "zaino" ? (
        bagIds.length ? (
          visibleGroups(bagIds).map((g) => (
          <div key={g.key} className="sgs-group">
          <p className="sgr-label">{g.label} <small>({g.ids.reduce((t, id) => t + (bag[id] || 0), 0)})</small></p>
          <ul className="sgs-list">{g.ids.map((id) => (
            <li key={id} className="sgs-wrap">
              <ul className="sgs-list sgs-list--one"><ItemRow id={id} n={bag[id]} onGift={(x) => { setEquip(null); setGift(gift === x ? null : x); }} onEquip={(x) => { setGift(null); setEquip(equip === x ? null : x); }} busy={busy} /></ul>
              {equip === id && <EquipBox id={id} charData={charData} busy={busy} onEquip={doEquip} onClose={() => setEquip(null)} />}
              {gift === id && <GiftBox id={id} uid={uid} charData={charData} busy={busy} onSend={sendGift} onClose={() => setGift(null)} />}
            </li>
          ))}</ul>
          </div>
          ))
        ) : <p className="sgr-empty">Lo zaino è vuoto: passa dalla Bottega o cerca fra i mostri.</p>
      ) : null}
      {tab === "zaino" && !!worn.length && (
        <>
          <p className="sgr-label">Equipaggiamento montato sugli eroi</p>
          <ul className="sgs-list">
            {worn.map(({ cls, slot, id }) => {
              const it = itemOf(id);
              return (
                <li key={`${cls}-${slot}`} className="sgs-item sgs-worn" style={clsStyle(cls)}>
                  <SgIcon kind="item" of={it} frame size="md" className={`sgs-ico gi-r-${it.rarity}`} />
                  <span className="sgs-main"><b>{it.name}</b><small>sul tuo <span className="sgr-clsname"><SgIcon kind="cls" of={cls} fallback={classInfo(cls)?.icon} /> {heroIdentity(cls, charData?.storyChars?.[cls])}</span></small></span>
                  <button type="button" className="sgr-btn sgr-btn--ghost" disabled={busy} onClick={() => unequip(cls, slot)}>↩ Nello zaino</button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {tab !== "zaino" && (shopMode === "sell" ? (
        <>
          <p className="sgr-hint">Vendi una copia alla volta per un terzo del prezzo, arrotondato per difetto. Per gli oggetti solo bottino si usa il valore di riferimento per rarità. Gli oggetti equipaggiati vanno prima rimessi nello zaino.</p>
          {visibleGroups(bagIds).map((g) => (
            <div key={g.key} className="sgs-group">
              <p className="sgr-label">{g.label}</p>
              <ul className="sgs-list">{g.ids.map((id) => <ItemRow key={id} id={id} n={bag[id]} onSell={sell} busy={busy} />)}</ul>
            </div>
          ))}
        </>
      ) : (
        <>
          <label className="sgs-filter"><input type="checkbox" checked={wFilter} onChange={(e) => setWFilter(e.target.checked)} /> solo armi e armature che i miei eroi possono usare</label>
          {visibleGroups([...shop, ...shopWeapons, ...shopArmors]).map((g) => (
            <div key={g.key} className="sgs-group">
              <p className="sgr-label">{g.label}</p>
              <ul className="sgs-list">{g.ids.map((id) => <ItemRow key={id} id={id} n={bag[id] || null} onBuy={buy} busy={busy} coins={coins} charData={charData} />)}</ul>
            </div>
          ))}
        </>
      ))}

    </section>
  );
}
