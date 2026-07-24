## 2026-07-24 · fix(routes): stop the bare /vendors/[vendorId] 404 (gap audit · G)

Gap audit 2026-07-23 · Batch G. The bare route
`/dashboard/[eventId]/vendors/[vendorId]` has no `page.tsx` — the canonical
per-service room is `.../workspace` (the 33-call-site convention). Registries
(e.g. `lib/shortlist-taxonomy.ts`) emitted the bare href, and at sub-xl
viewports the inspector column NAVIGATES to it instead of opening the drawer,
landing the couple on a 404 when they tap a shortlisted vendor card on a phone.

Two-part fix (belt + suspenders):
- New `vendors/[vendorId]/page.tsx` redirects to `.../workspace`, so EVERY
  bare-route navigation resolves — present emitters and any future ones.
- `shortlist-taxonomy.ts` now emits the `/workspace` href directly (no redirect
  hop). Its `href` is the single source consumed by all three inspector call
  sites, so fixing it there fixes all three.

(The sibling `video-guestbook-card.tsx` `/gallery`→`/galleries` fix flagged in
the same audit batch is already on `main` — no change needed here.)

SPEC IMPACT: None — routing bug fix.
