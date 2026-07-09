## 2026-07-09 · style(home): adopt the ProgressRing on the hub event cards

Consistency with the Overview density reskin (#2935): the "Where to?" hub's
event cards swap their flat wine progress bar for the shared **ProgressRing** —
a 42px wine donut showing `pct%` in the center, with "Planned · N days" beside
it. Falls back to the plain countdown caption when an event has no checklist
rows (no ring, no fabricated number). Reuses
`app/_components/progress-ring.tsx`; no data changes. `tsc` + `next lint` clean.

SPEC IMPACT: None.
