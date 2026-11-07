# /open-shop redesign — side-by-sides (6 Nov 2026)

Each image: **prototype left, build right**. Prototype = corpus `prototypes/open_shop_redesign_2026-11-06/open-shop-redesign.html`
(step 2 shot against **v8**, corpus `dcde4a7c`; the other steps against the approved build contract, which v7/v8 did not
change). Build = the branch on a dummy-env dev server (`/dev/open-shop-lab`, `/dev/supplier-lab?easy=setup`) — never
production. The lab's service tree is the static `TAXONOMY_MAP`, so a few names differ from the prototype's
(e.g. "Hotel Stay" for "Hotel"); the live page reads Admin › Categories.

| File | State |
|---|---|
| `s1-name-390` / `-1280` | Step 1 · Name your shop |
| `s2-what-you-do-390` (+ `-dark`) | Step 2 · nothing picked — "Add more later…" shows only here |
| `s2-coordinator-390` | `?as=coordinator` — "What you coordinate" |
| `s2-chosen-390` / `-1280` | One service picked — "Your services", the meter "1 category · 1 service — Free and Verified cover this", the two buttons |
| `s2-services-390` / `-1280` | The owner's v8 example — 3 Reception + 1 Accommodation → "2 categories · 4 services — Solo covers this…", "Reception 3 · Accommodation 1", the first-booking label on each added service |
| `s2-own-events-390` | An added service's own events open (Select all · Clear · Done, "Use the same events as …") |
| `s2-more-in-group-390` | "More in Venues & churches" — the picker opened inside that group, Cancel |
| `s2-added-events-error-390` | An added service with no event → "Pick at least one event for Hotel Stay." |
| `s2-events-error-390` | "Pick at least one event." under the tiles |
| `s3-*` | Step 3 · lookup, "Is this your address?", confirmed, location denied |
| `s4-*` | Step 4 · default (+ dark), phone error, email taken, Sign in (the ONE sign-in panel as the pane), stale build |
| `today-*` | Today at 390 · 768 · 1280, and the open step as the side pane |
