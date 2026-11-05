/**
 * A PAID SERVICE THE BUYER CANNOT USE — the two things Admin › Payments can do
 * with it, as the public refund page promises (`app/(shell)/refunds/page.tsx`;
 * owner 2026-11-05 "yes to refund"):
 *
 *   1. CONVERT TO PAPIC CREDITS — its value becomes Papic credits on the event,
 *      and the service itself is switched off.
 *   2. MOVE TO THEIR NEXT EVENT — an unused service waits for the next event.
 *
 * Neither is a refund: no money moves. The work is done in ONE SQL transaction
 * each (migration 20271309226989: `admin_convert_order_to_papic_credits`,
 * `admin_move_order_to_next_event`), which hold the row lock that makes a double
 * click apply once. This module is the pure half: the words.
 *
 * ⚖ OWNER 2026-11-05: the credit figure is what they paid at the BEST-VALUE Papic
 * pack on sale, read live from the catalogue by `orders_papic_credit_value` — the
 * ONE place it is computed. No rate lives in TypeScript, and the admin types none.
 */

import { formatPhp } from '@/lib/php';

/** Every refusal the two SQL functions (and the action in front of them) can return. */
export type RemedyRefusal =
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
  | 'set_up_on_the_event'
  | 'already_papic'
  | 'too_small'
  | 'prices_changed'
  | 'no_prices';

/** What the admin reads when an action is refused. Plain, short, and says what to do. */
export const REMEDY_REFUSAL_COPY: Readonly<Record<RemedyRefusal, string>> = Object.freeze({
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
  set_up_on_the_event: 'This service is set up on the event itself, so it can’t be converted or moved here.',
  already_papic: 'This order is already Papic credits on their event. Move it instead if they haven’t used it.',
  too_small: 'What they paid is too little to make even one Papic credit.',
  prices_changed: 'Papic prices changed since this page loaded. Refresh and check the new number.',
  no_prices: 'No Papic pack is on sale right now, so there is no price to convert at.',
});

const KNOWN = new Set<string>(Object.keys(REMEDY_REFUSAL_COPY));

/** The admin-facing sentence for a refusal code; an unknown code is never shown raw. */
export function remedyRefusalCopy(code: unknown): string {
  return typeof code === 'string' && KNOWN.has(code)
    ? REMEDY_REFUSAL_COPY[code as RemedyRefusal]
    : 'That could not be done. Refresh the page and try again.';
}

/**
 * Services whose stored set-up lives on the EVENT row itself (Concierge writes
 * `events.concierge_*` on activation and nothing clears it), so neither switching
 * the order off nor re-pointing it would undo that. Refused rather than half-done.
 */
export const SERVICES_SET_UP_ON_THE_EVENT: ReadonlySet<string> = new Set(['concierge_complete']);

/** "₱999 = 3,000 credits" — the pack the figure was priced at, for the admin to read. */
export function packLine(packCredits: number | null, packPricePhp: number | null): string | null {
  if (!packCredits || !packPricePhp || packCredits <= 0 || packPricePhp <= 0) return null;
  return `${formatPhp(packPricePhp)} = ${packCredits.toLocaleString('en-PH')} credits`;
}

/** The couple's in-app notice when the value became credits. Says photos' currency, never a rate. */
export function creditsNotice(orderPublicId: string, credits: number): { title: string; body: string } {
  return {
    title: `${credits.toLocaleString('en-PH')} Papic credits added`,
    body:
      `Order ${orderPublicId} couldn’t be used, so we switched it off and added ` +
      `${credits.toLocaleString('en-PH')} Papic credits to your event. Your guests can use them for photos and clips on the day.`,
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
