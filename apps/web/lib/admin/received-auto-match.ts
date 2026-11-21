/**
 * lib/admin/received-auto-match.ts — which received BDO rows may match BY
 * THEMSELVES, and when a held match may pay.
 *
 * Phase 2 of the admin batch match. Owner rulings, specs DECISION_LOG 2026-11-17:
 *
 *   "Admin bulk matching: exact matches AUTO-APPROVE (narrow exception to the
 *    2026-07-11 'reader may PREPARE, never APPROVE' rule)" — and the row that
 *    closes its conditions, "limits APPROVED, undo 30 minutes":
 *     (1) only the owner's OWN received screenshots; a buyer's photo never approves;
 *     (2) the WHOLE reference AND the exact amount agree with exactly ONE unpaid
 *         payment; code compares, never a model yes/no;
 *     (3) BDO: the FULL InstaPay invoice number at the end of the BDO reference
 *         counts as the whole reference, never a shorter piece;
 *     (4) money whose screenshot time is earlier than the order is held for a
 *         manual match;
 *     (5) Undo stays 30 minutes, then the payment opens like any other;
 *     (6) "N matched by themselves" reaches him by the on-screen toast and the
 *         Focus list only, no new email.
 *   "a self-match HOLDS 30 minutes then pays" — the match is recorded, waits,
 *    Undo inside the window cancels cleanly, and only then the normal approve.
 *   "leftovers are matched by hand" — everything this module declines stays in
 *    the hand-match pile, exactly as phase 1 draws it.
 *
 * Pure: no database, no model, no clock of its own (`now` is handed in). Every
 * decision that can let money through is here, where a test RUNS it.
 *
 * 🔑 THE DEFAULT IS "NO". Each check below can only send a row to the hand pile.
 * Nothing in this file can widen what matches by itself; a missing field — a
 * reference, an amount, a time, an order date — is a "no", never a guess.
 */
import { compareReferences, normalizeReference, MIN_CONTAINMENT_LENGTH } from '@/lib/payment-reference-match';
import type { WaitingPayment } from '@/lib/admin/received-match';

/** Ruling (5): the Undo window, and the hold before the normal approve runs. */
export const AUTO_MATCH_HOLD_MS = 30 * 60 * 1000;

/**
 * The InstaPay invoice inside our BDO record: the trailing run of digits with
 * its zero padding taken off. `GXCHPHM2XXXB000000006991560` → `6991560`.
 * (Shape measured live 2026-07-31; lib/payment-proof-scan.ts names the parts.)
 */
export function fullInvoiceOf(receivedNorm: string | null): string | null {
  if (!receivedNorm) return null;
  const run = /(\d+)$/.exec(receivedNorm)?.[1];
  if (!run) return null;
  const invoice = run.replace(/^0+/, '');
  return invoice === '' ? null : invoice;
}

/**
 * Rulings (2) + (3): does the buyer's reference name this transfer WHOLLY?
 *   · the same reference, character for character (after spaces/case); or
 *   · the FULL InstaPay invoice — every digit after the zero padding.
 * A tail of the invoice ("991560" of "6991560") is a shorter piece and is NO.
 *
 * The floor of {@link MIN_CONTAINMENT_LENGTH} characters is the repo's existing
 * "too short to be evidence" line; it can only refuse.
 */
export function isWholeReference(receivedNorm: string | null, buyerReference: string | null): boolean {
  const buyer = normalizeReference(buyerReference);
  if (!receivedNorm || buyer.length < MIN_CONTAINMENT_LENGTH) return false;
  if (buyer === receivedNorm) return true;
  if (!/^\d+$/.test(buyer)) return false;
  const invoice = fullInvoiceOf(receivedNorm);
  return invoice !== null && invoice.length >= MIN_CONTAINMENT_LENGTH && buyer.replace(/^0+/, '') === invoice;
}

export type AutoOpenRow = {
  received_id: number;
  reference: string | null;
  reference_norm: string | null;
  amount_php: number | null;
  received_at: string | null;
  read_status: 'read' | 'unreadable';
  left_reason: 'later' | 'not_setnayan' | null;
  /** Set once an admin pressed Undo (or a release could not pay). Never auto again. */
  auto_undone_at: string | null;
};

/** A payment that already counts as money — a reused screenshot would name it too. */
export type CountedPayment = { payment_id: string; reference_number: string | null };

/** Why a row stays in the hand pile. One plain line each; the test reads them. */
export type HandReason =
  | 'unreadable'
  | 'not_setnayan'
  | 'undone_before'
  | 'no_reference'
  | 'no_amount'
  | 'no_time'
  | 'no_whole_reference'
  | 'two_payments_named'
  | 'amount_differs'
  | 'no_order_time'
  | 'before_order'
  | 'payment_claimed_twice'
  | 'already_counted';

export type AutoPlan = {
  /** Record these as automatic matches and hold them 30 minutes. */
  holds: Array<{ received_id: number; payment_id: string }>;
  /** Everything else, and the first reason it stayed with a person. */
  hand: Array<{ received_id: number; reason: HandReason }>;
};

const cents = (n: number) => Math.round(n * 100);

