## 2026-07-16 · fix(vendor): dedupe 21 duplicated surfaces across the vendor dashboard

A council audit (find → adversarial-verify) over all ~54 vendor surfaces found 21 user-visible duplicates — the same widget, metric, label, route, or copy rendered twice. The through-line is the 5-page IA reorg: each hub *appended* a full standalone surface below content that already rendered the same thing. This pass consolidates each to a single home and fixes the circular CTAs, keeping every route reachable via redirect.

**My Performance (`/vendor-dashboard/performance`)**
- Demand Radar rendered TWICE — the inline preview card in §4 plus an appended `EagerDisclosure`→`DemandSurface` fold. Removed the fold; §4 now hosts the full `DemandRadarCard` (fed by the already-fetched radar + market label) with the privacy note inline, under the page's own `canMarket` gate + `Reanimate`. This one change also killed the second "Where your bookings come from" table and the contradictory Pro-vs-Enterprise double upsell (both lived in the fold). `VendorPerformanceHub` wrapper removed — `PerformanceHome` is the default export. `/demand` redirect repointed off the retired `?tab=demand`; orphaned `demand/surface.tsx` + `demand-preview-card.tsx` deleted. The cron-free `maybeRefreshDemandRadar` `after()` trigger was preserved (moved onto the performance page).
- Label dupe: dropped `<h2>Reputation</h2>` (sole child under the "Reputation · all-time" eyebrow).
- Footnote dupe: "Excludes N bookings not tied to a specific service" now renders once (RoiAttributionCard), removed from MomentumCard + its now-dead prop plumbing.

**My Customers (`/vendor-dashboard/customers`)**
- Thread list rendered twice always-on (Bookings + Messages, same `fetchVendorThreads`). Folded Messages back behind the accordion (⚠ **reverses owner 2026-07-12 "promote Messages to always-on"** — Bookings, also always-on, already shows the same threads; Messages was originally COLLAPSE per the owner's own note). The Messages summary card's "Open messages" now opens that fold (`?open=messages`) instead of a circular redirect.
- Ongoing-payments card: dropped its duplicate unresolved-installments caveat (PaydaySurface owns it) and repointed its CTA to the in-page `#payday` anchor (was a self-redirect through `/payday`).
- "Book of business" link repointed to `?open=clients` (was a self-referential redirect through `/clients`).

**Plan & tokens (`/vendor-dashboard/subscription`)** — suppressed the plan-level "How to pay" PayBox tile for token-only (`TKN-`) orders; `PendingPurchases` already renders those instructions, so the page no longer shows two BDO+GCash QR blocks after a token top-up.

**Nav** — retired `/more` (it rendered cards for exactly the five bottom-nav tabs) → redirect to `/vendor-dashboard`; removed the topbar "More" link and the orphaned `vendor-mobile-landing` + `desktop-redirect`. Merged the sidebar footer's two adjacent `/subscription` rows into one (tier pill + Plan & tokens + token balance).

**Overview (`/vendor-dashboard`)** — removed the hero stat line that restated the inquiries/earned/bookings trio the `VendorTodayFocal` tile shows directly below; the hero subline is now a plain orienting lead-in.

**My Shop / branches** — `/branches` redirects to `/shop` (the shared `BranchManager` already renders inline on the Branch tile), which also moots the duplicate-"Enterprise" header. Removed the Branches card from SHOP_TOOLS. (Team card kept — `/team` hosts the extra-seat purchase the inline Team tile lacks; residual overlap flagged for owner.)

**Customer card (`/vendor-dashboard/clients/[eventId]`)** — "Log payment" now targets the thread's `#pending-payments` anchor and "Call" targets a new `#thread-call` anchor, so they no longer share the plain-chat URL with "Open chat" / "Chat".

**Verify** — deleted the hardcoded "free during launch" banner (the DB-driven intro already states the benefit + fee, and the hardcoded copy would go stale once a fee is set); trimmed SubmitCard to the SLA line (the 4 admin-run slots are enumerated once in "We handle this").

**Disputes / Team** — merged the twice-stated "neutral team reviews before it affects your rating" into one block (kept the actionable callout); slimmed the team invite-footer seat math to the used/cap glance (the Extra Seats card owns the base+extra breakdown).

**Dead code** — deleted `vendor-stats-panel.tsx` (~800 lines, imported nowhere; duplicated live My Performance cards).

Typecheck + lint clean; production build green. Verified the whole audit against shipped code at `origin/main`.

SPEC IMPACT: None (UI/IA dedup on shipped code; no schema, SKU, or pricing change). Two owner-lock touchpoints flagged for sign-off — the Messages always-on reversal and the residual Team inline-tile vs `/team` overlap — logged at the bottom of DECISION_LOG.md.
