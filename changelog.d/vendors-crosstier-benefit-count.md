## 2026-07-05 · feat(vendors): cross-tier benefit count + honest tier flags on the Free-for-Vendors overlay

The nav "Free for Vendors" overlay advertised **"See all 49 free vendor benefits"** — the free-tier count only, which undersold the platform. It now reads **"See all 100+ vendor benefits"**, computed across every tier (`HomeOverlays.tsx`: 84 named + 9 Custom dials + 9 plan-capability rows = 102 today, rendered "100+" when the total ≥ 100 so a copy tweak can't regress it).

To back that number honestly, the `/vendors` matrix's Custom column is no longer a hardcoded stub of 4 rows — the 9 real Custom dials are now canonical data on `VENDOR_CUSTOM_TIER.benefits` (single source of truth) and `buildCustomOnlyGroup()` maps over them.

Two now-stale `soon` flags flipped to live after verifying prod state:
- **Auto-shared to our socials** — `social_publish_settings.autopublish_enabled = true` (Facebook armed in prod 2026-07-05); the feature is live.
- **Category benchmarks vs peers** — `marketIntel = true` for Enterprise + `canSeeMarketIntel()` true = the surface is gated on and reachable. Renamed to **"Market Intelligence — category benchmarks vs peers"** and **moved Pro → Enterprise** to match the code gate (it was mis-listed under Pro).

Files: `app/_components/home/vendor-benefits.ts`, `app/vendors/_components/vendor-tier-matrix.tsx`, `app/_components/home/HomeOverlays.tsx`.

SPEC IMPACT: Category benchmarks tier moved Pro → Enterprise (matches the shipped `marketIntel` gate; the Pro placement was the drift). Custom tier benefits enumerated (9 dials). Logged in DECISION_LOG.md; no iteration-spec body edit needed (archive stubs, code canonical).
