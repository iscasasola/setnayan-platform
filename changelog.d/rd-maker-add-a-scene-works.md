## 2026-09-27 · feat(maker): "+ Add a scene" works in the Event Hub Maker, and the new scene waits in the draft

DECISION_LOG 2026-09-27, "+ ADD A SCENE" WORKS IN THE EVENT HUB MAKER (owner:
*"yes add the add a scene"*). Measured on origin/main: the toolbar's + was a
"coming in the next build" bubble, and the navigator's "+ Add a scene" wrote the
new scene straight onto the live page.

- **The toolbar's + opens the template sheet** — the same sheet as "+ Add a
  scene" at the end of the scenes, now one sheet with two doors. On a phone it
  is a bottom sheet. The work area portals the working + into the toolbar
  (`MAKER_ADD_SCENE_SLOT_ID`, beside the existing ⋯ portal); the "coming next"
  line for it is gone from `MAKER_COMING_NEXT`.
- **A picked template goes into the draft, never live.** `addCustomSection` has
  a draft door: the row is inserted hidden (`is_visible: false`, so no guest
  path draws it) and the draft says "shown" (`addedSceneDraft`,
  `lib/scene-writes.ts`), with the mode, the place at the end and the template
  canvas all set so nothing drafted for an earlier scene in the same slot leaks
  in. Apply publishes it; Restore leaves it hidden. It lands back with
  `?scene=` so the new scene is selected with its panel open.
- **Caps and Pro unchanged.** Six scenes of their own, and Pro, are still
  refused before the draft door. A free couple's + wears the padlock and says
  why, with a link to Event Hub Pro; the store shell shows no +.
- **One function to re-point:** `stageTakesOwnScenes(stage)`
  (`lib/maker-scene-list.ts`) — true on every stage today, read from
  `WIDGET_PHASES`.
- The Maker tour's Event Hub Pro slide names scenes of your own and the +.

+0 exported "use server" functions, no new table. Tests:
`lib/the-maker-adds-a-scene-to-the-draft.test.ts` (each assertion seen to fail
once by sabotage); `every-maker-form-drafts-or-says-so.test.ts` now requires
every "+ Add a scene" sheet to draft.

SPEC IMPACT: None. The decision is already recorded in DECISION_LOG 2026-09-27
("+ ADD A SCENE" WORKS IN THE EVENT HUB MAKER).
