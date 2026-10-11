# HANDOVER — drag a scene on the page, drop it on a bin (Batch C)

Branch `rd/c-drag-scenes`, worktree `~/Documents/Claude/Projects/wt-c-drag`, cut from `origin/preview/batch-b-event-hub` at `d2becf325`. Nothing pushed, no PR. **Built, not live.**

Plan: `prototypes/maker_drag_scenes_2026-10-11.html` (same bytes at `controller-2026-10-08/prototypes-out/`). Ruling: DECISION_LOG 2026-10-11 "IN THE MAKER, A SCENE IS MOVED BY DRAGGING IT ON THE PAGE…". Both are on the corpus's `origin/main` only — the local corpus checkout is 108 commits behind and does not have them.

## Where the drag lives, and why

In the Maker, running on the canvas frame's own document — the same shape as the RSVP stage's line drag (`rsvp-canvas-drag.ts`). The canvas is a same-origin frame; the Maker already measures that document directly for the picked part's frame and its ＋ (`partBox`). A drag must keep a scene under a finger every frame, so the press, hold, lifted scene and gap are in the frame's document; the bin, the collapse, the line and ↺ are the Maker's. **No guest-page file is touched.** Nothing is inserted or re-parented in the page's tree: scenes are slid by transforms, and a drop leaves them slid until the reload the save brings draws that order for real.

Files:
- `apps/web/lib/maker-scene-drag.ts` — the rules, pure (numbers, words, `sceneMovesAmong`, `sceneReflow`, `sceneDropSlot`, `sceneDropTarget`, bin/edge/busy rules).
- `apps/web/app/dashboard/[eventId]/launch/_components/scene-canvas-drag.ts` — the hands on the frame's document (`attachSceneDrag`).
- `…/scene-drag.tsx` — the Maker's side (`useSceneDrag`: bin, status line, ↺, page room, `heldSaveWatch`, `stageStill`).
- `…/add-part-sheet.tsx` — `usePartEdits` wires it: `moveTargets`, `dropOn`, `takeOff`, `pickAfter`, `tapPart`, the tag button, `PartMenuSheet`.
- `…/stage-tools.tsx` — collapse (`slide`, `data-scene-slide`, CSS), status row, keyboard. `…/stage-panel/stage-edit.tsx` — row 4 removed.
- `apps/web/lib/a-scene-is-dragged-on-the-page.test.ts` — 13 tests. Eleven older guards re-aimed, each with a dated note.

## Built and working (last full lab walk: 81 passed · 3 failed)

Hold 350 ms lifts · gap opens · edge auto-scroll · lower third slides away and back (280 ms, `cubic-bezier(.4,0,.2,1)`, both motions measured mid-way) · scene stays under the finger, scroll offset kept · bin in the thumb zone with "Drop here to remove" · drop reorders at once, "Saving…", canvas redraw agrees · one drop = one save = one ↺ · failed save slides back then "That did not save. Nothing changed — please try again." · fixed part nudges and says why · other tabs dim · never across the Wedding March · slow network: no snap-back, second hold refused ("One moment — the page is catching up.") · fast and slow swipes only scroll · tag menu Move up · Move down · Remove (a step is seen at once) · mouse press-drag at 1000 px · Reduce Motion fade · Earlier · Later · Remove row gone.

Checks: full `tsc` rc 0 on the final code (run it with `apps/web/.next` deleted — with `.next/types` present it runs out of heap at 7 GB); 507 neighbouring tests and 2,530 Maker-related tests pass; 23 sabotages each went red and were restored.

## Session of 2026-10-12 (second builder) — what changed, in order

0. `origin/main` (d2e38b7c1) merged in with a real merge commit (646ecbe75). No conflicts; no generated file was touched by this branch.
1. **FAULT 1 fixed and walked** (22272c1e0, 46bb7a73d). Cause: the Maker's Undo was found by `aria-label="Undo"` as well as by its bar item — and the line's own Undo is an `ActionButton`, whose `aria-label` is its word. The line's button WAS "the Maker's Undo" to that selector: its own press was heard as ↺, the step was forgotten and the line cleared. Now `SCENE_UNDO_BUTTON` (`lib/maker-scene-drag.ts`) = `[data-maker-shell] [data-maker-draft-actions] button[data-bar-item="Undo"]`, pressed from inside the line's own press (the `setTimeout` deferral guarded against this same fault and is gone). A second fault under it: the scene ↺ put back was picked and let go of in the same breath (`usePartEdits` read "taken off" from the list the render still held) — the list is now asked again at that moment. Walk C3: back where it was · "Message is back" · ONE press of ↺ · ↺ off again · Message picked.
2. **FAULT 2 was the walk's own touch point, not the product** (74cb13c82). Holding the cover picks a part of it and the page glides to that part's middle; the walk measured the Reveal while the page still moved and the finger landed on the cover, which said — truthfully — "Logo keeps its place on this page." The walk now waits for the page to stop (`steady`) and checks what is under the finger (`under`) before it holds. D2: "The Reveal is always first on this page.", the Reveal picked. A test pins the Reveal's route in `subject()`.

