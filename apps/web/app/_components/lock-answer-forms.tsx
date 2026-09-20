import { SubmitButton } from '@/app/_components/submit-button';
import { BookingFeeNotice } from '@/app/_components/booking-fee-notice';
import type { FeeDisclosure } from '@/lib/booking-fee-disclosure';

/**
 * THE SUPPLIER'S ANSWER TO A BOOKING ASK, ON THE ACCEPTED QUOTE CARD.
 *
 * Owner, live as the supplier, 2026-09-19: the card read "Accepted · the couple
 * has asked you to lock" and offered only "View proposal" — *"there is no agree
 * and confirm booking"*. The answer already existed, twice: the Overview's
 * request card (`LockRequestBody` in `vendor-dashboard/_components/
 * overview-sections.tsx`) and the client page (`LockRequestAnswer`). This is
 * the same two forms, posting the same two actions, handed in as props:
 *
 *   · `vendorAgreeToLock` — the RPC `vendor_agree_to_lock` is what books;
 *   · `vendorDeclineLock` — with the supplier's optional reason, which the
 *     couple reads.
 *
 * Plain forms carrying ONLY `vendor_id` (the actions' confused-deputy rule: the
 * event id comes off the row the RPC authorized, never off the form) plus
 * `return_to`, so the answer lands back in this thread with the RPC's status in
 * the query string — `lockAnswerReturnTo` in `lib/lock-answer-notice.ts` only
 * honours a supplier thread path, and the thread page says the sentence.
 *
 * The decline sits inside a <details>: a no is a real answer, but it should
 * not be one mis-tap away from a yes — same reasoning as the Overview card.
 */
export function LockAnswerForms({
  eventVendorId,
  returnTo,
  agreeLock,
  declineLock,
  feeForecast = null,
}: {
  eventVendorId: string;
  /** The supplier's own thread path — where the answer lands. */
  returnTo: string;
  agreeLock: (formData: FormData) => void | Promise<void>;
  declineLock: (formData: FormData) => void | Promise<void>;
  /**
   * What agreeing will cost this shop, resolved by `forecastForBooking` on the
   * thread page. Named BEFORE the button — owner, 2026-09-20: "as a vendor i do
   * not know i have to pay." `null` renders nothing.
   */
  feeForecast?: FeeDisclosure | null;
}) {
  return (
    <div className="w-full">
      <BookingFeeNotice disclosure={feeForecast} />
      <form action={agreeLock}>
        <input type="hidden" name="vendor_id" value={eventVendorId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <SubmitButton
          pendingLabel="Agreeing…"
          className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
          style={{ background: 'var(--sn-success)' }}
        >
          Agree to this booking
        </SubmitButton>
      </form>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-ink/60">
          Can&rsquo;t take this booking?
        </summary>
        <form action={declineLock} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="vendor_id" value={eventVendorId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <input
            type="text"
            name="reason"
            maxLength={240}
            placeholder="Why? (optional — the couple sees this)"
            className="h-9 min-w-0 flex-1 rounded-full border px-3 text-sm"
            style={{ borderColor: 'var(--sn-line)' }}
          />
          <SubmitButton
            pendingLabel="Sending…"
            className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
            style={{ borderColor: 'var(--sn-line)' }}
          >
            Turn it down
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}
