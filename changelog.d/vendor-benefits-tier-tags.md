## 2026-07-01 · feat(vendor-benefits): tier tags on the For-vendors overlay

Each benefit in the homepage "For vendors" overlay now carries a Free / Solo /
Pro / Enterprise chip, so a vendor sees which tier it comes in at — reflecting
**as-built §6 gating** (owner choice), not the aspirational allocation.

- `VendorTier` added to `vendor-benefits.ts`; every benefit + hero card tagged
  (10 Pro — editorial/awards, team seats, co-listing/ecosystem-grow, vs-peers
  benchmarks; 56 Free). Honestly, Setnayan's tiers mostly gate *caps* (photos,
  reach, categories, team), so most features are genuinely Free.
- `HomeOverlays` renders a colour-coded tier chip beside each benefit + a **tier
  legend** explaining that Solo/Enterprise lift limits (answering volume, real
  name, categories, team, reach) rather than unlock distinct features, with a
  link to the full `/for-vendors` ladder.
- Chip + legend styles in `home-reskin.css`.

tsc + eslint clean. SPEC IMPACT: none (surfaces existing §6 gating; count sync
handled by the concurrent reconcile PR).
