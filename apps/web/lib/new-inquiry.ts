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

/**
 * The ids `current_vendor_booked_event_ids()` returns over PostgREST — a SETOF uuid arrives as bare strings or as
 * `{ current_vendor_booked_event_ids: uuid }` rows depending on the client; both are read, anything else dropped.
 * Only uuid-shaped ids pass, since they are written into a `not.in.(…)` filter.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function bookedEventIdsOf(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const row of data) {
    const id = typeof row === 'string' ? row : (row as { current_vendor_booked_event_ids?: unknown } | null)?.current_vendor_booked_event_ids;
    if (typeof id === 'string' && UUID_RE.test(id)) out.push(id);
  }
  return [...new Set(out)];
}
