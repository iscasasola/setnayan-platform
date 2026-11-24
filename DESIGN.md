# DESIGN.md: no generic "AI look"

> A pointer, not a copy. The full standard is **HOUSE_DESIGN_STANDARD Part I** in the specs corpus
> (`iscasasola/Setnayan-specs`, `HOUSE_DESIGN_STANDARD_2026-11-20.md`, Part I added 23 Nov 2026). **That file wins on
> any conflict with this one.** Values (colours, radii, shadows) live there and in `apps/web/app/globals.css`, never here.

Every screen, sheet, modal and component follows these five rules. A break is a defect, not a style choice.

1. **No decorative gradients** on headers, buttons, backgrounds or chart fills, and never purple-to-blue. One flat accent, only for the main action, the active state and the one key number.
2. **No icon tiles** (a coloured pastel box behind an icon). Icons are monochrome and appear only where they do a job.
3. **One hero metric.** Never a row of 3–4 equal KPI cards with repeated green % badges. One number large; the rest smaller and quieter.
4. **Hairlines, not shadows.** 1 px hairline on static cards, inputs, badges and charts. Shadows only on floating overlays (modal, sheet, dropdown, popover, tooltip, floating button). Radius 4 for badges and inputs, 12 for cards, 22 for sheets; a search, chat or compose pill with its buttons inside stays a full pill.
5. **Exact words and numbers.** No filler ("Welcome back, X 👋", "+12.5% from last month"). Name the exact period. `tabular-nums` on every number. A small sparkline beats a row of % pills. Never show a comparison the app cannot compute.

Where the work stands: [`audits/part-i-2026-11-23.md`](audits/part-i-2026-11-23.md) maps every known break by area and the fix rounds.
