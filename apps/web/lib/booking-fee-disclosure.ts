/**
 * THE SUPPLIER IS TOLD ABOUT THE BOOKING FEE — before they owe it, and then
 * where they already are. PURE (no database, no `server-only`), so every number
 * and every sentence is unit-testable and cannot be re-typed at a call site.
 *
 * ─── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * Owner, 2026-09-20, having just driven a real booking end to end as the
 * supplier Saysay and been billed ₱837.50:
 *   · *"i never saw the payment screen to pay us."*
 *   · *"as a vendor i do not know i have to pay."*
 *
 * Both measured the same day. The bill was real (`orders`
 * 7d1a014d-54ec-4e66-b882-03a085f5f7ca, ₱837.50, charge S89F-HMS91HGPAK) and
 * `/vendor-dashboard/booking-fees` renders it correctly — but the ONLY link to
 * that page in the whole supplier product was one tile on
 * `/vendor-dashboard/subscription`, and NOTHING anywhere told a shop the fee
 * existed before the charge appeared.
 *
 * 🔑 A FEE THE SUPPLIER LEARNS ABOUT FROM THE BILL IS INDISTINGUISHABLE FROM A
 * SURPRISE CHARGE. The disclosure and the bill are two halves of one mechanism;
 * having only the second is how you lose the supplier, not the money.
 *
 * ─── THE ONE QUOTER RULE ───────────────────────────────────────────────────
 * Every number printed by every surface below comes from `bookingFeePhp` +
 * `isFreeBooking` — the same two pure primitives `decideLockFee` composes and
 * the SQL mirror `public.booking_fee_centavos` is pinned against. NOTHING here
 * re-types a rate, a band or a floor.
 *
 * ⚠ AND WHEN THE NUMBER CANNOT BE COMPUTED, IT IS NOT GUESSED. A `standing` of
 * `'unreadable'` renders a sentence that says so and names where the live
 * figure lives. Owner, 2026-08-31, on a money default that shipped labelled as
 * a guess: **"don't guess."** A label on an invention does not make it safe.
 */

import {
  bookingFeePhp,
  bookingFeeScheduleSummary,
  type BookingFeeSchedule,
} from '@/lib/booking-fee';
import { FREE_BOOKING_LIMIT, isFreeBooking } from '@/lib/booking-fee-lock';
import { monthDay } from '@/lib/format-date';
import { feeEnforcementSentence } from '@/lib/event-access-stage';

/* ═══════════════════════════════════════════════════════════════════════════
   1 · WHERE A SUPPLIER STANDS WITH THE FEE, ON ONE BOOKING
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The supplier's fee position on ONE prospective or agreed booking.
 *
 * Mirrors the arms of `booking_fee_open_lock_charge` in the order that RPC
 * takes them, so a reader can check the two side by side:
 *   · `silent`      — the fee system is dark, or this is not a billable shape
 *                     (off-platform shop, covered package row). Say NOTHING.
 *   · `not_sourced` — attribution 'import': the couple did not come from
 *                     Setnayan, so there is no fee, ever, on this booking.
 *   · `free`        — inside the free-5 (`booking_ordinal <= 5`).
 *   · `billable`    — booking 6+; the live schedule prices it.
 *   · `unreadable`  — a read was refused. NOT "free", NOT "₱0".
 */
export type BookingFeeStanding =
  | { kind: 'silent' }
  | { kind: 'not_sourced' }
  /**
   * Inside the free-5. ⚠ CARRIES THE SCHEDULE, like `billable` — owner,
   * 2026-09-20: *"still tell them that there should be a booking fee. but this
   * will be considered free."* A free booking must NAME the amount it would
   * have cost, so the first payable one is not a surprise. Without the schedule
   * here that number cannot be computed, and the copy would fall back to a bare
   * "Free" — the exact thing the owner ruled against.
   */
  | { kind: 'free'; ordinal: number; ordinalIsFrozen: boolean; schedule: BookingFeeSchedule }
  | { kind: 'billable'; ordinal: number; ordinalIsFrozen: boolean; schedule: BookingFeeSchedule }
  | { kind: 'unreadable' };

