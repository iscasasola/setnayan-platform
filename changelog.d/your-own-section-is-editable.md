## 2026-10-17 · fix(maker): a scene of the couple's own can be picked and written — Heading and Words in Edit, even while empty

Owner, 17 Oct, on his own Maker: a "Your own section" he had just added from template 20 (Photo strip) drew its
placeholder ("YOUR OWN SECTION — Write this scene.") and *"i cannot edit this"*.

**Measured cause** (Maker lab, on his row as production holds it — `custom_1` = `{ canvas: { preset: 'still',
template: 20 }, stage_order: { rsvp: 2 } }`, mode Auto — now `lab_own=tpl20`): a tap on the scene posted
`w:custom_1`, and no part of the Stages map (`lib/maker-parts.ts` `MAKER_PARTS`) had that canvas key, so
`makerPartOfTap` and `makerPartOfCanvas` both answered null. The toolbar let go of what was picked and stayed on the
stage ("You're editing · Invitation › Home"), Edit drew nothing. True of every scene of their own, written or empty,
on every stage. Behind it, two more: Edit lists only words the page draws (a placeholder draws none), and the one
write a Heading makes (`sceneTypeWrite`) refused any scene with no words yet. On the desktop Maker a tap on the
placeholder's name opened the font sheet of the placeholder's own label. Nothing swallowed the tap
(`pointer-events` auto); the template is not the cause — every template and the plain scene behave the same.

**Fix, on the shipped doors only:**
- `own1`…`own6` are Maker parts (`MAKER_OWN_SCENE_PARTS`, canvas `w:custom_N`, named as the editor row is) — a tap
  picks the scene; Background and Animate are a `w:` scene's.
- Edit lists the scene's **Heading** and **Words** always (`part-words.ts` `ownSceneFields`): the ones the page draws
  are marked and typed as on every scene; one it does not draw yet is a row holding the Maker's own words. Keeping a
  word the page did not draw is not held, so the page is redrawn with it and the placeholder gives way.
- While it is typed, it shows on the page: the placeholder carries the scene's guest look, drawn by the guest's own
  renderer (`makerWordsLook` → `renderCustomSection`, the template's heading/words), and the canvas types into it
  (`type-in-place-canvas.ts` `showOwnLookWords`).
- `sceneTypeWrite`: a Heading on a scene with no words yet is its first write, not an emptying.
- Desktop: a tap anywhere on an EMPTY scene of their own opens its Content (`tapOpensWords`), the shipped Heading ·
  Words · pictures form.
- Kept: guests never see an empty scene of their own.

Guard: `apps/web/lib/own-scenes-are-parts.test.ts` (every slot × no template + all 25 templates: a tap picks it, Edit
lists ≥1 field while empty, the first Heading is one unheld draft write, the placeholder never blocks the tap, typing
shows on the page, a guest sees nothing). Lab: the own scene is drawn from its drafted row through the real path.

Not in this PR: the Photo strip's three **pictures** on the phone — Edit has no picture row; on the desktop they are
in the scene's Content (`SceneSlotsPanel`).

SPEC IMPACT: None.
