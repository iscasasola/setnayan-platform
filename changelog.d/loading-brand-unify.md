# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · refactor(loading): unify every loading screen on the gold-particle brand loader

Owner directive (2026-07-05): update all loading screens — initial + process — onto **one signature loading moment**. The cold-start splash (`#sn-init-splash`) and blocking-action overlay (`useLoader`) were already the gold-particle `SDLoader`; this lands the same mark on the ~167 route-navigation skeletons and the handful of custom `loading.tsx`, and **retires the interactive "play while you wait" overlay** (Tap Burst / Wedding Wisdom / Quick Pick).

- **`components/loading-activity.tsx`** — rewritten. `LoadingActivity` (the export the shared `<Screen>` skeleton wrapper renders above every route) now fades in the branded `<SDLoader>` over the page skeleton via the reused `.sd-overlay`, with section-aware narration resolved from the URL. All ~167 route skeletons pick this up through `<Screen>` with **no per-file change**. The old TapBurst/WisdomCard/QuickPick games + their WISDOM/PICKS copy banks are gone.
- **`components/sd-loader/loader-steps.ts`** — new `ROUTE_STEPS` map: per-section route-nav narration (3 lines each) + a human `hint` sublabel for guests / vendors / budget / schedule / seating / messages / studio / website / explore / orders / workspace / admin / vendor-dashboard, with a generic `route` fallback. Also exported from `sd-loader/index.ts`.
- **Custom (non-`<Screen>`) routes brought onto the mark:** the per-vendor **workspace** loader now renders `<SDLoader>` directly (was a bespoke spinner + `LoadingStatus`); the **site-editor** loader drops its redundant `<LoadingNarration>` strip since `BoardPageSkeleton` → `<Screen>` now carries the branded loader; **vendor-invite** and **vendor/lock** skeletons get `<LoadingActivity>` layered on top. Monogram already used `<SDLoader>` and is unchanged.
- **Untouched (already unified):** boot splash `#sn-init-splash` (CSS-only `.sd-loader`), the `useLoader()` blocking overlay, and all `LOADER_STEPS` action copy.

Behaviour preserved: first paint shows the SSR skeleton alone (instant page structure); the brand overlay fades in only after hydration, so fast (<~200ms) navigations never flash a heavy loader. Reduced-motion is handled by `SDLoader` + the global a11y block. Verified: `tsc --noEmit` clean across all touched files.

SPEC IMPACT: None — visual/UX unification of the shipped loading system; no schema, no pricing, no SKU change.
