# Progress — Generatore Sessioni DM

Piano completo: `./PLAN.md`. Aggiornare questo file alla fine di ogni fase (`/clear` in mezzo).

## Stato fasi
- [x] **Fase A** — Firestore (`dm_sessions` + `parties`) + config party + seed idempotente + `/sessions/:party` di verifica (niente import: reference = solo stile)
- [x] **Fase B** — Dettaglio `/sessions/:party/:number` (HTML in iframe srcDoc isolato + summary di riferimento) + tile nel pannello DM
- [x] **Fase C** — Endpoint `/api/generate-session` (streaming, maxDuration 60, opus-4-8) + prompt engineering + plumbing client (streamGenerateSession/parseGenerated/loadPartyContext)
- [x] **Fase D** — Frontend `/dm/generate-session` (selettore party + form + checkbox PG + anteprima iframe streaming + salva) + tile pannello DM
- [~] **Fase E** — IN TEST: deployata su Vercel (commit 46992bb). Da fare: generare Sessione XXI AMEA dal vivo e misurare latenza/timeout 60s.

## Decisioni bloccate
- Collezione = `dm_sessions` (la `sessions` esistente = calendario, NON toccare).
- Modello = `claude-opus-4-8` (HTML) / `claude-haiku-4-5` (summary); env `CLAUDE_MODEL`.
- Tutto master-only (`isDmUser` UI + `isMaster()` rules). Nessuna pagina pubblica.
- Piano Vercel = da verificare → progettare per 60s (streaming), piano B a blocchi se timeout.

## Aperti — tutti risolti (2026-07-03)
- [x] characters reali (AMEA no Sylva/Lupo; LEAF Soran/Zethir/Taaras; ENOX Makenna/Temistocle/Alaric/Lael)
- [x] reference = solo stile, nessun import
- [x] citazioni chiusura decise (Obia/Nyxaris/Ezhkie)
- [x] Vercel Hobby (60s)

## File toccati
- `firestore.rules` — regole `dm_sessions` + `parties` (isMaster). DEPLOYATE.
- `src/data/parties.js` — config party (nuovo).
- `src/utils/dmSessions.js` — ensureParties/loadSessions/loadSession/saveSession (nuovo).
- `src/pages/SessionsArchive.jsx` — archivio `/sessions/:party` (nuovo).
- `src/App.jsx` — import + rotta `/sessions/:party`.

## Log
- 2026-07-03 — Fase 0: letto template, mappata struttura, risolti conflitti, PLAN+progress.
- 2026-07-03 — Fase A FATTA: regole Firestore deployate, config party, seed idempotente client-side, pagina archivio con stato vuoto. Build OK.
- 2026-07-03 — Fase B FATTA: SessionDetail (iframe srcDoc) + rotta + tile pannello DM. Build OK.
- 2026-07-03 — Fase C FATTA: `api/generate-session.js` (streaming SSE→plain, maxDuration 60, MODEL=env CLAUDE_MODEL||claude-opus-4-8, max_tokens 8000, mapping durata→atti, int→roman, palette random via prompt, output ---HTML---/---SUMMARY---). Client: `streamGenerateSession`/`parseGenerated`/`loadPartyContext` in utils/dmSessions.js. Build OK.
  - ⚠️ RISCHIO TIMEOUT 60s: HTML completo ~8k token può NON stare in <60s su Hobby. Da MISURARE in Fase E. Fallback = generazione a blocchi (per atto). max_tokens attuale 8000 forse da abbassare.
  - NB: l'endpoint gira solo su Vercel (non su vite dev). Test reale in Fase E (serve deploy o `vercel dev`).
  - Contesto passato attualmente da dm_sessions. DA VALUTARE in Fase D: attingere anche alla collezione esistente `summaries` (recap reali per party) per continuità dal giorno 1.
  Prossimo: Fase D (form /dm/generate-session).
- 2026-07-03 — Fase D FATTA: `src/pages/GenerateSession.jsx` (selettore party, form completo, checkbox PG dinamici, genera in streaming con contatore caratteri, anteprima iframe, salva→redirect al dettaglio) + rotta `/dm/generate-session` + tile "🎲 Genera Sessione" nel pannello. `loadPartyContext` ora pesca ANCHE dalla collezione `summaries` esistente (recap reali per party) per continuità dal giorno 1. Template caricato via `?raw` (chunk separato). Build OK.
  Prossimo: Fase E — TEST END-TO-END. L'endpoint gira solo su Vercel → serve deploy o `vercel dev`. Da misurare: latenza/timeout 60s.
