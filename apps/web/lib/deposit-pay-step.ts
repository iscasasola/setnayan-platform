/**
 * The deposit step — what a couple is told to do next about paying a supplier,
 * and whether that supplier has given them anywhere to pay.
 *
 * Owner, live on the booking run (2026-09-18): "there is no mode to pay the
 * vendor the deposit… the payment modes of the vendor must show. and an easier
 * way to pay of course."
 *
 * ⚠ NOTHING HERE MOVES MONEY. Couples pay suppliers directly, off-platform, to
 * the supplier's OWN published destinations (`vendor_payment_methods`).
 * Setnayan never holds, routes or reverses it
 * (project_setnayan_vendor_payment_disclosure). This module only decides which
 * sentence and which button a screen shows — it never invents a destination or
 * an amount.
 *
 * Pure on purpose (no `server-only`, no Supabase): every decision below is
 * executed by `deposit-pay-step.test.ts`, not grepped for.
 */
import type { ModerationStatus, PaymentMethodType } from './vendor-payment-methods';

// ---------------------------------------------------------------------------
// 1 · The couple's deposit, as ONE state.
// ---------------------------------------------------------------------------

/**
 * - `due`       — nothing recorded yet: pay the supplier, then record it.
 * - `sent`      — recorded, the supplier has not answered.
 * - `confirmed` — the supplier acknowledged it.
 * - `refused`   — the supplier said it never reached them; the couple's record
 *                 is kept and they can send it again (owner 2026-08-27).
 * - `unknown`   — the read was refused. NOT `due`: telling a couple who has
 *                 already paid to "pay your deposit" is the failure-shaped-like-
 *                 an-answer this project has shipped seven fixes for.
 */
export type DepositStep = 'due' | 'sent' | 'confirmed' | 'refused' | 'unknown';

export function depositStepOf(
  row: {
    deposit_recorded_at: string | null;
    deposit_acknowledged_at: string | null;
    deposit_declined_at?: string | null;
  } | null,
): DepositStep {
  if (!row) return 'unknown';
  // An acknowledgement outranks everything: the supplier has said yes.
  if (row.deposit_acknowledged_at) return 'confirmed';
  if (row.deposit_declined_at) return 'refused';
  if (row.deposit_recorded_at) return 'sent';
  return 'due';
}

/** The couple still has something to DO — pay and record, or send it again. */
export function depositNeedsAction(step: DepositStep): boolean {
  return step === 'due' || step === 'refused';
}

/**
 * Where the "Pay your deposit" call to action goes: the supplier's workspace,
 * on the Payments tab, at the deposit card. `?tab=payments` selects the tab in
 * the relationship shell; `#deposit` is the card's own id (`DEPOSIT_ANCHOR_ID`).
 * The flat (flag-off) workspace renders the same card on one page, so the
 * fragment alone still lands.
 */
export const DEPOSIT_ANCHOR_ID = 'deposit';

export function depositStepHref(eventId: string, vendorId: string): string {
  return `/dashboard/${eventId}/vendors/${vendorId}/workspace?tab=payments#${DEPOSIT_ANCHOR_ID}`;
}

// ---------------------------------------------------------------------------
// 2 · Can a couple see anywhere to pay this supplier? (the supplier's view)
// ---------------------------------------------------------------------------

/**
 * - `ready`      — at least one method a couple can actually see.
 * - `in_review`  — they added one, and it is waiting for Setnayan's review.
 * - `none`       — nothing a couple can see (none added, all hidden, held,
 *                  removed, or a payment LINK without an active Pro plan).
 * - `unreadable` — the read was refused. The nudge then says NOTHING: telling a
 *                  supplier "you have no payment method" when they have three is
 *                  a lie, and silence costs only a missed prompt.
 */
export type PayoutReadiness = 'ready' | 'in_review' | 'none' | 'unreadable';

export type PayoutMethodFacts = {
  method_type: PaymentMethodType;
  is_shown: boolean;
  moderation_status: ModerationStatus;
};

/**
 * The SAME visibility rule `fetchPublishedMethodsForCouple` applies — shown,
 * approved, and a link only for an active Pro supplier. If that rule changes,
 * this must change with it; `deposit-pay-step.test.ts` pins both.
 */
export function isCoupleVisible(m: PayoutMethodFacts, proActive: boolean): boolean {
  return (
    m.is_shown &&
    m.moderation_status === 'approved' &&
    (m.method_type !== 'link' || proActive)
  );
}

export function payoutReadinessOf(
  rows: ReadonlyArray<PayoutMethodFacts> | null,
  proActive: boolean,
): PayoutReadiness {
  if (rows === null) return 'unreadable';
  if (rows.some((m) => isCoupleVisible(m, proActive))) return 'ready';
  if (rows.some((m) => m.is_shown && m.moderation_status === 'pending_review')) {
    return 'in_review';
  }
  return 'none';
}

// ---------------------------------------------------------------------------
// 3 · What the couple is told when there is nothing to show.
// ---------------------------------------------------------------------------

/**
 * `listed`       — the supplier's published methods were read (possibly none).
 * `off_platform` — a supplier the couple added by hand; there is no Setnayan
 *                  shop to hold payment details.
 * `unreadable`   — the read failed. Must NOT read as "they have none".
 */
export type CouplePayMethodsState = 'listed' | 'off_platform' | 'unreadable';

/** Null when there IS something to show — the pay sheet speaks for itself. */
export function noPayMethodsSentence(
  state: CouplePayMethodsState,
  methodCount: number,
  vendorName: string,
): string | null {
  if (state === 'unreadable') {
    return `We couldn’t load ${vendorName}’s payment details just now. Refresh the page to try again.`;
  }
  if (state === 'off_platform') {
    return `${vendorName} isn’t on Setnayan, so their payment details aren’t here. Pay them the way you agreed with them.`;
  }
  if (methodCount > 0) return null;
  return `${vendorName} hasn’t added a way to pay them on Setnayan yet, so there’s nothing to show here. Ask them in chat where to send your deposit — we’ve asked them to add one.`;
}
