## 2026-11-13 · fix(maker): Post Event's "Reads as" can be reached at every width (F-W2-43)

PR #7596 drew Post Event's story-wide controls — "Reads as · Story / Page" and, before the day, "Peek now" — as a row
of the old Scenes column in `editor-shell.tsx`. The new Maker never shows that column: on a phone it is
`max-lg:hidden` and its tiles portal into a navigator slot the stage toolbar leaves hidden; on a desktop
`maker-desk.tsx` sets it `display:none!important`. So the controls were in the page and could not be pressed at
390, 1280 or 1600 px. Measured in the dev Maker lab before the fix: the nearest hidden ancestor was the lower
third's slot (390) and the Scenes nav (1280).

- The work area now REGISTERS the controls with the Maker (`setPostEventStory`, the same pattern as the Event Bar
  switch), and the stage toolbar draws them under "Tap a part of the page to edit it." while nothing is picked on
  Post Event (`data-stage-post-event-story`). The toolbar is the lower third on a phone and the tools column on a
  desktop, so one place covers every width. The controls themselves (`post-event-story-controls.tsx`) are unchanged.
- Verified in the lab at 390 / 1280 / 1600: visible, and picking "Page" saves to the draft (`lab_editorial =
  {"readAs":"page"}`) with no error. Shots: `build-sessions/shots-post-event-fix/`.
- New guard `lib/post-event-reads-as-is-reachable.test.ts`: never back in the Scenes nav; every element from the
  toolbar's render down to the slot wears no hidden class or attribute; no Maker rule set hides the slot. Four
  mutations seen red.

SPEC IMPACT: None — the placement follows the approved design (the story-wide controls above Post Event's scenes,
DECISION_LOG "POST EVENT = A STORY (ONE SCENE PER SCREEN) — SIX CALLS SETTLED"); only where the new Maker draws them
changed.
