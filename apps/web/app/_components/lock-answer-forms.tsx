import { Check, X } from 'lucide-react';
import { AskSubmit } from '@/app/_components/ask-submit';
import { BookingFeeNotice } from '@/app/_components/booking-fee-notice';
import type { FeeDisclosure } from '@/lib/booking-fee-disclosure';

/**
 * THE SUPPLIER'S ANSWER TO A BOOKING ASK, ON THE ACCEPTED QUOTE CARD.
 *
 * Owner, live as the supplier, 2026-09-19: the card read "Accepted · the couple
 * has asked you to lock" and offered only "View quote" — *"there is no agree
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
        {/* 2026-10-12 look calls: the main answer is terracotta, 44 px — the
            customer card's Agree (`booking-ask-panel.tsx`) is the same button. */}
        <AskSubmit tone="brand" main icon={<Check aria-hidden strokeWidth={1.9} />} label="Agree to this booking" pendingLabel="Agreeing…" />
      </form>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ink/60">
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
            className="h-11 min-w-0 flex-1 rounded-full border bg-transparent px-4 text-sm text-ink"
            style={{ borderColor: 'var(--sn-line)' }}
          />
          <AskSubmit tone="neutral" icon={<X aria-hidden strokeWidth={1.9} />} label="Turn it down" pendingLabel="Sending…" />
        </form>
      </details>
    </div>
  );
}
