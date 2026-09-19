/**
 * WHERE THE COUPLE GOES TO LOCK A SUPPLIER — one rule, imported by every
 * "ask them to lock" link.
 *
 * ── WHY THIS FILE EXISTS (AREA-CHAT, 2026-09-19) ────────────────────────────
 * Two surfaces told the couple that booking means pressing Lock "on that shop's
 * workspace page" and linked there: the accepted quote card in the conversation
 * (S5, #5607) and the sent-quote page (A4). The workspace page holds NO lock
 * control — measured with `git grep -n "AccordionLockButton\|finalizeVendor("`:
 * the one lock path mounts on the Vendors page, in the bench row
 * (`bench-vendor-actions.tsx`) and in "Your team" (`build-locked.tsx`), and
 * nowhere under `vendors/[vendorId]/workspace/`. Both links were a dead end
 * from the day they shipped, and #5614 (one chat box) turned the dead end into
 * a LOOP: a bare workspace landing now redirects to the conversation, so
 * "🔒 Ask Saysay to lock" on the quote card reloaded the quote card.
 *
 * The door is the bench, opened on the pick's own category tile — the shipped
 * `?open=<tile>` contract the Vendors page already honours (`ShortlistCategories`
 * → `initialOpenTile`; precedent `lib/setnayan-ai-free-assist.ts`). A category
 * the taxonomy cannot place (a raw DB string) still lands on the bench, whose
 * first tile carries the same Lock control — never on a page with none.
 *
 * 🔑 The rule lives here and not in either page because two pages deriving one
 * destination is how the two came to agree on the wrong one.
 */
import { tileForCategory } from './shortlist-taxonomy';
import type { VendorCategory } from './vendors';

/** The Vendors page — the bench + "Your team" — where the one lock path mounts. */
export function coupleLockDoorHref(eventId: string, category: string | null): string {
  const base = `/dashboard/${eventId}/vendors`;
  const tile = category ? tileForCategory(category as VendorCategory) : null;
  return tile ? `${base}?open=${encodeURIComponent(tile)}` : base;
}
