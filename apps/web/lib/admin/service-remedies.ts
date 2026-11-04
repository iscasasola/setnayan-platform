/**
 * A PAID SERVICE THE BUYER CANNOT USE — the two things Admin › Payments can do
 * with it, as the public refund page promises (`app/(shell)/refunds/page.tsx`;
 * owner 2026-11-05 "yes to refund"):
 *
 *   1. CONVERT TO PAPIC CREDITS — its value becomes Papic credits on the event.
 *   2. MOVE TO THEIR NEXT EVENT — an unused service waits for the next event.
 *
 * Neither is a refund: no money moves. The work is done in ONE SQL transaction
 * each (migration 20271309226989: `admin_convert_order_to_papic_credits`,
 * `admin_move_order_to_next_event`), which hold the row lock that makes a double
 * click apply once. This module is the pure half: the words, and the bound.
 *
 * ⚠ NO CONVERSION RATE LIVES HERE. DECISION_LOG 2026-10-22 approved "worth what
 * you paid", NO RATE STATED, and the catalogue sells Papic in packs whose
 * per-credit price differs by pack. So the ADMIN types the credit count. The
 * only number derived here is an upper BOUND read off the live catalogue — never
 * a suggestion, never a default.
 */

import { formatCentavosPhp } from '@/lib/php';
import type { GiftRung } from '@/lib/setnayan-gift';

/** Every refusal the two SQL functions (and the action in front of them) can return. */
export type RemedyRefusal =
  | 'bad_credits'
  | 'short_reason'
  | 'not_found'
  | 'not_paid'
  | 'supplier_bill'
  | 'no_account'
  | 'no_event'
  | 'nothing_paid'
  | 'no_target'
  | 'same_event'
  | 'already_converted'
  | 'not_owner'
  | 'no_next_event'
  | 'not_next_event'
  | 'camera_credits'
  | 'credits_used'
  | 'cannot_move_service'
  | 'over_bound'
  | 'no_prices';

/** What the admin reads when an action is refused. Plain, short, and says what to do. */
export const REMEDY_REFUSAL_COPY: Readonly<Record<RemedyRefusal, string>> = Object.freeze({
  bad_credits: 'Enter a whole number of Papic credits, more than 0.',
  short_reason: 'Write a reason of at least 20 characters.',
  not_found: 'That order no longer exists. Refresh the page.',
  not_paid: 'Only a paid order can be converted or moved.',
  supplier_bill: 'This is a supplier’s own bill. It can’t be converted or moved.',
  no_account: 'This order has no account behind it, so there is no event to give it to.',
  no_event: 'This order isn’t on an event.',
  nothing_paid: 'Nothing was paid on this order, so there is nothing to convert or move.',
  no_target: 'Pick the event to move it to.',
  same_event: 'It is already on that event.',
  already_converted: 'Its value already became Papic credits, so it can’t move too.',
  not_owner: 'That event isn’t theirs. A service can only move to an event they host.',
  no_next_event: 'They have no next event yet. It waits until they create one.',
  not_next_event: 'It can only move to the next event they created.',
  camera_credits: 'Its Papic credits belong to one camera on this event, so it can’t move.',
  credits_used: 'Papic credits on this event were already used, so it can’t move.',
  cannot_move_service: 'This service is set up on the event itself and can’t be moved here.',
  over_bound: 'That is more credits than what they paid can buy at today’s Papic prices.',
  no_prices: 'Papic prices could not be read. Try again in a moment.',
});

const KNOWN = new Set<string>(Object.keys(REMEDY_REFUSAL_COPY));

/** The admin-facing sentence for a refusal code; an unknown code is never shown raw. */
export function remedyRefusalCopy(code: unknown): string {
  return typeof code === 'string' && KNOWN.has(code)
    ? REMEDY_REFUSAL_COPY[code as RemedyRefusal]
    : 'That could not be done. Refresh the page and try again.';
}

/**
 * Services whose stored set-up lives on the EVENT row itself, so re-pointing the
 * order would leave the old event switched on. Refused rather than half-moved.
 * (Concierge writes `events.concierge_*` on activation and nothing clears it.)
 */
export const SERVICES_THAT_CANNOT_MOVE: ReadonlySet<string> = new Set(['concierge_complete']);

/** A typed credit count, or null when it is not a whole number above zero. */
export function parseCredits(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().replace(/,/g, '');
  if (!/^\d{1,9}$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * THE MOST CREDITS `paidCentavos` COULD BUY AT TODAY'S PAPIC PRICES — the
 * cheapest per-credit pack in the live catalogue. "Worth what you paid" can never
 * be more than this, so it bounds a typo (15,000 for 1,500). It is NOT a rate and
 * is never pre-filled: no ruling says which pack prices a conversion.
 *
 * Null when the ladder is empty (catalogue unreadable or unpriceable) — the
 * action then refuses rather than accept an unbounded number.
 */
export function maxCreditsForPaid(paidCentavos: number, ladder: readonly GiftRung[] | null): number | null {
  if (!ladder || ladder.length === 0) return null;
  if (!Number.isFinite(paidCentavos) || paidCentavos <= 0) return 0;
  let best: GiftRung | null = null;
  for (const r of ladder) {
    if (r.credits <= 0 || r.priceCentavos <= 0) continue;
    // Compare credits-per-centavo without floating point: a/b > c/d ⇔ a·d > c·b.
    if (!best || r.credits * best.priceCentavos > best.credits * r.priceCentavos) best = r;
  }
  if (!best) return null;
  return Math.floor((paidCentavos * best.credits) / best.priceCentavos);
}

/** "₱99 = 150 · ₱499 = 1,000 …" — the live packs, for the admin to read beside the box. */
export function packsLine(ladder: readonly GiftRung[] | null): string | null {
  if (!ladder || ladder.length === 0) return null;
  return ladder
    .map((r) => `${formatCentavosPhp(r.priceCentavos)} = ${r.credits.toLocaleString('en-PH')}`)
    .join(' · ');
}

/** The couple's in-app notice when the value became credits. Says photos' currency, never a rate. */
export function creditsNotice(orderPublicId: string, credits: number): { title: string; body: string } {
  return {
    title: `${credits.toLocaleString('en-PH')} Papic credits added`,
    body:
      `Order ${orderPublicId} couldn’t be used, so we added ${credits.toLocaleString('en-PH')} ` +
      'Papic credits to your event. Your guests can use them for photos and clips on the day.',
  };
}

/** The couple's in-app notice when the service moved to their next event. */
export function movedNotice(orderPublicId: string, toEventName: string | null): { title: string; body: string } {
  const where = toEventName && toEventName.trim() ? `“${toEventName.trim()}”` : 'your next event';
  return {
    title: 'Your service moved to your next event',
    body: `Order ${orderPublicId} is now on ${where}. You don’t need to pay again.`,
  };
}
