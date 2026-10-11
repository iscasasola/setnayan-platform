## 2026-10-11 · feat(maker): a scene is moved by holding it on the page and dragging it, and removed by dropping it on a bin — the Earlier · Later · Remove row is gone

Owner, 2026-10-11, on the new Maker (Stages | Studio, a phone): *"what if we drag the scene on the preview instead of having this. then there is a delete button where they can drag the scene to the delete button to delete it"* · *"just like instagram"* · on the prototype: *"i see it. yes this looks good. but when we drag something the bottom toolbar collapses and shows the whole page. make sure animation to collapse and expand shows"* · *"our build is the drag by scene"* · *"so whatever their location is what will be seen on the event hub itself too"*.

Built from the approved prototype (`prototypes/maker_drag_scenes_2026-10-11.html`, corpus), behaviour for behaviour, in "Drag the scene (the build)" mode.

**What a couple does now (phone, Stages side):**

- **Press and hold a scene** (350 ms) — it lifts under the finger with its ring and its name tag, the phone buzzes once, the lower third **slides away** so the whole page shows (280 ms, `cubic-bezier(.4,0,.2,1)`; a short fade under Reduce Motion), a dashed gap opens where it would land, and the page scrolls by itself near its top and bottom edge. **Let go** and it settles there at once; the lower third **slides back**; the line under the tools says "Saving…" until the page shows it.
- **Drop it on the bin** ("Drop here to remove", in the thumb zone while a scene is lifted) — it leaves the page and the line says "<Scene> removed" beside **Undo**. A scene of the couple's own is never taken silently: the bin opens its "Delete this scene?" sheet.
- **A quick swipe still scrolls** — the page's pan is refused only once the hold has fired.
- **A part that keeps its place** (the Reveal, the cover, the reply card, E-Gifts, the Wedding March) does not lift: it nudges, and the line says why.
- **A save that is refused** slides the scene back, then: "That did not save. Nothing changed — please try again."
- **Whoever cannot drag**: the picked part's name tag is now a button — Move up · Move down · Remove (the Maker's one bottom sheet). Alt + ↑ ↓ and Delete do the same from a keyboard.
- The other page tabs dim while a scene is lifted; a scene stays on its page.

**The Earlier · Later · Remove row is removed** from Edit's last row. Row 4 is the toolbar's own line under the tools now.

**Where the drag lives, and why.** In the Maker, on the canvas's own document — the way the RSVP stage's line drag already runs (`rsvp-canvas-drag.ts`). The canvas is the guest's page in a same-origin frame; a tap there reaches the Maker as a message, and the Maker already reads and measures that document directly for the picked part's frame and its ＋. A drag has to keep a scene under a finger for every frame of a gesture, so the press, the hold, the lifted scene and the gap are in the frame's document (`scene-canvas-drag.ts`), and what is the Maker's — the bin, the collapse, the line, ↺ — is told from there (`scene-drag.tsx`). **No guest-page file was touched**, and nothing is inserted into or moved inside the page's own tree: scenes are slid, and a drop leaves them slid into place until the reload the save brings draws that same order for real.

**Every rule the buttons kept, the drag keeps** (`lib/maker-scene-drag.ts`, `lib/a-scene-is-dragged-on-the-page.test.ts`):

- **One drop = one save = one Undo step.** A drop is the work area's own one-save move (`makerDropDelta` → `movedOrder` → `stageOrderPatch`); the bin is today's Remove for that part (the eye, or the Post Event switch). The drag's three files hold no door to the draft.
- **A drop is only accepted where it changes the page.** The parts a scene may land among are one list (`sceneMovesAmong` → `stepChangesThePage`), read by the drag AND by the tag's Move up · Move down: never across the Wedding March, never beside a fixed part.
- **The page the couple arranges is the page the guest gets.** Executed over every stage, every scene and every place it can be dropped, with a hide already published under the draft: from the drop, through the shipped reducers, to the guest page's own ordered scene list (`resolveSiteBodyPlan` + `splitAroundEntourage`) after Apply — and no other stage moves.
- **No snap-back, no double action.** The scene sits where it was put while the save runs and the canvas's redraw agrees; no second lift while a press is on its way to the page (`sceneLiftAllowed`, the `maker-settle` busy rule).

**First-load JS: no change.** All of it rides the lazy Stages panel (`details-lazy.tsx` → `stage-tools.tsx`, the `maker-details` chunk) — held by a test that walks every source file for who loads the drag. No new dependency.

**Standing guards re-aimed** (each with a dated note, none weakened): the row-4 claims of `the-toolbar-is-four-rows`, `edit-types-the-words-in-place` and `the-post-event-toolbar-is-the-prototypes`; "no buttons on the frame" (`the-preview-only-selects`: the name tag is the menu's door, by this ruling); the move's toast (`maker-settle`, `the-toast-peeks-from-the-top`: a move and a remove are said on the line under the tools); `one-drag-is-one-order-write`, `a-step-always-changes-the-page`, `the-rsvp-stage-is-parts`, `the-stages-panel-wears-the-accent`, `the-play-button-previews`.

**Not built, said plainly:**

- **Desktop (≥ 1024).** The prototype's desktop is the three-column new Maker (parts · page · tools). That Maker is a phone's only today (`maker-shell.tsx`: `ss = stagesStudio && phone`); the shipped desktop Maker keeps its navigator's own drag and eye. Mounting a press-drag on its canvas would take over the mouse selection its letter-by-letter styling uses, and it has no home for the line or the tag's menu. The drag's hands do take a mouse (press and move, no hold) wherever the Stages panel is drawn.
- **The tag's steps are not optimistic.** Move up · Move down show "Saving…" until the page redraws, as the buttons did; only a drop is seen at once.
- **A real iPhone.** The hold, the callout and the rubber-band are proven in Chromium's touch emulation only.

SPEC IMPACT: None new — this builds DECISION_LOG 2026-10-11, "IN THE MAKER, A SCENE IS MOVED BY DRAGGING IT ON THE PAGE AND REMOVED BY DROPPING IT ON A BIN ("JUST LIKE INSTAGRAM"); THE LOWER THIRD COLLAPSES WHILE A SCENE IS HELD; BATCH C." (status there: NOT BUILT → built, not live). The row's "desktop = mouse drag" is not built (see above) — for the owner to rule where it lives once the desktop Stages Maker exists.
