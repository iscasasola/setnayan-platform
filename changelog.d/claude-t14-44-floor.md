## 2026-11-14 · style(couple): /dashboard buttons reach the 44 px floor (RW-304a follow-up to T14)

The shared pill (`.ab`) is 40 px by default. On `/dashboard` and its library tabs the standalone buttons now lift to the
sheet's 44 px floor with the repo's own `!h-11` pattern (icon-only (+) also `!w-11 !min-w-11`): Create an event and the
(+) on the board, Edit editorial · View page · View editorial, Contact, and the photos/suppliers tabs' Create an event,
Share the Memories link, View & download, Explore the marketplace. No new look — same pills, 4 px taller.

Left as is: the profile header's 26 px pen (photo / name) is the v3 design — a 26 px circle whose touch target is already
44 px through `::before` (`app/u/_components/profile-header.tsx`, outside these folders).

SPEC IMPACT: None — implements the approved design template's 44 px button floor; no decision changed.
