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
- Still DARK: `SCRUB_OUT_OFFERED = false`. With it off, the real `SiteBody` is byte-identical to origin/main in all
  24 measured cases, no island mounted.
- Guards: `lib/scrub-is-a-held-hand-over.test.ts` (10) re-aimed, (11) new; `the-lab-plays-the-scrub-chain` and
  `the-first-screen-keeps-its-action` re-aimed. Browser check (`scripts/scrub-browser-check.mjs`): block 16 re-aimed,
  block 16b new (six window sizes × the four covers).

SPEC IMPACT: None beyond the two DECISION_LOG rows already written by the owner's session (2026-10-12); open owner
question recorded in the PR: the PHOTO cover's "Get inside" is under the photo on today's page too, so it is not on
the first screen under Scrub either.
