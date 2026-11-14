## 2026-11-14 · feat(supplier): the service card — the sign-up kind is never re-asked (cut 3, in progress)

Owner-approved 2026-11-14 (DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED", specs 93ed7cd0). This PR carries the one-form Card Maker of #7553 (ruling 6058, STATUS ready, reused rather than superseded), merged with main, and builds cut 3 on it.

- **Merged with main, keeping both same-day rulings.** The row stays #7553's −/＋ stepper under More settings (owner "more settings."). It asks main's per-service question, "How many events a day can this service take?" (d8ec0922). A shared schedule's own number is said in its ⓘ (RW-67). `how-many-a-day-is-per-service.test.ts` is re-aimed to the row; its claim is unchanged.
- **The kind picked at sign-up is never re-asked.** A one-kind sign-up writes `vendor_profiles.services` and no coverage row, so the maker opened on the whole catalogue and then asked "Add Florals to what you do?". `loadMakerContext` now reads the shop's services. Their live leaves are listed under "What you cover" (a lone one is pre-picked, "From your shop"), and they count as covered, so the question is not asked. Read only; nothing is written.

Still to come in this PR: the short form (name · price · included · photos, the rest under "More options" in the same sheet), the typed price kept into the sheet, and the preview behind "See it as couples do".

Guard: `lib/supplier-cuts-the-card.test.ts`.

SPEC IMPACT: None.
