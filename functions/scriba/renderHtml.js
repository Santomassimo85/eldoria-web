// functions/scriba/renderHtml.js
//
// Trasforma il contenuto strutturato de "Lo Scriba" (testo + immagini) in una
// email-giornale. HTML a tabelle + CSS inline: è l'unico modo affidabile su
// Gmail/Outlook. Le immagini sono URL https (Firebase Storage) o cid: (prova).
//
// Tema: pergamena antica (bianco sporco) con testo scuro. Forziamo "light only"
// per evitare che la dark-mode dei client inverta i colori.
// Font: Cinzel (titoli, fantasy) + Lora (corpo, leggibile) via Google Fonts —
// i client che li supportano (Apple Mail, iOS, l'archivio web /scriba) li
// caricano; gli altri (Gmail) ricadono su Georgia.

const { exanthiaDateLabel, SOTTOTITOLO_TESTATA } = require("./calendar");

// URL pubblico del sito (prod su Vercel) per il link all'archivio in fondo.
const SITE_URL = "https://eldoria-web-delta.vercel.app";
// Nome proprio dell'arena (tenuto in sync con prompt.js → ARENA_NAME).
const ARENA_HEADING = "L'Arena Vermiglia";

// Stack font: titolo "fantasy", corpo "leggibile". Fallback web-safe per Gmail.
const FONT_TITLE = "'Cinzel','Trajan Pro',Georgia,'Times New Roman',serif";
const FONT_BODY = "'Lora',Georgia,'Times New Roman',serif";

const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

