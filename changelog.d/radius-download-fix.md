## 2026-06-26 · fix(radius): tokenize the 3 arbitrary radii in download-motion

`apps/web/app/download/_download-motion.tsx` used 3× arbitrary `rounded-[Npx]`,
which kept the (informational, RADIUS_LINT_STRICT) "lint radius tokens" CI tree
red for every PR. Swapped to standard token-backed classes, intent-preserving:
`rounded-[5px]` on a 10px dot → `rounded-full` (it was a circle; matches the
sibling dots) · `rounded-[8px]` → `rounded-md` (exact `--m-r-sm` 8px) ·
`rounded-[10px]` → `rounded-md` (nearest token). No other files touched;
`RADIUS_LINT_STRICT=1` now exits 0.

SPEC IMPACT: None.
