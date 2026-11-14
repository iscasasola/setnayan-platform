## 2026-11-14 · feat(supplier): the service card — the sign-up kind is never re-asked (cut 3)

Owner-approved 2026-11-14 (DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED", specs 93ed7cd0). This PR carries the one-form Card Maker of #7553 (ruling 6058, STATUS ready, reused rather than superseded), merged with main, and builds cut 3 on it.

- **Merged with main, keeping both same-day rulings.** The row stays #7553's −/＋ stepper under More settings (owner "more settings."). It asks main's per-service question, "How many events a day can this service take?" (d8ec0922). A shared schedule's own number is said in its ⓘ (RW-67). `how-many-a-day-is-per-service.test.ts` is re-aimed to the row; its claim is unchanged.
- **The kind picked at sign-up is never re-asked.** A one-kind sign-up writes `vendor_profiles.services` and no coverage row, so the maker opened on the whole catalogue and then asked "Add Florals to what you do?". `loadMakerContext` now reads the shop's services. Their live leaves are listed under "What you cover" (a lone one is pre-picked, "From your shop"), and they count as covered, so the question is not asked. Read only; nothing is written.

- **The short form.** The first page is name · price · what's included · photos. Specialties, extras and the gift move under **More options**, which now shows while a card is being made (it was the saved card's "More settings" only, 7 Nov; this cut supersedes that for the creation page). It sits in the same form, so a typed price is kept and every field still posts.
- **The phone's preview is one tap away.** "See it as couples do" opens the same live card face. It was pinned and left about a 60 px window for the fields at 390. It supersedes the 9 Nov "always pinned". From 820 px up, the side preview is unchanged.
- Re-aimed (claim kept, place updated): `the-card-gift-is-one-dropdown.test.ts` § 5 and `laptop-gets-two-columns.test.ts`.
- Shots: `build-sessions/shots-supplier-cuts-card/`.

Guard: `lib/supplier-cuts-the-card.test.ts`.

SPEC IMPACT: None.
