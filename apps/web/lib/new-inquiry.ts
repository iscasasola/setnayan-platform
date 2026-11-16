/**
 * new-inquiry.ts — WHAT COUNTS AS A "NEW INQUIRY" (CYC-14, 16 Nov 2026).
 *
 * Supplier Today said "1 new inquiry" for a couple who had already booked: both Today's inquiry cards
 * (`lib/vendor-overview.ts`) and the console badge (`app/vendor-dashboard/layout.tsx`) counted every
 * `chat_threads.inquiry_status = 'pending'` row, and a thread stays `pending` when the couple books some other way
 * (the shop's own link, a claimed QR, Agree) or when the supplier simply replies in it. ONE rule, read by both:
 * an inquiry is new only while it is pending, the supplier has not answered it (`vendor_first_reply_at`, stamped by
 * the `stamp_vendor_first_reply` trigger on the supplier's first message), and its event is not booked with this shop.
 * Pure — `lib/new-inquiry.test.ts` runs it.
 */
export type InquiryLike = {
  inquiry_status: string | null;
  event_id: string | null;
  vendor_first_reply_at?: string | null;
};

export function isNewInquiry(t: InquiryLike, bookedEventIds: ReadonlySet<string>): boolean {
  if (t.inquiry_status !== 'pending') return false;
  if (t.vendor_first_reply_at) return false;
  return !(t.event_id && bookedEventIds.has(t.event_id));
}

/** `isNewInquiry` over a list — the one count the badge and Today both print. */
export function countNewInquiries(threads: ReadonlyArray<InquiryLike>, bookedEventIds: ReadonlySet<string>): number {
  return threads.filter((t) => isNewInquiry(t, bookedEventIds)).length;
}
