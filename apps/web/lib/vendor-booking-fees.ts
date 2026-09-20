/**
 * Vendor Booking-Fee SURFACING — pure helpers (NO database, NO `server-only`),
 * so the "which orders are a vendor's fee orders" + classification rules are
 * unit-testable and importable by the (server) fetch/sweep half AND the tests.
 *
 * CONTEXT: when a booking locks past a verified vendor's free-5, the fee-charge
 * path (lib/booking-fee-lock.server.ts · owned by a parallel lane — do NOT edit
 * it here) mints a VENDOR-payer `orders` row with a
 * `vendor_booking_fee__{chargeId}` service_key on the same manual GCash/BDO QR
 * rail couples use. Until now that order only surfaced in /admin/payments — the
 * VENDOR had nowhere to see or pay it. This module is the READ-side surfacing
 * layer: it never writes the fee, it only identifies + classifies the orders
 * the charge path already created.
 */

import {
  BOOKING_FEE_LOCK_SERVICE_PREFIX,
  chargeIdFromBookingFeeLockServiceKey,
} from '@/lib/booking-fee-lock';
import type { OrderStatus } from '@/lib/orders';

/** Re-export so callers import the fee prefix from one surfacing entry point. */
export { BOOKING_FEE_LOCK_SERVICE_PREFIX };

/**
 * True iff an order's service_key is a lock booking-fee key
 * (`vendor_booking_fee__{chargeId}`). Thin, well-named wrapper over the charge
 * parser so the surfacing layer reads intent, not string mechanics.
 */
export function isVendorBookingFeeServiceKey(
  serviceKey: string | null | undefined,
): boolean {
  return chargeIdFromBookingFeeLockServiceKey(serviceKey) !== null;
}

/**
 * The `service_key LIKE` pattern that scopes an `orders` query to booking-fee
 * rows. Paired with the RLS `user_id = auth.uid()` read policy, this is what
 * makes a vendor see ONLY their own fee orders (never another vendor's).
 */
export const VENDOR_BOOKING_FEE_SERVICE_KEY_LIKE = `${BOOKING_FEE_LOCK_SERVICE_PREFIX}%`;

/**
 * The vendor-facing pay/detail page for a fee order. Kept in one place so the
 * list rows, the notification deep-link, and the redirect targets can't drift.
 */
export function vendorBookingFeePayPath(orderId: string): string {
  return `/vendor-dashboard/booking-fees/${orderId}`;
}

/** The list hub itself (the doorway target). */
export const VENDOR_BOOKING_FEES_PATH = '/vendor-dashboard/booking-fees';

/**
 * Where a WAIVED charge's receipt points — and, because this repo's emitters
 * key on `related_url`, its idempotency key as well.
 *
 * 🔑 A WAIVED CHARGE HAS NO PAY PAGE, BECAUSE IT HAS NO ORDER.
 * `vendorBookingFeePayPath` is `/booking-fees/{orderId}`, and
 * `collectBookingFeeAtLock` returns 'free' before any order is minted — so
 * there is no id to deep-link and nothing to pay. The hub's "Waived — your
 * first 5" section is the right destination.
 *
 * ⚠ NOT A `#fragment`. A fragment link to an id the page does not render fails
 * SILENTLY — the browser stays at the top and nothing says the anchor was
 * missing. The query parameter is inert on the page; it is carried only to make
 * the URL unique per charge, which is what makes "one receipt per waived
 * charge" enforceable with an existence check.
 */
export function vendorWaivedFeePath(chargeId: string): string {
  return `${VENDOR_BOOKING_FEES_PATH}?waived=${encodeURIComponent(chargeId)}`;
}

/**
 * The vendor-facing bucket for a fee order.
 *   • 'due'      — actionable: submitted / awaiting_payment (pay now).
 *   • 'verifying' has NO separate order status (a payment row is pre-created at
 *     charge time), so "up for verification" is copy shown on a 'due' order —
 *     it is NOT a distinct bucket here (the order stays 'due' until an admin
 *     promotes it to 'paid').
 *   • 'settled'  — money-final positive close: paid / fulfilled.
 *   • 'closed'   — no longer collectible: cancelled / refunded / lapsed / draft.
 */
