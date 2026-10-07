// ── Ruoli dell'app ──────────────────────────────────────────────────────────
// MASTER = il DM principale (tutto).
// CO-MASTER = l'altro admin (2026-10-07): può usare TUTTO come il Master
// ECCETTO i giochi — World Boss, Arena (+ Bottega Arena), TCG e Mercato Nero —
// dove resta una GIOCATRICE come gli altri (gioca con il suo PG, Makenna).
// Per le aree di gioco usare isMainMaster; per tutto il resto isAdminEmail.
// Le regole Firestore/Storage (isMaster()) includono già il co-master.

export const MASTER_EMAIL = "santomassimo85@gmail.com";
export const CO_MASTER_EMAILS = ["ripperti96@gmail.com"];
export const ADMIN_EMAILS = [MASTER_EMAIL, ...CO_MASTER_EMAILS];

const norm = (e) => String(e || "").trim().toLowerCase();

// Solo il DM principale (aree di gioco: boss, arena, tcg, mercato).
export const isMainMaster = (email) => norm(email) === MASTER_EMAIL;
// Master o co-master (tutto il resto dell'app).
export const isAdminEmail = (email) => ADMIN_EMAILS.includes(norm(email));
export const isCoMaster = (email) => CO_MASTER_EMAILS.includes(norm(email));
