## 2026-10-21 · fix(layout): every page fits every phone — no sideways scroll at 320, 44 px presses on the front door and sign-in

Owner, 2026-10-21: "are they aligned for all mobile devices? resizes properly?" — an automated sweep
(Playwright WebKit + Chromium) of the signed-out pages and the signed-in `/dev` labs at 320 · 360 · 375 ·
390 · 414 · 430 portrait, phone landscape 667×375 and 932×430, iPad 768×1024 and 1024×1366, iPad Split
View 507×1024, and the app shell at 390 / 430.

- Front door: the Discover card's action pill ("Guest list only" / "Ask to join") may wrap inside its
  own column. At 320 it was wider than its 88 px text column and scrolled the whole page sideways
  (WebKit; iPad audit W7).
- Front door: "How it works", "Open your shop →" and "See all N articles" press 44 px (were 16–22 px),
  through an `::after` expander, so no line moves.
- Sign-in / sign-up: "Forgot password?", "Create one, free" and "Sign in" press 44 px (were 17–19 px);
  the card's close button is 44 px (was 40). The Terms / Privacy links inside the agreement sentence stay
  inline on purpose (an expander there would take the checkbox label's own press).
- New guard `tests/e2e/the-page-never-scrolls-sideways.spec.ts`: public pages at 320/375/430 and
  667×375 never scroll sideways and nothing sticks out past the edge; the REAL Discover shelf
  (rendered, since CI has no database) keeps every card's content inside its card at 320/360; the
  signed-in labs run the same check against a dev server (`E2E_LABS=1`).

SPEC IMPACT: None
