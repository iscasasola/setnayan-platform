## 2026-07-11 · fix(dashboard): nav-consistency audit fixes — Budget desktop parity, after-phase label, dead-config prune, stale copy

Resolved four confirmed findings from a couple-dashboard nav-consistency audit,
bringing the desktop sidebar back in line with the mobile SSOT and clearing dead
config left by earlier renames/flattens.

- **Budget desktop/mobile divergence (Finding 1).** The desktop sidebar builder
  (`customer-nav-config.ts`) still built a top-level `budget` PLAN item (with
  Activity + Disputes children) after the mobile SSOT (`lib/customer-menu.ts`)
  had already removed the standalone Budget menu (owner 2026-07-10 — Budget now
  lives in the Merkado tab). Removed the desktop item + its now-unused
  `Wallet`/`Activity`/`Shield` icon imports + the `budget` entry in
  `SIDEBAR_SLOT_KEYS`. Reachability after removal: `/budget` → the Merkado's
  Budget tab ("Open budget & payments" lens link, `merkado-budget-lens.tsx`);
  `/disputes` → the vendor booking cancel→dispute flow
  (`cancel-booking-button.tsx`); `/activity` → the "See all recent activity →"
  link at the foot of the dashboard body's "Around your event" section
  (`event-dashboard.tsx`, added in the re-audit follow-up). The
  `customer.sidebar.activity/disputes`
  registry slots + their `CHILD_SLOT_KEYS` mappings are intentionally kept so a
  re-surfaced link stays admin-editable.

- **After-phase label leftover (Finding 2).** The `ctx.phase === 'after'` roster
  in `lib/customer-menu.ts` hardcoded `label: 'Home'` for `key:'home'`; the
  Home→Overview rename missed it (plan-phase + the registry default are
  'Overview'). Changed to 'Overview'.

- **Dead nav config from the Overview leaf-flatten #3004 (Finding 3).** Removed
  the unread `unreadMessages` param from `buildCustomerNavGroups` opts and the
  dead nav-config pass-through in `CustomerSidebar` (the value is still legit for
  the topbar bell in `layout.tsx`, untouched; the prop is retained on
  `CustomerSidebar` only for that call site's type-check). Deleted the dead
  `CHILD_SLOT_KEYS` entries `schedule`/`messages`/`contracts`. Deleted the
  orphaned `NAV_SLOT_DEFAULTS` rows `customer.sidebar.schedule` /
  `customer.sidebar.messages` / `customer.sidebar.contracts` +
  `customer.home-subnav.overview` / `customer.home-subnav.checklist` (zero
  consumers). Refreshed the stale header docstrings in `customer-sidebar.tsx` +
  `customer-nav-config.ts` to the current Overview/Merkado leaf IA.

- **Stale copy (Finding 4).** `app/dashboard/(account)/profile/page.tsx` said
  "Home tab" in three places (Planner mode + Planning reminders copy); updated
  to "Overview tab" after the Home→Overview rename.

Verification: `tsc --noEmit`, `next lint`, `tsx --test lib/**/*.test.ts` (1402
pass), the nav-icon-source / bottom-nav / radius / legibility guards, and
`next build` all pass.

SPEC IMPACT: None (nav-chrome consistency + dead-config cleanup within the
owner-locked 2026-07-10 "Budget lives in Merkado" + Home→Overview decisions; no
schema, RPC, SKU, pricing, or route change — /budget, /activity, /disputes routes
are unchanged and stay reachable).
