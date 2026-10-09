// api/genera-oggetto-arena.js
//
// "Crea con Gemini" della Bottega dell'Arena (2026-10-09): dall'idea del Master
// inventa UN articolo per il catalogo `arena_market_items`, con il payload
// ESATTO che il motore dell'Arena sa già usare (stesso schema di
// ArenaMarketCatalog.jsx → buildPayload). Il vocabolario ammesso (tipi di
// danno, malus, bonus, spell del motore, caratteristiche) arriva dal client,
// così resta una sola fonte; il client poi ripulisce la risposta
// (`sanitizeAiItem`) e la mette nel form: il Master rivede e salva.
//
// Powered by Gemini (GEMINI_API_KEY, come oracolo-frasi e crafting-maledizione).

export const config = { maxDuration: 60 };

const SCHEMA_DOC = `FORMATO DELLA RISPOSTA — un solo oggetto JSON, niente testo attorno:
{
  "category": "item" | "spell" | "weapon" | "armor" | "pet",
  "name": "nome evocativo in italiano",
  "icon": "UNA emoji",
  "description": "1-2 frasi di sapore in italiano (non ripetere i numeri)",
  "price": intero (Monete Arena),
  "maxPerWeek": intero 1-3,
  "payload": { ...dipende dalla categoria, vedi sotto... }
}

DADI: sempre nel formato NdM o NdM+K (es. "2d8", "1d6+2"), mai altro.
EFFETTO COMPONIBILE (usato in "extras" e "onHit"), uno di:
  {"kind":"damage","dice":"2d6"}                       → danno al nemico
  {"kind":"heal","dice":"2d6"}                         → cura a chi lo usa
  {"kind":"buff","buffType":<BUFF>,"buffAmount":1-3,"buffTurns":1-5}  → bonus a sé
  {"kind":"malus","malusType":<MALUS>,"malusDice":"1d4","malusTurns":1-4} → malus al nemico
     (malusDice solo se il malus lo richiede, malusTurns solo se li richiede)
  In "onHit" ogni effetto ha anche "chance": 1-100 (probabilità all'impatto).

PAYLOAD PER CATEGORIA:
- item (oggetto da zaino, azione gratuita), "effect" uno di:
    {"effect":"heal","dice":"2d8","uses":1-3,"extras":[...]}
    {"effect":"damage","dice":"2d6","uses":1-3,"extras":[...]}
    {"effect":"buff","buffType":<BUFF>,"buffAmount":1-3,"buffTurns":0-5 (0 = tutto il fight),"uses":1-3,"extras":[...]}
    {"effect":"malus","malusType":<MALUS>,"malusDice":"1d6","malusTurns":1-4,"uses":1-3,"extras":[...]}
    {"effect":"resist","resist":{<TIPO_DANNO>:"resist"|"immune"|"vuln"},"extras":[...]}  (passivo, niente uses)
  "extras" è facoltativo (0-2 effetti).
- spell (pergamena): {"spellClass":<CLASSE>,"spellName":<NOME ESATTO dalla lista>,"charges":1-3,"castStat":<STAT>,"castStatMin":0-16,"slotCost":{"1":0-2,"2":0-2,"3":0-2}}
    La spell DEVE essere copiata identica dalla lista della sua classe. slotCost facoltativo.
- weapon: {"components":[{"dice":"1d8","type":<TIPO_DANNO>}, ...1-3 componenti],"hitBonus":0-2,"ranged":bool,"twoHanded":bool,"onHit":[...0-2 effetti con chance]}
- armor: {"acFixed":11-19,"resist":{<TIPO_DANNO>:"resist"|"immune"|"vuln"}}  (resist facoltativo, CA FISSA che sostituisce quella base)
- pet (azione bonus): {"effect":"damage"|"heal","dice":"2d6","autoHit":bool,"hitBonus":0-5,"uses":1-4,"onHit":[...solo se effect damage]}`;

async function callGemini(geminiKey, prompt) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1, maxOutputTokens: 2000, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 512 } },
      }),
    },
  );
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("Risposta vuota da Gemini.");
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(clean);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: "Chiave Gemini mancante." });

  const { idea = "", category = "", vocab = {}, catalog = [] } = req.body || {};
  const v = vocab || {};
  const list = (arr) => (Array.isArray(arr) ? arr : []).join(", ");
  const spells = Object.entries(v.spells || {})
    .map(([cls, names]) => `  ${cls}: ${(names || []).join(" | ")}`)
    .join("\n");
  const esempi = (Array.isArray(catalog) ? catalog : []).slice(0, 40)
    .map((c) => `- [${c.category}] ${c.name} · ${c.price} MA · ${c.summary || ""}`)
    .join("\n");

  const prompt = `Sei il bottegaio dell'Arena di un gioco di ruolo fantasy (combattimenti 1 contro 1 a turni, PG di livello 3 con circa 25-35 PF, CA 12-16).
Inventa UN articolo per la Bottega dell'Arena.

IDEA DEL MASTER: ${String(idea).trim() || "(nessuna: inventa tu qualcosa di originale e utile)"}
CATEGORIA: ${["item", "spell", "weapon", "armor", "pet"].includes(category) ? `"${category}" (obbligatoria)` : "scegli tu la più adatta all'idea"}

VOCABOLARIO AMMESSO (usa SOLO queste chiavi, scritte identiche: una chiave che non è qui, es. un malus "acid", viene buttata via):
<TIPO_DANNO>: ${list(v.damageTypes)}
<MALUS>: ${(v.malusTypes || []).map((m) => `${m.key} (${m.label}${m.needsDice ? ", vuole malusDice" : ""}${m.needsTurns ? ", vuole malusTurns" : ""})`).join("; ")}
<BUFF>: ${(v.buffTypes || []).map((b) => `${b.key} (${b.label})`).join("; ")}
<STAT>: ${list(v.castStats)}
<CLASSE> e spell del motore (nome — info):
${spells}

${SCHEMA_DOC}

EQUILIBRIO E PREZZO: le Monete Arena sono 60 a settimana (+20 dal 2° torneo e qualche vincita). Tieni il potere in linea col catalogo esistente e fai pagare di più ciò che è più forte o ha più usi.
CATALOGO ESISTENTE (per calibrare prezzi e potenza, NON copiarlo):
${esempi || "(vuoto)"}`;

  try {
    let out;
    try { out = await callGemini(geminiKey, prompt); }
    catch { out = await callGemini(geminiKey, prompt + "\n\nATTENZIONE: rispondi con JSON valido e basta."); }
    return res.status(200).json({ item: out });
  } catch (e) {
    return res.status(500).json({ error: "Generazione non riuscita: " + e.message });
  }
}
