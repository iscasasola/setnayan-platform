## 2026-09-28 · feat(maker): "+ Add a scene" works in the Event Hub Maker (into the draft, selected at once); "everywhere or just here" verified on the train

DECISION_LOG 2026-09-27, "+ ADD A SCENE" WORKS IN THE EVENT HUB MAKER (owner:
*"yes add the add a scene"*), resumed from the paused WIP `rd/maker-add-a-scene-works`
and finished on the Keynote/Pages toolbars + "Maker feels instant" (merge train
2026-09-28). Measured on the train before this: the toolbar's + was a "coming in
the next build" bubble on desktop and a disabled More ▾ row on a phone, and the
navigator's "+ Add a scene" wrote the new scene straight onto the live page.

- **The + works, on both doors.** The work area registers what it may do
  (`MakerAddScene`, `maker-context.tsx` — ready / refused / nothing) and the shell
  draws from it: the desktop toolbar's ＋ (`AddSceneTool`) and the phone's More ▾
  "Add a scene" row both open the SAME template sheet as the navigator's
  "+ Add a scene". No portal, no second sheet. The "coming next" line for it is
  gone from `MAKER_COMING_NEXT`.
- **A picked template goes into the draft, never live.** `addCustomSection` has a
  draft door: the row is inserted hidden (`is_visible: false`, so no guest path
  draws it) and the draft says "shown" (`addedSceneDraft`, `lib/scene-writes.ts`),
  with the mode, the place at the end and the template canvas all set so nothing
  drafted for an earlier scene in the same slot leaks in. Apply publishes it;
  Restore folds it away as hidden.
- **It appears at once and is selected — without remounting the Maker.** The
  tile's post lands back on the address the couple is already on (the shell's
  `maker_stay`, `lib/maker-stay.ts`), so only the data changes; the WIP's
  `?scene=<id>` (a new page key → the whole Maker reloading) is dropped. The work
  area remembers which scenes it had when the tile was tapped and selects the
  custom scene that appeared (`scenesBeforeAdd`, `editor-shell.tsx`).
- **Caps and Pro unchanged.** Six scenes of their own, and Pro, are still refused
  before the draft door. A free couple's + wears the padlock and says why — the
  desktop bubble links to Event Hub Pro, the phone row says it on the row; the
  store shell shows no + at all.
- **Phone first.** The template sheet is a bottom sheet under `sm`; its
  Desktop · Phone · Both view choice is one `PickMenu` dropdown (owner rule: a set
  of choices is one dropdown, never a pill row).
- **First-visit tour** `customer_add_scene_v1` (the shipped `MiniTour`/`TOURS`),
  mounted inside the sheet so it fires the first time it opens. The Maker tour's
  Event Hub Pro slide names scenes of your own and the +.
- **One function to re-point:** `stageTakesOwnScenes(stage)`
  (`lib/maker-scene-list.ts`) — true on every stage today, read from `WIDGET_PHASES`.

**"Everywhere or just here" (DECISION_LOG 2026-09-25 / 2026-09-27):** the paused WIP
`rd/maker-everywhere-or-just-here` (8ed074088) was already carried onto the train in a
LATER form by `rd/maker-edit-words-in-the-scene` — `lib/details-bound.ts`
(`sceneBoundTextOf`), `details-bound-field.tsx` ("Change it everywhere (updates
Details)" · "Just this scene" · "Edited here · ↺ Use Details"), the guest readers,
the Details page note and the `customer_details_bound_v1` tour. Every hunk of the
WIP is present, so it was NOT cherry-picked (it would only have regressed those
files); this PR verifies it in the browser instead.

+0 exported "use server" functions (`a-section-of-your-own-is-pro-and-laid-out`
holds the list), no new table. Tests: `lib/the-maker-adds-a-scene-to-the-draft.test.ts`
(8 tests; the registration, the padlock on both doors, the same-address landing and
the client-side selection each seen to fail once by sabotage);
`every-maker-form-drafts-or-says-so.test.ts` now requires every "+ Add a scene"
sheet to draft.

SPEC IMPACT: None. The decisions are already recorded in DECISION_LOG 2026-09-27
("+ ADD A SCENE" WORKS IN THE EVENT HUB MAKER; THE MAKER IS THE EDITOR).
