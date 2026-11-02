## 2026-07-09 · style(event-home): the countdown hero gets the Energy planning RING + serif name

"Energy, not skin" reskin — the couple event-home hero (`EventCountdownHeader`)
levels up two ways, with **no data / query / migration change**:

- **Serif event name** — `font-display` → `.m-serif` on the `<h1>`, matching the
  2026-07-09 home-hub reskin (wine + display serif). Source-Sans body untouched.
- **Planning progress RING** — the flat "Vendors locked" linear bar becomes a
  wine (`--color-mulberry`) SVG donut with a serif percent in the centre. Same
  inputs (`pct` / `lockedCount` / `totalLockable`), denser read: track =
  `text-ink/10`, value stroke = `text-mulberry`, `-rotate-90` + round cap,
  `X of N vendors locked` beneath.

tsc `--noEmit` + `next lint` clean. No new query, no i18n keys.

SPEC IMPACT: iter 0021 (couple dashboard) — first surface of the "Energy, not
skin" density pass on event-home (progress rings / serif headings). Owner
direction 2026-07-09 ("override the locks" — wine + serif in the dashboard).
Reference: project memory `project_setnayan_dashboard_design_direction`.
