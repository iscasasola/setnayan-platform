/**
 * <BookingFeeLine> — the supplier booking-fee sentence, said once for every
 * surface that draws it (/for-suppliers twice, the plan cards, the supplier's
 * own booking-fees page).
 *
 * Owner, 2026-11-04, rewording "Your first booking from Setnayan is on us —
 * after that 5% of the first ₱100,000, then 1%, minimum ₱50, only on couples we
 * source". The facts are unchanged; the sentence now reads
 *
 *   **Your first booking through Setnayan is free.** After that: 5% up to
 *   ₱100,000, 1% above — only on couples who found you here. ⓘ
 *
 * and the ⓘ holds "Minimum fee ₱50 per booking. Bookings you bring in yourself
 * are never charged."
 *
 * 🔑 EVERY NUMBER IS THE LIVE SCHEDULE THE PAGE READ (`getLiveBookingFeeSchedule`),
 * never typed and never the code default. NULL means the page could not read
 * it: the fee is named with no rate and no minimum, exactly as before.
 */
import type { CSSProperties } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import {
  bookingFeeBandsLine,
  bookingFeeMinimumAmount,
  type BookingFeeSchedule,
} from '@/lib/booking-fee';
import { FIRST_BOOKING_FREE } from '@/lib/booking-fee-lock';

/** Who the fee applies to — the visible label the ⓘ sits beside. */
export const FEE_LINE_WHO = 'only on couples who found you here.';
/** The second sentence behind the ⓘ. */
export const FEE_LINE_OWN_CLIENTS = 'Bookings you bring in yourself are never charged.';

export function BookingFeeLine({
  fee,
  leadStyle,
}: {
  /** The LIVE schedule, or null when it could not be read. */
  fee: BookingFeeSchedule | null;
  /** Style for the bold lead sentence (a page's own ink colour). */
  leadStyle?: CSSProperties;
}) {
  return (
    <>
      <b style={leadStyle}>{FIRST_BOOKING_FREE}</b> After that:{' '}
      {fee ? bookingFeeBandsLine(fee) : 'a booking fee'} —{' '}
      <InfoTip label={FEE_LINE_WHO} ariaLabel="About the booking fee" align="end">
        {fee
          ? `Minimum fee ${bookingFeeMinimumAmount(fee)} per booking.`
          : 'Its rate is shown in full before you agree to any booking.'}{' '}
        {FEE_LINE_OWN_CLIENTS}
      </InfoTip>
    </>
  );
}
