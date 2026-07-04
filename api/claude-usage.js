// api/claude-usage.js
// Tesoreria del Concilio: consumo token + costi delle chiamate API Claude.
// Interroga la Usage & Cost Admin API di Anthropic (serve una ADMIN key,
// sk-ant-admin01-…, diversa dalla ANTHROPIC_API_KEY: env ANTHROPIC_ADMIN_KEY).
// NB: l'Admin API esiste solo per account con Organizzazione nel Console —
// se la chiave manca rispondiamo { configured:false } e la UI spiega cosa fare.
//
// Output:
// {
//   configured: true,
//   days: [{ date, tokensIn, tokensOut, cacheRead, costCents, models:{...} }],
//   totals: { tokensIn, tokensOut, cacheRead, costCents, costEstimated, byModel },
// }
// costCents: dal cost_report (USD, centesimi). Se il cost_report non è
// disponibile, stimiamo dai token col listino (costEstimated: true).

export const config = { maxDuration: 30 };

const API = "https://api.anthropic.com/v1/organizations";
const HEADERS = (key) => ({
  "anthropic-version": "2023-06-01",
  "x-api-key": key,
  "User-Agent": "EldoriaWeb/1.0 (Concilio Tesoreria)",
});

// Listino USD per MTok (input/output) — usato SOLO come stima di riserva
// quando il cost_report non risponde. Cache read = 0.1×in, write 5m = 1.25×in,
// write 1h = 2×in.
const PRICING = [
  { match: /opus-4-[5678]/, in: 5, out: 25 },
  { match: /opus/, in: 15, out: 75 },
  { match: /sonnet/, in: 3, out: 15 },
  { match: /haiku-4-5/, in: 1, out: 5 },
  { match: /haiku-3-5/, in: 0.8, out: 4 },
  { match: /haiku/, in: 0.25, out: 1.25 },
];
function priceFor(model) {
  const m = String(model || "");
  return PRICING.find((p) => p.match.test(m)) || { in: 5, out: 25 };
}
function estimateCents(model, t) {
  const p = priceFor(model);
  const usd =
    (t.in / 1e6) * p.in +
    (t.out / 1e6) * p.out +
    (t.cacheRead / 1e6) * p.in * 0.1 +
    (t.cache5m / 1e6) * p.in * 1.25 +
    (t.cache1h / 1e6) * p.in * 2;
  return usd * 100;
}

// GET paginato su un endpoint del report (segue next_page).
async function fetchReport(url, key) {
  const out = [];
  let page = null;
  for (let i = 0; i < 10; i++) {
    const u = url + (page ? `&page=${encodeURIComponent(page)}` : "");
    const r = await fetch(u, { headers: HEADERS(key) });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`Anthropic ${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    out.push(...(j.data || []));
    if (!j.has_more || !j.next_page) break;
    page = j.next_page;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Usa GET" });

  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) return res.status(200).json({ configured: false });

  const days = Math.min(31, Math.max(7, parseInt(req.query.days, 10) || 30));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  start.setUTCHours(0, 0, 0, 0);
  const qs = `starting_at=${start.toISOString()}&ending_at=${end.toISOString()}`;

  try {
    // ── Usage (token) per giorno, per modello ──────────────────────────────
    const usageBuckets = await fetchReport(
      `${API}/usage_report/messages?${qs}&bucket_width=1d&group_by[]=model&limit=31`,
      key
    );

    const byDate = new Map(); // date → { models, tokensIn, tokensOut, cacheRead, costCents }
    const dayOf = (iso) => String(iso).slice(0, 10);
    const blank = () => ({ in: 0, out: 0, cacheRead: 0, cache5m: 0, cache1h: 0 });

    for (const b of usageBuckets) {
      const date = dayOf(b.starting_at);
      if (!byDate.has(date)) byDate.set(date, { date, models: {}, costCents: null });
      const d = byDate.get(date);
      for (const r of b.results || []) {
        const model = r.model || "sconosciuto";
        if (!d.models[model]) d.models[model] = blank();
        const t = d.models[model];
        t.in += r.uncached_input_tokens || 0;
        t.out += r.output_tokens || 0;
        t.cacheRead += r.cache_read_input_tokens || 0;
        t.cache5m += r.cache_creation?.ephemeral_5m_input_tokens || 0;
        t.cache1h += r.cache_creation?.ephemeral_1h_input_tokens || 0;
      }
    }

    // ── Costi reali (USD) per giorno ───────────────────────────────────────
    let costEstimated = false;
    try {
      const costBuckets = await fetchReport(`${API}/cost_report?${qs}&limit=31`, key);
      for (const b of costBuckets) {
        const date = dayOf(b.starting_at);
        if (!byDate.has(date)) byDate.set(date, { date, models: {}, costCents: null });
        const d = byDate.get(date);
        let cents = 0;
        for (const r of b.results || []) cents += Number(r.amount) || 0;
        d.costCents = (d.costCents || 0) + cents;
      }
    } catch {
      costEstimated = true; // cost_report non disponibile: si stima dal listino
    }

    // ── Aggregati ──────────────────────────────────────────────────────────
    const list = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const totals = { tokensIn: 0, tokensOut: 0, cacheRead: 0, costCents: 0, byModel: {} };
    for (const d of list) {
      d.tokensIn = 0; d.tokensOut = 0; d.cacheRead = 0;
      let estCents = 0;
      for (const [model, t] of Object.entries(d.models)) {
        d.tokensIn += t.in + t.cache5m + t.cache1h;
        d.tokensOut += t.out;
        d.cacheRead += t.cacheRead;
        estCents += estimateCents(model, t);
        if (!totals.byModel[model]) totals.byModel[model] = { ...blank(), estCents: 0 };
        const m = totals.byModel[model];
        m.in += t.in; m.out += t.out; m.cacheRead += t.cacheRead;
        m.cache5m += t.cache5m; m.cache1h += t.cache1h;
        m.estCents += estimateCents(model, t);
      }
      if (d.costCents == null) d.costCents = Math.round(estCents * 100) / 100;
      totals.tokensIn += d.tokensIn;
      totals.tokensOut += d.tokensOut;
      totals.cacheRead += d.cacheRead;
      totals.costCents += d.costCents;
    }
    totals.costEstimated = costEstimated;

    // I dati Anthropic hanno ~5 min di ritardo: cache CDN per non martellare.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ configured: true, days: list, totals });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
