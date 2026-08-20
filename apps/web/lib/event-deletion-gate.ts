/**
 * event-deletion-gate.ts — the two decisions behind removing a celebration,
 * separated from the I/O so they can actually be tested.
 *
 * They live here rather than in `delete-actions.ts` because a `'use server'`
 * module may only export async functions — a pure helper exported from one is a
 * build error, and the usual workaround (make it async) would hide these behind
 * a network round trip in the test.
 */

/**
 * Order states that mean money has actually moved. A refund still moved money.
 *
 * ⚠ `lapsed` IS IN THIS LIST AND IS NOT AN OVERSIGHT-LOOKING EXTRA. It is
 * reachable ONLY from `paid` — `lib/subscriptions.ts` is its sole writer and it
 * filters `.eq('status','paid')` — so a lapsed order is a PAID order whose
 * service later expired. Omitting it let a once-paid celebration, possibly
 * carrying a BIR receipt, be deleted by pressing a button.
 */
export const SETTLED_ORDER_STATUSES = [
  'paid',
  'fulfilled',
  'refunded',
  'lapsed',
] as const;

/**
 * 🚨 THE STATUS LIST ALONE IS NOT A GATE, BECAUSE THE COUPLE CAN CHANGE THE
 * STATUS. This is the hole that shipped with the first cut of this file.
 *
 * `cancelOrder` (app/dashboard/[eventId]/orders/actions.ts) writes
 * `status='cancelled'` with **no check on the status it is leaving**, and the
 * RLS guard behind it agrees: `orders_update_status_guard` is RESTRICTIVE with
 * `USING (user_id = auth.uid())` and a WITH CHECK that only constrains the NEW
 * value, which admits `'cancelled'`. So a couple with a PAID order could cancel
 * it — through the button or straight through PostgREST — and walk the event
 * past a gate that was looking only at the current status.
 *
 * 🔑 A GATE MUST KEY ON SOMETHING THE PERSON IT GATES CANNOT REWRITE. Payment
 * and receipt rows are that thing: a `payments` row means somebody logged a
 * transfer or uploaded a screenshot, and a `receipts` row is a BIR official
 * receipt with a sequential serial. Neither is reachable by flipping an enum on
 * the order, and both survive the cancellation.
 *
 * Same family as the repo's own "the row is yours, the field is not" sweep, and
 * the reason `vendor_agree_to_lock` asks a row's STATUS rather than trusting a
 * link's presence.
 */
export type MoneyEvidence = {
  /** Orders currently sitting in a settled state. */
  settledOrders: number | null;
  /** Payment rows against ANY of this event's orders, whatever their status. */
  paymentRows: number | null;
  /** BIR official receipts against ANY of this event's orders. */
  receiptRows: number | null;
  /**
   * Suppliers this couple has PAID whose service is not yet finished.
   *
   * ⚠ THIS IS MONEY SETNAYAN NEVER TOUCHED. The couple pays the supplier
   * directly, off-platform; the three signals above only see money paid to
   * Setnayan. A wedding can carry twelve booked suppliers, three of them paid a
   * deposit, and every Setnayan-side signal reads zero.
   *
   * Owner 2026-08-21: *"when a user decides to delete an event and they paid
   * vendors. they can only delete it if the vendors with paid purchase accepts
   * that this deletion. but if the event is already completed and they have
   * completed their service for that event, the user can delete it anytime."*
   *
   * So a supplier counts here only while BOTH halves of the release are unmet —
   * paid, and not yet finished. A supplier who took a deposit and delivered on a
   * day that has passed is settled and holds nothing.
   */
  unsettledPaidSuppliers: number | null;
};

/**
 * The only order states a BUYER may cancel — every one is pre-payment.
 *
 * 🔑 NAMED POSITIVELY, NOT AS "anything but paid". A deny-list over an
 * eight-value enum is a bill you keep paying: add a state later and it is
 * cancellable by default. This way anything unrecognised fails closed.
 *
 * Cancelling a SETTLED order is a refund request, not a cancellation, and it
 * goes through a person — not a button on the buyer's own screen.
 */
export const CANCELLABLE_ORDER_STATUSES = [
  'draft',
  'submitted',
  'awaiting_payment',
] as const;

/** Supplier states that mean really booked, not merely being considered. */
export const BOOKED_VENDOR_STATUSES = [
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
] as const;

