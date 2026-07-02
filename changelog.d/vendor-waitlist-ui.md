## 2026-07-02 · feat(vendor-dashboard): waitlist settings + pick-one + block-dates button (calendar blocking PR-B)

The vendor-facing + couple-facing half of the calendar block/waitlist feature
(PR-A shipped the auto-block trigger + Locked-QR guard).

- **Waitlist settings** — on the Calendar page's Booked-Out Waitlist section: an
  "Accept a waitlist on booked dates" toggle + a "Hold up to 1/2/3 per date" cap
  → `updateWaitlistSettings` (writes `vendor_profiles.waitlist_enabled` +
  `max_waitlist_acceptances`).
- **Vendor pick-one** — each waitlisted date gets a "Pick for waitlist (X/N)"
  button → `pickWaitlistCouple` stamps `accepted_at` on the next couple in line,
  capped at the vendor's setting (per date). (Per-couple identity isn't reliably
  visible to a vendor pre-booking under RLS/hybrid-anonymity, so "pick" takes the
  next-in-line; per-couple selection is a follow-up.)
- **Couple-join gate** — `/v/[slug]` shows "Join the waitlist" only when the
  vendor has it switched on (else the date reads simply "Unavailable"); the
  `joinVendorWaitlist` action enforces the same. The 1–3 cap is enforced
  vendor-side on pick (RLS hides other couples' rows from a couple).
- **Block-dates button** — a prominent "Block dates" button in the calendar
  header (beside the heatmap) anchors to the existing block form (`#block-dates`).

SPEC IMPACT: Vendor calendar — waitlist is now vendor-configurable (on/off + 1–3
cap) with a pick-one; couple CTA gated. Logged in DECISION_LOG.md. No new
migration (uses PR-A's `20270428213000` columns, already applied to prod).
Verified tsc + lint + `next build`.
