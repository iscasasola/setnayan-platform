## 2026-10-19 · fix(hub): a short page still gets its bars · Home clears the top bar · a Cover Scene is its own first screen

Follow-up to #6673, from the live walk of `marco-marga` (a Save the Date with no date yet, signed out, 375):

- **The bars come when the cover is fully gone OR the guest has reached the page's end** (scrolled, bottom within
  4 px) — `app/[slug]/_components/cover-scene-menu.tsx`. The page under marco-marga's cover was shorter than a
  screen, so its foot was reached with the cover still on screen and the bars (Me among them) never came. A tap
  on the bottom bar now keeps the bars until the guest's own next touch, wheel or key (Q3, 2026-10-15).
- **Home clears the top bar**: under the pinned top bar the Home mark is (bar clearance 4.5rem + 8 px + the
  landing's 2 px − the 3rem rhythm) tall, so where Home lands the first section starts 8 px under the bar
  (live: the countdown's heading sat under it) — `app/globals.css` `[data-home-after-cover]`.
- **The first-screen fit measures a Cover Scene from its own top** (`first-screen-fit.ts` `doorLimit`,
  `first-screen-door.tsx`): the Save the Date's closing card stands above the scene, and measured from the page's
  top the cover gave away its mark, eyebrow and link, drawn hundreds of px down ON the program card.

Guards: `the-invitation-is-one-page.test.ts` 5 (re-aimed), 7 (the gap), 8 (short page, tap, Me);
`the-first-screen-keeps-its-action.test.ts` (7); two phrase pins re-aimed. Goldens regenerated.

SPEC IMPACT: None — controller calls (2026-10-19) implementing the 2026-10-15 Q3 and 2026-10-16 cover rulings on
pages too short for the cover to leave; no owner ruling changed.
