## 2026-07-21 · fix(live-studio): the control room fits one screen, no page scroll

An operator surface used during a ceremony that cannot be re-run must not scroll: a control below
the fold is a control you cannot reach, and whatever you scroll past is a camera you can no longer
see. Every hardware switcher fits on one screen for this reason.

**The cause was `aspect-video` on the PROGRAM monitor**, which derives height from **width**. On a
wide desktop column that produced a ~1000px monitor before the sources rail was even reached, so
the page scrolled and the overlay's own bottom band fell off screen.

Height now flows the other way — the console is told how tall it may be and the monitor takes what
is left.

- **`lib/panood-console-fit.ts`** — available height is **measured** from the console's own
  `getBoundingClientRect().top`, not summed from the shell's chrome (sticky bar + padding + mobile
  nav). Any hardcoded sum of those rots the first time one changes.
- Mobile-nav clearance follows **viewport** width (the nav is `lg:hidden`), *not* the board/compact
  layout mode — the two are allowed to disagree, since layout is device-driven. `env(safe-area-inset-bottom)`
  is subtracted for the iPhone home indicator.
- **A floor, not a crush**: below 420px it stops shrinking and lets the page scroll a little.
  On a short window with OBS docked, that is the honest outcome.
- Returns **null** on an unusable measurement (SSR, zero viewport, mid-transition) so the console
  falls back to natural flow rather than collapsing to zero.

Layout consequences: the console root is a fixed-height flex column; `min-h-0` throughout so the
monitor can actually shrink; the program `<video>` switches `object-cover → object-contain`, since
the box is no longer 16:9 and cropping would make an operator misjudge their own shot. In compact,
the tab body is the **one** scrollable region — PROGRAM and the tab bar stay pinned. In board, each
column scrolls internally, with the rails capped at half the column so a long moment list can never
squeeze out the monitor.

9 new unit tests (124 total, all pass). Typecheck + production build clean.

SPEC IMPACT: None — layout fix to the shipped console.
