/**
 * budget-tile-committed.ts — what the dashboard's Budget tile may say about "committed".
 *
 * 🔒 A HIDDEN AMOUNT IS NOT ₱0 (#5936, controller audit on PR #7560, Fix B).
 * `event_vendor_money_read` hands a Suppliers-only delegate every booking with its amounts NULL and
 * `money_shown: false`. The tile summed those as 0 and printed the paid-orders part alone — "₱2,499 committed so
 * far" when the couple has ₱152,499 committed. A number that is silently short reads as a real figure. So the tile
 * has THREE honest states, never two:
 *
 *   measured → the figure;
 *   unread   → a read was refused ("couldn't load");
 *   hidden   → the caller may not read the booking amounts ("hidden"), drawn as "—", never ₱ anything.
 *
 * Held by lib/a-hidden-amount-never-reads-as-a-figure.test.ts.
 */

export type CommittedRead =
  | { state: 'measured'; centavos: number }
  | { state: 'unread' }
  | { state: 'hidden' };

/** TRUE when the reader hid any booking's amounts from this caller — they are not measured, whatever they sum to. */
export function anyBookingAmountHidden(rows: ReadonlyArray<{ money_shown?: boolean | null }>): boolean {
  return rows.some((r) => r.money_shown === false);
}

export function budgetTileCommitted(i: {
  vendorsMeasured: boolean;
  ordersMeasured: boolean;
  amountsHidden: boolean;
  /** paid orders + contracted bookings, summed — only meaningful when the state is `measured`. */
  centavos: number;
}): CommittedRead {
  if (!i.vendorsMeasured || !i.ordersMeasured) return { state: 'unread' };
  if (i.amountsHidden) return { state: 'hidden' };
  return { state: 'measured', centavos: i.centavos };
}

/** The tile's line under the figure when the amounts are hidden. */
export const COMMITTED_HIDDEN_LINE = 'hidden — needs Budget & payments access';
