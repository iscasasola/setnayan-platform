/**
 * A FEE THAT OPENED AND WAS NEVER BILLED — the pure half.
 *
 * ─── The defect this module exists for ───────────────────────────────────
 * `collectBookingFeeAtLock` opens the charge through the RPC FIRST and can
 * then return `{status:'skipped'}` at FIVE later points, every one of which
 * leaves a `booking_fee_charges` row sitting `pending` with **no `orders` row
 * behind it**:
 *
 *   1 · `existing-order check unreadable: …`  (the orders read was refused)
 *   2 · `charge_unread` / the charge read's own message
 *   3 · `payer read failed: …`                (vendor_profiles was refused)
 *   4 · `order_insert_failed` / the insert's message
 *   5 · the payments insert failed — **and it DELETES the order it just made**
 *
 * The lock is already committed, the supplier is shown nothing owed, the
 * couple sees nothing, and no screen anywhere says a bill is missing. The
 * booking fee is the only revenue path this product has
 * ([[the-booking-fee-is-the-only-revenue-path]]), so "uncollected and silent"
 * is the most expensive shape it can take.
 *
 * 🔑 AND THE CATCH-UP COULD NOT HEAL IT. `maybeCatchUpAcknowledgedDeposits`
 * treats a charge in `('pending','paid','waived_import','waived_free5')` as
 * "already charged" and skips it — i.e. it skips EXACTLY the rows that need
 * repair. Its condition is "a booking with no charge at all"; this module's is
 * "a charge with no bill". Two different absences, and only one had a sweep.
 *
 * ─── Why PURE, and why everything decidable lives here ───────────────────
 * `lib/unbilled-fee-repair.server.ts` imports 'server-only', so a `tsx --test`
 * file cannot load it ([[server-only-forces-guards-to-grep-split-the-decision]]).
 * Every rule that can be got wrong — which charges are candidates, in what
 * order, when an attempt counts as billed, and what an admin is told — lives
 * in this file, where a test RUNS it instead of grepping for it.
 *
 * ⚠ THE REASON IS DERIVED AT READ TIME, NEVER STORED ON THE CHARGE.
 * The obvious home for it is the long-unused `booking_fee_charges.failed_reason`
 * column. It is a trap: `booking_fee_charges_size_the_gift` is a **BEFORE INSERT
 * OR UPDATE** trigger that re-sizes `gift_credits` / `gift_centavos` on every
 * UPDATE of a `pending` row, and for a charge with no lock stamp it re-sizes
 * against the LIVE Papic ladder. A bookkeeping write to a text column would
 * therefore be able to silently move the money the supplier is about to be
 * billed. Nothing in this repair path writes to `booking_fee_charges`.
 */

import { FEE_SETTLED_STATUSES, type DepositEffectsOutcome } from '@/lib/deposit-acknowledged-effects';

/** Statuses that mean a charge is LIVE AND OWED — the only repair candidates. */
export const REPAIRABLE_CHARGE_STATUS = 'pending';

/**
 * How many charges one claimed run may actually attempt.
 *
 * The body runs inside a Vercel `after()` budget measured in seconds. 25 is the
 * WORK cap, not the scan cap — {@link selectUnbilledCharges} is handed up to
 * {@link UNBILLED_SCAN_LIMIT} candidates and durably-unbillable ones are set
 * aside without spending any of this budget, so a head of charges that can
 * never be billed cannot wedge the ones that can.
 */
export const MAX_REPAIRS_PER_RUN = 25;

/** How many pending charges the sweep reads before it decides what to work on. */
export const UNBILLED_SCAN_LIMIT = 200;

/**
 * Past this age, "no bill yet" has stopped being a moment and become a state:
 * many claimed windows have gone by and the bill is still not there. The desk
 * says so out loud rather than repeating "retrying" forever.
 */
export const UNBILLED_STUCK_AFTER_MS = 6 * 60 * 60 * 1000;

/** The `orders.service_key` a lock-path booking fee is billed under. */
export function unbilledFeeServiceKey(chargeId: string): string {
  return `vendor_booking_fee__${chargeId}`;
}

export type PendingCharge = {
  chargeId: string;
  /** NULL for a legacy send-path charge — it has no booking row to re-run. */
  eventVendorId: string | null;
  status: string;
  /** ISO. The sweep's ordering key. */
  createdAt: string;
};

