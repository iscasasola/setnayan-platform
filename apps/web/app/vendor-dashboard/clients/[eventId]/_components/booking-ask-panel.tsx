/**
 * THE BOOKING ASK ON THE SUPPLIER'S CUSTOMER CARD — the supplier's half of
 * pair P2 (`SUPPLIER_CONNECTION_MAP_2026-10-10.md` rows 12–16; owner
 * 2026-10-10: a Suppliers-page piece is not working when only the couple's
 * half exists).
 *
 *   LockRequestAnswer      the ask is open: Agree · Turn it down, IN PLACE —
 *                          the forms post `return_to` = this card, so the
 *                          answer lands back here and is said here
 *   LockAnswerLine         what that answer did (`lib/lock-answer-notice.ts`)
 *   BookingAskOutcomeLine  the ask closed without a booking: you said no · you
 *                          did not answer in 48 hours · they took it back
 *
 * EVERY LINE IS THE COUPLE'S LINE FOR THE SAME ROW, pronoun turned
 * (`lib/booking-ask-words.ts`): "Asked to book · waiting for your yes" here is
 * "Asked to book · waiting for their yes" on the couple's Build and Find.
 *
 * 💸 THE FEE SEAM. Agree posts `vendorAgreeToLock` and nothing else. On
 * `rd/booking-fee-rules` (owner 2026-10-12 #1, "the fee is CREATED at the
 * supplier's YES") that action calls `mintBookingFeeForBooking` itself, so this
 * panel needs no fee logic: what it shows before the press is the shipped
 * forecast (`BookingFeeNotice`), what it posts is the yes.
 *
 * Server-rendered; the two actions are props so the dev lab
 * (`/dev/booking-ask-lab`) draws the same panel without a session.
 */
import { Check, X } from 'lucide-react';
import { BookingFeeNotice } from '@/app/_components/booking-fee-notice';
import { PayoutMethodNudge } from '@/app/vendor-dashboard/_components/payout-method-nudge';
import { askLine, type SupplierAskOutcome } from '@/lib/booking-ask-words';
import type { FeeDisclosure } from '@/lib/booking-fee-disclosure';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { formatLongTimestamp } from '@/lib/format-date';
import type { LockAnswerNotice } from '@/lib/lock-answer-notice';
import { lockRequestFuseLabel } from '@/lib/lock-request-state';
import { AskSubmit } from '@/app/_components/ask-submit';
import { DeclineReasonFields } from '@/app/_components/decline-reason-fields';

type FormAction = (formData: FormData) => void | Promise<void>;

const ico = { 'aria-hidden': true, strokeWidth: 1.9 } as const;

/**
 * The supplier's answer, on the client card itself (PR-H slice B).
 *
 * 🔑 A SECOND PLACE TO ANSWER, NOT A SECOND ANSWER. Both buttons post to the
 * SAME two server actions the Overview feed's card uses, which post to the same
 * two DEFINER RPCs. Nothing about the state machine lives here — this file
 * decides where the control appears and nothing else. If the decline reason ever
 * changes shape, it changes in one place.
 *
 * ⚠ THE FORM CARRIES ONLY `vendor_id` (+ `return_to`). The actions read `event_id` off the
 * envelope the RPC returns from the row it authorized, never off the form — the
 * confused-deputy rule those actions carry in their own docblock.
 */