/**
 * Which open received rows match by themselves. Every condition is a ruling;
 * the three marked "safe reading" are where the wording left a choice and the
 * choice that sends MORE to a person was taken (listed as owner questions):
 *
 *   · no time read off the screenshot → cannot show (4) holds → hand;
 *   · two received rows naming the same payment wholly → neither (exactly ONE);
 *   · the reference already counts on a matched payment → hand (a reused picture).
 *
 * `waiting` must be the UNPAID payments not already under a hold.
 */
export function planAutoMatches(args: {
  open: readonly AutoOpenRow[];
  waiting: readonly WaitingPayment[];
  counted: readonly CountedPayment[];
}): AutoPlan {
  const { open, waiting, counted } = args;
  const holds: AutoPlan['holds'] = [];
  const hand: AutoPlan['hand'] = [];
  const no = (received_id: number, reason: HandReason) => hand.push({ received_id, reason });

  // Pass 1 — each row on its own.
  const named = new Map<number, WaitingPayment>();
  for (const r of open) {
    if (r.read_status !== 'read') { no(r.received_id, 'unreadable'); continue; }
    if (r.left_reason === 'not_setnayan') { no(r.received_id, 'not_setnayan'); continue; }
    if (r.auto_undone_at) { no(r.received_id, 'undone_before'); continue; }
    if (!r.reference_norm) { no(r.received_id, 'no_reference'); continue; }
    if (r.amount_php == null) { no(r.received_id, 'no_amount'); continue; }
    if (!r.received_at) { no(r.received_id, 'no_time'); continue; }

    // Exactly ONE unpaid payment may name this transfer wholly — at ANY amount,
    // so a second payment carrying the same reference is a question, not noise.
    const whole = waiting.filter((p) => isWholeReference(r.reference_norm, p.reference_number));
    if (whole.length === 0) { no(r.received_id, 'no_whole_reference'); continue; }
    if (whole.length > 1) { no(r.received_id, 'two_payments_named'); continue; }
    const p = whole[0]!;
    if (cents(p.amount_php) !== cents(r.amount_php)) { no(r.received_id, 'amount_differs'); continue; }
    if (!p.order_created_at) { no(r.received_id, 'no_order_time'); continue; }
    if (Date.parse(r.received_at) < Date.parse(p.order_created_at)) { no(r.received_id, 'before_order'); continue; }
    if (counted.some((c) => compareReferences(r.reference_norm, c.reference_number) !== 'none')) {
      no(r.received_id, 'already_counted');
      continue;
    }
    named.set(r.received_id, p);
  }

  // Pass 2 — exactly ONE received row may claim a payment.
  const claims = new Map<string, number>();
  for (const p of named.values()) claims.set(p.payment_id, (claims.get(p.payment_id) ?? 0) + 1);
  // A row that failed pass 1 only on its time or amount still NAMES the payment;
  // it must also block, or a duplicate screenshot with no time would let its twin through.
  for (const r of open) {
    if (named.has(r.received_id) || r.read_status !== 'read' || r.left_reason === 'not_setnayan' || !r.reference_norm) continue;
    for (const p of waiting) {
      if (isWholeReference(r.reference_norm, p.reference_number)) claims.set(p.payment_id, (claims.get(p.payment_id) ?? 0) + 1);
    }
  }
  for (const [received_id, p] of named) {
    if ((claims.get(p.payment_id) ?? 0) > 1) no(received_id, 'payment_claimed_twice');
    else holds.push({ received_id, payment_id: p.payment_id });
  }
  return { holds, hand };
}

/** Ruling (5): Undo is open strictly inside the 30 minutes. */
export function undoIsOpen(matchedAtIso: string, now: Date): boolean {
  return now.getTime() - Date.parse(matchedAtIso) < AUTO_MATCH_HOLD_MS;
}

/** The hold is over and the normal approve may run. Exactly the complement of {@link undoIsOpen}. */
export function holdIsDue(matchedAtIso: string, now: Date): boolean {
  return !undoIsOpen(matchedAtIso, now);
}

/** The cut-off an SQL filter uses: a hold matched at or before this is due. */
export function dueCutoffIso(now: Date): string {
  return new Date(now.getTime() - AUTO_MATCH_HOLD_MS).toISOString();
}

/** "Pays at 10:42 AM" — Manila, the only clock the admin's BDO app shows. */
export function paysAtLabel(matchedAtIso: string): string {
  return new Date(Date.parse(matchedAtIso) + AUTO_MATCH_HOLD_MS).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The row state Undo puts back. A hold changes ONLY these four fields (never
 * `left_reason`, never the payment), so clearing them is the earlier state —
 * plus the `auto_undone_at` stamp that keeps the next drop from redoing it.
 */
export const HOLD_FIELDS = ['matched_payment_id', 'match_kind', 'matched_at', 'matched_by'] as const;

export function undoPatch(nowIso: string): Record<(typeof HOLD_FIELDS)[number], null> & { auto_undone_at: string } {
  return { matched_payment_id: null, match_kind: null, matched_at: null, matched_by: null, auto_undone_at: nowIso };
}

export function holdPatch(paymentId: string, userId: string, nowIso: string) {
  return { matched_payment_id: paymentId, match_kind: 'auto' as const, matched_at: nowIso, matched_by: userId };
}