/**
 * The candidates: charges that are LIVE AND OWED with no bill behind them.
 *
 * ⚠ A WAIVED CHARGE IS NEVER A CANDIDATE, and that is the whole reason this is
 * a function rather than a `.filter()` at the call site. `waived_free5` (the
 * owner's first-five-free rule) and `waived_import` are ₱0 by construction and
 * correctly have no order; billing one would charge a supplier for a booking
 * the owner gave them. `paid`, `failed` and `expired` are equally out — a paid
 * charge has its bill, and a failed/expired one is not owed.
 *
 * ORDER IS OLDEST FIRST and is preserved from the input, which the caller reads
 * `.order('created_at', { ascending: true })`. Deterministic on purpose: the
 * old catch-up capped at 25 rows with NO ordering at all, so at scale PostgREST
 * could hand it the same arbitrary page every time and it would repair the same
 * few forever while the rest aged out of sight.
 */
export function selectUnbilledCharges(
  charges: readonly PendingCharge[],
  billedServiceKeys: Iterable<string>,
): PendingCharge[] {
  const billed = new Set(billedServiceKeys);
  return charges.filter(
    (c) => c.status === REPAIRABLE_CHARGE_STATUS && !billed.has(unbilledFeeServiceKey(c.chargeId)),
  );
}

/** What the sweep (and the desk) can read about why a charge has no bill. */
export type UnbilledFacts = {
  chargeId: string;
  eventVendorId: string | null;
  /** FALSE when the `event_vendors` row could not be found at all. */
  bookingFound: boolean;
  acknowledged: boolean;
  archived: boolean;
  /** The supplier user who would be billed; NULL on an unclaimed profile. */
  payerUserId: string | null;
  /** How long the charge has been open, in ms. */
  ageMs: number;
};

export type UnbilledCode =
  | 'send_path'
  | 'booking_missing'
  | 'not_acknowledged'
  | 'archived'
  | 'no_payer'
  | 'retrying'
  | 'stuck';

export type UnbilledVerdict = {
  code: UnbilledCode;
  /** One sentence, written for the owner. He does not read code. */
  reason: string;
  /**
   * TRUE when re-running the collector cannot possibly help — a person has to
   * act. The sweep SKIPS these (they must not eat the work budget) and the desk
   * shows them as needing attention rather than as "we are retrying".
   */
  durable: boolean;
};

/**
 * WHY THIS CHARGE HAS NO BILL — measured when someone looks, never remembered.
 *
 * A stored reason rots in both directions ([[a-registers-status-rots-in-both-directions]]):
 * it can name a cause that was fixed an hour later, and it cannot name one that
 * appeared since. Every fact here is read fresh, so the sentence on the desk is
 * true at the moment it is read.
 */
export function whyNotBilled(f: UnbilledFacts): UnbilledVerdict {
  if (!f.eventVendorId) {
    return {
      code: 'send_path',
      reason:
        'This fee was opened by the old proposal-send path, which has no booking behind it. It cannot be billed automatically — raise the bill by hand or void the charge.',
      durable: true,
    };
  }
  if (!f.bookingFound) {
    return {
      code: 'booking_missing',
      reason:
        'The booking this fee belongs to is gone, so there is nothing to bill against.',
      durable: true,
    };
  }
  if (f.archived) {
    return {
      code: 'archived',
      reason:
        'The booking was archived (rejected or withdrawn) after the fee opened. Nothing is owed — the charge should be closed.',
      durable: true,
    };
  }
  if (!f.acknowledged) {
    return {
      code: 'not_acknowledged',
      reason:
        'The supplier has not confirmed the deposit on this booking, so the fee is not due yet.',
      durable: true,
    };
  }
  if (!f.payerUserId) {
    return {
      code: 'no_payer',
      reason:
        'Nobody owns this supplier profile yet, so there is no account to send the bill to. It bills itself once the shop is claimed.',
      durable: true,
    };
  }
  if (f.ageMs >= UNBILLED_STUCK_AFTER_MS) {
    return {
      code: 'stuck',
      reason:
        'This fee opened but the bill was never raised, and repeated automatic retries have not fixed it. The supplier has been shown nothing owed. Check Sentry for deposit-acknowledged-effects.',
      durable: false,
    };
  }
  return {
    code: 'retrying',
    reason:
      'The fee opened but the bill has not been raised yet. Setnayan retries automatically; if this is still here in a few hours it is stuck.',
    durable: false,
  };
}

/**
 * Did the repair attempt actually leave a bill behind? NULL when it did; the
 * reason when it did not.
 *
 * Reuses {@link FEE_SETTLED_STATUSES} — the SAME vocabulary the acknowledge
 * judge settles on — so "billed" cannot drift between the two readers of one
 * result. All five of the collector's late skip points arrive here as
 * `status:'skipped'` carrying their own message, and that message is the reason.
 */
