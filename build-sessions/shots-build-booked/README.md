# Build + Booked — shots and the safe-navigation walk (390 px)

**Proposed** = the owner-approved prototype `controller-2026-11-12/suppliers-one-prototype-2026-11-12.html`, drawn
headless at its 375-px phone: `proposed-build-top.png` · `proposed-build-fold.png` · `proposed-booked-top.png` ·
`proposed-booked-open.png`.

**Now — not in this folder, on purpose.** The live walk on 2026-11-13 was done on the owner's own event before the
controller ruled "never touch cale-ice, not even read-only"; those images were removed from this PR. The
replacement — a local preview of `/dev/suppliers-lab` on fixture data — could not be produced on this machine: the
first compile took 14 min under a load average of 8+ and ended in a 500. testnayan1 has no session in the browser pane
and no password was entered. **The controller should shoot Now from a lab or a testnayan1 session before shipping.**

## What this PR changes

1. **Booked — an opened row no longer cuts off its right-hand buttons.** Measured live at 390: the chapter pickers,
   Share and the tiles ran 6 px past the 16-px gutter and `.bk-exp>div{overflow:clip}` cut them. Cause: the fold's
   one grid track grew to its widest child. Fix: `grid-cols-[minmax(0,1fr)]` on `data-booked-fold` (applied in the
   browser first: 0 buttons past the gutter). Pre-existing, not from #7530.
2. **Build — a "Nobody yet" line's Find door sits on its own row under its words**, as the prototype draws it. A long
   category ("Jewelleries & Accessories") was squeezed into a three-line column beside a wide button.

Both are guarded: `lib/booked-is-the-team.test.ts` §7 and `lib/the-build-is-the-approved-frame.test.ts` §6.

## Safe-navigation walk — how each screen exits

| Screen | Ways out |
|---|---|
| Build (body) | bottom bar (Today · Guests · Suppliers · Memories · Hub) · ☰ menu · pinned `Build ▾` → Find / Booked · each "Find in X" → Find with that category open |
| Build › "Nobody yet · N" fold | the same line closes it (a native `<details>`); nothing is trapped inside |
| Build › Compare sheet | Done · ✕ · tap outside |
| Build › Save / Rename sheets | Not now / Cancel · ✕ |
| Build › Book this build ask | its ask sheet's No / ✕ (only "Yes, book them" sends) |
| Booked (body) | bottom bar · ☰ menu · pinned `Booked ▾` → Find / Build |
| Booked › an opened row | tap the row again, or open another (one open at a time) |
| Booked › "Which chapters will they serve?" ask | ✕ · Not now (per visit; it asks once per supplier needing a chapter, so N suppliers = N closes in a row) |

No dead end. The header hides on scroll down and returns on scroll up; no header text clipped at 390;
`scrollWidth` = 390 on both pages (no sideways scroll).

## Seen, not mine (flagged to the controller)

- The pinned row read "1 booked" for a moment while the body said "5 booked", then settled — the `find-organized`
  session's pinned row.
- Arriving on Booked with 3 suppliers needing a chapter opens the chapters ask 3 times in a row.
