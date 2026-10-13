## 2026-10-13 · fix(b3fix): batch 3 walk follow-ups — a worn choice saves nothing

Stacked on the batch-3 release (#6504). The independent walk of batch 3 found small defects; one commit each.

- **A tap on the choice already worn does nothing — no save, no ↺ step.** Tapping the Background tile already
  picked (Plain on Announcements, None on What to wear) wrote an empty `block_looks:{}` and put an ↺ on the bar that
  changed nothing. Fixed at the control: the block Background tiles (and the blocks' one save, `useBlockLooksDraft`),
  the RSVP card's three tiles, the scene Background strip, every one-choice dropdown in the toolbar (`Dd`), Animate's
  While on screen and Size pills, and the cover lines' / scenes' one save (`element-sheet` `commit`) when the canvas
  did not change. Guard: `stage-panel/a-tap-on-the-worn-choice-saves-nothing.test.ts` (rendered; each control's own
  tap handler pressed).
- No migration. +0 server actions.

SPEC IMPACT: None
