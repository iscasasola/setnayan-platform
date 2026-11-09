/** A supplier's review page (and its workspace's completion handshake) — `vendors/[vendorId]/review/actions.ts`. */
export const VENDOR_REVIEW_STAY_DOORS = [
  'vendorReview.coupleConfirmReceived',
  'vendorReview.coupleReportNonDelivery',
  'vendorReview.recommendVendor',
] as const;
export type VendorReviewStayDoor = (typeof VENDOR_REVIEW_STAY_DOORS)[number];
