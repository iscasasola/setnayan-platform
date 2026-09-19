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
import { PLAN_GROUPS, planGroupForCategory, type PlanGroupId } from './wedding-plan-groups';

/** The Vendors page — the bench + "Your team" — where the one lock path mounts. */
export function coupleLockDoorHref(eventId: string, category: string | null): string {
  const base = `/dashboard/${eventId}/vendors`;
  const tile = category ? tileForCategory(category as VendorCategory) : null;
  return tile ? `${base}?open=${encodeURIComponent(tile)}` : base;
}

/**
 * WHAT THE ACCEPTED QUOTE CARD NEEDS TO MOUNT THE LOCK ITSELF (owner, live,
 * 2026-09-19: *"the lock attempt was from the chat. it should also work there."*).
 *
 * The card no longer links away to lock — it mounts the bench's own
 * `AccordionLockButton`, which calls the one `finalizeVendor`. That button needs
 * exactly what the bench hands it: the pick's `event_vendors.vendor_id` and a
 * REAL plan group (it must never be handed a null group — see
 * `BenchCardActions.lockGroupId`). The group is resolved here, by the same
 * `planGroupForCategory` the bench and `finalizeVendor` use, so the chat and
 * the bench cannot disagree about which group a pick belongs to.
 *
 * `groupId` null ⇒ no group claims this category, so the bench has no Lock for
 * it either; the card then offers the bench link (`benchHref`) instead of a
 * button that would fail. Nothing here writes.
 */
export type CoupleLockTarget = {
  eventId: string;
  /** `event_vendors.vendor_id` — what `finalizeVendor` keys on. */
  vendorId: string;
  groupId: PlanGroupId | null;
  groupLabel: string;
  /** Where the same Lock mounts on the Vendors page — the secondary door. */
  benchHref: string;
};

export function coupleLockTarget(
  eventId: string,
  vendorId: string,
  category: string | null,
): CoupleLockTarget {
  const groupId = category ? planGroupForCategory(category as VendorCategory) : null;
  const groupLabel = (groupId && PLAN_GROUPS.find((g) => g.id === groupId)?.label) || 'Vendor';
  return {
    eventId,
    vendorId,
    groupId,
    groupLabel,
    benchHref: coupleLockDoorHref(eventId, category),
  };
}
