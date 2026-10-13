## 2026-10-13 · fix(b3fix): batch 3 walk follow-ups — a worn choice saves nothing

Stacked on the batch-3 release (#6504). The independent walk of batch 3 found small defects; one commit each.

- **A tap on the choice already worn does nothing — no save, no ↺ step.** Tapping the Background tile already
  picked (Plain on Announcements, None on What to wear) wrote an empty `block_looks:{}` and put an ↺ on the bar that
  changed nothing. Fixed at the control: the block Background tiles (and the blocks' one save, `useBlockLooksDraft`),
  the RSVP card's three tiles, the scene Background strip, every one-choice dropdown in the toolbar (`Dd`), Animate's
  While on screen and Size pills, and the cover lines' / scenes' one save (`element-sheet` `commit`) when the canvas
  did not change. Guard: `stage-panel/a-tap-on-the-worn-choice-saves-nothing.test.ts` (rendered; each control's own
  tap handler pressed).
- **Suppliers › a refused Save is said like a refused Add or Remove.** It names the supplier ("Kusina ni Lola could
  not be saved. Nothing was added."), says it in the page's one top toast as well as on the section, offers Try again
  (the same save again; not for signed-out / not-your-event), and the section's "· N" stays — the refusal no longer
  rides the list's own error. Guard: `vendors/a-refused-save-names-the-supplier.test.ts`.
- No migration. +0 server actions.

SPEC IMPACT: None