export type FeeOrderBucket = 'due' | 'settled' | 'closed';

const DUE_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'submitted',
  'awaiting_payment',
]);

const SETTLED_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'paid',
  'fulfilled',
]);

/** Pure bucket for a fee order status. Deterministic mirror of the SQL statuses. */
export function classifyFeeOrderBucket(status: OrderStatus): FeeOrderBucket {
  if (DUE_STATUSES.has(status)) return 'due';
  if (SETTLED_STATUSES.has(status)) return 'settled';
  return 'closed';
}

/** A fee order is payable (renders the pay CTA + counts toward "you owe") iff due. */
export function isFeeOrderPayable(status: OrderStatus): boolean {
  return classifyFeeOrderBucket(status) === 'due';
}

/**
 * From a set of fee orders, the ones that are still DUE — i.e. the ones the
 * doorway/notification should surface. Non-fee keys are defensively filtered
 * out (the query already scopes by prefix, but the predicate keeps the pure
 * layer honest so a caller can pass a mixed order list safely).
 */
export function selectDueFeeOrders<
  T extends { service_key: string | null; status: OrderStatus },
>(orders: readonly T[]): T[] {
  return orders.filter(
    (o) => isVendorBookingFeeServiceKey(o.service_key) && isFeeOrderPayable(o.status),
  );
}

/** A fee order as far as its MONEY is concerned. Both columns may be absent. */
export type FeeOrderAmountSource = {
  confirmed_total_php: number | string | null | undefined;
  requested_total_php: number | string | null | undefined;
};

/**
 * WHAT THIS FEE COSTS — the confirmed figure, else the requested one, else
 * `null` because WE COULD NOT READ IT.
 *
 * 🔴 EVERY CALLER WROTE `Number(o.confirmed_total_php ?? o.requested_total_php ??
 * 0)`, AND THAT TRAILING `?? 0` IS THE WHOLE BUG. `formatPhp` already renders an
 * absent figure as `—`; the `?? 0` reaches it first and turns "we could not read
 * this" into **₱0** — a bill that says it costs nothing, on the page whose job is
 * to name what to transfer. The hub's warning banner did it twice over: a single
 * unreadable order silently contributed 0 to "totalling ₱X", so the headline
 * under-stated what the supplier owes without anything on screen saying so.
 *
 * ⚖ HOW REACHABLE IS IT? `orders.requested_total_php` is `NUMERIC(12,2) NOT
 * NULL` (migration `20260513150000_iteration_0034_payments.sql`) and a
 * column-level refusal fails the WHOLE PostgREST query — which
 * `fetchVendorFeeOrders` already turns into `FEE_ORDERS_UNREADABLE`, never `[]`.
 * So on a row that exists and was read, this is belt-and-braces rather than a
 * live defect, and it is claimed as nothing more. Prod row counts were NOT
 * measured this session (the read-only SQL tool was permission-blocked), so no
 * claim is made about live data either way.
 *
 * 🔑 IT IS STILL WORTH REMOVING, FOR THE REASON `pay-amount.ts` GIVES ABOUT ITS
 * OWN `maximumFractionDigits`: the declared TYPE admits null, so the render must
 * answer for null. A guard can hold a total-less order to `—` forever; it cannot
 * hold a schema column to NOT NULL. And the failure mode this shape produces —
 * "₱0" for "unknown" — is the exact disease seven merged PRs were spent on: a
 * failure that renders identically to a fact.
 */
