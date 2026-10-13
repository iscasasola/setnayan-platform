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
- **Suppliers › the build's counts move at the press.** "Add to build" answers in place, but the cart peek's
  "This build · N of M · ₱…" and the segment's "Build N/M" stayed the page's first numbers until the couple left Find.
  The page now hands the shell the inputs it counted with (`LiveTallyBase`) and the shell counts again at every
  in-place pin (`liveBuildTally`, over the bench's `builtNowIn`) — nothing pressed gives the page's own numbers,
  exactly. A supplier saved from "More to compare" joins its row's "· N yours" and "N to decide" at once
  (`savedInPlaceCount`). Still no page refresh. Guard: `vendors/the-build-count-moves-at-the-press.test.ts`.
- **Maker › RSVP: a finger picks the Yes / No answer in Safari (LIVE on main).** In WebKit a touch tap on the two
  answer lines never fired a click, so they could not be picked on an iPhone (a mouse could). Cause: the canvas
  bridge (`rsvp-canvas-bridge.tsx` `onDown`) cancelled the pointerdown on anything in `INERT_FIELDS` — the answers are
  `<label>`s — and WebKit drops a tap's click when its TOUCH pointerdown is cancelled. A finger's pointerdown is no
  longer cancelled; the field's focus is still refused on the mousedown that follows. Guard (WebKit, touch, the real
  bridge bundled): `app/[slug]/_components/a-finger-picks-the-rsvp-answer.test.ts` — red on main's bridge, green here.
- No migration. +0 server actions.

SPEC IMPACT: None