3. **Desktop answered, with a test and a walk** (767cb7dbc): the row that left (Earlier · Later · Remove) was the Stages panel's Edit row and the Stages panel is a phone's alone (`ss = stagesStudio && phone`) — a desktop couple never had it. They move / take off a scene in the navigator (`website/editor/_components/editor-shell.tsx`: drag a tile · right-click → Move up · Move down · Hide · the tile's eye), which this branch does not touch. Test (8) holds it; walk K2 right-clicks a tile at 1280 and moves a scene.
4. **The lift** (be1bd3726, d2a2e1969): 1.03 where it fits, else as large as keeps the prototype's 4.675 px from the page's edge. Measured: the page is a 359 px frame at 375; lifted 349.65 px (0.974), ring whole (was ≈0.955). **The tag over the bin** (742dd1210) shrinks and dims with the scene. Both walked (B3, C1) and seen in the side-by-sides.
5. **The lab can hold a scene of the couple's own** (6d10aed68): cookie `lab_own=1` (`open({ own: true })` in the walk). Walk **M** (own scene on the bin → "Delete this scene?", nothing written, Keep it), **N** (Post Event: hold · move · one ↺ · bin · Undo) and **K2** all pass. The lab has no delete form for an own scene (the sheet says "This scene cannot be deleted here.") — the Delete press itself is not walkable there.
6. **WHOLE LAB WALK: 125 passed · 0 failed** (`tools/walk-out.txt`, 2026-10-12, at code 742dd1210 — d2a2e1969 after it changed a comment and a test only). Side-by-sides re-composed and looked at (2 lifted, 3 over bin, 4 removed; 1, 5, 6 looked at from the run before — same states).
7. **`pnpm preflight` at be1bd3726: 1 FAILED · 48 passed** (33 min). The one failure is mine and is NOT fixed: `lib/maker-list-gates.test.ts` M09 pins the old line `if (gone) onGoneRef.current?.();` — re-aim it at `if (gone && partTakenOff(askPartOps(), canvas)) onGoneRef.current?.();` (`add-part-sheet.tsx`, `usePartEdits`), with a dated note. Preflight has not been run since 742dd1210 / d2a2e1969.

## Session of 2026-10-12 (third builder)

1. **M09 re-aimed** (928d73f93): `lib/maker-list-gates.test.ts` now pins `if (gone && partTakenOff(askPartOps(), canvas)) onGoneRef.current?.();` with a dated note. Ran with `a-scene-is-dragged-on-the-page`: 24/24 pass. Sabotage (put the old `if (gone)` back): M09 red; restored, green.
2. **Full tsc rc 0** (under the heavy lock, `.next` deleted, at 928d73f93).
3. **Changelog fragment** dated 2026-10-12, this session's fixes added, "Desktop" paragraph corrected (75184b60f).
4. **Side-by-sides 1, 5, 6 looked at.** 1: same as the prototype but for the shipped differences listed below. 5: the built picture is taken mid-glide (holding the cover picks Logo and the page glides to it) — a picture at rest was added to walk D (`built-phone-5-locked-nudge-at-rest.png`). 6: the extra top-bar line is fault 3 (below) — kept, with the reason.
5. Fault 3 decision (owner may overrule): the top-bar error line is the house rule "an error is never silent: it is shown until the next save succeeds" (`lib/maker-save-status.ts`); the prototype's own line fades after 3.2 s, so hiding the top-bar line would leave a refused save silent. Both stay. The lab's words ("Your background could not be changed") are the lab's fixed `?fail=1` answer for every save, not what a real move says.

## STOPPED HERE (second builder, account limit, 2026-10-12) — superseded by the third builder's section above

NOT DONE: full `tsc` (step 6) was never run this session · the M09 re-aim above · preflight re-run to green · `changelog.d/rd-c-drag-scenes.md` does not yet mention this session's fixes · nothing pushed, no PR.

Differences from the prototype still standing (for the owner): the tag menu is the Maker's one bottom sheet, not a small popover (kept: `MakerSheet` — "every pop-up of the new Maker on a phone", owner 2026-10-06; INTERACTION_RULES § 9) · the lifted scene is 0.974, not 1.03 (above) · the lifted scene is cut off at the page frame's foot instead of riding over the tab row (it lives in the canvas frame) · the name tag is the shipped 9 px tag, the prototype's is 11 px · Undo is the house 44 px icon + word button, not a 34 px word pill · a grey menu step still answers with why (the prototype disables it) · a failed save also shows the shipped top-bar line · the count badge sits on ✓, not on ↺, and Countdown's door reads "Open in Studio › Info" (both shipped, not this branch).

⚠ THE LAB UNDER LOAD. With other builders' jobs running (load average 13) the dev server sometimes took 6–25 s to answer the render an Undo asks for. The Maker then says nothing until the page shows it (and nothing at all past its own settle timeout) — the scene still comes back. The walk's waits are polls now (`until`), not fixed sleeps. If C3 fails, read how long the `_rsc` answer took before calling it a fault.

## Known faults

3. Failed save shows two lines at once: the shipped top-bar line (server/lab reason) and the prototype's line in row 4. Left as is.
4. Pre-existing, not this branch's: a grey "Move down" on Welcome says "Countdown stays before the Wedding March." though the March is on Details (`heldWhy` reads the stage list, not the page).

## Contract points

| Point | State |
|---|---|
| Hold, lift, gap, edge scroll, collapse/expand, scene under finger | built, walked |
| Bin, "Drop here to remove" | built, walked. The bin counts only 280 ms after the lift (it rises from where a thumb grabs the last scene — the prototype has that flaw) |
| "<Scene> removed · Undo" | built, walked — one press, back in its place, "<Scene> is back", the scene picked |
| Failed-save slide-back + words | built, walked (move and remove) |
| Locked parts nudge and say why | built, walked (the Reveal says its own line) |
| Tag menu fallback | built as the Maker's one bottom sheet (`MakerSheet`), not the prototype's small popover — owner to confirm |
| Other tabs dimmed, no cross-page drag | built, walked |
| Own scene → "Delete this scene?" from the bin | built, guarded by test, **not walked** (the lab sample has no scene of the couple's own) |
| Post Event scenes drag/remove | built through the same functions, **not walked** |
| Desktop 1280 | **not built** — the Stages panel is phone-only (`maker-shell.tsx`: `ss = stagesStudio && phone`); the prototype's three-column desktop Maker does not exist, and a canvas press-drag on the shipped desktop Maker would take over its letter-selection. Mouse path works wherever the panel is drawn (<1024) |
| First-load JS | no change expected: everything is in the lazy `maker-details` chunk; a test walks every source file for who imports the drag. Not measured by a build |
| New dependency | none |

Deviations to tell the owner: lifted scene is scaled to fit inside the screen (≈0.96) instead of 1.03, because guest scenes run edge to edge; Undo is the house `ActionButton` (icon + word, 44 px) not the prototype's 34 px word pill; a mouse nudges a fixed part on a drag attempt, not on a plain click; status line under a non-Edit tool shows for 3.2 s then yields the row.

## Next three steps

1. Re-aim `lib/maker-list-gates.test.ts` M09 (see 7 above); run it and `lib/a-scene-is-dragged-on-the-page.test.ts` (17 tests) from `apps/web`.
2. Full `tsc` under the heavy lock, `apps/web/.next` deleted first: `NODE_OPTIONS=--max-old-space-size=8192 ../../node_modules/.bin/tsc --noEmit -p tsconfig.json` from `apps/web` → rc 0. Then `pnpm preflight` from the root (no lock; ≈ 33 min) to 0 failed.
3. Add this session's fixes to `changelog.d/rd-c-drag-scenes.md`; hand the side-by-sides and the difference list above to the owner before any push. Real iPhone still unproven: the 350 ms hold against Safari's long-press, callout/selection, rubber-band scroll while held, no `navigator.vibrate`.

## How to run the walk

Tools and pictures: `~/Documents/Claude/Projects/controller-2026-10-08/batch-c/drag/` (`tools/walk.mjs`, `proto.mjs`, `sides.mjs`, `sabotage.py`, `sabotage2.py`, last output `walk-out.txt`).

```sh
R=~/Documents/Claude/Projects/wt-c-drag; L=~/Documents/Claude/Projects/heavy-lock.sh
# .env.local is copied from wt-batch-b (public keys only; git-ignored)
cd $R/apps/web && "$L" acquire "c-drag next dev" && { NODE_PATH="$R/node_modules/.pnpm/node_modules" node node_modules/next/dist/bin/next dev --port 3791 & echo $! > /tmp/c-drag-dev.pid; wait; "$L" release "c-drag next dev"; }
# NODE_PATH is required: without it @sentry/core does not resolve.
node ~/Documents/Claude/Projects/controller-2026-10-08/batch-c/drag/tools/walk.mjs        # all; or: walk.mjs C,D
node …/tools/sides.mjs                                                                    # side-by-sides, no server needed
# walk sections: A–L as before · M own scene · N Post Event · K2 desktop navigator. The walk polls (`steady`, `under`, `until`).
kill <the PID you wrote>; rm -rf $R/apps/web/.next                                 # always, before tsc
cd $R/apps/web && ../../node_modules/.bin/tsx --test lib/a-scene-is-dragged-on-the-page.test.ts
cd $R/apps/web && python3 …/tools/sabotage.py && python3 …/tools/sabotage2.py             # commit first
```

The lab reads `platform_settings` with the anon key on load and is refused — a read by the app's own layout, nothing written, no sign-in.
