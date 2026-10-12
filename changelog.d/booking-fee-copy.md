## 2026-10-12 · fix(booking-fee copy): every page quotes the LIVE rate, and couple pages stop naming the supplier fee

Audit `controller-2026-10-12/BOOKING_FEE_RULES_AUDIT_2026-10-12.md` build items 5 and 6, approved by the owner
2026-10-12 ("APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)", answer 14).

- **The live rate (A3 / item 5).** `/for-suppliers` (page, metadata, JSON-LD, hero, thesis, fair-pay, CTA, tier
  deltas, tier matrix), the front door's "Open your shop" card, the marketing chrome's "For suppliers" overlay
  (via `/api/home-pricing`), `llms.txt`, the supplier claim page, the earnings blurb and `/pricing`'s supplier-plan
  JSON-LD printed `bookingFeeScheduleSummary()` with no argument — the CODE DEFAULT, not the owner's
  `platform_settings` numbers. They now read `getLiveBookingFeeSchedule()` (new, `lib/booking-fee-settings.server.ts`,
  `cache()`d). `supplierCommissionPromise` / `supplierCommissionShort` take the schedule with no default; a NULL
  schedule (unreadable, or a module constant with no render) names the fee WITHOUT a rate — never the default.
- **The audience rule (E4, E5 / item 6, owner #14).** `/pricing`'s description, Open Graph and Twitter lines said
  "Suppliers keep 100%" / "Setnayan takes 0%" with no fee sentence — now they carry it; the couple's "0% commission"
  is left alone. The couples' waitlist and the couple-readable help topic (`about-setnayan`) no longer mention the
  supplier fee; its sentence moved word for word to a new supplier-only help topic, "Fees & plans".
- Guards: `lib/fee-copy-reads-the-live-rate.test.ts` (no no-arg summary outside `lib/booking-fee.ts`; NULL prints no
  rate; the readers read; the `/pricing` share lines), `one-commission-promise.test.ts` (waitlist moves to the
  couple-facing list; couple-readable help never names the fee, a supplier-only topic does), `llms-txt.test.ts`
  (fed an owner-edited schedule, must not print the default). Each sabotage-run red → green.

SPEC IMPACT: None — implements the 2026-10-12 owner answers already in the corpus DECISION_LOG (81292dc).
