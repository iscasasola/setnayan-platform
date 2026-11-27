## 2026-11-27 · perf(loading): Ghost waiting screens for 13 routes the speed audit found frozen

Speed audit 2026-11-27 (`docs/audits/2026-11-27/speed.md`, Group J and the ⓛ rows with 3+ reads before paint) found routes with no loading boundary at or above them, so a tap showed nothing until the server answered. Each now has its own `loading.tsx`, in the house "D · Ghost" style: known words show at once, the rest is grey under the Sheen. Each skeleton follows its own page's layout.

- **New loaders:**
  - Group J: `receipts/order/[orderId]`, `receipts/payment/[paymentId]`, `claim/[token]`, `join/crew/[token]`, `open-shop`, `onboarding/simple`
  - ⓛ, 3+ reads: `open-shop/invite`, `open-shop/logo`, `wall/[eventId]`, `papic/decorate`, `tour/budget`, `tour/gallery`, `tour/vendors`
- **Left without a loader, on purpose:**
  - These ten pages call `notFound()` on a crawlable path: `pay/[reference]`, `proposals/[publicId]`, `samahan/chat/[threadId]`, `samahan/chat/new`, `panood/control/[eventId]`, `panood/program/[eventId]`, `onboarding/[type]`, `vendor/fit/[ref]`, `papic/pool`, `papic/order/[token]`.
  - On those pages a boundary streams HTTP 200 for something that does not exist, the `/v/[slug]` soft-404. `the-press-commits-now.test.ts` forbids that.
  - Their wait needs a `<Suspense>` after the existence check, not a `loading.tsx`.
- **New guard:** `app/_components/a-slow-route-waits-on-a-ghost.test.ts`. For every route above, the boundary exists in its own folder, builds from `@/components/skeletons`, renders a `<Ghost>` inside the shared `<Screen>`, and shows no "Loading" text on screen. Two sabotages were seen red: a Ghost swapped for `Sk`, and a visible "Loading…".
- **Untouched:** no existing file was edited. No migration, no server action, no price.

SPEC IMPACT: None. These are waiting screens for shipped pages, drawn from each page's own layout.
