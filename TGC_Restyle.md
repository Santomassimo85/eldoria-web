# Fix responsive + frecce di attacco/targeting

## Problema 1 — Layout non responsive
Attualmente su desktop la UI è troppo piccola e schiacciata, su smartphone
le carte sono enormi e c'è troppo spazio vuoto verticale tra le due zone.
NON è responsive davvero: è la stessa UI scalata male.

### Cosa voglio
- UNA sola UI che si adatta, non due versioni.
- Le carte devono avere dimensioni proporzionate allo schermo:
  usa clamp() per la larghezza, es. width: clamp(70px, 9vw, 130px);
  l'altezza segue in proporzione (height: calc(width * 1.4)).
- Il tavolo deve RIEMPIRE lo spazio disponibile: niente enormi zone vuote.
  Le tre fasce (zona avversario / zona centrale-battlefield / zona giocatore)
  devono dividersi l'altezza con flex (es. flex: 1) e restare sempre
  proporzionate, sia a 375px che a 1920px.
- Su mobile in verticale: le carte si rimpiccioliscono e si avvicinano,
  ma il layout logico resta identico (avversario sopra, tu sotto).
- I pulsanti laterali (Annulla, Scarta, Log, Fine Turno) devono restare
  leggibili e cliccabili (min 44x44px) su entrambi i formati.
- Niente scrollbar verticale: tutto il gioco deve stare in una schermata.

### Test obbligatorio
Verifica visivamente il risultato a 3 larghezze: 375px (smartphone),
768px (tablet) e 1920px (desktop). In tutte e tre il tavolo deve essere
pieno e proporzionato, senza spazi vuoti enormi né carte sovradimensionate.

## Problema 2 — Frecce di attacco e linea di targeting
Voglio aggiungere due effetti visivi tipo MTG Arena:

### A) Linea di targeting (mentre selezioni)
Quando l'utente seleziona una carta e sta scegliendo il bersaglio:
- parte una linea/traiettoria luminosa dalla carta selezionata fino al
  puntatore del mouse (o al dito su touch).
- la linea segue il movimento in tempo reale finché non rilascia/conferma.
- stile: linea curva o leggermente ad arco, con bagliore (glow), colore
  acceso (es. dorato o ciano), punta a freccia sul bersaglio.

### B) Freccia di attacco (quando l'attacco parte)
Quando una carta attacca un nemico:
- appare una freccia luminosa dalla carta attaccante al bersaglio.
- resta visibile per circa 1 secondo, poi svanisce con un fade.
- stile coerente con la linea di targeting (stesso glow/colore).

### Come implementarlo (suggerimento tecnico)
- Usa un <svg> a copertura totale del tavolo (overlay assoluto,
  pointer-events: none così non blocca i click).
- Disegna la linea/freccia come <path> SVG tra le coordinate dei due
  elementi (usa getBoundingClientRect per ottenere le posizioni).
- Per la linea che segue il mouse: aggiorna il path su onMouseMove/onTouchMove.
- Per la freccia di attacco: mostra il path, poi rimuovilo dopo ~1000ms
  (setTimeout o stato + transizione di opacità).
- Le coordinate vanno ricalcolate in modo relativo, così funzionano a
  qualsiasi dimensione di schermo (collegato al fix responsive sopra).

## Vincoli
- React. Modifica SOLO presentazione/layout/effetti visivi.
- NON toccare la logica di gioco (regole, danni, stato partita).
- Usa il file CSS già esistente per colori e variabili; se manca un valore,
  aggiungilo lì, non scrivere colori a mano nei componenti.
- Niente librerie nuove senza chiedermi prima (l'overlay SVG si fa
  con React puro, non serve nulla).

## Come procedere
1. Prima esplora il progetto e fammi un PIANO scritto: quali file modifichi
   e cosa cambi. FERMATI e aspetta il mio OK.
2. Poi lavora in 3 step separati, fermandoti dopo ognuno:
   STEP 1 = fix responsive del layout e delle carte
   STEP 2 = linea di targeting che segue il puntatore
   STEP 3 = freccia di attacco temporanea (1 secondo)
3. Dopo ogni step dimmi cosa testare e aspetta il feedback.
NON fare tutto insieme.