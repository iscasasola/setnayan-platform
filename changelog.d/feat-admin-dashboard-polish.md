## 2026-07-10 · polish(admin): declutter the Overview sidebar (default-collapse) + close #2965 deferred items

Owner reacted to the reskinned admin sidebar ("this is the admin?"): because the
admin LANDS on `/admin` — the Overview ('queues') menu's own hub — the shipped
6-menu respine auto-expanded Overview's ~18 queue children on arrival, so the
clean six-menu rail read as a long cluttered list duplicating the `/admin` queue
tiles. This declutters that and closes the batch of #2965 deferred polish items.
Admin doorway only (`apps/web/app/admin/**`); `require-admin` gate and the
`--a-violet` accent untouched.

### Task 1 — declutter (the owner-flagged fix)

- New admin-local `app/admin/_components/admin-sidebar-menu.tsx` renders the six
  menu rows. It keeps the shared `<SidebarItem>` look (parent row + indented
  children + the aggregated parent badge) but adds a real expand/collapse
  **toggle** (the chevron is a button, not just an indicator), persisted under
  the same `setnayan.nav.section.<key>.open` localStorage key the SidebarSection
  primitive uses.
- The **Overview ('queues') menu defaults COLLAPSED even when active**
  (`collapsedWhenActive`), so the admin lands on six clean parent menus. The
  other five keep the shipped auto-expand-on-active default. An explicit user
  toggle wins (persisted). No route, tile, or `ADMIN_NAV_GROUPS` entry removed —
  purely a default-expand-state change; the shared `<SidebarItem>` (imported by
  the couple + vendor doorways) was NOT modified.
- Every queue stays reachable: the `/admin` tiles + work list link to each, and
  the Overview section reopens from its toggle. The live queue-count aggregation
  onto the Overview parent (`aggregateParentBadge`, worst-urgency tone) still
  renders while collapsed, so folding never hides SLA pressure.
- Mobile `admin-bottom-nav.tsx` is a flat ≤5-tab strip with no expand logic and
  `admin-nav-fab.tsx` is a single action — neither replicates the expand
  behavior, so neither needed a mirror change.

### Task 2 — #2965 deferred polish

1. **Lane rollups** on the Overview action-queue lanes — a per-lane aggregate
   open-count chip toned by worst urgency, derived from the same digest-backed
   tile values (no new query). Shipped.
2. **Activity-feed status chips** — each `admin_audit_log` row gets an outcome
   chip + toned leading dot read straight off its real action code (done /
   action / update). Shipped. The **sparkline was SKIPPED** — the activity feed
   is 8 discrete rows, not a real metric series, and there is no honest
   pre-loaded time series to draw one from (the KPI cluster already carries the
   real cleared-queues `ProgressRing`).
3. **`.m-card` unification** — the ad-hoc `rounded-2xl/bg-cream` "Recent admin
   activity" card migrated onto canonical `.m-card`; the Taxonomy + AI-brain
   stat grids migrated via the new shared card below. Shipped.
4. **Shared `KpiStatCard`** — `app/admin/_components/kpi-stat-card.tsx` extracts
   the repeated numeric KPI tile (canonical `.m-card` + `.m-mono` eyebrow +
   display number). Adopted on the Overview stats grid (8 tiles) and the
   Taxonomy + Brain grids (identical numeric tiles). Admin-local — not a
   repo-wide component the other doorways import. The divergent dense / iconed
   `Stat` variants (payments, payouts, pricing, …) were intentionally left as-is.
5. **7-day stat deltas** — **SKIPPED honestly.** No prior value is pre-loaded and
   an as-of-7-days-ago count is neither already-available nor cheap-and-accurate
   (entity totals are subject to deletions, so a derived delta could be wrong —
   worse than none). Omitted rather than fabricate a number.

Verify: `tsc --noEmit` clean · `next lint` (no new errors — only pre-existing
warnings in untouched files) · 1343/1343 unit tests · radius (strict) + nav-icon
+ bottom-nav + legibility guards pass · `next build` exit 0.

SPEC IMPACT: None — admin sidebar default-collapse behavior + admin-only UI polish; no schema, pricing, SKU, or product-decision change.
