## 2026-10-12 · feat(admin/booking-fees): suppliers to review — several booked-but-unsettled events

Owner 2026-10-07 ("flag suppliers with several booked-but-unsettled events") and 2026-10-12 "APPROVE ALL: THE
BOOKING-FEE QUESTIONS (14)" answer 12 (an admin-set count of events, default 2, review only). Audit
`controller-2026-10-12/BOOKING_FEE_RULES_AUDIT_2026-10-12.md` H2 / build item 14.

`/admin/booking-fees` gains "Suppliers to review": each supplier with at least N events their couples treat as booked
(a booked status, or a payment recorded) and no settled booking fee, with the events, what couples recorded and the
fee owed. N is `platform_settings.fee_review_unsettled_events_min` (migration `20271267295101`, seeded 2), edited on
the same page (one server action, audited). It lists; it charges and tells nobody. A refused read says which one
failed rather than "nobody to review". Manual suppliers (no `marketplace_vendor_id`) cannot appear — named in the
audit.

Tests: `lib/admin/suppliers-to-review.test.ts` (pure roll-up), `tests/db/fee-review-threshold.db.test.ts`.

SPEC IMPACT: None — implements the owner's 2026-10-12 answer already in the corpus DECISION_LOG (81292dc).
