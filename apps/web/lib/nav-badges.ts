/**
 * nav-badges.ts — the ONE source for every live count that appears on a nav.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The bottom nav has had full badge support since it shipped — a dot, a count,
 * a tone palette and an sr-only label, rendered in BOTH its flat and accordion
 * paths. The admin bar uses it. **Neither the couple's bar nor the vendor's
 * passed a single badge**, while their desktop sidebars, sitting on the same
 * layout and fed by counts the layout had ALREADY fetched, showed them.
 *
 * So a vendor at a wedding, on the phone, saw five plain tabs. The same vendor
 * at a laptop saw "3 new inquiries · 2 unread threads". The phone is where they
 * actually are.
 *
 * ── WHY A SHARED HELPER, NOT A SECOND COPY ──────────────────────────────────
 * The obvious fix was to re-derive the badge beside the bottom nav. That is the
 * failure this codebase keeps paying for: the payouts row counted one thing
 * while the list beneath it counted another, both valid, disagreeing forever in
 * silence. A COUNT AND THE THING IT COUNTS MUST COME FROM ONE PREDICATE — so
 * the sidebar and the bar now call the same function, and a change to what a
 * badge means reaches both or neither.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
 * No new counts are invented. Each helper takes numbers the layout already
 * fetched for the sidebar and shapes them; nothing new is queried, and no badge
 * is placed on a tab whose sidebar twin does not already carry one. Making the
 * phone match the desktop is a parity fix. Deciding a tab deserves a NEW count
 * is a product call, and is not being made here.
 *
 * ── ZERO IS NOT A BADGE, AND NEITHER IS "UNKNOWN" ───────────────────────────
 * Every helper returns `undefined` rather than a zero badge. A count of 0 and a
 * count that failed to load look identical once rendered, and both layouts
 * fail-soft their count fetches to 0/null on error. A dot reading "0" would
 * therefore claim "nothing is waiting" on exactly the request that could not
 * find out — the same shape as filing an unmeasured queue under "all clear".
 */

import type { NavBadge } from '@/app/_components/nav/types';

/**
 * The couple's Guests tab — a live head-count.
 *
 * Neutral tone: a guest count is information, not a demand. It is not work
 * waiting for them, so it must not wear the accent that means "act on this".
 * Mirrors the sidebar's own choice; do not diverge without changing both.
 */
export function customerGuestsBadge(guestCount?: number | null): NavBadge | undefined {
  if (!guestCount || guestCount <= 0) return undefined;
  return {
    count: guestCount,
    tone: 'neutral',
    // The bare number on a bottom-nav dot is ambiguous read aloud — "142" beside
    // a Guests icon could be anything. The sr-only label says which.
    label: `${guestCount} ${guestCount === 1 ? 'guest' : 'guests'}`,
  };
}

/**
 * The vendor's My Customers tab — pending inquiries PLUS unread threads.
 *
 * Both land on one tab because the 5-page IA (owner-locked 2026-07-12) put the
 * booking pipeline AND the message threads inside My Customers. The sidebar
 * already sums them onto that same row; this is that rule, lifted out so the
 * two cannot drift.
 *
 * Orange (the brand accent) because unlike a guest count this IS work waiting —
 * a couple has asked a question and nobody has answered.
 *
 * The combined number alone would be a lie of omission: "5" could be five
 * inquiries or five unread messages, which need different amounts of urgency.
 * The visible dot carries the sum; the label carries the split.
 */
export function vendorCustomersBadge(
  bookingsPending?: number | null,
  threadsUnread?: number | null,
): NavBadge | undefined {
  const inquiries = Math.max(0, bookingsPending ?? 0);
  const threads = Math.max(0, threadsUnread ?? 0);
  const total = inquiries + threads;
  if (total <= 0) return undefined;
  return {
    count: total,
    tone: 'orange',
    label: `${inquiries} new inquiries · ${threads} unread threads`,
  };
}
