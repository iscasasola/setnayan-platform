## 2026-07-01 · chore(ci): guard against re-inflating the vendor-dashboard layout

Protects the 2026-07-01 vendor-dashboard perf work (#2529/#2533/#2543/#2546).

- New `apps/web/scripts/lint-vendor-layout-revalidate.mjs` — fails CI when a NEW
  broad `revalidatePath('/vendor-dashboard', 'layout')` or `revalidatePath('/',
  'layout')` appears. Those layout-mode busts on the root path defeat the client
  Router-Cache window (staleTimes.dynamic=60) for the whole vendor subtree, so
  every subsequent navigation refetches — silently undoing the "cheap layout"
  win. Page-scoped `revalidatePath('/vendor-dashboard/<page>')` is unaffected.
- Uses the repo's ratcheting-baseline pattern (like lint-guest-legibility): the
  tree already has 5 intentional, low-frequency admin/tour uses (admin pricing
  edit → vendors see new prices; global-settings nuke; guided-tour completion),
  recorded as per-file allowed counts. Only NEW drift beyond baseline fails.
- Wired as `pnpm lint:vendor-layout` + a CI job in `ci.yml`.

NOTE: like lint-radius, this is NOT yet a required check — the owner promotes it
via branch protection (add "lint vendor layout revalidate") to make it blocking.

Verified: passes the current tree; a synthetic broad bust fails with a GitHub
annotation; page-scoped / deeper-path / `/dashboard` calls are correctly ignored.

SPEC IMPACT: None. CI/dev tooling only.
