/**
 * FREE inquiry-answer launch flag (Booking_Fee_Build_Plan §PR-1).
 *
 * Today a FREE-tier vendor cannot accept an in-app inquiry at all
 * (unlock_vendor_event RAISEs TIER_FREE_NO_INAPP), and a verified vendor is capped
 * at 10 accepts/rolling-week (VERIFIED_WEEKLY_LIMIT) — a real couple can sit in
 * silence. The Booking Fee replaces that inbox wall with "free unlimited
 * inquiries, pay only to send a proposal." This flag opens the accept path.
 *
 * Default OFF → today's behaviour is byte-identical (the live unlock_vendor_event
 * is untouched; only when this is ON does acceptInquiry route to the no-tier-gate
 * variant). Flipping it ON is a deliberate, communicated launch-window policy — it
 * begins the "free-for-all" period the build plan describes (§6 #7), so it is the
 * owner's call, not a silent default. Same value client + server.
 */
export function freeInquiryAcceptEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_FREE_INQUIRY_ACCEPT_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
