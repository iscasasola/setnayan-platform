# /open-shop at prototype v16 — side-by-sides (6 Nov 2026)

Each image: **prototype left, build right**, both at 390 px. Prototype = specs repo
`prototypes/open_shop_redesign_2026-11-06/open-shop-redesign-v16.html` (`57feebf1`), driven through its own
click-through. Build = this branch's `/dev/open-shop-lab` on a dummy-env dev server (no database, never production).
The lab's tree is the static `TAXONOMY_MAP`, so some names differ from the prototype's taxonomy v2 ("Photography" for
"Photographer", "Reception" for "Venues"); the live page reads Admin › Categories. The lab's specialties and event
scopes for a few services are the prototype's own (`FILTERS`, `SVC_EVENTS`).

| File | v16 fix |
|---|---|
| `d1-another-category-tiles-390` | ① "Another category" opens the category tiles under the cards (picked categories not offered) |
| `d1-fourth-category-flash-390` | ① A 4th category lands; its card scrolls into view and flashes once |
| `d2-inline-hint-390` | ② The meter + the one inline hint and ⓘ |
| `d2-plan-sheet-390` | ② Continue past Free → "Before you continue" as a sheet |
| `d2-plan-sheet-refused-390` | ② Continue without the tick → "Tick the box to continue." |
| `d3-specialties-open-390` | ③ Specialties open — every chip + Done |
| `d3-specialties-compiled-390` | ③ Specialties closed — the picks + "+ Add" |
| `d4-services-per-event-390` | ④ Services as chips under each ticked event (one unticked at Debut) |
| `d4-not-offered-390` | ④ "X isn’t offered for Wake" |
| `d4-on-no-event-refused-390` | ④ A service on for no picked event blocks Continue |
| `d5-about-you-390` | ⑤ Step 4 · About you |
| `d5-account-three-buttons-390` | ⑤ Step 5 · Your account — three equal buttons |
| `d5-account-email-open-390` | ⑤ Email opens email + password in place, one hint |
