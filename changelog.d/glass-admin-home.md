## 2026-07-15 · feat(admin): Glass PR-8 — admin shell home focal + queue-page pattern

Atelier-Glass rollout PR-8 (rollout plan § 3.4 / § 5 PR-8 — the deliberately
restrained admin pass). Recomposes the admin **Overview** into the shared shell
language and applies the load-bearing **queue-page pattern** to the three named
work queues, without touching data sources, actions, routes, copy-facts, or
flags. Builds on the PR-1 foundation (already-landed kit classes + violet
retirement, #3251/#3257) and the shipped launcher/vendor idioms.

- **`admin/template.tsx`** (new) — 3-line `.sn-page-enter` shell transition (soft
  rise on pathname change; RM-frozen). Matches the event/account templates.
- **Home focal "Exception Desk"** (`app/admin/page.tsx`) — the one `.sn-tile-dark`
  obsidian focal (`sn-bloom`). Headline = open items across the ACTIONABLE work
  lanes, computed **exactly as the launcher HQ signal** (iterate
  `ADMIN_QUEUE_META`, exclude the `support` lane, sum `getAdminQueueDigest`
  counts) — same number as the launcher card by construction. Adds the urgency
  sub-line (past-SLA / due-soon, warm semantics), a cleared-queues ProgressRing
  (`sweep`), the top-3 busiest lanes, and the gold work-list CTA + platform-
  upgrades link. Replaces the old mulberry-gradient KPI-cluster section.
- **Glass lane bento** — the 4 consequence lanes as glass `.sn-tile`s (blur
  budget: 4 tiles + focal = 5, under the 8-cap); the `ActionQueueTile`s inside
  stay **opaque** (nested-in-glass → flat) with Space-Mono `CountUp` counts.
- **Saira retirement** — every KPI/queue numeral flips from Saira Condensed to
  **Space Mono** (`app/admin/page.tsx` KPI cluster + `ActionQueueTile`;
  `_components/kpi-stat-card.tsx`). `KpiStatCard` → opaque `.sn-row` + `.sn-eye`
  + `CountUp`; `_overview-tile.tsx` nav tile → opaque warm card + gold accent.
- **Queue-page pattern** on `payments/`, `verify/`, `disputes/`: `.sn-h1` header
  + `.sn-eye` eyebrow, filter rows → `.sn-chip`/`.selected`, list surfaces → ONE
  `.sn-tile` wrapper with opaque `.sn-row` items / opaque table rows (no per-row
  blur, no row entrance animation). Status pills → the warm `--sn-*` semantics
  (#B77E2E / #5E7C52 / #4E6C82 / #A6483B); **violet retired** on disputes
  (`resolved_for_couple` + enterprise/custom tier chips → info-slate); stock
  `red-*` / `bg-cream` / mulberry / terracotta idioms swapped for kit tokens.

Fences honoured: the ~95 other admin routes (PR-9), `admin-nav-*`/sidebar chrome,
and every non-admin surface untouched. Gates: typecheck + ESLint + `lint:radius`
+ local production build all green.

SPEC IMPACT: None — visual/motion recomposition only (rollout plan § 3.4 / § 5
PR-8). No schema, SKU, pricing, route, data-source, action, copy-fact, or flag
change.
