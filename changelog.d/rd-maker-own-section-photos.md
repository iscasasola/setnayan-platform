## 2026-10-18 · feat(maker): a scene of their own's pictures on the phone · every Animate control and Font ▾ wear ◆ · the empty E-Gifts card wears its accent

Owner, 2026-10-18, three "build it" answers (relayed by the controller).

**1 · A scene of their own's pictures work on the phone** (*"we already have the templates, just make them work"*). The
Maker's canvas draws every picture slot of the template in its place (`renderScene` `makerSlots`; an empty one is the
template's own box, "＋ Photo" / "＋ Clip", marked `data-scene-slot`); an empty scene's placeholder shows those boxes.
A tap on one opens Edit with that slot's sheet; Edit's row 3 is "Photos ◆" (one tile per slot). The sheet is the app's
own uploader into the event's `scene-background` folder plus the couple's media — the same set the scene's
Background › Upload offers (handed through `MakerPartOps.sceneMedia`) — and "Take it off". One whole-canvas draft save
with its base (`sendCanvasBase`), held and redrawn in place (`makerRedrawSave`). ✓ Apply now keeps a slot picture
uploaded into this event's scene folder (it was held "not your photo"); `sceneUploadRefs` offers slot uploads again.
15 of the 25 templates take pictures (1–7, 13–15, 17–21; 5 and 14 are clips) — each held by
`lib/own-scene-photos-work-on-the-phone.test.ts`.

**2 · ◆ marks** (*"all animate, effects, styles, accents are pro"*, 2026-10-16). The older part sheet's Font ▾ wears the
sheet's one Pro mark (hidden in the store shell); every named Animate control (Fade · Blur · Move · Size, While on
screen, From/To, Band, Plays, Rows, Words/Reveal, Delay, Leaves) wears " ◆" (`animatePro`). Guard
`lib/every-animate-control-wears-the-mark.test.ts`; pinned-label tests re-aimed.

**3 · The empty E-Gifts card wears the picked accent** in the Maker (the Vintage spray + lace fan, and the divider) —
the prompt sits in one card shaped as a bank card. Guests unchanged (no way to give = no card). Guard
`lib/the-empty-gifts-wears-its-accent.test.ts`. Lab: `lab_gifts=none`, `lab_own=tpl<N>`.

SPEC IMPACT: None in the corpus from this branch — implements the owner's 2026-10-18 rulings; the as-built product
calls (Photos in Edit's row 3, a slot tap opens its sheet, slot uploads accepted at Apply, the empty gifts card) are
listed in the PR body for the controller's DECISION_LOG row.
