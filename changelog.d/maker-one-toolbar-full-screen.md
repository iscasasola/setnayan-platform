## 2026-11-20 · feat(maker): the Event Hub Maker — one toolbar, full screen, a way back

Owner, 20 Nov: *"Yes, build it"* on `prototypes/maker_one_toolbar_expand_2026-11-20_fable.html` v17
(DECISION_LOG rows "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED", "MAKER EDIT ROWS RUN BY
IMPORTANCE", "MAKER · WAY BACK + BUILT-IN GUEST PAGES").

- The Maker is full screen; ‹ leaves; ↺ History is ⚙'s first group; "Event name"; E-Gifts has a visible Back.
- Every scene has ONE toolbar: head ‹ · name ▾ · › · ✕, body, foot Edit · Style · Animate ◆ and ⤢ Expand
  (only on Logo, Love Story, Schedule, E-Gifts — the parts with an editor to expand into; never Dress code).
  Background is a row of Style, not a tab. ▶ plays from the Animate tab.
- A tap always SELECTS (no editor rises from the tap); nothing is auto-picked on arrival.
- The way back: ✕, phone Back (closes Expand first, then the toolbar — `useBackCloses`), swipe the toolbar
  down, a tap outside a scene, Esc. With nothing selected the resting bar reads "Tap any scene to edit it"
  with Look and Pages.
- Full screen editors: ✓ Done in the head and ⤡ Minimize; Esc and Back close them.
- 👁 is on the phone's top bar (it replaces holding ▶).
- New Pages sheet (`maker-pages-sheet.tsx`): Whole Event Hub (Look) first, then this stage's pages with
  their scenes (tap goes there and selects), 👁 opens the shipped "What guests see", built-in pages say
  words only.

SPEC IMPACT: None (the rulings are already in `DECISION_LOG.md`, 20 Nov).
