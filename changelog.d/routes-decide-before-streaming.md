## 2026-11-28 · fix(routes): 16 frozen routes decide their 404 / redirect before streaming, then paint at once

The loading-screens checker (PR #8450) left 17 routes with no loading boundary. A boundary commits HTTP 200 before the page body runs, so a page that answers `notFound()` or `redirect()` behind one would send a skeleton and then a client hop (the `/v/[slug]` soft-404). With no boundary, a tap on them froze until the server answered.

- **Layout decides, loader paints (14):** `pay/[reference]`, `proposals/[publicId]`, `samahan/chat/[threadId]`, `panood/control/[eventId]`, `panood/program/[eventId]`, `onboarding/[type]`, `onboarding/simple`, `vendor/fit/[ref]`, `papic/pool`, `papic/order/[token]`, `receipts/order/[orderId]`, `receipts/payment/[paymentId]`, `claim/[token]`, `open-shop/logo`.
  - Each route's checks moved into a `cache()`d `gate.ts`. The route's own `layout.tsx` awaits it, and that layout sits outside its `loading.tsx`. The page asks the same gate and gets the same answer in the same request: one set of reads.
  - A refused read still draws its "couldn't open" screen (200), from the layout and from the page.
  - Each route gained a `loading.tsx`. The program window's loader is empty on purpose, because OBS captures that window.
- **Page decides, then `<Suspense>` (2):** `open-shop` and `samahan/chat/new` need `searchParams` to decide, and a layout is not given them. The page decides first. The reads that only draw the page stream in a `…Streamed` component.
- **Not fixed:** `open-shop/invite`. Its sign-in redirect carries `?next=`, which a layout cannot read, and everything else it does is a decision. It is unchanged.
- **Tour:** `tour/layout.tsx` now awaits `getSampleEvent()` above every stop's boundary. If the sample wedding is missing, the tour answers a real 404, not a 200.
- **Guard:** `app/_components/a-route-decides-before-it-streams.test.ts`.
  - It fails any page under a boundary, or any layout under an ancestor's boundary, that calls `notFound` / `redirect` / `permanentRedirect`.
  - 268 routes already did this and are named in `streams-before-deciding.known.ts`. That list only shrinks.
  - It also pins each route's shape and the tour.
  - Three sabotages were seen red.
- **Server actions:** no new export. No migration.

SPEC IMPACT: None.
