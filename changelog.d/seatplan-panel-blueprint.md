## 2026-07-16 · feat(seating): panel tabs + blueprint canvas + mobile drawer — council verdict cluster 2

Second cluster of the scroll-less seat-plan recomposition (after #3275's frame +
command bar), implementing `Seat_Plan_Scrollless_Council_Verdict_2026-07-15` §3/§7
and `Seat_Plan_2D3D_Alignment_Directive_2026-07-15`. Presentation-only — zero
server-action / dirty-set / geometry / collision (`lib/seating.ts`) / world-layer
changes; every data path, action, lock, route, and flag is unchanged.

- **Left panel → three tabs** (verdict §3): the 8-section mega-scroll becomes
  **People / Tables / Rules**, full-height with the search pinned above the tab
  strip and its own scroll pane. People = "only show unseated" (pinned) +
  Individual Members + Member Groups; Tables = `+ Table` + AddTablePanel + the
  tables list; Rules = Seating Priority + Seating Guide. The active tab persists
  per user (`localStorage seating:panel-tab`). Badges: unseated count on People,
  a **warm-red violation count on Rules** (real breaches only — honesty rule) so
  breaches are visible from any tab. The picked-guest echo stays in the canvas
  contextual pill so pick-to-seat survives a tab switch.
- **Virtualization** (verdict §3): member rows get `content-visibility:auto` +
  `contain-intrinsic-size` — the dependency-free fix for the "250 pax, no
  virtualization" bug (no new deps; react-window avoided).
- **Blueprint 2D restyle** (directive): the interactive canvas shifts to skeletal
  linework — **chairs render as seat-footprint slots/ticks, not `Armchair`
  furniture icons** (empty = hairline `border-current` outline that keeps the
  pick/idle affordance colour; occupied = colour-tinted footprint under the guest
  SeatBadge). Room walls, table hubs, and the serpentine ribbon drop to hairline
  (`border-2 → border`, stroke 2 → 1.25); dimensions, table counts, and element
  marker labels go **Space Mono**. Illustration richness stays in the 3D lab.
  Gated to the interactive canvas only — the PDF/print/caterer exports are
  independent server routes (`export|print|caterer/route.ts`, `lib/seating-pdf.ts`)
  and do NOT import this render layer, so the Mood-board PDF's illustrative mode
  is untouched.
- **Mobile bottom drawer** (verdict §7): below `lg` the stacked panel-above-canvas
  sandwich is replaced by a bottom drawer over a full-height canvas — 3 snap points
  (peek handle with a mono "N to seat · N tables" label / half / full), drag-to-
  resize (snaps to nearest) + tap-to-cycle, `prefers-reduced-motion` respected.
  The drawer yields to its handle while the <768px per-table sheet is open (never
  stacks). The command bar condenses: the three `+ Add / Arrange / Share` menus
  collapse into a single **`⋯` overflow sheet** (one source of truth for the rows,
  shared with the desktop menus); the save chip + a short "Auto" Auto-Arrange stay
  visible; the zoom cluster + scale bar lift above the peek handle so they stay
  reachable.
- Kit: command bar stays the only blurred surface; gold budget unchanged (Auto
  Arrange still mulberry — S3 not jumped); mono data labels; `lint:radius` clean.

SPEC IMPACT: `Seat_Plan_Scrollless_Council_Verdict_2026-07-15.md` §3 + §7 and
`Seat_Plan_2D3D_Alignment_Directive_2026-07-15.md` (blueprint 2D projection) now
built on the interactive editor. DECISION_LOG row appended in the corpus.
