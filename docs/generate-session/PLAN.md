# Generatore Sessioni DM — Piano completo

> Strumento **privato** (solo master `santomassimo85` + co-master `ripperti96`) per
> generare e archiviare le prep-sessioni D&D dei tre party con Claude Opus 4.8.
> **I giocatori non vedono mai queste pagine.** Serve al DM come traccia da seguire.

## Principi non negoziabili
1. **Isolamento per party**: ogni query filtra SEMPRE per `party`. Le storie non si mescolano mai.
2. **Il file di riferimento è SOLO un guscio grafico.** `reference_sessions/sessione_20.html`
   detta layout/CSS/JS (tabs, timer, combat card, palette, box). Il suo *contenuto narrativo*
   (Olwen, Pendolo di Vethrik…) è storia AMEA e va ignorato come dato — conta solo la forma.
   `sessione_17.html` = esempio secondario (variazione palette). `sessione_9_editor.html` = IGNORATO.
3. **Tutto master-only.** Ogni rotta è gated con `isDmUser` (App.jsx). Nessuna pagina pubblica.

## Decisioni prese (2026-07-03)
- Collezione sessioni generate = **`dm_sessions`** (la collezione `sessions` è già occupata dal calendario).
- Modello default = **`claude-opus-4-8`** (via env `CLAUDE_MODEL`). Estrazione summary = `claude-haiku-4-5` (rapida/economica).
- Piano Vercel = **Hobby (60s)** confermato → endpoint progettato per stare entro 60s (streaming). Vedi §Timeout.
- Visibilità = **privata totale**. Nessuna vista giocatore, nessuno stripping "Note DM": mostriamo l'HTML intero a noi.
- **I file `reference_sessions/*.html` sono TUTTI solo esempi di stile — nessuno va importato come sessione reale.** L'archivio parte vuoto; le sessioni vere le crea il generatore (o import manuale futuro).
- **La palette tematica cambia in modo RANDOM a ogni sessione generata** (il modello sceglie un mood cromatico diverso ogni volta; niente palette fissa).
- Personaggi reali (da `src/data/partyMembers.js`, con AMEA senza Sylva/Lupo):
  - **AMEA** (Eldoria): Garroth, Tanagar, Caius
  - **LEAF** (Nyxaris Aetherna / Exanthia): Soran, Zethir, Taaras
  - **ENOX** (Eldoria / Ezhkie): Makenna, Temistocle, Alaric, Lael
- Citazioni di chiusura (decise): AMEA = "Cronache di Obia" · LEAF = "Canti di Nyxaris" · ENOX = "Annali di Ezhkie".

---

## Modello dati Firestore

