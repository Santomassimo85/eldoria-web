/* TCG access gate — kept in its own module so the page file only
   exports a component (React Fast Refresh requirement). */

export const TCG_LOCKED = false;
export const TCG_ALLOWED_EMAILS = new Set(["santomassimo85@gmail.com"]);

export function isTcgUnlockedFor(email) {
  if (!TCG_LOCKED) return true;
  return TCG_ALLOWED_EMAILS.has(email || "");
}
