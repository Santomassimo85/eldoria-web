/* LE SEGRETE · Bottega e zaino (2026-11-04)
   Monete Antiche (characters.storyCoins) e zaino (characters.storyBag) del giocatore, per
   tutti i suoi eroi. Si compra col server (segreteDo op shopBuy); le armi magiche si
   equipaggiano dalla scheda dell'eroe. */
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { ITEMS, SHOP_ITEMS, RARITY, COIN_ICON, COIN_NAME, FLOOR_COINS_DIE, bagOf, coinsOf, itemOf, boughtToday, dailyLimit } from "../data/segreteItems";
import { WEAPON_CHOICES } from "../data/segreteKits";
import { classInfo } from "../data/segrete";

let callable = null;
const segreteDo = (data) => { callable = callable || httpsCallable(functions, "segreteDo"); return callable(data).then((r) => r.data); };

// chi usa un tipo d'arma: "Guerriero, Bardo"
const usersOf = (base) => Object.entries(WEAPON_CHOICES).filter(([, l]) => l.includes(base)).map(([c]) => classInfo(c)?.it).filter(Boolean).join(", ");

function ItemRow({ id, n, onBuy, busy, coins, charData }) {
  const it = itemOf(id);
  const r = RARITY[it.rarity];
  return (
    <li className="sgs-item">
      <span className="sgs-ico" aria-hidden="true">{it.icon}</span>
      <span className="sgs-main">
        <b>{it.name}</b> <em style={{ color: r.color }}>{r.it}</em>
        <small>{it.desc}{it.kind === "weapon" ? ` Classi: ${usersOf(it.base)}.` : ""}</small>
      </span>
      {n != null && <span className="sgs-n">×{n}</span>}
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

export default function SegreteShop({ charData, view = "zaino" }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const tab = view;
  const [wFilter, setWFilter] = useState(false);
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
  const myBases = new Set(Object.keys(charData?.storyChars || {}).flatMap((c) => WEAPON_CHOICES[c] || []));
  const shop = SHOP_ITEMS.filter((id) => ITEMS[id].kind !== "weapon");
  const shopWeapons = SHOP_ITEMS.filter((id) => ITEMS[id].kind === "weapon" && (!wFilter || myBases.has(ITEMS[id].base)));
  return (
    <section className="sgr-block" id="sgr-bottega">
      <h2 className="sgr-h2">{tab === "zaino" ? "🎒 Il tuo zaino" : "🏪 La Bottega"} <span className="sgr-coins">{COIN_ICON} {coins} {COIN_NAME}</span></h2>
      <p className="sgr-hint">{tab === "zaino"
        ? "Lo zaino è tuo e vale per tutti i tuoi eroi. Gli oggetti si usano in lotta col tasto 🎒 Zaino; le armi magiche si equipaggiano dalla scheda dell'eroe (scheda Personaggi)."
        : `Si paga in ${COIN_NAME}: 1d${FLOOR_COINS_DIE} a ogni eroe per sala vinta, più quelle che lasciano i mostri (si portano a casa solo se il gruppo vince). Ogni oggetto ha un limite di acquisti al giorno.`}</p>
      {msg && <p className="sgr-hint" role="status">{msg}</p>}
      {tab === "zaino" ? (
        bagIds.length ? (
          <ul className="sgs-list">{bagIds.map((id) => <ItemRow key={id} id={id} n={bag[id]} />)}</ul>
        ) : <p className="sgr-empty">Lo zaino è vuoto: passa dalla Bottega o cerca fra i mostri.</p>
      ) : (
        <>
          <p className="sgr-label">Pozioni e oggetti da lotta</p>
          <ul className="sgs-list">{shop.map((id) => <ItemRow key={id} id={id} n={bag[id] || null} onBuy={buy} busy={busy} coins={coins} charData={charData} />)}</ul>
          <p className="sgr-label">Armi +1 <small>(si equipaggiano dalla scheda dell'eroe; le +2 si trovano solo nei dungeon)</small></p>
          <label className="sgs-filter"><input type="checkbox" checked={wFilter} onChange={(e) => setWFilter(e.target.checked)} /> solo armi che i miei eroi possono usare</label>
          <ul className="sgs-list">{shopWeapons.map((id) => <ItemRow key={id} id={id} n={bag[id] || null} onBuy={buy} busy={busy} coins={coins} charData={charData} />)}</ul>
        </>
      )}
    </section>
  );
}
