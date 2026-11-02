## 2026-10-12 · fix(maker): the new Maker's small leftovers — the uploader tells after the set · ↺ keeps the RSVP card picked · a line just added is in view

From the 2026-10-12 Maker walk (controller-2026-10-12/walk-maker) and HANDOFF_2026-10-10 §A item 6.

- **F2 — the app's uploader told its parent from inside a state update.** `app/_components/file-upload.tsx` called
  `onChange` inside its `setItems` updaters (a landing; ✕ on a kept file). React runs an updater while rendering, so
  a parent setting state in `onChange` was updated during FileUpload's render — "Cannot update a component
  (StageTools) while rendering FileUpload" on an RSVP picture upload — and React's development double-run told it
  twice. An updater now records what to say; one effect says it once, after the commit (two uploads landing
  together are one change). Every FileUpload caller gets this; none relied on the in-render call. Guard
  `lib/the-uploader-tells-after-the-set.test.ts`; `a-refused-upload-says-so` re-aimed (dated note).
- **F5 — ↺ that took the picked RSVP line away left Edit lit with nothing under it.** The list hook now hands the
  pick to that screen's card (the toolbar's own "Open the card" event), so the card's rows show, as when the stage
  opens. Guard `lib/the-rsvp-stage-keeps-the-card-after-undo.test.ts`; `rsvp-stage-truth` § 6 re-aimed.
- **F3 — a line added on the RSVP stage could land out of sight** (375 × 667: a picture mostly below the 270-px band).
  After an add the frame is scrolled so the new line sits in the band above the toolbar, once drawn and a picture's
  file has loaded (`partPickScroll`, the band measured as the toolbar's own centring does). Guard
  `lib/an-added-rsvp-line-is-brought-into-view.test.ts`.
- **Every RSVP line's Edit has its last row — the pass's Save button too.** Walked in the lab at 375 × 812 and 667:
  every line of the three screens already had ↑ Earlier · ↓ Later · Group · Remove (since 2026-10-11) except the
  pass's Save button, whose Edit was EMPTY (its row was the toolbar's own three, gone since 2026-10-11). It now has
  the same row, every step grey and saying why ("The Save button stays under the ticket."). Guard
  `lib/the-rsvp-save-button-edit-has-its-row.test.ts`; `the-rsvp-stage-shows-the-card-and-done` re-counted (dated).
  Entrance videos "play once" skipped — no entrance video exists in any catalogue yet (the owner's five files) and
  how one is stored as a Main background is not recorded. Prints' six and the seat counter skipped — no clear record.

SPEC IMPACT: None — fixes inside recorded rulings (RSVP per-element record 2026-10-09; the toolbar's pick rules).