export function repairReason(outcome: DepositEffectsOutcome): string | null {
  if (outcome.thrown) return `threw: ${outcome.thrown}`;
  if (!outcome.eventId) return 'booking row not found';
  if (!outcome.acknowledged) return 'the deposit acknowledgement is not on the booking';
  if (!outcome.anchorId) {
    return outcome.anchorUnreadable
      ? `money row unreadable: ${outcome.anchorUnreadable}`
      : 'no money row (archived booking or orphaned cascade line)';
  }
  if (!outcome.feeEnabled) return 'the booking fee is switched off';
  if (!outcome.fee) return 'fee never attempted';
  if (FEE_SETTLED_STATUSES.has(outcome.fee.status)) return null;
  if (outcome.fee.status === 'skipped') return outcome.fee.reason ?? 'skipped with no reason given';
  if (outcome.fee.status === 'no_payer') return 'no payer — unclaimed supplier profile';
  return `unknown fee status: ${outcome.fee.status}`;
}

/** Everything the orchestrator below needs from the world. Injected, so a test drives it. */
export type RepairIo = {
  /** Pending charges, oldest first, already capped at {@link UNBILLED_SCAN_LIMIT}. */
  listPendingCharges(): Promise<PendingCharge[]>;
  /** Which of these service keys already have an `orders` row. */
  listBilledServiceKeys(keys: readonly string[]): Promise<string[]>;
  /** Fresh facts for the candidates, keyed by chargeId. */
  gatherFacts(charges: readonly PendingCharge[]): Promise<Map<string, UnbilledFacts>>;
  /** Run the acknowledge effects for one booking — the ONE path to the collector. */
  runEffects(eventVendorId: string): Promise<DepositEffectsOutcome>;
  /** Told about every charge left unbilled, so the failure is never only a silence. */
  report(chargeId: string, reason: string): void;
};

export type RepairSummary = {
  /** Candidates found (before the work cap). */
  candidates: number;
  /** Charges a collector run was actually attempted for. */
  attempted: number;
  /** Charges that came out of the attempt WITH a bill. */
  billed: number;
  /** Charges still unbilled afterwards, durable causes included. */
  unbilled: number;
};

/**
 * Re-mint the missing bills. IDEMPOTENT BY CONSTRUCTION, TWICE OVER:
 *
 *  · the RPC behind the collector returns the SAME live charge on a re-run
 *    (reused, same frozen ordinal), so a repair never opens a second fee; and
 *  · `orders_booking_fee_one_bill_per_charge` (PR #5727) makes a second bill
 *    for one charge impossible at the DATABASE, which the collector reports as
 *    `already_billed` — a 23505 is SUCCESS here, not an error.
 *
 * So "repaired twice" and "repaired once" are the same end state: one bill.
 *
 * ⚠ IT DOES NOT BILL ANYTHING NEW. Every charge it touches already exists and
 * is already owed; the sweep only finishes a job that stopped half way. When a
 * fee opens, the fee schedule and the free-five rule are untouched by this file.
 */
export async function repairUnbilledCharges(io: RepairIo): Promise<RepairSummary> {
  const pending = await io.listPendingCharges();
  const billedKeys = await io.listBilledServiceKeys(pending.map((c) => unbilledFeeServiceKey(c.chargeId)));
  const candidates = selectUnbilledCharges(pending, billedKeys);
  const summary: RepairSummary = { candidates: candidates.length, attempted: 0, billed: 0, unbilled: 0 };
  if (candidates.length === 0) return summary;

  const facts = await io.gatherFacts(candidates);

  for (const charge of candidates) {
    // A durable cause cannot be fixed by running the collector again, so it
    // never spends the work budget. This is what stops the sweep re-walking a
    // head of permanently-unbillable rows forever and never reaching the
    // repairable ones behind them — the exact failure the 25-row cap had.
    const fact = facts.get(charge.chargeId);
    if (fact) {
      const verdict = whyNotBilled(fact);
      if (verdict.durable) {
        summary.unbilled += 1;
        io.report(charge.chargeId, verdict.reason);
        continue;
      }
    }

    if (summary.attempted >= MAX_REPAIRS_PER_RUN) break;
    // `eventVendorId` is non-null here: a null one is `send_path`, which is
    // durable and was set aside above. The guard keeps that true by code.
    if (!charge.eventVendorId) continue;

    summary.attempted += 1;
    const outcome = await io.runEffects(charge.eventVendorId);
    const reason = repairReason(outcome);
    if (reason === null) {
      summary.billed += 1;
    } else {
      summary.unbilled += 1;
      io.report(charge.chargeId, reason);
    }
  }

  return summary;
}
