## 2026-11-06 · feat(partnerships): suppliers link up only after serving the same event

Owner, 6 Nov 2026 (DECISION_LOG): *"Suppliers can connect partnerships with suppliers they have been with in events. cannot link until they have served the same event."* Partnerships stay free (2026-08-05).

- **The rule, in one place.** Migration `20271316893943_partners_after_a_shared_event.sql`: `vendor_served_together_rows(uuid)` (internal) — both shops BOOKED (`contracted · deposit_paid · delivered · complete`, the same four as `BOOKED_VENDOR_STATUSES`) on one non-sample event whose date has passed (Manila); archived and fraud-voided rows never count. `partners_you_served_with(p_vendor)` — the supplier's own read (refuses another shop with `not_your_shop` instead of answering empty). A `BEFORE INSERT` trigger on `vendor_partnerships` raises `NOT_SERVED_TOGETHER` without a shared past event. Existing rows and RLS untouched. Re-propose of an already-accepted partnership (a new wording) is a restatement, not a new link, and still works.
- **Dropped:** `vendor_worked_with_ids(uuid)` — the old "listed first" hint, which answered for any vendor id and counted any co-occurrence. Its only caller now reads the new function.
- **Partnerships page.** The propose picker lists ONLY the live shops this supplier served a past event with — one row each, tap opens (the shared `Fold`), line "Served together · ‹event type› · ‹Mon YYYY›" (never the couple or the event's name). Empty: "Partners show here after you serve an event with another Setnayan supplier." A failed read says so instead.
- **`proposePartnership`** asks the one shared reader (`lib/partners-you-served-with.server.ts`) before inserting: "You can link up after you've both served the same event." Both inserts word the trigger's refusal the same way.
- **Analytics.** The "Link up with suppliers you already work with" card does not fire when nobody is eligible — a separate helper `withoutPartnershipRecWhenNobodyToLink` in `lib/vendor-growth-recs.ts`, composed on top of `buildGrowthRecs` (whose lines are untouched).

Tests: `lib/partners-you-served-with.test.ts` (7) · `tests/db/partners-after-a-shared-event.db.test.ts` (7, against the replayed migrations).

SPEC IMPACT: the controller recorded the ruling in the corpus DECISION_LOG (2026-11-06); no further corpus edit.