export function LockRequestAnswer({
  eventVendorId,
  expiresAt,
  payoutReadiness,
  feeForecast,
  returnTo,
  agreeLock,
  declineLock,
  now = new Date(),
}: {
  eventVendorId: string;
  expiresAt: string | null;
  /** S19 — asked HERE because agreeing makes the deposit the couple's next step. */
  payoutReadiness: PayoutReadiness;
  /**
   * What agreeing will cost them, named BEFORE the button. `null` when the fee
   * system is dark or this booking carries none — silence, never a "₱0".
   */
  feeForecast: FeeDisclosure | null;
  /** This card's own path — the answer lands back here (`lockAnswerReturnTo`). */
  returnTo: string;
  agreeLock: FormAction;
  declineLock: FormAction;
  /** The render instant (the lab pins it). */
  now?: Date;
}) {
  // The deadline is the one the DATABASE stamped and the sweep enforces —
  // never a window recomputed here.
  const left = lockRequestFuseLabel(expiresAt, now);
  const fuse =
    left === null
      ? 'They are waiting on your answer.'
      : left === 'closing now'
        ? 'Closing now — once it does, the request is gone and they will look elsewhere.'
        : `${left} — after that the request closes and they will look elsewhere.`;
  return (
    <section className="mt-3 border-y py-3.5" style={{ borderColor: 'var(--sn-line)' }} data-booking-ask="requested">
      <p className="text-sm font-semibold text-ink">{askLine('requested', 'supplier')}</p>
      <p className="mt-0.5 text-sm text-ink/60">{fuse}</p>
      {/* Saying WHY the page is thin is part of the answer: the venue address
          and the run-of-show arrive with the yes. */}
      <p className="mt-2 text-sm text-ink/55">
        You are seeing the area, the date and the headcount. The exact venue and the day-of run-of-show open the moment you
        agree.
      </p>
      <PayoutMethodNudge readiness={payoutReadiness} context="lock" />
      {/* ⚠ ABOVE THE BUTTON, NOT BELOW IT. A fee named after the press is a
          receipt, not a disclosure. */}
      <BookingFeeNotice disclosure={feeForecast} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={agreeLock}>
          <input type="hidden" name="vendor_id" value={eventVendorId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <AskSubmit tone="brand" main icon={<Check {...ico} />} label="Agree to this booking" pendingLabel="Agreeing…" />
        </form>
      </div>
      {/* A no is a real answer, but not one mis-tap away from a yes. */}
      <details className="mt-3" data-booking-ask-no="">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ink/60">Can&rsquo;t take this booking?</summary>
        <form action={declineLock} className="mt-1 flex flex-wrap items-center gap-2">
          <input type="hidden" name="vendor_id" value={eventVendorId} />
          <input type="hidden" name="return_to" value={returnTo} />
          {/* Why ▾ + an optional line, joined into the one \`reason\` field the action reads (no Undo — the couple
              is told at once). */}
          <DeclineReasonFields />
          <AskSubmit tone="neutral" icon={<X {...ico} />} label="Turn it down" pendingLabel="Sending…" />
        </form>
      </details>
    </section>
  );
}

/** What the supplier's answer did — said where they pressed. */
export function LockAnswerLine({ notice }: { notice: LockAnswerNotice }) {
  return (
    <p
      role={notice.tone === 'refused' ? 'alert' : 'status'}
      data-lock-answer={notice.tone}
      // A status line, not a card (2026-10-11 look: frames only on what you press).
      className={`mt-3 border-l-2 py-1 pl-3 text-sm ${
        notice.tone === 'refused' ? 'border-danger-500 text-danger-900 dark:text-danger-100' : 'border-mulberry text-ink'
      }`}
    >
      {notice.text}
    </p>
  );
}

/** The ask closed without a booking — the couple's line for the same row. */
export function BookingAskOutcomeLine({ outcome }: { outcome: SupplierAskOutcome }) {
  // A timestamp → the Manila day it happened on (never its UTC date).
  const when = outcome.at ? formatLongTimestamp(outcome.at) || null : null;
  return (
    <section className="mt-3 border-y py-3" style={{ borderColor: 'var(--sn-line)' }} data-booking-ask={outcome.state}>
      <p className="text-sm font-semibold text-ink">
        {outcome.line}
        {when ? <span className="font-normal text-ink/55"> · {when}</span> : null}
      </p>
      {outcome.words ? <p className="mt-0.5 text-sm text-ink/60">Your words: &ldquo;{outcome.words}&rdquo;</p> : null}
      <p className="mt-0.5 text-sm text-ink/55">
        {outcome.state === 'declined'
          ? 'The couple was told. If they ask again, it shows here to answer.'
          : outcome.state === 'expired'
            ? 'The ask closed on its own. If they ask again, it shows here to answer.'
            : 'Nothing to answer. If they ask again, it shows here.'}
      </p>
    </section>
  );
}
