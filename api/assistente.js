// api/assistente.js
// Assistente player di Eldoria — powered by Gemini (gratuito).
// Legge da Firestore, propone azioni con conferma obbligatoria prima di scrivere.
//
// STRUMENTI disponibili:
//   leggi_scheda, leggi_mercato, leggi_bacheca, leggi_riassunti,
//   leggi_npc, leggi_geo, leggi_arena, leggi_party, leggi_divinita
//   fai_offerta (SCRITTURA — richiede conferma frontend)
//   accetta_missione (SCRITTURA — richiede conferma frontend)
//
// Il backend NON esegue mai azioni di scrittura direttamente:
// restituisce { pendingAction: { type, params } } e aspetta che il
// frontend mandi { confirmedAction: { type, params } } per eseguire.

const PROJECT_ID = "eldoria-web";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const MASTER_EMAIL = "santomassimo85@gmail.com";

// ---- Party roster: unica fonte di verità (allineata a Bacheca.jsx) ----
// L'appartenenza al gruppo si deriva dal NOME del personaggio (campo char.name).
const PARTY_ROSTER = {
  "AMEA": ["Tanagar", "Garroth Tel´Arion", "Caius Maxis-Richtofen"],
  "ENOX": ["Temistocle Sottocolle Milo", "Dante", "Roynot", "Vyger", "Timoty Bevibotte", "Alaric Voltasorte"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Makenna", "Taaras Stormrage", "Soran", "Zethir Nightwhisper"],
  "ECO":  ["Aksel", "Dago", "Ismael Van Dyke"],
};
const PARTY_IDS = Object.keys(PARTY_ROSTER);

function getPartyByCharName(name) {
  if (!name) return "Senza Gruppo";
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return "Senza Gruppo";
}

// ---- Sistema Ratto (allineato a Mercato.jsx): punti → rango/livello ----
const RATTO_LEVELS = [
  { lv: 0, min: 0, name: "Estraneo" },
  { lv: 1, min: 5, name: "Simpatizzante" },
  { lv: 2, min: 15, name: "Informatore" },
  { lv: 3, min: 30, name: "Ricettatore" },
  { lv: 4, min: 50, name: "Veterano" },
  { lv: 5, min: 80, name: "Ombra di Obia" },
];
function getRatto(points = 0) {
  return [...RATTO_LEVELS].reverse().find(l => points >= l.min) || RATTO_LEVELS[0];
}

// ---- Pantheon (già conosciuto, non serve leggerlo da Firestore) ----
const PANTHEON_BRIEF = `Vecchie divinità: Vulkàros(fuoco/guerra), Nysia(acqua/vita/morte), Syrael(aria/profezia), Drokhan(terra/giustizia), Enoia(spirito/destino), Lirael(arte/memoria), Myrhal(magia/segreti), Zenara(natura/bestie), Kal-Durr(tempo/fato), Naavir(inganno/ombre).
Nuovi dei: Malakor(ordine/contratti distorto), Venestra(amore ossessivo/disperazione), Xylos(sfortuna), Sune(bellezza/amore buono).
Divinità malvagie: Morgath(magia corrotta/fame), Xul'Korah(inganno/malattie), Thal-Grimor(guerra crudele/tirannia), Malakhia(oblio/follia/vuoto).`;

// ---- Helpers Firestore REST ----
async function readCollection(name, apiKey, limit = 30) {
  const url = `${FS_BASE}/${name}?key=${apiKey}&pageSize=${limit}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.documents || []).map(d => firestoreDocToObj(d));
}

async function readDoc(path, apiKey) {
  const url = `${FS_BASE}/${path}?key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json();
  return firestoreDocToObj(data);
}

// PATCH con supporto a field paths annidati (es. "bids.UID").
// Per un path "a.b" Firestore REST richiede: updateMask.fieldPaths=a.b E un body
// con la struttura mappa annidata { a: { mapValue: { fields: { b: <valore> } } } }.
// (NON una chiave letterale "a.b": quella corromperebbe il documento.)
async function patchDoc(path, fields, apiKey) {
  const maskPaths = [];
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    const segs = k.split(".");
    // updateMask: ogni segmento "strano" va racchiuso in backtick
    maskPaths.push(segs.map(s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : "`" + s + "`").join("."));
    // costruisci la struttura annidata nel body
    let cursor = body.fields;
    segs.forEach((seg, i) => {
      if (i === segs.length - 1) {
        cursor[seg] = toFirestoreValue(v);
      } else {
        if (!cursor[seg]) cursor[seg] = { mapValue: { fields: {} } };
        cursor = cursor[seg].mapValue.fields;
      }
    });
  }
  const mask = maskPaths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join("&");
  const url = `${FS_BASE}/${path}?key=${apiKey}&${mask}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.ok;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object") {
    const f = {};
    for (const [k, val] of Object.entries(v)) f[k] = toFirestoreValue(val);
    return { mapValue: { fields: f } };
  }
  return { stringValue: String(v) };
}

function firestoreDocToObj(doc) {
  if (!doc || !doc.fields) return {};
  const obj = { _id: doc.name?.split("/").pop() };
  for (const [k, v] of Object.entries(doc.fields)) obj[k] = extractValue(v);
  return obj;
}
function extractValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue; // ISO string
  if (v.nullValue !== undefined) return null;
  if (v.mapValue) return firestoreDocToObj(v.mapValue);
  if (v.arrayValue) return (v.arrayValue.values || []).map(extractValue);
  return null;
}

// ---- Utility testo ----
function stripHtml(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function formatCurrency(cur) {
  if (!cur || typeof cur !== "object") return null;
  const parts = [];
  if (cur.pp) parts.push(`${cur.pp} pp`);
  if (cur.gp) parts.push(`${cur.gp} mo`);
  if (cur.ep) parts.push(`${cur.ep} me`);
  if (cur.sp) parts.push(`${cur.sp} ma`);
  if (cur.cp) parts.push(`${cur.cp} mr`);
  return parts.length ? parts.join(", ") : "nessuna moneta";
}

// ---- Contesto giocatore: chi è e in che gruppo gioca (letto una volta) ----
async function loadPlayerContext(uid, apiKey) {
  const me = await readDoc(`characters/${uid}`, apiKey);
  if (!me || !me.name) return { char: me, name: null, party: null };
  const ratto = getRatto(me.rattoPoints || 0);
  return {
    char: me,
    name: me.name,
    party: getPartyByCharName(me.name),
    platinum: me.platinum || 0,        // MP usati al mercato nero
    gold: me.currency?.gp || 0,        // oro "normale"
    arenaCoins: me.arenaCoins || 0,    // monete dell'Arena (scommesse)
    tcgCoins: me.tcgCoins || 0,        // monete del gioco di carte TCG
    rattoPoints: me.rattoPoints || 0,
    rattoLv: ratto.lv,
    rattoName: ratto.name,
  };
}

// Normalizza in array: alcuni campi possono arrivare come mappa {0:…,1:…}
// invece che come array (a seconda di come Foundry/Firestore li ha scritti).
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return [];
}

// ---- Esegui uno strumento (lettura) ----
async function executeTool(toolName, toolInput, ctx, apiKey) {
  const { uid, name: myName, party: myParty } = ctx;
  switch (toolName) {
    case "leggi_scheda": {
      const doc = ctx.char || await readDoc(`characters/${uid}`, apiKey);
      if (!doc || !doc.name) return "Scheda non trovata. Chiedi al Master di sincronizzarla da Foundry.";
      const s = doc.stats || {};
      const actions = asArray(doc.actions);
      const cantrips = actions.filter(a => a && a.category === "Trucchetto").map(a => a.name);
      const spells = actions.filter(a => a && /livello/i.test(a.category || "")).map(a => `${a.name} (${a.category})`);
      const ratto = getRatto(doc.rattoPoints || 0);
      // Profilo TCG (salvato sul personaggio)
      const tcgColl = doc.tcgCollection && typeof doc.tcgCollection === "object" ? doc.tcgCollection : {};
      const carteUniche = Object.keys(tcgColl).length;
      const carteTotali = Object.values(tcgColl).reduce((a, n) => a + (Number(n) || 0), 0);
      return JSON.stringify({
        nome: doc.name, classe: doc.class, sottoclasse: doc.subclass || null,
        livello: doc.level, razza: doc.race, gruppo: myParty,
        pf: s.hp, pfMax: s.maxHp, ca: s.ac, iniziativa: s.initiative,
        cdIncantesimi: s.spellDc, bonusCompetenza: s.prof,
        // ── Economie e progressi (tutto ciò che il giocatore possiede) ──
        monete: {
          oro: doc.currency?.gp || 0,
          valutaCompleta: formatCurrency(doc.currency),
          platinoMercatoNero: doc.platinum || 0,
          moneteArena: doc.arenaCoins || 0,
          moneteTCG: doc.tcgCoins || 0,
        },
        rangoRatto: `${ratto.name} (livello ${ratto.lv}, ${doc.rattoPoints || 0} punti)`,
        profiloTCG: {
          classeTCG: doc.tcgStarterClass || null,
          carteUniche, carteTotaliPossedute: carteTotali,
          carteNelMazzo: Array.isArray(doc.tcgDeck) ? doc.tcgDeck.length : 0,
        },
        slotIncantesimi: asArray(doc.spellSlots).filter(sl => sl && sl.label).map(sl => `${sl.label}: ${sl.value}/${sl.max}`),
        trucchetti: cantrips,
        incantesimi: spells,
        inventario: asArray(doc.inventory).slice(0, 25).filter(i => i && i.name).map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}${i.equipped ? " (equipaggiato)" : ""}`),
      });
    }

    case "leggi_party": {
      if (!myParty || myParty === "Senza Gruppo") {
        return "Il tuo personaggio non risulta assegnato a nessun gruppo. Chiedi al Master.";
      }
      const memberNames = PARTY_ROSTER[myParty] || [];
      const all = await readCollection("characters", apiKey, 60);
      const members = all.filter(c => memberNames.includes(c.name));
      const found = members.map(c => ({
        nome: c.name, classe: c.class, sottoclasse: c.subclass || null,
        livello: c.level, razza: c.race,
        pf: c.stats?.hp, pfMax: c.stats?.maxHp, ca: c.stats?.ac,
      }));
      // membri del roster senza scheda sincronizzata
      const missing = memberNames.filter(n => !members.some(c => c.name === n));
      return JSON.stringify({ gruppo: myParty, membri: found, schedeMancanti: missing });
    }

    case "leggi_riassunti": {
      const all = await readCollection("summaries", apiKey, 60);
      if (!all.length) return "Nessun riassunto di sessione trovato.";
      const query = (toolInput?.query || "").toLowerCase();
      // party richiesto esplicitamente, altrimenti quello del giocatore
      let targetParty = (toolInput?.party || "").toUpperCase();
      if (!PARTY_IDS.includes(targetParty)) targetParty = PARTY_IDS.includes(myParty) ? myParty : null;

      let list = all;
      if (targetParty) {
        // riassunti del proprio gruppo + eventi di world-building condivisi ("Unico")
        list = all.filter(s => s.party === targetParty || s.party === "Unico");
      }
      if (query) {
        list = list.filter(s => JSON.stringify(s).toLowerCase().includes(query));
      }
      // più recenti prima: order desc, poi createdAt
      list.sort((a, b) => (b.order || 0) - (a.order || 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      if (!list.length) return `Nessun riassunto trovato${targetParty ? ` per il gruppo ${targetParty}` : ""}${query ? ` con "${toolInput.query}"` : ""}.`;
      return JSON.stringify({
        gruppo: targetParty || "tutti",
        riassunti: list.slice(0, 6).map(s => ({
          titolo: s.title, sottotitolo: s.subTitle || null, gruppo: s.party,
          data: s.date, testo: stripHtml(s.content).slice(0, 900),
        })),
      });
    }

    case "leggi_mercato": {
      const items = await readCollection("items", apiKey, 40);
      const onSale = items.filter(i => !i.isSold);
      if (!onSale.length) return "Il mercato nero è vuoto al momento.";
      // Visibilità per rango Ratto (come Mercato.jsx): la riserva scatta dal livello 2 in su.
      const myRattoLv = ctx.rattoLv || 0;
      const myMp = ctx.platinum || 0;
      const visible = onSale.filter(i => (Number(i.minLevel) || 0) <= Math.max(myRattoLv, 1));
      const nascostiPerRango = onSale.length - visible.length;
      if (!visible.length) return JSON.stringify({ mpDisponibili: myMp, oggetti: [], nota: `Nessun oggetto accessibile al tuo rango Ratto (${ctx.rattoName}). ${nascostiPerRango} oggetti richiedono un rango più alto.` });
      return JSON.stringify({
        mpDisponibili: myMp,
        rangoRatto: ctx.rattoName,
        oggettiRiservatiPerRangoSuperiore: nascostiPerRango,
        oggetti: visible.map(i => {
          const bids = i.bids ? Object.values(i.bids) : [];
          const topBid = bids.length ? Math.max(...bids.map(b => b?.amount ?? b ?? 0)) : 0;
          const isAuction = i.saleType === "auction";
          const costo = isAuction ? (i.startingBid || 0) : (i.price || 0);
          return {
            id: i._id, nome: i.name, tipo: i.type, rarita: i.class,
            modalita: isAuction ? "asta" : "prezzo fisso",
            prezzo: isAuction ? null : i.price,
            baseAsta: isAuction ? i.startingBid : null,
            offertaPiuAlta: topBid || null,
            puoiPermettertelo: myMp >= costo,
            descrizione: stripHtml(i.description).slice(0, 300),
            livelloRattoMin: i.minLevel || 0,
          };
        }),
      });
    }

    case "leggi_bacheca": {
      const quests = await readCollection("quests", apiKey, 40);
      // Visibilità: All, oppure mirate al party / personaggio del giocatore
      const visible = quests.filter(q => {
        const tp = q.targetParty || "All";
        const tc = q.targetCharacter || "All";
        const partyOk = tp === "All" || tp === myParty;
        const charOk = tc === "All" || tc === myName;
        return partyOk && charOk;
      });
      if (!visible.length) return "Nessuna missione disponibile per te al momento.";
      return JSON.stringify(visible.map(q => ({
        id: q._id, titolo: q.title, descrizione: stripHtml(q.description).slice(0, 300),
        stato: q.status, difficolta: q.difficulty, zona: q.zone || null,
        perGruppo: q.targetParty || "All",
        ricompensa: [q.reward, q.rewardGold ? `${q.rewardGold} mo` : null, q.rewardItem].filter(Boolean).join(" · ") || null,
        accettataDa: q.acceptedBy || null,
      })));
    }

    case "leggi_npc": {
      const npcs = await readCollection("npcs", apiKey, 80);
      const query = (toolInput?.query || "").toLowerCase();
      const filtered = query
        ? npcs.filter(n => JSON.stringify(n).toLowerCase().includes(query))
        : npcs.slice(0, 12);
      if (!filtered.length) return `Nessun NPC trovato${query ? ` per "${toolInput.query}"` : ""}.`;
      return JSON.stringify(filtered.slice(0, 15).map(n => ({
        nome: n.name, fazione: n.faction || null, citta: n.linkedCity || n.location || null,
        descrizione: stripHtml(n.description).slice(0, 400),
      })));
    }

    case "leggi_geo": {
      const places = await readCollection("geo_archive", apiKey, 80);
      const query = (toolInput?.query || "").toLowerCase();
      const filtered = query
        ? places.filter(p => JSON.stringify(p).toLowerCase().includes(query))
        : places.slice(0, 12);
      if (!filtered.length) return `Nessun luogo trovato${query ? ` per "${toolInput.query}"` : ""}.`;
      return JSON.stringify(filtered.slice(0, 15).map(p => ({
        nome: p.name, continente: p.continent || null,
        descrizione: stripHtml(p.description).slice(0, 400),
      })));
    }

    case "leggi_arena": {
      const meta = await readDoc("arena_meta/global", apiKey) || {};
      const history = await readCollection("arena_tournament_history", apiKey, 30);
      history.sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
      const last = history[0] || null;
      const phaseLabel = { registration: "iscrizioni aperte", combat: "torneo in corso", finished: "concluso" }[meta.phase] || (meta.phase || "nessun torneo attivo");

      // ── Combattimenti REALI in corso (torneo): solo kind group/final, ──
      // ── niente match "fun" né AI (gli AI hanno players[].isAi). ──
      const realMatches = (meta.matches || []).filter(m =>
        (m.kind === "group" || m.kind === "final") &&
        m.status !== "finished" && !m.winner &&
        (m.players || []).every(p => !p.isAi)
      );
      const combattimentiInCorso = realMatches.map(m => {
        const [p1, p2] = m.players || [];
        const vincente = (p1 && p2)
          ? (p1.hp === p2.hp ? "pareggio" : (p1.hp > p2.hp ? p1.name : p2.name))
          : null;
        return {
          tipo: m.kind === "final" ? "finale" : "girone",
          fase: m.status,
          sfidanti: [p1, p2].filter(Boolean).map(p => ({ nome: p.name, pf: p.hp, pfMax: p.maxHp })),
          staVincendo: vincente,
        };
      });

      return JSON.stringify({
        torneoInCorso: {
          stato: phaseLabel,
          round: meta.phase === "combat" ? (meta.currentRound || 1) : null,
          iscritti: (meta.participants || []).length,
          soloCampioni: !!meta.championsOnly,
          premi: meta.prizes ? stripHtml(meta.prizes).slice(0, 200) : null,
          vincitoreCorrente: meta.tournamentWinner ? (meta.lastChampion?.name || "proclamato") : null,
        },
        combattimentiInCorso: combattimentiInCorso.length ? combattimentiInCorso : "Nessun combattimento di torneo in corso adesso.",
        ultimoTorneoVinto: last ? {
          vincitore: last.winnerName, classe: last.winnerClass || null,
          vittorieTotaliDelVincitore: last.wins || null,
          partecipanti: (last.participants || []).length,
          premi: last.prizes ? stripHtml(last.prizes).slice(0, 200) : null,
        } : null,
        alboCampioni: history.slice(0, 6).map(h => h.winnerName).filter(Boolean),
      });
    }

    case "leggi_tcg": {
      const t = await readDoc("tcg_tournament/global", apiKey);
      if (!t || t.status === "closed") {
        return "Al momento non c'è nessun torneo TCG attivo (o è nascosto ai giocatori).";
      }
      const participants = t.participants && typeof t.participants === "object"
        ? Object.values(t.participants) : [];
      const statoLabel = { open: "iscrizioni aperte", running: "in corso", ended: "concluso" }[t.status] || t.status;
      return JSON.stringify({
        nomeTorneo: t.name || "Torneo TCG",
        stato: statoLabel,
        roundCorrente: t.currentRound || 0,
        roundTotaliGiocati: (t.rounds || []).length,
        iscritti: participants.length,
        nomiIscritti: participants.map(p => p.name).filter(Boolean).slice(0, 16),
        campione: t.champion?.name || null,
      });
    }

    case "leggi_boss": {
      // FONTE DI VERITÀ: battle_state/current (HP vivi nelle `units`).
      // La collection `bosses` tiene i valori-modello (PF pieni di reset) e NON è
      // affidabile come stato vivo: si usa solo come fallback se non c'è battaglia.
      const battle = await readDoc("battle_state/current", apiKey);
      const units = battle && Array.isArray(battle.units) ? battle.units : [];
      const bossUnits = units.filter(u => u.side === "enemy" && u.kind === "boss");
      const heroes = units.filter(u => u.side === "hero");
      const minions = units.filter(u => u.side === "enemy" && u.kind === "minion");

      // Nessuna battaglia tattica valida → guarda quale boss è "selezionato" (catalogo)
      if (!battle || !battle.fightStarted || !bossUnits.length) {
        const active = (await readCollection("bosses", apiKey, 20)).filter(b => b.isActive);
        return JSON.stringify({
          battagliaInCorso: false,
          messaggio: active.length
            ? "Nessuna battaglia World Boss in corso in questo momento."
            : "Nessun World Boss attivo al momento.",
          bossSelezionato: active.map(b => b.name).slice(0, 3),
        });
      }

      const bossInfo = bossUnits.map(b => ({
        nome: b.name, pf: b.hp, pfMax: b.maxHp,
        percentualePf: b.maxHp ? Math.round((b.hp / b.maxHp) * 100) + "%" : null,
        sconfitto: !!b.dead,
      }));
      const heroesAlive = heroes.filter(u => !u.dead).length;
      const phase = battle.phase || "setup"; // setup | fighting | over

      // ── Battaglia conclusa: deriva l'esito come fa il gioco (BossTactics) ──
      if (phase === "over") {
        const heroesWiped = heroes.length > 0 && heroesAlive === 0;
        const heroesLost = !!battle.bossExpired || heroesWiped;
        let esito, vincitore;
        if (heroesLost) {
          vincitore = "Boss";
          esito = battle.bossExpired
            ? "SCONFITTA DEI GIOCATORI — il tempo è scaduto e il boss è sopravvissuto."
            : "SCONFITTA DEI GIOCATORI — tutti gli eroi sono caduti.";
        } else {
          vincitore = "Giocatori";
          esito = "VITTORIA DEI GIOCATORI — il boss è stato sconfitto.";
        }
        return JSON.stringify({
          battagliaInCorso: false, battagliaConclusa: true,
          vincitore, esito, round: battle.round || null,
          boss: bossInfo, eroiSopravvissuti: heroesAlive, eroiTotali: heroes.length,
        });
      }

      if (phase === "setup") {
        return JSON.stringify({ battagliaInCorso: false, stato: "in preparazione (non ancora iniziata)", boss: bossInfo, eroi: heroes.length });
      }

      // ── Battaglia in corso (fighting) ──
      const turn = await readDoc("battle_meta/turn_tracker", apiKey) || {};
      const turnoDi = turn.phase === "boss" ? "il Boss e i nemici" : turn.phase === "players" ? "i giocatori" : null;
      return JSON.stringify({
        battagliaInCorso: true, round: battle.round || null, turnoDi,
        boss: bossInfo,
        minionVivi: minions.filter(m => !m.dead).length,
        eroiVivi: heroesAlive, eroiTotali: heroes.length,
      });
    }

    case "leggi_divinita":
      return PANTHEON_BRIEF;

    case "leggi_statistiche_agent": {
      // Solo il master può vedere le statistiche d'uso dell'assistente.
      if (!ctx.isMaster) return "Queste statistiche sono riservate al Master.";
      const stats = await readDoc("agent_stats/global", apiKey) || {};
      const total = stats.total || 0;
      const perUser = stats.perUser && typeof stats.perUser === "object" ? stats.perUser : {};
      // Risolvi gli uid in nomi personaggio
      const chars = await readCollection("characters", apiKey, 60);
      const nameByUid = {};
      chars.forEach(c => { if (c._id) nameByUid[c._id] = c.name; });
      const perGiocatore = Object.entries(perUser)
        .map(([uid, n]) => ({ giocatore: nameByUid[uid] || uid, consultazioni: Number(n) || 0 }))
        .sort((a, b) => b.consultazioni - a.consultazioni)
        .slice(0, 20);
      return JSON.stringify({
        consultazioniTotali: total,
        perGiocatore,
        ultimoUtilizzo: stats.lastUsed || null,
      });
    }

    default:
      return "Strumento non riconosciuto.";
  }
}

