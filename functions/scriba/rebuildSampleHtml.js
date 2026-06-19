// functions/scriba/rebuildSampleHtml.js
//
// Ri-renderizza l'HTML dei numeri d'ESEMPIO dell'archivio (src/data/scribaSample.json)
// SENZA richiamare Claude/Gemini: riusa contenuto+immagini già salvati e aggiorna
// solo la testata (data in-world + sottotitolo). Riassegna i numeri così da coprire
// più mesi del calendario di Exanthia nell'anteprima archivio.
//
//   node scriba/rebuildSampleHtml.js

const fs = require("fs");
const path = require("path");
const { renderScribaHtml } = require("./renderHtml");
const { exanthiaDateLabel } = require("./calendar");

const OUT = path.join(__dirname, "..", "..", "src", "data", "scribaSample.json");
const issues = JSON.parse(fs.readFileSync(OUT, "utf8"));

// Numero "reale" (ha le immagini): la base da cui prendere contenuto+immagini.
const real = issues.find((i) => (i.images || []).length) || issues[0];

// Numeri scelti per cadere in 4 mesi diversi (n.1 = 10 Solleone, +2/numero):
//   1 → Solleone · 18 → Mascherata · 33 → Brumaria · 48 → Granaio
const NUOVI = { "sample-3": 1, "sample-2": 18, "sample-1": 33, "sample-0": 48 };

for (const it of issues) {
  const num = NUOVI[it.id] ?? it.number ?? 1;
  it.number = num;
  // Paper completo (contenuto+immagini del numero reale) ma testata col numero
  // proprio → data in-world corretta. La card resta sul motto/lead di `it.content`.
  it.html = renderScribaHtml({ content: real.content, edition: num, images: real.images || [] });
}

fs.writeFileSync(OUT, JSON.stringify(issues, null, 2));
console.log("✓ scribaSample.json ri-renderizzato:");
for (const it of issues) console.log(`   ${it.id} → N.${it.number} (${exanthiaDateLabel(it.number)})`);
