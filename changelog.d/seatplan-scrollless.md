## 2026-07-15 · feat(seating): scroll-less editor frame — council verdict

Recompose the couple seat-plan editor (`apps/web/app/dashboard/[eventId]/seating/`)
from a document that scrolls into a fixed `100dvh` app frame — implementing
`Seat_Plan_Scrollless_Council_Verdict_2026-07-15` and the
`Seat_Plan_2D3D_Alignment_Directive_2026-07-15`. Zero capabilities deleted; a
pure JSX re-parenting (no server-action / dirty-set / world-layer changes).

- **`SeatingFrame`** (new `_components/seating-frame.tsx`): a `100dvh`,
  `overflow-hidden`, `flex-col` shell. Least-invasive shell opt-out — it measures
  its own top offset (the shell chrome height) and fills the rest; `page.tsx`
  bleeds the content padding so the page never document-scrolls. No `layout.tsx`
  change (sign-off S4 avoided). Dev assertion warns if a flow sibling pushes it
  down.
- **Command bar** (the page's ONLY backdrop-blur surface): a 52px row that
  absorbs the retired SeatStat strip + duplicate pills into one mono **stats
  chip**, plus **[2D · 3D · List]** segment, **`+ Add ▾`** (tables · entrance ·
  service door · dance floor · cocktail · sign ×24 · booth · room size & scale),
  **`Arrange ⚙▾`** (auto-seating + keep-groups policies verbatim · build draft ·
  fill-around-locked), **`Share & print ▾`** (3 Export PDFs · guest-photo
  visibility · walkthrough videos · publish & print), a **permanent save-status
  chip** (⌘S + `beforeunload` guard; no autosave — sign-off S2), and the single
  **gold Auto Arrange** primary. All 16 mapped controls remain reachable; coach
  marks ride the existing 0030 tour infra. Audit: 16/16, 0 lost.
- **Banner slot**: one single-line strip, priority DayOf > capacity > walima,
  losers collapse into a **"N notices"** command-bar badge that expands on tap.
- **Canvas fill**: deleted the `aspect-[7/5]` box + 64vh cap; the canvas absorbs
  all remaining height and to-scale mode letterboxes the room ratio inside the
  measured region (ResizeObserver → `fitView` on mount + resize). The
  world-layer pan/zoom pipeline is untouched. Contextual picked-guest /
  picked-group / linking / notice bars become one floating pill.
- **2D/3D**: the segment routes 3D to the existing `/seating/lab` with a dirty
  guard (Save & switch / Switch anyway) + hover prefetch + flag-hide
  (`NEXT_PUBLIC_SEATING_3D`). A mirrored segment on the lab chrome links back
  (List → `?view=list`), healing the doorway fork (comment updated at
  `lib/add-ons-catalog.ts`). One room, three projections.
- Kit: gold only on Auto Arrange + the active segment tick; mono counts/times;
  warm-red day-of + violations; `lint:radius` clean.
- Deferred to follow-up PRs (verdict is per-region separable): left-panel 3-tab
  virtualization (PR-2), the 2D blueprint restyle (directive), and the polished
  mobile bottom-drawer + condensed bar (PR-5). Mobile currently degrades to a
  usable flex split, not a blank canvas.

SPEC IMPACT: `Seat_Plan_Scrollless_Council_Verdict_2026-07-15.md` +
`Seat_Plan_2D3D_Alignment_Directive_2026-07-15.md` implemented (frame +
command-bar cluster; panel tabs / blueprint restyle / mobile drawer tracked as
follow-ups). DECISION_LOG row appended in the corpus.