/**
 * May this event be self-deleted, given every trace of money against it?
 *
 * 🔒 IT FAILS CLOSED ON EVERY SIGNAL, AND THAT ASYMMETRY IS THE WHOLE POINT.
 * `null` on ANY of the three means that count could not be read, and the answer
 * to "we could not check whether they paid" is no. Every OTHER number on the
 * confirmation screen degrades to "we couldn't check" and still lets the person
 * decide — because those are their own guests and their own photographs. These
 * refuse instead: a paid service is a receipt, a BIR record and a support case,
 * and it is not theirs alone to destroy. An unmeasured queue is not a clear one.
 *
 * Returns TRUE when deletion must be refused.
 */
export function deletionIsBlocked(evidence: MoneyEvidence): boolean {
  const { settledOrders, paymentRows, receiptRows, unsettledPaidSuppliers } =
    evidence;
  if (
    settledOrders === null ||
    paymentRows === null ||
    receiptRows === null ||
    unsettledPaidSuppliers === null
  ) {
    return true;
  }
  return (
    settledOrders > 0 ||
    paymentRows > 0 ||
    receiptRows > 0 ||
    unsettledPaidSuppliers > 0
  );
}

/**
 * Is this supplier released — may the couple delete without asking them?
 *
 * BOTH halves, because the owner named both: *"if the event is already completed
 * AND they have completed their service for that event"*. A supplier who marked
 * the job done for a wedding that has not happened yet has not finished it; a
 * wedding that has passed with a supplier still mid-delivery has not released
 * them either.
 *
 * ⚠ `eventHasPassed` MUST be computed on the PH-local day (`manilaTodayISO`),
 * never from the server's clock. This repo has a documented family of defects
 * where a UTC server and a Manila venue disagree by a day — a card read
 * "Tomorrow" on the morning of the wedding. Getting it wrong here decides
 * whether a supplier is asked at all.
 */
export function supplierIsReleased(args: {
  eventHasPassed: boolean;
  /** `event_vendors.completion_status` — the purpose-built signal. */
  completionStatus: string | null;
  /** `event_vendors.status` — the older booking enum. */
  vendorStatus: string | null;
}): boolean {
  // 🚨 A DISPUTE IS NEVER A RELEASE. `disputed` means the couple and the
  // supplier disagree about whether the job was done — the one state where
  // deleting the evidence is least acceptable. Checked first so no later
  // clause can override it.
  if (args.completionStatus === 'disputed') return false;

  /*
    CONFIRMED, NOT MERELY CLAIMED. The ladder is
    awaiting_vendor → vendor_marked → confirmed / auto_confirmed, and
    `vendor_marked` is the supplier SAYING they finished with nobody agreeing
    yet. Treating that as a release would let the couple delete on the
    supplier's own unconfirmed word — which is the opposite of the consent the
    owner asked for.
  */
  const done =
    args.completionStatus === 'confirmed' ||
    args.completionStatus === 'auto_confirmed' ||
    args.vendorStatus === 'delivered' ||
    args.vendorStatus === 'complete';

  return args.eventHasPassed && done;
}

/**
 * Has this supplier been paid anything for this celebration?
 *
 * FOUR SIGNALS, because the couple can record a payment four ways and any one of
 * them means real money left their hands: the booking sitting at `deposit_paid`,
 * a deposit amount, a deposit timestamp, or a logged payment row.
 *
 * ⚠ Setnayan never holds this money — the couple pays the supplier directly —
 * so every signal here is the COUPLE'S OWN RECORD of having paid. That is the
 * best evidence the platform has, and it is why the remedy is to ask the
 * supplier rather than to decide for them.
 */
export function supplierWasPaid(args: {
  vendorStatus: string | null;
  depositPaidPhp: number | null;
  depositRecordedAt: string | null;
  hasLoggedPayment: boolean;
}): boolean {
  return (
    args.vendorStatus === 'deposit_paid' ||
    (args.depositPaidPhp ?? 0) > 0 ||
    args.depositRecordedAt !== null ||
    args.hasLoggedPayment
  );
}

/**
 * Did the person type their celebration's name?
 *
 * Case- and whitespace-insensitive: this checks that somebody MEANT it, not
 * that they can reproduce capitalisation. "  cale & ice " is the same intent as
 * "Cale & Ice".
 *
 * An empty expected name can never be matched — otherwise an event with a blank
 * display name would delete on an empty box, which is the one input a stray
 * press produces.
 */
export function confirmationMatches(typed: string, eventName: string): boolean {
  const expected = eventName.trim().toLowerCase();
  if (expected.length === 0) return false;
  return typed.trim().toLowerCase() === expected;
}
