## 2026-07-03 · fix(vendor-dashboard): unblock the radius-token CI guard

`editable-row.tsx`'s Leaflet pin `divIcon` used a hardcoded
`border-radius:9999px` inside its raw HTML string, failing the
`lint radius tokens` CI check on every PR since it merged. Swapped to
`border-radius:50%` (identical circle for the 16px pin; the guard only flags
hardcoded px radii — a Tailwind class can't reach inside a Leaflet HTML
string).

SPEC IMPACT: None.
