# Tile della mappa (Boss Fight tattico)

Metti qui i tuoi tile disegnati. Vengono caricati automaticamente dal renderer
isometrico (`IsoBoard`): se il file c'è, viene usato il tuo disegno; se manca,
si usa il tile procedurale colorato di ripiego. Basta ricaricare la pagina dopo
aver aggiunto i file.

## Dove e come si chiamano
Cartella: `public/assets/tiles/`  →  servita all'URL `/assets/tiles/<nome>.png`

Un file PNG per ogni tipo di terreno, **nome esatto = chiave del terreno**:

| File           | Terreno  |
|----------------|----------|
| `grass.png`    | Erba     |
| `stone.png`    | Pietra   |
| `sand.png`     | Sabbia   |
| `dirt.png`     | Terra    |
| `wood.png`     | Legno    |
| `snow.png`     | Neve     |
| `water.png`    | Acqua    |
| `lava.png`     | Lava (2 danni/turno)  |
| `acid.png`     | Acido (2 danni/turno) |

(`vuoto` = buco, nessun file: resta trasparente.)

## Formato dell'immagine
- **PNG con trasparenza.**
- **Solo la faccia superiore** del tile, cioè un **diamante isometrico 2:1**
  (largo il doppio dell'altezza). I fianchi/altezza li genera il motore.
- Il diamante deve **riempire l'immagine** toccando i 4 lati (gli angoli
  dell'immagine restano trasparenti).
- Dimensione consigliata: **128 × 64 px** (oppure 64 × 32 px). Pixel-art ok:
  viene scalata mantenendo i pixel netti.

```
  immagine 128×64 (gli angoli trasparenti)
   ┌───────────────┐
   │      ◢◣       │   ← vertice alto del diamante al centro-alto
   │    ◢    ◣     │
   │   ◣      ◢    │
   │      ◥◤       │   ← vertice basso al centro-basso
   └───────────────┘
```

Se invece i tuoi tile sono **cubi interi** (con i fianchi/altezza già
disegnati), dimmelo: adatto il renderer per usarli come blocchi.
