## 2026-07-13 · chore(account-chrome): delete the orphaned account-nav sidebar cluster

Follow-up to PR #3224, which retired the old `(account)` dashboard sidebar (the
account surfaces now render the launcher's chrome-less top bar instead of
`SidebarShell`). That left three files with no live importer — they only
referenced each other (`account-mobile-nav` → `account-sidebar` →
`account-nav-config`). Deleted the cluster:

- `app/dashboard/(account)/_components/account-sidebar.tsx`
- `app/dashboard/(account)/_components/account-mobile-nav.tsx`
- `app/dashboard/(account)/_components/account-nav-config.ts` (`buildAccountNavGroups`)

- `scripts/lint-nav-icon-source.mjs` — dropped `account-sidebar.tsx` from the
  `CHOKEPOINTS` delegation list (it read each entry and failed the build on a
  missing file), with a comment noting the account doorway no longer has a
  sidebar. The other doorway chokepoints (event / vendor / admin sidebars +
  bottom navs + marketing top-nav) are unchanged. `doorway-sidebar-header.tsx`
  is untouched — still consumed by the event / vendor / admin layouts.

Dead-code removal only — no runtime surface. `node scripts/lint-nav-icon-source.mjs`
passes; `tsc --noEmit` clean.

SPEC IMPACT: None.