// ---- Definizioni strumenti per Gemini ----
const TOOLS_DEF = {
  function_declarations: [
    { name: "leggi_scheda", description: "Legge la scheda del giocatore loggato: PF, CA, livello, classe, razza, gruppo, valuta, slot e incantesimi, inventario.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_party", description: "Legge i personaggi del GRUPPO del giocatore loggato (compagni di party): nomi, classi, livelli, PF, CA.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_riassunti", description: "Legge i riassunti delle sessioni passate. Di default filtra sul gruppo del giocatore (più gli eventi condivisi). Per 'ultima sessione' restituisce i più recenti.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Parola chiave opzionale da cercare (es. nome NPC, luogo)" }, party: { type: "STRING", description: "Forza un gruppo specifico: AMEA, ENOX, LAC, LEAF, ECO. Ometti per usare il gruppo del giocatore." } }, required: [] } },
    { name: "leggi_mercato", description: "Legge gli oggetti in vendita al mercato nero (prezzo fisso o asta) con prezzi, rarità e offerta più alta.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_bacheca", description: "Legge le missioni della bacheca visibili al giocatore (mirate al suo gruppo/personaggio o pubbliche).", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_npc", description: "Cerca un NPC per nome, fazione o città.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Nome, fazione o città dell'NPC" } }, required: [] } },
    { name: "leggi_geo", description: "Cerca luoghi, città o regioni di Eldoria.", parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Nome del luogo da cercare" } }, required: [] } },
    { name: "leggi_arena", description: "Legge lo stato dell'Arena: torneo in corso (fase, round, iscritti), COMBATTIMENTI di torneo attualmente in corso (chi combatte contro chi e i PF di ciascuno, chi sta vincendo), vincitore dell'ultimo torneo e albo dei campioni. Esclude i match amichevoli e contro l'AI. Solo consultazione.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_tcg", description: "Legge lo stato del torneo di carte TCG: se è aperto/in corso/concluso, round, iscritti e campione. Solo consultazione.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_boss", description: "Legge lo stato del World Boss: se c'è un boss attivo, i suoi PF, lo scudo, il round e di chi è il turno. Solo consultazione.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_divinita", description: "Informazioni sulle divinità e il pantheon di Eldoria.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "leggi_statistiche_agent", description: "SOLO MASTER. Statistiche d'uso dell'assistente: quante volte è stato consultato in totale e da chi. Usa questo strumento quando il master chiede 'quante volte sei stato consultato/usato'.", parameters: { type: "OBJECT", properties: {}, required: [] } },
    { name: "fai_offerta", description: "Piazza un'offerta su un oggetto del mercato nero IN ASTA (scala il platino dal personaggio). RICHIEDE CONFERMA dell'utente prima di eseguire.", parameters: { type: "OBJECT", properties: { item_id: { type: "STRING", description: "ID dell'oggetto" }, item_nome: { type: "STRING", description: "Nome dell'oggetto" }, importo: { type: "NUMBER", description: "Importo in MP (platino)" } }, required: ["item_id", "item_nome", "importo"] } },
    { name: "accetta_missione", description: "Accetta una missione dalla bacheca a nome del giocatore. RICHIEDE CONFERMA dell'utente prima di eseguire.", parameters: { type: "OBJECT", properties: { quest_id: { type: "STRING", description: "ID della missione" }, quest_titolo: { type: "STRING", description: "Titolo della missione" } }, required: ["quest_id", "quest_titolo"] } },
  ],
};

function buildSystemPrompt(ctx) {
  let who = "Il giocatore non ha ancora una scheda sincronizzata: invitalo a chiedere al Master.";
  if (ctx.name) {
    const s = ctx.char?.stats || {};
    who = `Il giocatore loggato è **${ctx.name}**` +
      (ctx.char?.race ? `, ${ctx.char.race}` : "") +
      (ctx.char?.class ? ` ${ctx.char.class}` : "") +
      (ctx.char?.subclass ? ` (${ctx.char.subclass})` : "") +
      (ctx.char?.level ? ` di livello ${ctx.char.level}` : "") +
      `, gruppo **${ctx.party}**.` +
      ` Statistiche: PF ${s.hp ?? "?"}/${s.maxHp ?? "?"}, CA ${s.ac ?? "?"}.` +
      ` Soldi: **${ctx.platinum} MP** (platino, valuta del mercato nero), ${ctx.gold} mo (oro), **${ctx.arenaCoins} monete Arena** (per scommettere nell'arena) e **${ctx.tcgCoins} monete TCG** (per il gioco di carte).` +
      ` Rango Ratto: **${ctx.rattoName}** (livello ${ctx.rattoLv}, ${ctx.rattoPoints} punti) — determina quali oggetti del mercato nero può vedere/comprare.` +
      (PARTY_ROSTER[ctx.party] ? ` Compagni di gruppo: ${PARTY_ROSTER[ctx.party].join(", ")}.` : "");
  }
  return `Sei l'assistente di gioco per la campagna fantasy Eldoria (sistema D&D 5e).
Sei un AGENTE: non ti limiti a chiacchierare, agisci. Per ogni richiesta consulti i dati reali con gli strumenti, ragioni e dai una risposta utile e concreta.

CONTESTO GIOCATORE (usalo sempre, non chiederlo): ${who}

Quando l'utente dice "il mio gruppo", "il party", "noi", "la nostra sessione", "l'ultima sessione", "riassumi" o "per me", riferisciti SEMPRE al gruppo del giocatore qui sopra (${ctx.party || "sconosciuto"}). Riassunti e missioni sono divisi per gruppo: gli strumenti filtrano già sul gruppo giusto.

COSA SAI GIÀ (dal contesto, senza strumenti): nome, razza, classe, livello, gruppo, PF/CA, e TUTTE le valute del giocatore — **MP (platino del mercato)**, **oro**, **monete Arena**, **monete TCG** — più il rango Ratto, sono scritti qui sopra. NON dire mai "non conosco le tue MP / le tue monete / i tuoi soldi / il tuo livello": leggili dal contesto. Usa leggi_scheda solo per dettagli più fini (inventario completo, lista incantesimi, slot, profilo carte TCG).

COME LAVORI (importante):
- Per QUALSIASI domanda che riguardi dati di gioco, chiama PRIMA lo strumento giusto e poi rispondi sui risultati. Non rispondere mai "non lo so" senza aver provato uno strumento.
  · mercato / oggetti in vendita / aste → leggi_mercato
  · "per me" sul mercato → leggi_mercato e poi evidenzia ciò che è adatto al giocatore (livello Ratto, classe, soldi disponibili).
  · missioni / incarichi / bacheca → leggi_bacheca
  · la mia scheda / PF / incantesimi / inventario / soldi → leggi_scheda
  · il mio gruppo / compagni / party → leggi_party
  · riassunti / cosa è successo / ultima sessione → leggi_riassunti
  · NPC / personaggi → leggi_npc · luoghi / città → leggi_geo · divinità → leggi_divinita
  · arena / torneo dell'arena / chi ha vinto / albo campioni / "chi sta combattendo ora" / "è attivo il match tra X e Y" / chi sta vincendo → leggi_arena
  · TCG / torneo di carte / chi è il campione TCG → leggi_tcg
  · World Boss / "c'è un boss?" / "come sta il boss" / battaglia → leggi_boss
  Questi tre (arena, TCG, boss) sono di SOLA CONSULTAZIONE: non esistono azioni di combattimento, puoi solo riferire lo stato.
  · "chi sta combattendo nell'arena", "chi sta vincendo", "che PF ha X nel match" → leggi_arena (sezione combattimentiInCorso).${ctx.isMaster ? `
  · (MASTER) "quante volte sei stato consultato/usato", statistiche d'uso → leggi_statistiche_agent.` : ""}
- Puoi e DEVI usare più strumenti se serve (es. "cosa posso comprare?" → leggi_scheda + leggi_mercato per confrontare i soldi).
- Dopo aver ricevuto i risultati di uno strumento, produci SEMPRE una risposta testuale per il giocatore. Non terminare mai con una chiamata a strumento senza spiegare cosa hai trovato.

STILE:
- Rivolgiti al giocatore SEMPRE con il suo nome${ctx.name ? ` (${ctx.name})` : ""}, non con "avventuriero" o altri appellativi generici. Usalo con naturalezza, senza ripeterlo a ogni frase.
- Rispondi SEMPRE in italiano, con tono da narratore fantasy ma chiaro e diretto. Vai al punto, usa elenchi quando aiutano.
- Non inventare dati non presenti negli strumenti. Se uno strumento non restituisce nulla, dillo con onestà (es. "Il mercato è vuoto al momento").

AZIONI (scrittura): per fai_offerta e accetta_missione chiama lo strumento, poi nella risposta finale spiega chiaramente cosa stai per fare e chiedi conferma. Non agire mai senza conferma dell'utente.`;
}

// Risolve l'oggetto del mercato: prima per id, poi (fallback robusto) per nome.
// Gli id Firestore sono stringhe casuali di 20 caratteri che il modello può
// trascrivere male: la ricerca per nome rende l'offerta affidabile lo stesso.
async function resolveMarketItem(params, apiKey) {
  let item = params.item_id ? await readDoc(`items/${params.item_id}`, apiKey) : null;
  if (item && item.name) return { item, id: params.item_id };

  const wanted = (params.item_nome || "").trim().toLowerCase();
  if (!wanted) return { item: null, id: null };
  const all = await readCollection("items", apiKey, 60);
  const candidates = all.filter(i => (i.name || "").trim().toLowerCase() === wanted);
  // Preferisci un oggetto non ancora venduto
  const pick = candidates.find(i => !i.isSold) || candidates[0] || null;
  return pick ? { item: pick, id: pick._id } : { item: null, id: null };
}

// ---- Scrittura: piazza un'offerta in asta (scala platino, scrive bids.UID) ----
async function placeBid(uid, params, apiKey) {
  const { item, id } = await resolveMarketItem(params, apiKey);
  if (!item || !item.name) return { ok: false, msg: `❌ Non trovo "${params.item_nome || params.item_id}" al mercato. Controlla il nome o riprova a chiedere cosa c'è in vendita.` };
  if (item.isSold) return { ok: false, msg: `❌ **${item.name}** è già stato venduto.` };
  if (item.saleType !== "auction") return { ok: false, msg: `❌ **${item.name}** non è all'asta: non si possono fare offerte.` };
  const minBid = item.startingBid || 0;
  if (params.importo < minBid) return { ok: false, msg: `❌ L'offerta minima per **${item.name}** è ${minBid} MP.` };

  const me = await readDoc(`characters/${uid}`, apiKey);
  const platinum = me?.platinum || 0;
  if (platinum < params.importo) return { ok: false, msg: `❌ Platino insufficiente: hai ${platinum} MP, ne servono ${params.importo}.` };

  const charName = me?.name || "Un eroe";
  const okItem = await patchDoc(`items/${id}`, {
    [`bids.${uid}`]: { amount: params.importo, charName, timestamp: new Date().toISOString() },
  }, apiKey);
  if (!okItem) return { ok: false, msg: "❌ Errore nell'invio dell'offerta. Riprova." };

  await patchDoc(`characters/${uid}`, { platinum: platinum - params.importo }, apiKey);
  return { ok: true, msg: `✅ Offerta di **${params.importo} MP** su **${item.name}** piazzata! Il platino è stato bloccato; verrà rimborsato se non vinci l'asta.` };
}

// ---- Scrittura: accetta una missione ----
async function acceptQuest(uid, params, apiKey) {
  const me = await readDoc(`characters/${uid}`, apiKey);
  if (!me || !me.name) return { ok: false, msg: "❌ Scheda non trovata: impossibile accettare la missione." };
  const party = getPartyByCharName(me.name);
  const ok = await patchDoc(`quests/${params.quest_id}`, {
    acceptedBy: me.name,
    acceptedParty: party,
    status: "in_progress",
  }, apiKey);
  return ok
    ? { ok: true, msg: `✅ Missione **${params.quest_titolo}** accettata a nome di **${me.name}** (gruppo ${party})! Buona fortuna, ${me.name}.` }
    : { ok: false, msg: "❌ Errore nell'accettare la missione. Riprova." };
}

async function callGemini(geminiKey, systemPrompt, contents, { useTools = true } = {}) {
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      // Limita il "thinking" così non consuma tutti i token lasciando la risposta vuota,
      // ma ne tiene abbastanza per decidere quali strumenti usare.
      thinkingConfig: { thinkingBudget: 512 },
    },
  };
  if (useTools) body.tools = [TOOLS_DEF];
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return r.json();
}

