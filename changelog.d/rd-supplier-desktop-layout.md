## 2026-10-23 · feat(supplier, desktop): the supplier dashboard wears the couple's desktop shell — the strip from 701, one body width per tab, sheets as the 440 panel

Area 3 of "DESKTOP COVERS THE WHOLE APP", drawn in `prototypes/desktop_layouts_2026-10-22.html` family 2 ("the same
shell as the couple's, the shop's four rows pushed in" — the rail itself swaps, owner Q1 23 Oct, PR #6827). Phone
(< 701) untouched.

- **The couple's line.** `vendor-dashboard/layout.tsx` hands `boundary="tab"` to the shell AND the dock (the bar used
  to dock itself at the default 1024): from 701 the rail's 72-px strip replaces the phone bar (240 with words from
  1280), and every shared `Sheet` on the supplier pages is the one 440-px right panel (`SHEET_AT.tab`). The page's
  phone-bar clearance ends at 701 (`tab:pb-0`).
- **One body width per tab** (the prototype's table): Today · Customers › Money · Shop (Services · Page · How it is
  going) · Hub → the reading column, 48 rem; Customers › People · Dates → the wide stage, 64 rem. The old slabs
  (`max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl`) leave the four tabs; Today's first screen and How it is going's top
  block give up their own 36 rem from 701 so the measure IS the column; the fold accordion below Customers and Shop
  takes its page's measure (`FeatureAccordion measure`).
- **The dock pins from 701**: the supplier thumb row (search + Add · Check a date + Add · Log a payment · View + Apply)
  takes its pinned place at the foot of the stage from 701, not 1024 — clear of the strip.
- **Lab:** `/dev/supplier-lab?…&shell=1` draws the real shell (rail · strip · dock) around the lab bodies, each in its
  page's column, so the tablet band is walkable with no sign-in (`app/dev/_components/supplier-lab-shell.tsx`).
- **Not built, named:** a customer row opening as a 440 panel (on the phone it is a page, not a sheet — the "same sheet
  as a panel" rule has nothing to carry); the service card maker as the panel and the Hub's scanner result / lock
  sentence as the panel (each is a page or a full-screen view today, not a sheet). Supplier dark mode stays in the dark
  plan's step 4 (owner Q2).
- Guards: `app/vendor-dashboard/the-columns-are-the-system.test.ts` (each tab's outermost column, the money/wide split,
  the accordion's measure, no slab back); `the-tablet-band-is-the-strip.test.ts` now admits exactly the two designed
  trees and holds both the shell and the dock on the line, and the supplier thumb row's desktop place at 701.

SPEC IMPACT: None — implements the approved prototype `desktop_layouts_2026-10-22.html` family 2 and the 2026-10-23
DECISION_LOG row.
