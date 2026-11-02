## 2026-07-01 · fix(vendor-dashboard): route performance-card corner radii through --m-r-* tokens

The `lint radius tokens` CI guard was failing on `main` — 10 ad-hoc `rounded-[Npx]`
sites across the 7 vendor-dashboard performance cards. Swapped each arbitrary
radius for the design-system Tailwind class that maps to the SAME `--m-r-*` token
(verified against tailwind.config.ts, where the class names are NOT 1:1 with px):
`rounded-[14px]` → `rounded-lg` (var(--m-r-md)=14px), `rounded-[22px]` →
`rounded-2xl` (var(--m-r-lg)=22px), `rounded-t-[3px]` → `rounded-t-sm`
(var(--m-r-xs)=4px, nearest token). Visuals preserved; the radius guard now passes.

Files: demand-preview / funnel-preview / growth-recs / health-composite / momentum
card + chart / roi-attribution.

SPEC IMPACT: None
