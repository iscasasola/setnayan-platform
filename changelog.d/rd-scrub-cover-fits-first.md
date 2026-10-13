## 2026-10-12 · feat(scrub): the cover is fitted before it fades; "Get inside" stays on the stranger's first screen (dark)

Owner rulings 2026-10-12 (DECISION_LOG, "option 2" and "Scrub keeps Get inside on the stranger's first screen").
With Scrub on, a cover taller than the screen was held by its bottom, so the couple's names sat under the pinned top
bar while it faded (four red rows in #6484's browser check), and the stranger's "Get inside" only arrived after the
cover faded.

- The page's existing first-screen fit (`first-screen-door.tsx`) moved, unchanged, into
  `app/[slug]/_lib/first-screen-fit-dom.ts` so it has a second caller: the hold (`hub-scrub-engine.ts` `fitCover`)
  fits the cover ONCE, on the page as it lays out without the hold, before it is held — the stranger's cover around
  its door, the guest's around its names and date (a cover with no door) — and never again while it is held (the
  loop #6484 fixed). The door's own fit stands aside while held (measures and writes nothing) and fits the plain page
  again when the hold goes.
- A cover is held where it stands when its NAMES and DATE are seen from there (`scrubCoverStands(…, seen)`).
- The stranger's door, when it is on the first screen as the page opens, STAYS (shown, unmoved) for the whole hold;
  the block after it (the Countdown) arrives alone in the cover's place, ending above the door; what follows goes on
  under the door. Opening the door stands the hold down for the visit (`hub-scrub.tsx`). A door that is not on the
  first screen (the photo cover) still arrives with the Countdown, as before.
- 📷 A PHOTO cover is fitted too (owner 2026-10-13, DECISION_LOG: *"do it"*): the photo plate is the first part to
  give way (`GIVE_WAY_ORDER` = plate, link, time, mark, eyebrow, line, date) — it is drawn whole below "Get inside",
  which comes up under the date. This CHANGES TODAY'S STRANGER PAGE for photo covers, Scrub on or off (the door's own
  fit, `first-screen-door.tsx`, now finds the photo masthead before the door; the box holding both carries
  `data-first-screen-photo`). A card cover has no plate, so its fit is unchanged. Under Scrub the stranger's photo
  door stays too, and the guest's photo cover is fitted (no door) so its date stays above the bottom bar.
- Still DARK: `SCRUB_OUT_OFFERED = false`. With it off, the real `SiteBody` is byte-identical to origin/main in all
  24 measured cases, no island mounted.
- Guards: `lib/scrub-is-a-held-hand-over.test.ts` (10) re-aimed, (11) new; `the-lab-plays-the-scrub-chain` and
  `the-first-screen-keeps-its-action` re-aimed. Browser check (`scripts/scrub-browser-check.mjs`): block 16 re-aimed,
  block 16b new (six window sizes × the four covers).

SPEC IMPACT: None beyond the DECISION_LOG rows already written by the owner's sessions (2026-10-12 option 2 + "Get
inside stays"; 2026-10-13 "1. do it 2. yes 3. yes"). The photo change is client-side (the fit), so the server HTML is
byte-identical to main in all 24 measured cases; what live strangers with a photo cover see changes (browser block 16c).