/**
 * Two lines of supplier-facing copy plus the tone the mount renders it in.
 * `null` from any producer below means RENDER NOTHING — silence is the honest
 * rendering of "no fee here", never a "₱0" that advertises an absence.
 */
export type FeeDisclosure = {
  headline: string;
  detail: string;
  tone: 'good' | 'info' | 'due' | 'overdue';
};

/** How many free bookings are left AFTER the one at `ordinal`. Pure. */
export function freeBookingsLeftAfter(ordinal: number): number {
  if (!Number.isFinite(ordinal) || ordinal < 1) return 0;
  return Math.max(0, FREE_BOOKING_LIMIT - Math.floor(ordinal));
}

/**
 * " — 4 more free bookings after this one", or " — and this is the last of
 * them". ONE clause, used by the forecast (before the booking) and by the
 * waived receipt (after it), so the count the supplier is promised on the
 * Agree button is the count their receipt confirms.
 */
export function freeBookingsLeftClause(ordinal: number): string {
  const left = freeBookingsLeftAfter(ordinal);
  if (left <= 0) return ' — and this is the last of them';
  return ` — ${left} more free ${left === 1 ? 'booking' : 'bookings'} after this one`;
}

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * A peso figure the supplier will be billed, to the CENTAVO.
 *
 * 🔴 NOT ROUNDED TO THE PESO. The existing in-app notification titled the
 * ₱837.50 bill "Booking fee due — ₱838" (measured in production, notification
 * 5b5882bc, 2026-09-20) because its formatter carried `maximumFractionDigits:
 * 0`. A supplier who pays the number they were shown pays the wrong number, and
 * an admin matching by amount then has a mismatch on money. Every fee figure in
 * this file goes through here.
 */
export function feePesos(amountPhp: number): string {
  if (!Number.isFinite(amountPhp)) return PESO.format(0);
  return PESO.format(amountPhp);
}

