import {
  isCancelledInquiryStatus,
  resolveThreadStage,
  THREAD_STAGE_LABEL,
  type ThreadStage,
} from '@/lib/vendor-thread-stage';

/**
 * THE BOOKINGS LIST'S TAG, DERIVED FROM THE BOOKING — never from chat activity.
 *
 * 🔴 WHAT THIS REPLACED (S43 · AREA-VENDOR). The row tag was "New" when the
 * thread had an unread chat notification and "Stale" when nobody had typed for
 * 30 days. Neither is a fact about the booking: a couple who paid a downpayment
 * and went quiet read as "Stale", a declined ask with one unread "thanks" read
 * as "New", and a booked wedding was indistinguishable from a cold lead.
 *
 * Now:
 *   • New          — the couple asked and this shop has not answered
 *                    (`inquiry_status = 'pending'`).
 *   • In progress  — a live conversation or booking: the ladder resolves to
 *                    Inquiry · Quoted · Booked.
 *   • Closed       — the ladder resolves to Completed or Cancelled.
 *
 * The row pill shows the ladder's own label for anything that is not New, so
 * the list and the thread page cannot disagree: the ordering lives in ONE place,
 * `resolveThreadStage`, and this file only groups its answer.
 *
 * Unread is still shown — as its own marker, because it is a fact about the
 * inbox, not the booking.
 */
export type BookingListStatus = 'new' | 'in_progress' | 'closed';

export const BOOKING_LIST_LABEL: Record<BookingListStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  closed: 'Closed',
};

export type BookingListFacts = {
  inquiryStatus: string | null | undefined;
  /** The shop is booked on this event (the room read: pool · agreed · Locked QR). */
  booked: boolean;
  /** A proposal for this event is out with the couple (sent / viewed). */
  quoted: boolean;
  /** The job is finished (`rowReadsCompleted`). */
  completed: boolean;
};

export function bookingStage(f: BookingListFacts): ThreadStage {
  return resolveThreadStage({
    completed: f.completed,
    booked: f.booked,
    quoted: f.quoted,
    cancelled: isCancelledInquiryStatus(f.inquiryStatus),
  });
}

export function bookingListStatus(f: BookingListFacts): BookingListStatus {
  const stage = bookingStage(f);
  if (stage === 'completed' || stage === 'cancelled') return 'closed';
  // A pending ask that the shop is somehow already booked on is not "New" —
  // the booking wins, exactly as it does on the ladder.
  if (stage === 'inquiry' && f.inquiryStatus === 'pending') return 'new';
  return 'in_progress';
}

/** The pill text: "New" for an unanswered ask, otherwise the ladder's label. */
export function bookingPillLabel(f: BookingListFacts): string {
  if (bookingListStatus(f) === 'new') return BOOKING_LIST_LABEL.new;
  const stage = bookingStage(f);
  // Same relabel the Clients list makes: an accepted, un-quoted thread is a
  // conversation, and "Inquiry" there reads as if the shop had not replied.
  return stage === 'inquiry' ? 'In conversation' : THREAD_STAGE_LABEL[stage];
}

/**
 * `?status=` from the URL. The retired `stale` tab (and anything unknown) lands
 * on All: "quiet for 30 days" has no honest equivalent among the booking states,
 * and mapping it onto Closed would hide live bookings behind an old link.
 */
export function parseBookingFilter(raw: string | undefined): 'all' | BookingListStatus {
  if (raw === 'new' || raw === 'in_progress' || raw === 'closed') return raw;
  return 'all';
}
