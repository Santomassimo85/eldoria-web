// Registro dei SET del Mercato Nero (solo Master).
//
// I set vivono dentro gli oggetti (`items/{id}.setPayload`), ma gli oggetti si
// cancellano: senza un registro a parte, un set venduto e ripulito sparisce.
// Qui ogni set ha il suo documento `market_sets/{slug}` con i pezzi creati,
// che restano anche dopo la cancellazione dell'oggetto (stato "eliminato").
//
// `reconcileSets` confronta gli oggetti del mercato col registro e restituisce
// SOLO i documenti da riscrivere: la Forgia lo lancia a ogni snapshot.
import React, { useMemo, useState } from "react";

export const setSlug = (name) =>
  String(name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "set";

const STATUS_META = {
  "in vendita": { icon: "🟢", label: "In vendita" },
  invenduto:    { icon: "⌛", label: "Asta chiusa, invenduto" },
  venduto:      { icon: "✅", label: "Venduto" },
  eliminato:    { icon: "🗑", label: "Tolto dal mercato" },
  "a mano":     { icon: "✍️", label: "Registrato a mano" },
};

// Firestore rifiuta `undefined`: tolgo le chiavi vuote.
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const pieceFromItem = (item) => {
  const expired = !item.isSold && item.endDate && new Date(item.endDate) <= new Date();
  return clean({
    source: "market",
    itemId: item.id,
    name: item.name || "Senza nome",
    class: item.class || "",
    type: item.type || "",
    img: item.img || "",
    createdAt: item.createdAt || null,
    status: item.isSold ? "venduto" : expired ? "invenduto" : "in vendita",
    buyerName: item.isSold ? (item.buyerName || "") : undefined,
    finalPrice: item.isSold && item.finalPrice != null ? Number(item.finalPrice) : undefined,
    soldAt: item.isSold ? (item.soldAt || null) : undefined,
  });
};

const normBonuses = (bonuses) =>
  (Array.isArray(bonuses) ? bonuses : [])
    .map((b) => ({ pieces: Number(b.pieces) || 1, effect: String(b.effect || "").trim() }))
    .filter((b) => b.effect)
    .sort((a, b) => a.pieces - b.pieces);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @param items    oggetti del mercato ({id, ...data})
 * @param registry documenti di market_sets ({id, ...data})
 * @returns [{id, data}] documenti da scrivere (interi)
 */
export function reconcileSets(items, registry) {
  const nowIso = new Date().toISOString();
  const byId = new Map(registry.map((r) => [r.id, r]));
  const itemIds = new Set(items.map((i) => i.id));

  // Oggetti attuali raggruppati per set
  const groups = new Map();
  for (const it of items) {
    const name = String(it.setPayload?.name || "").trim();
    if (!name) continue;
    const slug = setSlug(name);
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push(it);
  }

  const touched = new Set([...byId.keys(), ...groups.keys()]);
  const writes = [];

  for (const slug of touched) {
    const prev = byId.get(slug);
    const live = groups.get(slug) || [];
    const pieces = { ...(prev?.pieces || {}) };

    for (const [key, p] of Object.entries(pieces)) {
      if (p.source !== "market") continue;
      // l'oggetto esiste ma non è più in questo set → via di qui (lo prende l'altro set)
      if (itemIds.has(p.itemId) && !live.some((i) => i.id === p.itemId)) { delete pieces[key]; continue; }
      // l'oggetto è stato cancellato → resta nel registro come "eliminato"
      if (!itemIds.has(p.itemId) && p.status !== "eliminato") {
        pieces[key] = { ...p, status: "eliminato", deletedAt: nowIso, wasStatus: p.status };
      }
    }
    for (const it of live) {
      const p = pieceFromItem(it);
      pieces[it.id] = pieces[it.id]?.status === p.status ? { ...pieces[it.id], ...p } : p;
    }

    // Nome, pezzi totali e bonus: dall'oggetto più recente del set, se ce n'è uno vivo
    const newest = [...live].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
    const firstDate = Object.values(pieces).map((p) => p.createdAt).filter(Boolean).sort()[0];
    const data = clean({
      slug,
      name: prev?.name || String(newest?.setPayload?.name || "").trim() || slug,
      size: newest ? Math.max(2, Number(newest.setPayload.size) || 5) : (prev?.size || 5),
      bonuses: newest ? normBonuses(newest.setPayload.bonuses) : (prev?.bonuses || []),
      pieces,
      manual: prev?.manual || false,
      createdAt: prev?.createdAt || firstDate || nowIso,
    });
    if (!Object.keys(pieces).length && !prev?.manual) {
      if (prev) writes.push({ id: slug, data: null }); // set rimasto vuoto (oggetto spostato in un altro set)
      continue;
    }
    const before = prev ? clean({ slug: prev.slug, name: prev.name, size: prev.size, bonuses: prev.bonuses || [], pieces: prev.pieces || {}, manual: prev.manual || false, createdAt: prev.createdAt }) : null;
    if (!before || !same(before, data)) writes.push({ id: slug, data: { ...data, updatedAt: nowIso } });
  }
  return writes;
}

const parseBonusLines = (text, size) =>
  String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d+)\s*(?:\/\s*\d+)?\s*[:.)-]\s*(.+)$/);
      return m ? { pieces: Math.min(size, Math.max(1, Number(m[1]))), effect: m[2].trim() } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.pieces - b.pieces);

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
};

