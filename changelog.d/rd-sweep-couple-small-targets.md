## 2026-10-19 · fix(couple): the ⓘ presses at 44, "1 category", the Home lab draws the Home's gutter

Quality sweep 2026-10-19, batch 9 "couple-small-targets" (rows B11, C1, C8, C13).

- **B11 — the ⓘ presses at 44 × 44.** `.sn-dot-btn::after` (globals.css) now reaches
  `min(-8px, calc((100% - 46px) / 2))` on every side, so InfoTip's 16-px circle ("About Target",
  "About Agreed", "About Waiting for their yes") presses at 46 × 46 instead of ~30. The circle is still
  drawn 16 px. A dot button that was already bigger keeps its old 8-px halo, so its press does not shrink.
  Walked: Budget and Suppliers · Booked at 375 (elementFromPoint).
- **C1 — no change needed.** The pill selector's choices are drawn 38 px inside a 44-px track (the approved
  shape, § 2.E). They already press at 46 through `.sn-hit` (#6499 / dark-mode PR 4), which
  `the-shared-controls-press-at-44` already guards. The sweep measured `getBoundingClientRect`, which cannot
  see the `::after`. Walked: Find / Build / Booked and the Maker's Invitation / Studio press at 45–46.
- **C8 — "1 category".** New `countNoun(n, one, many)` in `lib/format-number.ts`. The Suppliers bench folder
  line uses it. The "Not knowable" wording is left as it is: the approved Suppliers prototype keeps it word
  for word, so changing it is the owner's call (see the PR body).
- **C13 — the 16-px overflow at 1280 was the lab's.** The real event layout pads `px-4 sm:px-6 lg:px-8`,
  which is exactly what `HomeCoverBand` pulls back. `/dev/home-lab` padded `px-4` at every width. The lab
  now wraps the Home in the layout's own gutter.
- Maker: in the same page and the same state, every Maker tool state (open · Style · Background · Animate · Edit)
  at Chromium 375 and WebKit 390 came out pixel-identical, with the same button rects and the same scroll
  overflow, whether the old halo was forced back or the new rule was in place. No Maker JS changed.
- Guards: `lib/the-shared-controls-press-at-44.test.ts` (the ⓘ on both axes, drawn at 16, every
  `.sn-dot-btn` in app/ ≥ 44 × 44 with no clip or `after:` override), `lib/format-number-count-noun.test.ts`,
  `lib/the-home-cover-band-fits-its-gutter.test.ts`. `lib/press-reach.ts` reads the new `inset: min(…)` form.

SPEC IMPACT: None. This changes no ruling. The "Not knowable" copy question goes to the owner and is not edited.
