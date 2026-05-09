/* ============================================================
   ELDORIA · Foundry VTT macro — Esporta giocatori per EXP Tracker
   ============================================================
   Come usarla:
   1. In Foundry, apri la barra macro in basso (clic destro su uno slot
      vuoto > "Crea Macro").
   2. Nome: "Esporta EXP Eldoria". Tipo: "Script".
   3. Incolla questo intero file nel campo "Comando".
   4. Salva e clicca la macro: il JSON viene copiato negli appunti
      e mostrato anche in chat (whisper a te). Poi vai sul tracker
      EXP, sezione "Importa da Foundry", incolla e clicca Importa.
   ============================================================ */

const players = game.actors
  // PC giocanti: tipo "character" e con almeno un proprietario non-GM
  .filter(a => a.type === "character" && a.hasPlayerOwner)
  .map(a => {
    const sys = a.system ?? {};
    let totalLevels = 0;
    let primaryClass = "—";
    let primaryLevels = 0;

    // Somma i livelli delle classi e identifica la classe primaria (quella con più livelli)
    const classItems = a.classes ?? {};
    for (const cls of Object.values(classItems)) {
      const lvl = Number(cls.system?.levels ?? 0);
      totalLevels += lvl;
      if (lvl > primaryLevels) {
        primaryLevels = lvl;
        primaryClass  = cls.name;
      }
    }
    // Fallback se actor.classes non è popolato
    if (!totalLevels) totalLevels = Number(sys.details?.level ?? 1);

    const xp = Number(sys.details?.xp?.value ?? 0);

    return {
      name:  a.name,
      class: primaryClass,
      level: totalLevels || 1,
      xp,
    };
  });

const json = JSON.stringify(players, null, 2);

// Stampa in console in ogni caso (F12)
console.log("=== Eldoria EXP — Player Export ===");
console.log(json);
console.log("===================================");

// Prova a copiare negli appunti
try {
  await navigator.clipboard.writeText(json);
  ui.notifications.info(`✓ Esportati ${players.length} giocatori — JSON copiato negli appunti.`);
} catch {
  ui.notifications.warn("Clipboard non accessibile. Apri la console (F12) e copia il JSON da lì.");
}

// Whisper in chat per il GM (così resta a portata di mano)
ChatMessage.create({
  whisper: [game.user.id],
  content:
    `<details open>
       <summary><strong>📥 Eldoria EXP — ${players.length} giocator${players.length === 1 ? "e" : "i"}</strong></summary>
       <pre style="white-space:pre-wrap;font-size:0.78em;background:#fffaf0;border:1px solid #c9a961;border-radius:6px;padding:8px;">${json.replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</pre>
     </details>`,
});