// Estrae il testo dalle parti, ignorando le parti di "thinking".
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { messages, uid, confirmedAction, email } = req.body || {};
  const isMaster = (email || "").toLowerCase() === MASTER_EMAIL;
  const apiKey = process.env.FIREBASE_API_KEY || "AIzaSyBGv3dT_2-ztsAwx0B4s42YtPL-Q1UBMcM";
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) return res.status(500).json({ error: "Chiave Gemini mancante." });
  if (!uid) return res.status(400).json({ error: "UID utente mancante." });

  // ---- Esecuzione azione confermata (scrittura) ----
  if (confirmedAction) {
    const { type, params } = confirmedAction;
    try {
      if (type === "fai_offerta") {
        const r = await placeBid(uid, params, apiKey);
        return res.status(200).json({ reply: r.msg });
      }
      if (type === "accetta_missione") {
        const r = await acceptQuest(uid, params, apiKey);
        return res.status(200).json({ reply: r.msg });
      }
      return res.status(400).json({ error: "Azione non riconosciuta." });
    } catch (e) {
      return res.status(500).json({ error: "Errore azione: " + e.message });
    }
  }

  // ---- Conversazione normale con Gemini ----
  if (!messages || !messages.length) return res.status(400).json({ error: "Messaggi mancanti." });

  try {
    // Carica una volta chi è il giocatore e in che gruppo gioca.
    const playerCtx = await loadPlayerContext(uid, apiKey);
    const ctx = { uid, isMaster, ...playerCtx };
    const systemPrompt = buildSystemPrompt(ctx);

    const geminiMessages = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    let data = await callGemini(geminiKey, systemPrompt, geminiMessages);
    if (data.error) return res.status(500).json({ error: data.error.message });

    // ---- Ciclo tool use ----
    let pendingAction = null;
    let usedTools = false;
    let iterations = 0;

    while (iterations < 8) {
      iterations++;
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const toolCalls = parts.filter(p => p.functionCall);
      if (!toolCalls.length) break; // nessun tool → risposta finale

      const resultParts = [];
      for (const part of toolCalls) {
        const { name, args } = part.functionCall;
        usedTools = true;

        // Azioni di scrittura → non eseguire, segnalare al frontend per conferma
        if (name === "fai_offerta" || name === "accetta_missione") {
          pendingAction = { type: name, params: args };
          resultParts.push({ functionResponse: { name, response: { result: "RICHIEDE_CONFERMA_UTENTE: l'azione verrà eseguita solo dopo che l'utente conferma nel modale. Riassumi cosa stai per fare e chiedi conferma." } } });
          continue;
        }

        const result = await executeTool(name, args, ctx, apiKey);
        resultParts.push({ functionResponse: { name, response: { result } } });
      }

      geminiMessages.push({ role: "model", parts });
      geminiMessages.push({ role: "user", parts: resultParts });

      data = await callGemini(geminiKey, systemPrompt, geminiMessages);
      if (data.error) return res.status(500).json({ error: data.error.message });
    }

    let reply = extractText(data);

    // Fallback robusto: se il modello ha raccolto dati ma non ha prodotto testo
    // (thinking troppo lungo, MAX_TOKENS, oppure è rimasto bloccato sui tool),
    // forziamo una risposta finale SENZA strumenti usando il contesto già raccolto.
    if (!reply && (usedTools || pendingAction)) {
      geminiMessages.push({
        role: "user",
        parts: [{ text: "Ora rispondi al giocatore in italiano, in modo chiaro e discorsivo, usando SOLO le informazioni già raccolte qui sopra. Se hai trovato dei dati, presentali; non dire che non hai trovato una risposta." }],
      });
      const forced = await callGemini(geminiKey, systemPrompt, geminiMessages, { useTools: false });
      reply = extractText(forced);
    }

    if (!reply) {
      const fr = data?.candidates?.[0]?.finishReason;
      reply = fr === "SAFETY"
        ? "Mi spiace, non posso rispondere a questa richiesta."
        : "Non sono riuscito a formulare una risposta. Riprova a riformulare la domanda.";
    }

    return res.status(200).json({ reply, pendingAction });
  } catch (e) {
    return res.status(500).json({ error: "Errore assistente: " + e.message });
  }
}
