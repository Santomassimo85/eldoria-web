# Restyling carte — vista compatta + vista ingrandita fluttuante

Obiettivo: rendere le carte del gioco compatte e leggibili sul campo, con
una vista ingrandita fluttuante al click. SOLO grafica/UI delle carte e
del loro ingrandimento. NON toccare meccaniche, combattimento, regole.

## Vista 1 — Carta compatta (come appare sul campo e in mano)
Le carte sul battlefield e in mano devono essere PICCOLE ma LEGGIBILI.
Mostrano solo l'essenziale:
- l'immagine/arte della carta (occupa la maggior parte dello spazio);
- l'icona/simbolo dell'abilità (solo l'ICONA, non il testo);
- le statistiche: costo, forza/attacco, HP/vita, in piccoli badge agli angoli;
- niente testo di descrizione in questa vista, niente paragrafi.
Requisiti:
- dimensione via clamp() in una variabile CSS unica (es. --card-w),
  abbastanza piccole da starci in molte sul campo, ma con immagine e
  numeri sempre nitidi e leggibili anche su smartphone (test a 375px);
- le carte NON devono mai sovrapporsi al punto di nascondere le statistiche;
- aspetto pulito e ordinato, coerente coi colori del file CSS esistente.

## Vista 2 — Carta ingrandita (al click / tap)
Quando l'utente clicca o tocca una carta:
- la carta appare in versione GRANDE, fluttuante sopra il campo
  (overlay, posizione assoluta), centrata o vicino alla carta originale;
- in questa versione grande è visibile TUTTO: immagine, nome, tipo,
  statistiche, e il TESTO dell'abilità scritto dentro la carta;
- ACCANTO alla carta ingrandita appare automaticamente un riquadro
  fluttuante separato con la DESCRIZIONE estesa dell'abilità (il "cosa fa"),
  così resta sempre visibile mentre si guarda la carta;
- il riquadro descrizione è fluttuante e leggero: sfondo semi-trasparente
  scuro, niente bordi pesanti, deve sembrare un tooltip elegante;
- cliccando fuori dalla carta ingrandita (o premendo ESC), si chiude e
  si torna alla vista compatta;
- l'ingrandimento NON deve spostare o disturbare le carte sul campo:
  è un livello sopra, il campo sotto resta fermo.

## Comportamento fluttuante — importante
- Tutto ciò che è "ingrandito" o "descrizione" vive in un overlay sopra
  il gioco, con posizione assoluta. Niente deve allargare o deformare il
  layout del campo.
- L'overlay non deve bloccare il gioco più del necessario: si apre al
  click sulla carta, si chiude al click fuori.

## Riferimento visivo
Lo stile target è quello di un gioco di carte digitale moderno: carte
compatte e ordinate sul tavolo, e al click una carta grande con accanto
un pannello descrittivo fluttuante. Pulito, leggibile, niente ingombri.
(NON copiare immagini, nomi o asset di giochi esistenti: solo lo stile
di impaginazione e interazione.)

## Vincoli
- React. Solo UI/grafica delle carte e dell'overlay di ingrandimento.
- Niente modifiche a logica di gioco, combattimento, regole.
- Colori e dimensioni dal file CSS esistente; nuove variabili vanno lì.
- Niente librerie nuove (l'overlay si fa con React puro).
- Responsive: la vista compatta e l'ingrandimento devono funzionare bene
  sia a 375px (smartphone) che a 1920px (desktop).

## Come procedere
1. Esplora il progetto e fammi un PIANO scritto: come sono fatte ora le
   carte (file, componenti, dove stanno i dati di abilità/descrizione),
   e cosa cambierai. FERMATI e aspetta il mio OK.
2. Implementa in 2 step separati:
   STEP 1 = vista compatta (carte piccole con solo l'essenziale)
   STEP 2 = vista ingrandita fluttuante + riquadro descrizione a fianco
3. Dopo ogni step fermati e dimmi cosa testare.

## Riferimenti visivi
Nella cartella `riferimenti-grafici/` trovi degli screenshot di esempio.
Apri e GUARDA questi file prima di iniziare:
- carte_compatte — come devono apparire le carte sul campo
  (piccole, leggibili, solo immagine + icona abilità + statistiche).
-  abilita_fluttuante.png — la vista al click: carta grande + pannello
  descrizione fluttuante a fianco.
-  icone_piccole_abilitá.png — com'è il mio gioco ORA (da migliorare).
Replica lo STILE e l'impaginazione di questi esempi, NON gli asset:
non copiare immagini, nomi o elementi protetti da copyright.