### Collezione `dm_sessions`
```
{
  id: "amea-20",            // `${party.toLowerCase()}-${sessionNumber}`
  party: "AMEA",            // discriminante — AMEA | LEAF | ENOX
  sessionNumber: 20,        // intero
  title: "Il Sangue di Vethrik",
  htmlContent: "<!DOCTYPE html>…",   // sessione stand-alone completa
  summary: {
    panoramica: "…",
    bottino: "…",
    ganciAperti: "…"
  },
  durata: "4h",             // opzionale, dal form
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

### Collezione `parties`
```
{ id: "AMEA", name: "Gruppo AMEA", world: "Eldoria",              characters: ["Tanagar","Caius","Garroth"], active: true }
{ id: "LEAF", name: "Gruppo LEAF", world: "Nyxaris Aetherna/Exanthia", characters: [...],                     active: false }
{ id: "ENOX", name: "Gruppo ENOX", world: "Eldoria/Ezhkie",       characters: [...],                          active: false }
```
> I `characters` di LEAF/ENOX vanno confermati dall'utente (vedi §Da confermare).
> Ogni party può avere una `citazioneChiusura` configurabile (AMEA = "Cronache di Obia").

### Regole Firestore da aggiungere (`firestore.rules`)
```
match /dm_sessions/{docId} {
  allow read, write: if isMaster();   // isMaster() include già co-master ripperti96
}
match /parties/{partyId} {
  allow read:  if isMaster();
  allow write: if isMaster();
}
```
(La collezione esistente `sessions` NON si tocca.)

---

## Adattamento durata → atti (passato nel system prompt)
| Durata | Atti | Minuti/atto |
|--------|------|-------------|
| 2h     | 3    | 40          |
| 2.30h  | 3    | 50          |
| 3h     | 4    | 45          |
| 3.30h  | 4    | 52          |
| 4h     | 4–5  | ~50         |

---

## Endpoint `/api/generate-session` (Fase C)

**Input al modello:**
- **[A] Template grafico**: contenuto di `reference_sessions/sessione_20.html` (letto a build-time / incorporato come stringa) → "ecco come DEVE apparire una sessione".
- **[B] Contesto narrativo del party selezionato** (da Firestore):
  - a) tutti i `summary` delle sessioni passate del party in ordine cronologico;
  - b) `htmlContent` intero dell'ultima sessione del party (dettaglio "dove sono ora").
- **[Form DM]**: numero sessione, titolo suggerito, focus, personaggi coinvolti, durata, note.
- **[System prompt]**: ruolo + regole di stile + mapping durata→atti + formato output.

**Regole di stile (nel system prompt):**
- Prosa italiana, tono epico ma non pomposo.
- Dialoghi in corsivo con virgolette basse: «così».
- Meccaniche D&D 5e.
- Chiusura con citazione delle "Cronache di Obia" per AMEA (per-party configurabile).
- Riusa le classi CSS del template (`.scene`, `.combat-card`, `.timer-widget`, `.twist-box`, `.quote`,
  `.info-box`, keyword span colorati…) e sceglie una palette tematica coerente col mood della sessione.

**Formato output atteso dal modello:**
```
---HTML---
<!DOCTYPE html> … sessione completa stand-alone …
---SUMMARY---
{ "panoramica": "...", "bottino": "...", "ganciAperti": "..." }
```
Il backend fa split sui marker, valida il JSON del summary (con fallback), restituisce `{ html, summary }`.

### Timeout / architettura di generazione
Rischio reale: un HTML da ~700 righe può superare i 60s del piano Hobby.
- **Primario**: singola chiamata **in streaming** (`stream:true`) con `export const config = { maxDuration: 60 }`.
  Lo streaming dà feedback di avanzamento e riduce il rischio di connessioni idle.
- **Piano B (se in Fase E misuriamo timeout su Hobby)**: generazione **a blocchi** orchestrata dal client
  — (1) skeleton+overview+palette, (2..n) un atto per chiamata, (n+1) bottino+note+summary — poi assemblaggio
  client-side. Documentato qui, implementato solo se serve.
- Se l'utente conferma piano **Pro**: `maxDuration: 300` e singola chiamata non-stream, più semplice.

**Env**: `ANTHROPIC_API_KEY` (già presente), `CLAUDE_MODEL` (default `claude-opus-4-8`).

---

## Frontend

### `/dm/generate-session` (Fase D) — PROTETTA (isDmUser)
1. Selettore party (AMEA / LEAF / ENOX — bottoni).
2. Form: numero sessione · titolo suggerito (opz.) · focus (textarea lunga) · personaggi coinvolti
   (checkbox dinamici dai `characters` del party) · durata (2h…4h) · note (opz.).
3. "Genera" → chiama `/api/generate-session` (con progress/stream).
4. Anteprima HTML in `<iframe srcDoc>` (isola CSS/JS della sessione dall'app).
5. "Salva" → `setDoc(dm_sessions/{party-num})` + summary → redirect a `/sessions/{party}/{num}`.

### Archivio — PROTETTO (isDmUser)
- `/sessions/amea/`, `/sessions/leaf/`, `/sessions/enox/` → lista (numero + titolo) del party, ordinata.
- `/sessions/:party/:number` → HTML pieno in `<iframe srcDoc>`.
- Query SEMPRE filtrata per party.

> Convenzione repo esistente: gli strumenti DM stanno sotto `/dm-admin/*`. Manteniamo però gli URL
> richiesti (`/dm/generate-session`, `/sessions/{party}/`) gated con `isDmUser`, con link dal pannello `/dm-admin`.

---

## Sicurezza
- Rotte generate/archivio: gate `isDmUser(currentUser?.email)` lato UI + regole `isMaster()` lato Firestore.
- L'API key vive solo nell'endpoint serverless (mai nel client).

---

## Fasi (una alla volta, `/clear` tra una e l'altra; stato in `progress.md`)

- **Fase A** — Firestore setup + config party (NIENTE import: i reference sono solo stile)
  - Aggiungere regole `dm_sessions` + `parties`; deploy.
  - `src/data/parties.js` (config sorgente: characters reali, world, colore, citazione chiusura, active).
  - Seed idempotente di `parties` su Firestore (upsert client-side quando il master apre l'area, no credenziali admin).
  - Pagina `/sessions/amea/` di verifica (stato vuoto "nessuna sessione" — l'archivio parte vuoto).
- **Fase B** — Pagine archivio `/sessions/{party}/` complete (lista + dettaglio iframe).
- **Fase C** — Endpoint `/api/generate-session` + prompt engineering (template A + contesto B + form + stile).
- **Fase D** — Frontend `/dm/generate-session` (selettore party + form + anteprima + salva).
- **Fase E** — Test end-to-end: genera "Sessione XXI" di AMEA di prova; misura latenza (decide piano B timeout).

---

## Da confermare — TUTTO RISOLTO (2026-07-03)
1. ✅ characters reali: AMEA = Garroth/Tanagar/Caius (no Sylva, no Lupo); LEAF = Soran/Zethir/Taaras; ENOX = Makenna/Temistocle/Alaric/Lael.
2. ✅ i reference sono solo esempi di stile — nessun import.
3. ✅ citazioni chiusura decise (Obia / Nyxaris / Ezhkie).
4. ✅ Vercel Hobby (60s).