// Corpo articolo: paragrafi separati da doppio a-capo → <p>. Più grande e
// arioso di prima per la leggibilità.
const paragraphs = (body, color = "#2b2620") =>
    String(body || "")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p style="margin:0 0 13px;font-family:${FONT_BODY};font-size:16px;line-height:1.72;color:${color};">${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("");

function imageBlock(img) {
    if (!img || !img.url) return "";
    return `
      <tr><td style="padding:4px 0 18px;">
        <img src="${esc(img.url)}" alt="" width="548" style="display:block;width:100%;max-width:548px;height:auto;border:1px solid #cdbfa3;">
        ${img.caption ? `<div style="font-family:${FONT_BODY};font-style:italic;font-size:12px;color:#6b5d44;padding-top:6px;text-align:center;">${esc(img.caption)}</div>` : ""}
      </td></tr>`;
}

function article(a, { lead = false } = {}) {
    const titleSize = lead ? 27 : 20;
    const titleMargin = lead ? "0 0 14px" : "0 0 8px";
    return `
      <tr><td style="padding:${lead ? "0 0 6px" : "16px 0 6px"};">
        <h2 style="margin:${titleMargin};font-family:${FONT_TITLE};font-weight:700;font-size:${titleSize}px;line-height:1.25;color:#1c1813;letter-spacing:.5px;">${esc(a.headline)}</h2>
        ${paragraphs(a.body)}
      </td></tr>`;
}

function sectionBlock(heading, articles, images = []) {
    if (!articles || !articles.length) return "";
    const head = `
      <tr><td style="padding:26px 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:2px solid #1c1813;border-bottom:1px solid #1c1813;padding:4px 0;">
            <span style="font-family:${FONT_TITLE};font-weight:700;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#7a1f12;">${esc(heading)}</span>
          </td>
        </tr></table>
      </td></tr>`;
    const imgs = images.map(imageBlock).join("");
    return head + imgs + articles.map((a) => article(a)).join("");
}

/**
 * @param {{
 *   content: object,           // { edition_motto, lead, dalle_terre, voci_di_taverna, listini }
 *   edition: number,           // numero del giornale
 *   date?: Date,
 *   unsubUrl?: string,         // link/mailto disiscrizione
 *   images?: Array<{url:string, caption:string, placement:string}>,
 * }} args
 * @returns {string} HTML completo
 */
function renderScribaHtml({ content, edition, unsubUrl = "", images = [], approveUrl = "" }) {
    // La data è in-world: derivata dal NUMERO del giornale (n.1 = 10 di Solleone),
    // non dalla data reale di spedizione.
    const dateLabel = exanthiaDateLabel(edition);
    const motto = content.edition_motto ? esc(content.edition_motto) : "Cronache delle Terre di Exanthia";

    const imgs = Array.isArray(images) ? images : [];
    const byPlace = (k) => imgs.filter((im) => im.placement === k);

    const leadHasContent = content.lead && (content.lead.headline || content.lead.body);
    const leadBlock = leadHasContent
        ? article(content.lead, { lead: true }) + byPlace("lead").map(imageBlock).join("")
        : "";

    const unsub = unsubUrl
        ? `Non vuoi più ricevere Lo Scriba? <a href="${esc(unsubUrl)}" style="color:#7a1f12;">Disiscriviti</a>.`
        : "";

    // Banner di approvazione: SOLO nella copia del master (mai ai giocatori).
    const approveBanner = approveUrl ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1c1813;">
    <tr><td align="center" style="padding:18px 16px;">
      <div style="font-family:${FONT_BODY};font-size:13px;color:#f4efe3;padding-bottom:12px;line-height:1.5;">
        📰 <strong>Anteprima per il Direttore</strong> — questo numero NON è ancora stato inviato ai giocatori.<br>
        Approva qui sotto per spedirlo alla lista. (Questo riquadro non comparirà nella copia dei lettori.)
      </div>
      <a href="${esc(approveUrl)}" style="display:inline-block;background:#c9a227;color:#1c1813;font-family:${FONT_TITLE};font-weight:700;font-size:15px;letter-spacing:1px;text-decoration:none;padding:13px 28px;border-radius:6px;">✓ APPROVA E INVIA AI GIOCATORI</a>
    </td></tr>
  </table>` : "";

    return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap">
<style>
  :root { color-scheme: light only; supported-color-schemes: light only; }
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
  /* Anti dark-mode: ri-forza pergamena chiara + testo scuro sui client che
     rispettano prefers-color-scheme (Apple Mail, iOS, Outlook.com, browser). */
  @media (prefers-color-scheme: dark) {
    body, table, td { background-color: #f4efe3 !important; }
    .sc-outer { background-color: #ece3d0 !important; }
    .sc-paper { background-color: #f4efe3 !important; }
    h2, p, .sc-dark { color: #1c1813 !important; }
    .sc-muted { color: #6b5d44 !important; }
    .sc-accent { color: #7a1f12 !important; }
  }
  [data-ogsc] body, [data-ogsc] table, [data-ogsc] td { background-color: #f4efe3 !important; }
  [data-ogsc] h2, [data-ogsc] p, [data-ogsc] .sc-dark { color: #1c1813 !important; }
</style>
<title>Lo Scriba — N. ${edition}</title></head>
<body style="margin:0;padding:0;background:#ece3d0;">
  ${approveBanner}
  <table role="presentation" class="sc-outer" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ece3d0;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" class="sc-paper" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:100%;background:#f4efe3;border:1px solid #cdbfa3;">
        <tr><td style="padding:30px 36px 0;">

          <!-- TESTATA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="padding-bottom:6px;">
              <div style="font-family:${FONT_BODY};font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#6b5d44;">${SOTTOTITOLO_TESTATA} · Exanthia</div>
            </td></tr>
            <tr><td align="center" style="border-bottom:3px double #1c1813;padding-bottom:10px;">
              <div style="font-family:${FONT_TITLE};font-weight:700;font-size:46px;line-height:1.05;letter-spacing:3px;color:#1c1813;">Lo Scriba</div>
              <div style="font-family:${FONT_BODY};font-style:italic;font-size:15px;color:#6b5d44;padding-top:8px;">${motto}</div>
            </td></tr>
            <tr><td style="padding:7px 0;border-bottom:1px solid #1c1813;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td align="left" style="font-family:${FONT_BODY};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b5d44;">Numero ${edition}</td>
                <td align="right" style="font-family:${FONT_BODY};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b5d44;">${esc(dateLabel)}</td>
              </tr></table>
            </td></tr>
          </table>

          <!-- CORPO -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding-top:22px;"></td></tr>
            ${leadBlock}
            ${sectionBlock("Dalle Terre", content.dalle_terre, byPlace("dalle_terre"))}
            ${sectionBlock("Voci di Taverna", content.voci_di_taverna, byPlace("voci_di_taverna"))}
            ${sectionBlock("Listini & Loschi Affari", content.listini, byPlace("listini"))}
            ${sectionBlock(`Dall'${ARENA_HEADING.replace(/^L'/, "")} · Cronache del Sangue`, content.arena, byPlace("arena"))}
          </table>

          <!-- PIÈ DI PAGINA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:28px 0 30px;border-top:2px solid #1c1813;">
              <div style="font-family:${FONT_BODY};font-size:13px;line-height:1.6;text-align:center;padding-bottom:10px;">
                <a href="${esc(SITE_URL)}/scriba" style="color:#7a1f12;font-weight:bold;text-decoration:none;letter-spacing:1px;">❧ Sfoglia tutti i numeri ne Lo Scriba ❧</a>
              </div>
              <div style="font-family:${FONT_BODY};font-size:11px;line-height:1.6;color:#8a7d64;text-align:center;">
                Lo Scriba · cronache del mondo di Exanthia · stampato a uso degli avventurieri.<br>
                ${unsub}
              </div>
            </td></tr>
          </table>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// `italianDateLabel` mantenuto come alias (ora in-world) per retro-compatibilità
// con i punti che importano da qui passando il NUMERO del giornale.
module.exports = { renderScribaHtml, italianDateLabel: exanthiaDateLabel, exanthiaDateLabel };
