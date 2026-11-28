## 2026-11-28 · perf(loading): Ghost waiting screens for 6 routes the speed audit found frozen

Speed audit 2026-11-27 (`docs/audits/2026-11-27/speed.md`, Group J and the ⓛ rows with 3+ reads before paint) found routes with no loading boundary at or above them. On those, a tap showed nothing until the server answered. Each route below now has its own `loading.tsx` in the house "D · Ghost" style: the page's fixed words show at once, at the page's own size, and the rest is grey under the Sheen. Each skeleton follows its own page's layout. The three tour skeletons were checked against the live pages at 375 px and 1280 px.

- **New loaders:** `join/crew/[token]` (Group J), `wall/[eventId]`, `papic/decorate`, `tour/budget`, `tour/gallery`, `tour/vendors`.
- **Left without a loader, on purpose.** A boundary commits HTTP 200 before the page body runs, so a page that answers with a 404 or a redirect while rendering would send a skeleton and then a client hop.
  - Ten pages call `notFound()` on a crawlable path: `pay/[reference]`, `proposals/[publicId]`, `samahan/chat/[threadId]`, `samahan/chat/new`, `panood/control/[eventId]`, `panood/program/[eventId]`, `onboarding/[type]`, `vendor/fit/[ref]`, `papic/pool` and `papic/order/[token]`. This is the `/v/[slug]` soft-404, and `the-press-commits-now.test.ts` forbids it.
  - Seven pages call `redirect()` while rendering: both receipts, `claim/[token]`, `onboarding/simple`, and `open-shop` with its `invite` and `logo` steps. A signed-out visitor would get a 200 and a skeleton instead of a 307, and a missing receipt would answer 200, not 404.
  - Both groups need a fix that decides before streaming: middleware, or a `<Suspense>` after the checks.
- **New guard:** `app/_components/a-slow-route-waits-on-a-ghost.test.ts`. For each route above it checks that:
  - the boundary sits in the route's own folder and builds from `@/components/skeletons`;
  - it renders a `<Ghost>` inside the shared `<Screen>`;
  - it shows no "Loading" text on screen;
  - the route's page never redirects or 404s while rendering.
  - Three sabotages were seen red: a Ghost swapped for `Sk`, a visible "Loading…", and a `redirect(` added to a page.
- **Untouched:** no existing file was edited. No migration, no server action, no price.

SPEC IMPACT: None. These are waiting screens for shipped pages, drawn from each page's own layout.