/** The effective rate as display copy ("5.0%") — derived, never typed. */
function effectiveRateText(feePhp: number, totalPhp: number): string | null {
  if (!Number.isFinite(feePhp) || !Number.isFinite(totalPhp) || totalPhp <= 0) return null;
  return new Intl.NumberFormat('en-PH', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(feePhp / totalPhp);
}

/**
 * WHERE THIS BOOKING SITS in the free-5, as one sentence.
 *
 * 🔑 `frozen` IS NOT COSMETIC. Once a booking is agreed, the ordinal is stamped
 * on `booking_fee_ledger.booking_ordinal` and never moves — that is a fact. For
 * a quote still being written there is no ledger row yet, so the position is a
 * PROJECTION of what the RPC will assign (its own `count(*)` over the vendor's
 * lock ledger rows, mirrored in `resolveBookingFeeStanding`). Another booking
 * agreed in between moves it. The two are worded differently rather than the
 * projection being presented as a fact.
 */
function feePositionSentence(ordinal: number, frozen: boolean, free: boolean): string {
  const where = frozen
    ? `This is booking ${ordinal} of your first ${FREE_BOOKING_LIMIT} on Setnayan`
    : `This would be booking ${ordinal} of your first ${FREE_BOOKING_LIMIT} on Setnayan`;
  // ⚠ ONE CLAUSE, SHARED WITH THE RECEIPT. `freeBookingsLeftClause` is what
  // `waivedFeeCopy` also reads, so the count promised before the booking is the
  // count confirmed after it — this used to be typed out twice.
  if (free) return `${where}, which are free${freeBookingsLeftClause(ordinal)}.`;
  return frozen
    ? `Your first ${FREE_BOOKING_LIMIT} Setnayan bookings were free; this is number ${ordinal}.`
    : `Your first ${FREE_BOOKING_LIMIT} Setnayan bookings were free; this would be number ${ordinal}.`;
}

/**
 * The fee this booking WOULD incur — the line shown while the supplier is still
 * deciding (the quote composer) or about to agree (the Agree button).
 *
 * `totalPhp` is the agreed total NOW (`agreedTotalNow`), which is the figure
 * `booking_fee_open_lock_charge` itself prices: `total_cost_php` plus the
 * change deltas. A preview against anything else would quote a fee the bill
 * will not match.
 *
 * Returns `null` ONLY for `silent` — every other standing has something true
 * and useful to say, including the one where the read failed.
 */
export function bookingFeeForecast(
  standing: BookingFeeStanding,
  totalPhp: number | null,
): FeeDisclosure | null {
  switch (standing.kind) {
    case 'silent':
      return null;

    case 'not_sourced':
      return {
        tone: 'good',
        headline: 'No Setnayan booking fee on this booking.',
        detail:
          'This client did not come from Setnayan, so they are yours free — ' +
          'imported and returning clients never carry a fee.',
      };

    /*
     * ⚠ THE FREE AND BILLABLE ARMS SHARE ONE LINE SHAPE, DELIBERATELY:
     *
     *     Booking fee ₱508.50 — waived.        (inside the free-5)
     *     Booking fee ₱837.50 — payable…       (booking 6+)
     *
     * Owner, 2026-09-20: *"still tell them that there should be a booking fee.
     * but this will be considered free. or something like this."* A free
     * booking that says only "Free" teaches the supplier there is no fee, and
     * the sixth booking then arrives as a surprise charge — which is the whole
     * defect this module exists to remove, deferred by five bookings.
     *
     * 🔑 Both numbers come from the SAME `bookingFeePhp` call. The waived amount
     * is not a marketing figure: it is what `computed_fee_centavos` will hold on
     * the charge (prod's waived row carries 50850 against
     * `amount_charged_centavos` 0), so the forecast and the record agree.
     */
    case 'free':
    case 'billable': {
      const free = standing.kind === 'free';
      const summary = bookingFeeScheduleSummary(standing.schedule);
      const position = feePositionSentence(standing.ordinal, standing.ordinalIsFrozen, free);
      const total = Number(totalPhp);
      // ⚠ NO AMOUNT ⇒ SAY SO, NEVER A BARE "Free". The position and the schedule
      // are still true and still worth reading; only the figure is missing.
      if (!Number.isFinite(total) || total <= 0) {
        return {
          tone: free ? 'good' : 'info',
          headline: free
            ? 'Booking fee — waived (we could not work out the amount yet).'
            : 'Booking fee — payable when they book (we could not work out the amount yet).',
          detail: `${position} The fee is ${summary} of the agreed total; put a price on this quote and we will show you the exact figure.`,
        };
      }
      const fee = bookingFeePhp(total, standing.schedule);
      const rate = effectiveRateText(fee, total);
      return {
        tone: free ? 'good' : 'info',
        headline: free
          ? `Booking fee ${feePesos(fee)} — waived.`
          : `Booking fee ${feePesos(fee)}${rate ? ` (${rate})` : ''} — payable if they book.`,
        detail: free
          ? `${position} ${summary} of the agreed total of ${feePesos(total)} — you are not billed for this one.`
          : `${position} ${summary}, on the agreed total of ${feePesos(total)}. You are billed when the booking is agreed, and you pay it on the same GCash/BDO rail your couples use.`,
      };
    }

    case 'unreadable':
      return {
        tone: 'info',
        headline: 'We could not work out your booking fee just now.',
        detail:
          'Rather than show you a rate we have not checked, we would rather say so. ' +
          'Your Booking fees page always carries the live amount.',
      };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   1b · A WAIVED CHARGE THAT ALREADY EXISTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * One `booking_fee_charges` row with `status = 'waived_free5'`.
 *
 * 🔴 THESE WERE INVISIBLE. `/vendor-dashboard/booking-fees` lists ORDERS, and a
 * waived charge mints NO order (`collectBookingFeeAtLock` returns `'free'`
 * before the insert) — so a supplier's free bookings appeared on no supplier
 * surface at all. The fee they did not pay was as hidden as the fee they did.
 *
 * ⚠ `computedPhp` is `computed_fee_centavos` off the row — a REAL recorded
 * number (prod's waived charge carries 50850 = ₱508.50), not a figure this
 * module works out. Null when the column could not be read, and the copy then
 * prints no number at all.
 *
 * ⚠ `ordinal` is `booking_fee_ledger.booking_ordinal`, the position the RPC
 * stamped — never a count derived on this side (owner's instruction, and the
 * reason the fetch joins the ledger rather than counting rows).
 */
export type WaivedFeeCharge = {
  chargeId: string;
  eventId: string | null;
  coupleName: string | null;
  /** `computed_fee_centavos` ÷ 100 — what it WOULD have cost. Null ⇒ print none. */
  computedPhp: number | null;
  /** `booking_fee_ledger.booking_ordinal`. Null ⇒ the position is not claimed. */
  ordinal: number | null;
  /** `YYYY-MM-DD` the charge was opened, or null. */
  waivedOn: string | null;
};

/**
 * THE WAIVED LINE, wherever a waived charge is shown after the fact.
 *
 * Same rule as the forecast and for the same reason: name the amount, then say
 * it was waived and why. A row that reads only "Free" is refused by the guard.
 */
export function waivedFeeCopy(charge: WaivedFeeCharge): FeeDisclosure {
  const who = charge.coupleName?.trim() ? ` for ${charge.coupleName.trim()}` : '';
  // ⚠ HOW MANY ARE LEFT IS PART OF THE POSITION, not a separate sentence bolted
  // on by one caller. The in-app row and the emailed receipt read this SAME
  // function, so "4 more free bookings after this one" cannot say one thing on
  // the fee hub and another in the supplier's inbox. Only claimed when the
  // ledger gave a real ordinal — `freeBookingsLeftAfter(null)` is not a number
  // anyone measured.
  const position =
    typeof charge.ordinal === 'number' && Number.isFinite(charge.ordinal)
      ? `This was booking ${charge.ordinal} of your first ${FREE_BOOKING_LIMIT} on Setnayan, which are free${freeBookingsLeftClause(charge.ordinal)}.`
      : `It fell inside your first ${FREE_BOOKING_LIMIT} Setnayan bookings, which are free.`;
  // ⚠ NO NUMBER ⇒ NO NUMBER. An unreadable computed amount must not degrade to
  // "₱0" — that would state the fee was nothing rather than that it was waived.
  const amount =
    typeof charge.computedPhp === 'number' && Number.isFinite(charge.computedPhp)
      ? feePesos(charge.computedPhp)
      : null;
  return {
    tone: 'good',
    headline: amount
      ? `Booking fee ${amount} — waived${who}`
      : `Booking fee — waived${who} (we could not read the amount)`,
    detail: amount
      ? `${position} You were not billed the ${amount}, and nothing is owed on it.`
      : `${position} Nothing is owed on it.`,
  };
}

/**
 * THE RECEIPT — the in-app notification and the email for a waived charge.
 * Owner, 2026-09-20: *"yes, add the email receipt for waived bookings."*
 *
 * 🔑 IT COMPOSES {@link waivedFeeCopy}; IT DOES NOT RE-WRITE IT. The fee hub's
 * "Waived — your first 5" row and the sentence that lands in the supplier's
 * inbox come out of ONE function, so the amount, the position and the count of
 * free bookings left cannot say different things in the two places. The email
 * SUBJECT is `title` verbatim (emitNotification passes it straight to Resend),
 * so the subject line carries the real centavo figure — not the rounded one
 * that titled a ₱837.50 bill "₱838" in production.
 *
 * ⛔ IT IS A RECEIPT, NOT A BILL. No "pay", no "due", no "owed" in the
 * asking direction — the only mention of owing is the sentence saying nothing
 * is. The supplier has no action to take and the copy must never imply one;
 * `the-waived-fee-sends-a-receipt.test.ts` scans for the bill vocabulary.
 *
 * ⚠ AND AN UNREADABLE AMOUNT PRINTS NO NUMBER. That branch is inherited whole
 * from `waivedFeeCopy` for exactly this reason: a receipt that says "₱0 waived"
 * tells a shop their booking was worthless, and it is the shape the free-5
 * disclosure lane exists to remove.
 */
export function waivedFeeReceiptCopy(charge: WaivedFeeCharge): {
  title: string;
  body: string;
} {
  const copy = waivedFeeCopy(charge);
  return {
    title: copy.headline,
    body:
      `${copy.detail} This is your receipt — there is nothing to pay. ` +
      'Your Booking fees page lists every Setnayan booking fee you have had, waived and billed.',
  };
}

/**
 * The line a shop reads when it OPENS — the disclosure the owner asked for
 * first: *"as a vendor i do not know i have to pay."*
 *
 * `schedule` null means the live settings read failed. The sentence then names
 * the two facts that are CONSTANTS in code (joining is free; the first five
 * sourced bookings are free) and says plainly that it cannot quote today's
 * rate. It does not fall back to a printed 5%.
 */
export function bookingFeeJoinDisclosure(
  schedule: BookingFeeSchedule | null,
): FeeDisclosure {
  return {
    tone: 'info',
    headline: 'Opening your shop is free, and running it stays free.',
    detail: schedule
      ? `You only pay Setnayan when a couple books you THROUGH Setnayan — and your first ${FREE_BOOKING_LIMIT} of those are free. After that the booking fee is ${bookingFeeScheduleSummary(schedule)} of the agreed total. Clients you bring yourself are always free.`
      : `You only pay Setnayan when a couple books you THROUGH Setnayan — and your first ${FREE_BOOKING_LIMIT} of those are free. We could not load today's booking-fee rate on this page; it is shown in full before you agree to any booking. Clients you bring yourself are always free.`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE BILL, ONCE IT EXISTS — WHICH SURFACES SHOW IT
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * THE SURFACES A DUE BOOKING FEE MUST REACH.
 *
 * 🔴 BEFORE THIS, THERE WAS ONE: `/vendor-dashboard/subscription`. The Today
 * page, the client page for the booking being billed, and the money pages all
 * said nothing — so a supplier who never opened the subscription tab never
 * learned they owed Setnayan anything.
 *
 * This array is the decision AND the checklist: `the-fee-finds-the-supplier`
 * counts one mount per entry, so deleting a mount fails rather than going
 * quietly back to one doorway.
 *
 * ⚠ EVERY ENTRY IS A SUPPLIER SURFACE. There is deliberately no couple entry —
 * the supplier's fee is not the couple's business and must never appear on a
 * `app/dashboard/**` screen. `bothEndsOfTheFee` below is the executable half of
 * that sentence.
 */
export const BOOKING_FEE_BILL_SURFACES = ['today', 'client', 'earnings'] as const;
export type BookingFeeBillSurface = (typeof BOOKING_FEE_BILL_SURFACES)[number];

/** One unpaid booking-fee bill, in the shape every surface renders. */
export type DueFeeBill = {
  /** `orders.order_id` — the pay page is keyed on it. */
  orderId: string;
  /** What is owed, to the centavo. */
  amountPhp: number;
  /** The couple's event, so the client page can show only its own. */
  eventId: string | null;
  /** Who it is for, as the supplier knows them. Null when unresolved. */
  coupleName: string | null;
  /** `booking_fee_charges.expires_at` as `YYYY-MM-DD`, or null when unknown. */
  dueOn: string | null;
};

/**
 * THE DECISION: which of a supplier's due bills does `surface` show?
 *
 * PURE and total — the page passes what it read and gets back what to render,
 * so "a supplier with no pending fee sees none of it" is one assertion over
 * this function rather than three page reads.
 *
 * · `today` / `earnings` — every due bill this shop holds.
 * · `client`             — only the bill for THAT couple's event. A bill with
 *                          no `eventId` appears on neither client page: it
 *                          belongs to no couple, and guessing which would put
 *                          one couple's money on another's page.
 */
export function billsForSurface(
  bills: readonly DueFeeBill[],
  surface: BookingFeeBillSurface,
  ctx: { eventId?: string | null } = {},
): DueFeeBill[] {
  const list = bills.filter((b) => Number.isFinite(b.amountPhp) && b.amountPhp > 0);
  if (surface !== 'client') return list;
  const eventId = ctx.eventId ?? null;
  if (!eventId) return [];
  return list.filter((b) => b.eventId === eventId);
}

/** Sum of what a shop owes Setnayan right now, to the centavo. */
export function totalDuePhp(bills: readonly DueFeeBill[]): number {
  const sum = bills.reduce(
    (acc, b) => acc + (Number.isFinite(b.amountPhp) && b.amountPhp > 0 ? b.amountPhp : 0),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3 · OVERDUE — WHAT IS ACTUALLY TRUE WHEN THE DATE PASSES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * How close a bill is to its due date. Day-precision, compared as STRINGS
 * (`YYYY-MM-DD` against `phToday()`) — never via `new Date('2026-09-27')`,
 * which is midnight UTC and therefore the 26th in Manila.
 */
export type FeeDueStage = 'due' | 'soon' | 'last_day' | 'overdue';

/** Days between two `YYYY-MM-DD` strings, `to - from`. Null if either is unparseable. */
function daysBetween(fromYmd: string, toYmd: string): number | null {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** The escalation stage for one bill. Unknown due date → the plain 'due'. */
export function feeDueStage(dueOn: string | null, todayPh: string): FeeDueStage {
  if (!dueOn) return 'due';
  const days = daysBetween(todayPh, dueOn);
  if (days === null) return 'due';
  if (days < 0) return 'overdue';
  if (days === 0) return 'last_day';
  if (days <= 3) return 'soon';
  return 'due';
}

/**
 * THE OVERDUE SENTENCE — and why it promises what is actually true.
 *
 * 🔑 MEASURED 2026-09-20, NOT ASSUMED. `booking_fee_charges.expires_at` is
 * WRITTEN (`NOW() + INTERVAL '7 days'`) and READ BY NOTHING:
 *   · `cron.job` on production is EMPTY — this repo has no scheduler, by design;
 *   · no TypeScript reads the column (`grep expires_at` over lib/ and app/);
 *   · the only writer of `status = 'expired'` is the AMENDMENT re-derive path
 *     (`booking_fee_rederive_on_amendment`), which supersedes a charge when the
 *     price changes — it is not a deadline;
 *   · access to the BOOKING (is this shop booked at all) comes from
 *     `lock_request_state = 'agreed'` (`lib/vendor-room-access-rule.ts`) and
 *     does not consult the fee at all, ever — that surface is unrelated to
 *     the fee by design (folding it in would punish the couple for their
 *     supplier's unpaid bill).
 *
 * ⇒ RECONCILED 2026-09-20 with `claude/fee-unlocks-the-event`: a SEPARATE
 * question — can this shop reach an unsettled booking's DETAILS and day-of
 * tools — now has a real, flag-gated answer in `eventAccessUnlocked`
 * (`lib/event-access-stage.ts`). `feeEnforcementSentence` there is the ONE
 * place that reads `NEXT_PUBLIC_FEE_UNLOCKS_EVENT` and states the consequence
 * that is true for the CURRENT flag state — off ⇒ "not affected"; on ⇒ the
 * event stays locked until the fee is settled. This module calls it rather
 * than hand-writing the sentence a second time, so the promise here and the
 * gate there cannot drift apart — see `the-fee-finds-the-supplier.test.ts`'s
 * cross-lane tripwire, which fails loudly the day they do.
 */
export function feeDueCopy(bill: DueFeeBill, todayPh: string): FeeDisclosure {
  const stage = feeDueStage(bill.dueOn, todayPh);
  const who = bill.coupleName?.trim() ? ` for ${bill.coupleName.trim()}` : '';
  const amount = feePesos(bill.amountPhp);
  const by = bill.dueOn ? ` by ${formatDueDate(bill.dueOn)}` : '';
  switch (stage) {
    case 'overdue':
      return {
        tone: 'overdue',
        headline: `Booking fee overdue — ${amount}${who}`,
        // The consequence clause is `feeEnforcementSentence` — the ONE
        // function that reads NEXT_PUBLIC_FEE_UNLOCKS_EVENT — so this promise
        // and the actual gate in `eventAccessUnlocked` cannot disagree.
        detail:
          `This was due${by ? by.replace(' by ', ' on ') : ''}. ${feeEnforcementSentence()} ` +
          'Pay it on the same GCash/BDO rail; it clears within 24 hours of our team confirming it.',
      };
    case 'last_day':
      return {
        tone: 'overdue',
        headline: `Booking fee due today — ${amount}${who}`,
        detail:
          'Today is the due date. Pay it on the same GCash/BDO rail your couples use — it clears within 24 hours of our team confirming it.',
      };
    case 'soon':
      return {
        tone: 'due',
        headline: `Booking fee due${by} — ${amount}${who}`,
        detail:
          'Due in the next few days. Pay it on the same GCash/BDO rail your couples use — it clears within 24 hours of our team confirming it.',
      };
    case 'due':
      return {
        tone: 'due',
        headline: `Booking fee due${by} — ${amount}${who}`,
        detail:
          'Setnayan charges this once a couple we brought you agrees to book. Pay it on the same GCash/BDO rail your couples use — it clears within 24 hours of our team confirming it.',
      };
  }
}

/**
 * `2026-09-27` → `Sep 27, 2026`. Unparseable input comes back untouched.
 *
 * ⚠ ICU-FREE ON PURPOSE. `lib/format-date.ts` documents at length why `en-PH`
 * through `Intl` is not a fixed point — its short-date pattern depends on the
 * CLDR data compiled into the running Node, so the same due date can render
 * differently on this Mac and on the CI runner. `monthDay` is that file's
 * hand-built, measured replacement; the year is appended here.
 */
export function formatDueDate(ymd: string): string {
  const md = monthDay(ymd);
  const year = /^(\d{4})-\d{2}-\d{2}$/.exec(ymd)?.[1];
  return md && year ? `${md}, ${year}` : ymd;
}

/**
 * The in-app + email notification copy for one due bill.
 *
 * Replaces `bookingFeeNotificationCopy`'s peso-rounded title (see `feePesos`)
 * and carries the due date, which the old copy never named.
 */
export function bookingFeeNoticeCopy(bill: DueFeeBill): { title: string; body: string } {
  const who = bill.coupleName?.trim() ? ` for ${bill.coupleName.trim()}` : '';
  const by = bill.dueOn ? ` It is due ${formatDueDate(bill.dueOn)}.` : '';
  return {
    title: `Booking fee due — ${feePesos(bill.amountPhp)}`,
    body:
      `Your ${feePesos(bill.amountPhp)} Setnayan booking fee${who} is ready to pay.${by} ` +
      'Pay it on the manual GCash/BDO rail — it clears once our team confirms your payment (within 24 hours).',
  };
}
