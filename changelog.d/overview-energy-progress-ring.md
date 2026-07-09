## 2026-07-09 · feat(overview): energy density — wine progress ring in the couple countdown hero + reusable ProgressRing

First "Energy, not skin" density on the per-event Overview: the
`EventCountdownHeader` "vendors locked" signal upgrades from a flat gold bar to
the signature wine **progress ring**.

- New reusable primitive `app/_components/progress-ring.tsx` — pure inline-SVG
  donut, no deps, theme-aware, wine (`--color-mulberry`) stroke on a faint ink
  track, optional centered label. Reusable next across the home event cards,
  vendor completeness, and budget.
- `EventCountdownHeader`: the flat "Vendors locked X/N" bar → a 76px ring
  showing `pct%` in the center + "X of N vendors locked" + "N more to lock in".
  Same data (`lockedCount`/`totalLockable`), no page.tsx or query changes.

Scoped deliberately: the Overview is a 1866-line cockpit, so this touches one
self-contained header component and adds a shared primitive — not a page
rewrite. `tsc` + `next lint` clean.

NEXT (density layer, further PRs): adopt the ring on the home hub event cards
(replacing the flat bars), then bento tiles / mini-donuts / per-surface serif
headings across the remaining Overview cockpit + vendor/admin surfaces.

SPEC IMPACT: None.