/* ───────────────────────── UI ───────────────────────── */

export default function SetRegistry({ sets, onNewPiece, onShowInStock, onSave, onDelete }) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", size: 5, pieces: "", bonuses: "" });
  const [pieceDraft, setPieceDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return [...sets]
      .filter((s) => !nq || s.name.toLowerCase().includes(nq)
        || Object.values(s.pieces || {}).some((p) => String(p.name).toLowerCase().includes(nq)))
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  }, [sets, q]);

  const totals = useMemo(() => {
    let pieces = 0, sold = 0, live = 0;
    sets.forEach((s) => Object.values(s.pieces || {}).forEach((p) => {
      pieces++; if (p.status === "venduto") sold++; if (p.status === "in vendita") live++;
    }));
    return { sets: sets.length, pieces, sold, live };
  }, [sets]);

  const addManualSet = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const slug = setSlug(name);
    if (sets.some((s) => s.id === slug)) { setOpenId(slug); setAdding(false); return; }
    const size = Math.max(2, Number(draft.size) || 5);
    const now = new Date().toISOString();
    const pieces = {};
    draft.pieces.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((n, i) => {
      pieces[`m_${Date.now()}_${i}`] = { source: "manual", name: n, status: "a mano", createdAt: now };
    });
    await onSave(slug, { slug, name, size, bonuses: parseBonusLines(draft.bonuses, size), pieces, manual: true, createdAt: now, updatedAt: now });
    setDraft({ name: "", size: 5, pieces: "", bonuses: "" });
    setAdding(false);
    setOpenId(slug);
  };

  const addManualPiece = async (s) => {
    const n = pieceDraft.trim();
    if (!n) return;
    const now = new Date().toISOString();
    await onSave(s.id, { ...s, pieces: { ...s.pieces, [`m_${Date.now()}`]: { source: "manual", name: n, status: "a mano", createdAt: now } }, updatedAt: now }, true);
    setPieceDraft("");
  };

  const removePiece = async (s, key) => {
    const pieces = { ...s.pieces };
    delete pieces[key];
    await onSave(s.id, { ...s, pieces, updatedAt: new Date().toISOString() }, true);
  };

  return (
    <details className="mkadm-sets" open>
      <summary className="mkadm-sets-head">
        <h2>⛓ Registro dei Set <small>solo Master</small></h2>
        <span className="mkadm-sets-count">
          {totals.sets} set · {totals.pieces} pezzi · {totals.live} in vendita · {totals.sold} venduti
        </span>
      </summary>

      <p className="mkadm-sets-intro">
        Ogni oggetto che crei con "fa parte di un set" finisce qui da solo, e ci resta anche quando lo togli dal mercato.
        Prima di forgiare un pezzo nuovo, guarda cosa esiste già.
      </p>

      <div className="mkadm-sets-tools">
        <input
          type="search"
          className="admin-field-input"
          placeholder="Cerca un set o un pezzo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cerca nel registro dei set"
        />
        <button type="button" className="mkadm-set-bonus-add" onClick={() => setAdding((v) => !v)}>
          {adding ? "Annulla" : "＋ Registra un set a mano"}
        </button>
      </div>

      {adding && (
        <div className="mkadm-sets-manual">
          <p className="mkadm-sets-note">
            Per i set creati prima del registro, i cui oggetti sono già stati cancellati: scrivi quello che ricordi.
          </p>
          <div className="mkadm-field-row">
            <div className="mkadm-field">
              <label>Nome del set</label>
              <input className="admin-field-input" value={draft.name} placeholder="Es. Set del Drago d'Oro"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="mkadm-field">
              <label>Pezzi totali</label>
              <input className="admin-field-input" type="number" min="2" max="20" value={draft.size}
                onChange={(e) => setDraft({ ...draft, size: e.target.value })} />
            </div>
          </div>
          <div className="mkadm-field-row">
            <div className="mkadm-field">
              <label>Pezzi già creati (uno per riga)</label>
              <textarea className="admin-field-input" rows={4} value={draft.pieces}
                placeholder={"Elmo del Drago d'Oro\nGuanti del Drago d'Oro"}
                onChange={(e) => setDraft({ ...draft, pieces: e.target.value })} />
            </div>
            <div className="mkadm-field">
              <label>Bonus (uno per riga, "pezzi: effetto")</label>
              <textarea className="admin-field-input" rows={4} value={draft.bonuses}
                placeholder={"2: STR +1\n4: Resistenza al fuoco"}
                onChange={(e) => setDraft({ ...draft, bonuses: e.target.value })} />
            </div>
          </div>
          <button type="button" className="mkadm-btn-primary" disabled={!draft.name.trim()} onClick={addManualSet}>
            Salva nel registro
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <p className="mkadm-set-empty">
          {sets.length ? "Nessun set corrisponde alla ricerca." : "Ancora nessun set. Spunta \"fa parte di un set\" quando crei un oggetto."}
        </p>
      ) : (
        <div className="mkadm-sets-grid">
          {list.map((s) => {
            const pieces = Object.entries(s.pieces || {})
              .sort(([, a], [, b]) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
            const made = pieces.length;
            const live = pieces.filter(([, p]) => p.status === "in vendita").length;
            // pezzi il cui oggetto esiste ancora: finché ci sono, il set si ricrea da solo
            const linked = pieces.filter(([, p]) => p.source === "market" && p.status !== "eliminato").length;
            const isOpen = openId === s.id;
            return (
              <article key={s.id} className={`mkadm-setcard${isOpen ? " is-open" : ""}`}>
                <button type="button" className="mkadm-setcard-top" onClick={() => setOpenId(isOpen ? null : s.id)} aria-expanded={isOpen}>
                  <span className="mkadm-setcard-name">{s.name}</span>
                  <span className={`mkadm-setcard-frac${made >= s.size ? " is-full" : ""}`}>{made}/{s.size}</span>
                  <span className="mkadm-setcard-pips" aria-hidden="true">
                    {Array.from({ length: Math.max(s.size, made) }, (_, i) => (
                      <i key={i} className={i < made ? "on" : ""} />
                    ))}
                  </span>
                  <span className="mkadm-setcard-sub">
                    {made >= s.size
                      ? (made > s.size ? `⚠ ${made - s.size} pezzi oltre il totale` : "Set completo")
                      : `Mancano ${s.size - made} pezzi`}
                    {live ? ` · ${live} in vendita` : ""}
                  </span>
                </button>

                {isOpen && (
                  <div className="mkadm-setcard-body">
                    {s.bonuses?.length > 0 && (
                      <ul className="mkadm-setcard-bonuses">
                        {s.bonuses.map((b, i) => (
                          <li key={i}><strong>{b.pieces}/{s.size}</strong> {b.effect}</li>
                        ))}
                      </ul>
                    )}

                    <ul className="mkadm-setcard-pieces">
                      {pieces.map(([key, p]) => {
                        const meta = STATUS_META[p.status] || STATUS_META["a mano"];
                        return (
                          <li key={key} className={`is-${String(p.status).replace(/\s/g, "-")}`}>
                            <span className="mkadm-setcard-pimg">
                              {p.img ? <img src={p.img} alt="" loading="lazy" /> : <span aria-hidden="true">⛓</span>}
                            </span>
                            <span className="mkadm-setcard-pinfo">
                              <strong>{p.name}</strong>
                              <small>
                                {[p.class, p.type].filter(Boolean).join(" · ")}
                                {p.createdAt ? ` · creato ${fmtDate(p.createdAt)}` : ""}
                              </small>
                              <small className="mkadm-setcard-pstate">
                                {meta.icon} {meta.label}
                                {p.status === "venduto" && p.buyerName ? ` a ${p.buyerName}` : ""}
                                {p.status === "venduto" && p.finalPrice ? ` · ${p.finalPrice} Corone` : ""}
                                {p.status === "eliminato" && p.wasStatus === "venduto" ? " (era venduto)" : ""}
                                {p.status === "eliminato" && p.deletedAt ? ` · ${fmtDate(p.deletedAt)}` : ""}
                              </small>
                            </span>
                            {(p.source === "manual" || p.status === "eliminato") && (
                              <button type="button" className="mkadm-set-bonus-remove" title="Togli dal registro"
                                onClick={() => removePiece(s, key)}>✕</button>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mkadm-setcard-addpiece">
                      <input className="admin-field-input" placeholder="Pezzo creato fuori dal mercato…" value={pieceDraft}
                        onChange={(e) => setPieceDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addManualPiece(s); }} />
                      <button type="button" className="mkadm-set-bonus-add" onClick={() => addManualPiece(s)}>＋ Registra</button>
                    </div>

                    <div className="mkadm-setcard-actions">
                      <button type="button" className="mkadm-btn-primary" onClick={() => onNewPiece(s)}>
                        ⚒ Forgia un nuovo pezzo
                      </button>
                      {linked > 0 && (
                        <button type="button" className="mkadm-set-bonus-add" onClick={() => onShowInStock(s.name)}>
                          📦 Vedi nel magazzino
                        </button>
                      )}
                      {linked === 0 && (confirmDel === s.id ? (
                        <span className="mkadm-setcard-confirm">
                          Cancellare il set dal registro?
                          <button type="button" className="mkadm-set-bonus-remove" onClick={() => { onDelete(s.id); setConfirmDel(null); setOpenId(null); }}>Sì</button>
                          <button type="button" className="mkadm-set-bonus-add" onClick={() => setConfirmDel(null)}>No</button>
                        </span>
                      ) : (
                        <button type="button" className="mkadm-set-bonus-add" onClick={() => setConfirmDel(s.id)}>🗑 Togli dal registro</button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </details>
  );
}
