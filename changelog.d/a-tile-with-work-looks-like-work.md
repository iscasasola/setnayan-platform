## 2026-08-28 · fix(admin): a queue tile with work no longer renders the same colour as an empty one

The admin Overview's queue tiles had four states and three surfaces. A tile
holding work-but-not-yet-late was `bg-white/75`; a clear tile was `bg-white/70`;
and `.sn-tile`, the lane they nest in, is `--m-paper` = `#FFFFFF`. White at any
alpha over white composites to white, so those two states did not merely look
alike — they rendered the same pixel value. The only thing separating "somebody's
money is waiting" from "nothing to do" was a 3.5px triangle and a 10px label.

Reported by the owner against his own console, with one payment pending:
these cells "need to stand out when there are things to decide on."

- Any work at all now TINTS; clear is the only plain tile. Clock pressure moved
  onto a ring over the tint, so the ladder keeps four distinguishable rungs:
  overdue (danger tint + 2px ring) · due-soon (warning tint + 1px ring) ·
  open (warning tint) · clear (plain white, no icon).
- Fixed a shipped AA failure found on the way: `--sn-warning` (#B77E2E) on
  `--sn-warning-soft` (#F6EAD2) measures **2.92:1** — under the 4.5:1 body floor
  and under the 3:1 large-text floor the 30px numeral needs. The kit already
  ships `--sn-warning-deep` (#7A5119, 5.84:1) for exactly this pairing and says
  so at the token definition. Applied to the due-soon rung and to the lane's
  rollup chip. Danger is untouched — #A6483B on #F3E1DC is 4.61:1.
- New guard `app/admin/a-tile-with-work-looks-like-work.test.ts` (7 tests): the
  four rungs must stay distinct, only the clear rung may be plain white, and no
  warning-tinted surface may carry the plain amber token as text. The rule is
  pinned to the PAIRING, not to the token — plain `--sn-warning` as text is
  correct on the obsidian focal (5.34:1 on #17160F) and only wrong on its own
  tint. Five mutations, each with its occurrence count printed before → after,
  all red.

SPEC IMPACT: None. No decision, price, SKU or copy changes — this is the tone
ladder of one admin component plus a contrast token swap.
