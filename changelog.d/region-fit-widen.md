## 2026-06-22 · fix(onboarding): region fills the desktop width + fits without scrolling

Owner: "make sure all onboarding is fit on screen and doesn't need to scroll to find the bottom
elements above the continue button like the search and near me" (re the region step).

The region step rendered as a 720px-capped column (dead space on the right), and its fixed-height
destination cards (`clamp(286px, 40vh, 344px)`) overflowed on shorter laptops, pushing the search +
Near me row below the fold so you had to scroll to reach them. Desktop-only (`onboarding-desktop.css`,
≥1024px):

- Widened the region viewzone/tapzone to `max-width: 1040px` (more destinations visible per row),
  removing it from the single-column 720px-cap list.
- Clamped the destination card height to `clamp(150px, 26vh, 300px)` so the cards shrink with the
  viewport — the carousel + search + Near me then fit above Continue.

Browser-verified at 1280×820: the carousel shows ~6 destinations and the search / Near me / Continue
are all visible with no scrolling. ⚠ Known limit (the owner's "unless the design cannot make it
scroll-less" case): below ~750px tall the photo carousel + the top event-summary chrome are taller
than the window, so a hair of scroll remains there — trimming the event-summary chip on this step
would reclaim it (flagged to owner). Mobile (<1024) keeps the locked card sizing.

SPEC IMPACT None (desktop-only layout consistency + no-scroll fit).
