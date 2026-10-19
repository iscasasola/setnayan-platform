## 2026-10-19 · feat(tablet): the couple dashboard is a tablet from 701 — one boundary for the rail, the dock, the sheet and the page docks

Owner-approved 2026-10-19 (DECISION_LOG "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)", prototype
`prototypes/couple_dashboard_desktop_tablet_2026-10-19.html` 0f7e3858/b96c097d). PR 1 of 3 — the shell and the boundary.

- **One line, 701.** New Tailwind screen `tab: 701px` + `BREAKPOINTS.tab` (`lib/use-responsive.ts`). The event layout
  hands `boundary="tab"` to the shell (`AppRailShell` → `FrontDoorShell`, written as `data-boundary="tab"` on `.fd`
  and as the `useShellBoundary()` context) and to its `BottomDock` (`tab:hidden`). `app/_components/shell-boundary.tsx`.
- **The rail's 72-px strip comes down to 701** in the opted-in tree only: a tablet band in `front-door.css`
  (`@media (min-width: 701px) and (max-width: 1023.98px)`, `.fd[data-boundary='tab']`) restates the 1024–1279 strip
  over the drawer rules every tree gets below 1024 — no hamburger, no scrim, no hide-on-scroll transform, "+ Create"
  back. The word rail from 1280 is untouched.
- **The slim phone bar ends at 701 for every tree** (was 768) — the mark/word swap already switched at 701, so
  701–767 drew a half-switched bar.
- **The sheet docks right from 701 in the couple dashboard** (`SHEET_AT.tab`), from 1024 everywhere else
  (`SHEET_AT.lg`, byte-identical classes to before) — the same answer the dock gives on each surface.
- **The page docks move with the bar**: Guests and Budget `.lower`, Suppliers Find/Build bars and the cart peek take
  their shipped desktop place from 701 (Budget's and Find's 720-px rows also clear the 72-px rail); the Live Studio
  control room stops subtracting a bottom bar that is gone; the event column's dock clearance cancels at 701.
- **Hover ring only under `(hover: hover) and (pointer: fine)`** on the rail rows from 701 (a finger never leaves a
  stuck wash).
- **Labs:** `&shell=1` on `/dev/home-lab`, `/dev/guests-lab?part=screen|setup`, `/dev/suppliers-lab`,
  `/dev/budget-lab` draws the REAL One Shell (`app/dev/_lab-shell/lab-shell.tsx`) so the band can be walked with no
  sign-in and no database.
- **Unchanged on purpose (areas 3–4, not designed):** the front door, the doorways, the launcher, the account spokes,
  the supplier dashboard and HQ keep the off-canvas drawer and their bottom bars below 1024.
- Guards: new `the-tablet-band-is-the-strip.test.ts`; `sheet-agrees-with-the-nav`, `unfolding-ends-the-drawer`,
  `the-page-clears-the-dock`, `the-phone-has-one-bottom-bar`, `the-phone-bar-is-anchored`,
  `drawer-keeps-the-studio-lines`, `live-studio-wave8-layout` re-pointed at the per-surface boundary (8 sabotages red).

SPEC IMPACT: None — implements the approved DECISION_LOG row and prototype as drawn; no new ruling.
