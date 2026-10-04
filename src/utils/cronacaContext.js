// Archivio del mondo per la Cronaca del DM (DmTools → tab Cronaca).
// Prima di scrivere il riassunto, il Monaco Errante "legge" l'app: le cronache
// precedenti del gruppo, la prep della sessione, il diario dei giocatori, le
// schede dei PG e gli NPC / luoghi citati. Tutto letto dal client del Master
// (le regole lo permettono) e passato come testo a /api/genera-riassunto.
// Ogni fonte è facoltativa: se una lettura fallisce, si va avanti senza.
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { normText, mentioned } from "./nameMatch";

const MAX_TOTAL = 36000; // tetto di caratteri dell'archivio intero

// HTML → testo piano, spazi compattati.
export function stripHtml(html) {
  return String(html || "")
    .replace(/<(br|\/p|\/h\d|\/li|\/blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const cut = (s, n) => {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
};

const norm = normText;

const safe = (p) => p.then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []);
const ts = (v) => (v?.toMillis ? v.toMillis() : typeof v === "number" ? v : Date.parse(v || "") || 0);

/**
 * Raccoglie l'archivio per una cronaca.
 * @param {{party:string, linee:string, members:{name:string}[], summaries?:object[]}} args
 * @returns {Promise<{text:string, used:{label:string, items:string[]}[]}>}
 */
export async function buildCronacaContext({ party, linee, members = [], summaries }) {
  const [sums, sessions, diary, chars, npcs, places] = await Promise.all([
    summaries ? Promise.resolve(summaries) : safe(getDocs(collection(db, "summaries"))),
    safe(getDocs(query(collection(db, "dm_sessions"), where("party", "==", party)))),
    safe(getDocs(query(collection(db, "diary_notes"), where("party", "==", party)))),
    safe(getDocs(collection(db, "characters"))),
    safe(getDocs(collection(db, "npcs"))),
    safe(getDocs(collection(db, "geo_archive"))),
  ]);

  const used = [];
  const blocks = [];

  // 1) Cronache precedenti del gruppo: elenco dei titoli + le ultime 3 per esteso.
  const mine = sums
    .filter((s) => (s.party || "AMEA") === party)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  if (mine.length) {
    const recent = mine.slice(-3);
    const lines = [
      `Titoli di tutte le cronache del gruppo, in ordine: ${mine.map((s, i) => `${i + 1}. ${s.title || "?"}`).join(" · ")}`,
      ...recent.map((s) => {
        const n = mine.indexOf(s) + 1;
        return `— Cronaca n. ${n} «${s.title || ""}»${s.date ? ` (${s.date})` : ""}:\n${cut(stripHtml(s.content), n === mine.length ? 4500 : 2500)}`;
      }),
    ];
    blocks.push(`## CRONACHE PRECEDENTI DEL GRUPPO (la più recente è l'ultima)\n${lines.join("\n\n")}`);
    used.push({ label: "Cronache precedenti", items: recent.map((s) => s.title || "?") });
  }

  // 2) Prep della sessione dal Generatore DM: l'ultima, con panoramica e ganci.
  const prep = sessions.sort((a, b) => (a.sessionNumber || 0) - (b.sessionNumber || 0)).slice(-2);
  if (prep.length) {
    const lines = prep.map((s) => {
      const sm = s.summary || {};
      return [
        `— Prep sessione ${s.sessionNumber}${s.title ? ` «${s.title}»` : ""}`,
        sm.panoramica ? `Panoramica: ${cut(sm.panoramica, 1200)}` : "",
        sm.ganciAperti ? `Ganci aperti: ${cut(sm.ganciAperti, 800)}` : "",
        sm.bottino ? `Bottino previsto: ${cut(sm.bottino, 400)}` : "",
        !sm.panoramica && s.htmlContent ? cut(stripHtml(s.htmlContent), 2500) : "",
      ].filter(Boolean).join("\n");
    });
    blocks.push(`## PREPARAZIONE DEL MASTER (ciò che era previsto: NON è detto che sia accaduto)\n${lines.join("\n\n")}`);
    used.push({ label: "Prep del Master", items: prep.map((s) => `Sessione ${s.sessionNumber}${s.title ? ` · ${s.title}` : ""}`) });
  }

  // 3) Diario dei giocatori: le ultime 12 note.
  const notes = diary.sort((a, b) => ts(b.createdAt) - ts(a.createdAt)).slice(0, 12);
  if (notes.length) {
    blocks.push(`## DIARIO DEI GIOCATORI (note recenti, dal più nuovo)\n${notes.map((n) => `- ${n.authorName || "?"}: ${cut(n.text, 500)}`).join("\n")}`);
    used.push({ label: "Diario", items: [`${notes.length} note`] });
  }

  // 4) Schede dei PG del gruppo (abbinate per nome).
  const pcs = members
    .map((m) => chars.find((c) => c.name && (norm(c.name) === norm(m.name) || norm(c.name).split(/\s+/)[0] === norm(m.name))))
    .filter(Boolean);
  if (pcs.length) {
    blocks.push(`## I PROTAGONISTI (schede)\n${pcs.map((c) => {
      const bits = [c.race, [c.class, c.subclass].filter(Boolean).join(" · "), c.background ? `background ${stripHtml(c.background).slice(0, 60)}` : ""].filter(Boolean).join(", ");
      const bio = c.bio || c.backstory || c.description || "";
      return `- ${c.name}${bits ? ` (${bits})` : ""}${bio ? `: ${cut(stripHtml(bio), 500)}` : ""}`;
    }).join("\n")}`);
    used.push({ label: "Schede PG", items: pcs.map((c) => c.name) });
  }

  // Testo dove cercare i nomi: linee guida + ultima cronaca + ultima prep.
  const lastSum = mine[mine.length - 1];
  const hay = norm([linee, stripHtml(lastSum?.content), prep.map((s) => JSON.stringify(s.summary || {})).join(" ")].join(" "));
  const inLinee = norm(linee);

  // 5) NPC citati (prima quelli nelle linee guida).
  const npcHits = npcs
    .filter((n) => n.name && mentioned(n.name, hay))
    .sort((a, b) => Number(mentioned(b.name, inLinee)) - Number(mentioned(a.name, inLinee)))
    .slice(0, 18);
  if (npcHits.length) {
    blocks.push(`## NPC CITATI\n${npcHits.map((n) => {
      const where_ = [n.location, n.linkedCity].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
      const meta = [n.faction, where_].filter(Boolean).join(" · ");
      return `- ${n.name}${meta ? ` (${meta})` : ""}: ${cut(stripHtml(n.description), 450)}`;
    }).join("\n")}`);
    used.push({ label: "NPC", items: npcHits.map((n) => n.name) });
  }

  // 6) Luoghi dell'Atlante (/Geo) citati.
  const placeHits = places
    .filter((p) => p.name && mentioned(p.name, hay, { partial: false }))
    .sort((a, b) => Number(mentioned(b.name, inLinee, { partial: false })) - Number(mentioned(a.name, inLinee, { partial: false })))
    .slice(0, 8);
  if (placeHits.length) {
    blocks.push(`## LUOGHI CITATI (Atlante)\n${placeHits.map((p) => `- ${p.name}${p.continent ? ` (${p.continent})` : ""}: ${cut(stripHtml(p.description), 700)}`).join("\n")}`);
    used.push({ label: "Luoghi", items: placeHits.map((p) => p.name) });
  }

  let text = blocks.join("\n\n");
  if (text.length > MAX_TOTAL) text = text.slice(0, MAX_TOTAL) + "\n…(archivio troncato)";
  return { text, used };
}
