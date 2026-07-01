## 2026-07-01 · feat(vendor-dashboard): Demand Radar + Quote-to-Booking Funnel on the Overview

Added two full-detail, live-data analytics sections to the vendor Overview
(`/vendor-dashboard`), after "Upcoming schedules":

- **Demand Radar** — the full "where demand is building" read (signal summary,
  month heat strip, hot looks; admin scope also gets regions + event types),
  wired to the same `demand_radar_for_vendor` RPC + `getVendorDemandRadar()` the
  standalone `/vendor-dashboard/demand` route uses (with the same `after()`
  throttled rebuild). Honest "not enough demand data yet" empty state preserved.
- **Quote-to-Booking Funnel** — the full views → inquiries → quotes → booked
  funnel with the stage-over-stage conversion deltas, plus bookings-by-source
  and views-by-source breakdowns (min-N suppressed), wired to the same live
  reads as `/vendor-dashboard/funnel`. Honest empty states preserved.

Avoided duplication by extracting one source of truth for each surface:
- New shared `_components/demand-radar-panel.tsx` (`DemandRadarPanel`) and
  `_components/funnel-panel.tsx` (`FunnelPanel`), each with `variant='page' |
  'section'`. BOTH the standalone routes AND the Overview import them — the
  markup is not copy-pasted.
- The funnel data assembly (range handling, source humanizing, min-N slices)
  moved into `lib/vendor-funnel.ts` as `computeVendorFunnelView()` +
  `coerceFunnelRange()` / `FUNNEL_RANGE_OPTIONS` / `humanizeFunnelSource()`, so
  the standalone route and the Overview compute identical live data.
- The presentational `DemandRadarCard` was re-skinned to the editorial `--m-*`
  palette (Alabaster / Obsidian / Champagne — same underlying values as the
  prior `terracotta/cream/ink` Tailwind tokens) so all callers share one look.

Role-scoping matches the standalone surfaces: the Overview is already behind the
owner/admin `canManageVendor()` gate (agents get the team-member landing), and
the sections respect the same flag-dark tier gates — Demand Radar →
`canSeeMarketIntel` (Pro), Funnel → `canSeePerformanceTrends` (Solo) — via
`isVendorFeatureGateEnabled()`. Both are no-ops until
`VENDOR_TIER_FEATURE_GATE=true`, so today every managing vendor sees both,
matching the live standalone routes. Both reads degrade honestly (empty radar /
zeroed funnel) rather than throwing, so analytics never breaks the Overview.
Each section links out to its standalone route ("Open Demand Radar" / "Open the
full funnel — change the time range").

SPEC IMPACT: None