export function feeOrderTotalPhp(order: FeeOrderAmountSource): number | null {
  const raw = order.confirmed_total_php ?? order.requested_total_php;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * The sum of a set of fee orders, or `null` IF ANY ONE OF THEM IS UNREADABLE.
 *
 * 🔑 A SUM IS ONLY AS HONEST AS ITS WEAKEST TERM. Skipping an unreadable order
 * yields a smaller number that still looks like a total, which is worse than no
 * number: the supplier reads a figure, pays it, and is still in arrears. An
 * empty set legitimately totals ₱0 — that is a real zero, not a missing one.
 */
export function sumFeeOrderTotalsPhp(
  orders: readonly FeeOrderAmountSource[],
): number | null {
  let sum = 0;
  for (const o of orders) {
    const amount = feeOrderTotalPhp(o);
    if (amount === null) return null;
    sum += amount;
  }
  return sum;
}

/*
 * 🪦 `bookingFeeNotificationCopy` LIVED HERE AND IS GONE (2026-09-20).
 *
 * It formatted with `maximumFractionDigits: 0`, so it titled a ₱837.50 bill
 * "Booking fee due — ₱838" — measured on production notification 5b5882bc, the
 * one the owner received. A supplier who pays the number they were shown pays
 * the wrong number. Its replacement is `bookingFeeNoticeCopy` in
 * `lib/booking-fee-disclosure.ts`, which formats to the centavo through
 * `feePesos` and also names the due date the old copy never carried.
 *
 * Deleted rather than fixed in place: the point of the disclosure module is
 * that there is ONE place a fee figure is formatted, and leaving a second
 * formatter here is how the two come to disagree again.
 */

/** Longest reference we store. Bank/e-wallet ids are far shorter; this is a cap, not a shape. */
export const BOOKING_FEE_REFERENCE_MAX = 64;

export type FeeReferenceResult =
  | { ok: true; reference: string }
  | { ok: false; code: 'ref_required' };

/**
 * The vendor MUST give a reference when logging their booking-fee payment
 * (owner, 2026-08-06). Deliberately required HERE only — the three
 * customer-facing payment forms stay optional, because a guest blocked at the
 * last step of buying photos simply leaves.
 *
 * Without it an admin matches a payment by amount, sender and screenshot, which
 * holds until two vendors pay the same amount on the same day. Then it is
 * guesswork, on money.
 *
 * ⚠ NO FORMAT CHECK, ON PURPOSE. The 8-character code in our own records is
 * SETNAYAN'S reference, minted by us for the vendor to quote. What the vendor
 * types here is their BANK'S id — a GCash reference, an InstaPay invoice, a BDO
 * confirmation number — and those have no common shape. A regex here would
 * reject real payments.
 *
 * ⚠ NO MINIMUM LENGTH either. Six characters is a downstream MATCHING
 * heuristic; a shorter entry is merely harder to match, not invalid, and
 * refusing it would block a vendor whose bank really did give them a short id.
 *
 * Non-empty AFTER TRIM — the same definition of "proof" the admin fees queue
 * uses, because a single space satisfies the browser's own `required`.
 */
export function requireBookingFeeReference(raw: unknown): FeeReferenceResult {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (t.length === 0) return { ok: false, code: 'ref_required' };
  return { ok: true, reference: t.slice(0, BOOKING_FEE_REFERENCE_MAX) };
}

/**
 * Every refusal this lane can produce, mapped to what the vendor reads.
 *
 * 🚨 THE PAGE USED TO RENDER `decodeURIComponent(search.error)` DIRECTLY into an
 * alert box. That was harmless only because nothing ever wrote the parameter —
 * a dead reader. The moment it has a writer, anybody can hand a vendor a link
 * that shows them any sentence they like, inside our own red warning styling,
 * on the page where they are about to send money. A fixed map is the fix: an
 * unknown code renders NOTHING.
 */
export const BOOKING_FEE_ERRORS = {
  ref_required:
    'Add the reference number from your BDO or GCash confirmation — we need it to match your payment.',
} as const;

export type BookingFeeErrorCode = keyof typeof BOOKING_FEE_ERRORS;

export function bookingFeeErrorCopy(code: string | undefined): string | null {
  if (!code) return null;
  return (BOOKING_FEE_ERRORS as Record<string, string>)[code] ?? null;
}
