/**
 * THE PORTFOLIO — NO COUNT, NO PRICE. PURE: no database, no `server-only`, so the uploader (a client component), the
 * save door and the guards share one set of words.
 *
 * 🔓 OWNER 2026-11-23 (DECISION_LOG "THE 50-PHOTO PORTFOLIO CAP IS DROPPED — STORAGE IS THE ONLY LIMIT", *"Yes, drop
 * it"*): the every-plan free 50, the personal invite's 100 and "then 1 Papic credit a photo from the shop wallet" are
 * all gone. A portfolio photo is a stored file like any other — the plan's storage is the only limit, and `/api/upload`
 * checks it before any bytes move. The save stays ONE step (`shop_portfolio_commit`, owner-only), which since migration
 * `supplier_event_photo_limits` writes the list and charges nothing.
 *
 * (This file keeps its name so its callers and guards move with it; it no longer prices anything.)
 */

/** How many refs in `next` are not on the page yet (blanks and repeats dropped). */
export function portfolioAdded(stored: readonly string[], next: readonly string[]): number {
  const had = new Set(stored.filter(Boolean));
  const seen = new Set<string>();
  let added = 0;
  for (const ref of next) {
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    if (!had.has(ref)) added += 1;
  }
  return added;
}

const n = (x: number) => x.toLocaleString('en-PH');

/** The counter's two halves: "12 photos" · "No limit". */
export function portfolioCounter(count: number): { left: string; right: string } {
  const c = Math.max(0, Math.floor(count));
  return { left: `${n(c)} ${c === 1 ? 'photo' : 'photos'}`, right: 'No limit' };
}

/** The Save button: "Save" / "Save 3". */
export function portfolioSaveLabel(added: number): string {
  return added > 0 ? `Save ${n(added)}` : 'Save';
}

/** The toast after a save: "Portfolio saved. 3 added." */
export function portfolioSavedText(added: number): string {
  return added > 0 ? `Portfolio saved. ${n(added)} added.` : 'Portfolio saved.';
}

/** The ⓘ beside "Portfolio photos" — the rule in one sentence. */
export const PORTFOLIO_RULE = 'No limit on portfolio photos — your plan’s storage is the only one. Taking one off frees its space.';
