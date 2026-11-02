## 2026-07-08 · feat(life-flash): product named "Life-Flash" + event/month/year/lifetime scopes

Owner-locked (2026-07-08): the product is **Life-Flash** — "it can create monthly, annual, or whole lifetime, or maybe just the event"; the strategic frame is maximizing the value of everything Papic collects.

- Route renamed `/dashboard/life-story` → `/dashboard/life-flash` (safe: flag off, nothing public); all user-facing strings now "Life-Flash" (home card, Memories Hub banner, page, launcher "▶ Play your Life-Flash"). Internal lib modules keep the `life-story-*` codename.
- **Scope selector ships now** (pulled forward from v1.1): Whole life · per-year · per-month · per-event pills on the page, driving `scopeMomentGraph()` (new, on top of the `filterMomentGraph` seam) + `parseFlashScope`/`flashScopeKey`/`scopeOptions`. Dignity thresholds (year/month ≥5 moments · event ≥3) mean hollow scopes are never offered. The scoped graph drives the flash + reel; the ✦ people section stays lifetime-scoped.
- +4 unit tests (scope round-trip, event/month slicing incl. December rollover, threshold offering).

SPEC IMPACT: Logged — DECISION_LOG row 2026-07-08 (Life-Flash naming + scopes + Papic-payoff frame).
