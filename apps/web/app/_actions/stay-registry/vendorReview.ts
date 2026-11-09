import 'server-only';
import type { VendorReviewStayDoor } from '@/lib/stay-doors/vendorReview';
import type { StayWords } from '@/lib/save-in-place';
import { coupleConfirmReceived, coupleReportNonDelivery, recommendVendor } from '@/app/dashboard/[eventId]/vendors/[vendorId]/review/actions';
import { kind, type Door } from './_door';

/**
 * The review page. Pressed on the supplier's WORKSPACE, the completion handshake lands on the review page — another
 * screen, so it navigates exactly as before; pressed on the review page it stays. A refused recommendation says the
 * card's own words. (`submitReviewAppeal` is not a door: its landing draws "appeal filed" from `?appeal_filed=1`.)
 */
const VENDOR_REVIEW_WORDS: StayWords = {
  within: [/^\/dashboard\/[^/]+\/vendors\/[^/]+\/review$/],
  refuse: (q) =>
    q.get('recommend') === 'blocked'
      ? 'We couldn’t save that yet — a recommendation needs the supplier’s service marked complete for this event.'
      : null,
};
const vendorReview = kind(VENDOR_REVIEW_WORDS, null);

export const VENDOR_REVIEW: Readonly<Record<VendorReviewStayDoor, Door>> = {
  'vendorReview.coupleConfirmReceived': vendorReview(coupleConfirmReceived),
  'vendorReview.coupleReportNonDelivery': vendorReview(coupleReportNonDelivery),
  'vendorReview.recommendVendor': vendorReview(recommendVendor),
};
