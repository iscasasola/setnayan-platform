/**
 * THE ONE BOOKING-FEE SENTENCE, RENDERED. Two components, no logic:
 *
 *   · `BookingFeeNotice`  — a `FeeDisclosure` (what the fee WOULD be, or what
 *     joining costs). Shown before the supplier owes anything.
 *   · `BookingFeeBillRow` — a bill that EXISTS, with the door to pay it.
 *
 * Deliberately dumb. Every word and every peso figure is decided by
 * `lib/booking-fee-disclosure.ts` and handed in as a prop, so a surface cannot
 * quietly reword the money or round it — the defect that titled a ₱837.50 bill
 * "₱838" lived in a formatter, one layer below the sentence.
 *
 * Shape and tokens are lifted from `PayoutMethodNudge` (S19) on purpose: the
 * supplier already reads that row in these exact places, so this is the same
 * design language rather than a second one.
 *
 * Server components with no hooks and no directive — they render inside the
 * Today page, the client page, the chat card and the client-side quote composer
 * alike.
 */
import Link from 'next/link';
import { AlertTriangle, BadgeCheck, Info, Receipt } from 'lucide-react';
import type { FeeDisclosure, DueFeeBill, WaivedFeeCharge } from '@/lib/booking-fee-disclosure';
import { waivedFeeCopy } from '@/lib/booking-fee-disclosure';
import { VENDOR_BOOKING_FEES_PATH, vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';

/** Border / accent per tone. `good` is the free-booking and no-fee case. */
const TONE = {
  good: { accent: 'var(--sn-success, #1f7a4d)', Icon: BadgeCheck },
  info: { accent: 'var(--sn-gold-700)', Icon: Info },
  due: { accent: 'var(--sn-gold-700)', Icon: Receipt },
  overdue: { accent: 'var(--m-blush-deep)', Icon: AlertTriangle },
} as const;

export function BookingFeeNotice({
  disclosure,
  cta,
  testId = 'booking-fee-notice',
}: {
  /** `null` ⇒ render NOTHING. Silence is the honest rendering of "no fee here". */
  disclosure: FeeDisclosure | null;
  cta?: { href: string; label: string };
  /**
   * This row's own name, so a surface that mounts the shape TWICE can be
   * counted per LINE rather than per file. Both quote composers do: the fee,
   * and the exclusive Papic deal beside it (`papic-quote-notice`). A file-level
   * match cannot say which of two survived an edit.
   */
  testId?: string;
}) {
  if (!disclosure) return null;
  const { accent, Icon } = TONE[disclosure.tone];
  return (
    <div
      role="note"
      data-testid={testId}
      className="mt-3 flex items-start gap-2.5 rounded-xl border p-3"
      style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-surface, #fff)' }}
    >
      <Icon
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0"
        strokeWidth={1.75}
        style={{ color: accent }}
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-ink">{disclosure.headline}</p>
        <p className="text-sm text-ink/70">{disclosure.detail}</p>
        {cta ? (
          <Link
            href={cta.href}
            className="inline-flex text-sm font-semibold text-ink underline underline-offset-2"
          >
            {cta.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * ONE UNPAID BILL, with the door to pay it.
 *
 * 🔑 THE DOOR IS THE POINT. The bill was already correct in the database and
 * already rendered on `/vendor-dashboard/booking-fees`; what did not exist was
 * any way to arrive there from where the supplier actually stands. A row
 * without `Pay now` would reproduce the original defect with better wording.
 */
export function BookingFeeBillRow({
  bill,
  copy,
}: {
  bill: DueFeeBill;
  /** `feeDueCopy(bill, phToday())` — the escalation is decided, not styled. */
  copy: FeeDisclosure;
}) {
  const { accent, Icon } = TONE[copy.tone];
  return (
    <div
      role="note"
      data-testid="booking-fee-bill"
      className="mt-3 flex items-start gap-2.5 rounded-xl border p-3"
      style={{ borderColor: accent, background: 'var(--sn-surface, #fff)' }}
    >
      <Icon
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0"
        strokeWidth={1.75}
        style={{ color: accent }}
      />
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm font-semibold text-ink">{copy.headline}</p>
        <p className="text-sm text-ink/70">{copy.detail}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={vendorBookingFeePayPath(bill.orderId)}
            className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
            style={{ background: accent }}
          >
            Pay now
          </Link>
          <Link
            href={VENDOR_BOOKING_FEES_PATH}
            className="inline-flex text-sm font-semibold text-ink underline underline-offset-2"
          >
            All booking fees
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Every due bill for one surface, already filtered by `billsForSurface`.
 * Renders nothing for an empty list — the "no pending fee sees none of it"
 * property is a consequence of the filter, not of a second `if` here.
 */
export function BookingFeeBills({
  bills,
  copyFor,
}: {
  bills: readonly DueFeeBill[];
  copyFor: (bill: DueFeeBill) => FeeDisclosure;
}) {
  if (bills.length === 0) return null;
  return (
    <>
      {bills.map((b) => (
        <BookingFeeBillRow key={b.orderId} bill={b} copy={copyFor(b)} />
      ))}
    </>
  );
}

/**
 * THE FREE BOOKINGS, NAMED AND PRICED.
 *
 * 🔴 Owner, 2026-09-20: *"still tell them that there should be a booking fee.
 * but this will be considered free."* A waived charge previously appeared on NO
 * supplier surface — it mints no `orders` row, and every fee surface read
 * orders — so a shop learned "free" only from silence, and the sixth booking
 * arrived as a surprise bill.
 *
 * Quieter than {@link BookingFeeBillRow} on purpose: nothing is owed, so there
 * is no CTA. But the AMOUNT is stated, every time — `waivedFeeCopy` refuses to
 * render a bare "Free".
 */
export function WaivedFeeRows({ charges }: { charges: readonly WaivedFeeCharge[] }) {
  if (charges.length === 0) return null;
  return (
    <>
      {charges.map((c) => {
        const copy = waivedFeeCopy(c);
        return (
          <div
            key={c.chargeId}
            role="note"
            data-testid="booking-fee-waived"
            className="mt-3 flex items-start gap-2.5 rounded-xl border p-3"
            style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-surface, #fff)' }}
          >
            <BadgeCheck
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
              style={{ color: TONE.good.accent }}
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-ink">{copy.headline}</p>
              <p className="text-sm text-ink/70">{copy.detail}</p>
            </div>
          </div>
        );
      })}
    </>
  );
}
