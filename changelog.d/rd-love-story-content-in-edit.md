## 2026-10-19 · fix(maker): the Love Story's content is Edit's door, Style is only its look, and Edit is never blank

Owner, live (Safari ~840 px, Invitation › Home with a Love Story on it): the toolbar read "YOU'RE EDITING ·
INVITATION › HOME" over a blank Edit, and Style showed the Love Story's moments editor — *"why is it on style and not
on edit (and i thought it should jump to the studio?)"*. He was right: the shipped Edit for the Love Story is its one
door, "Open in Studio › Love Story" (TOOLBAR-SPEC 2026-10-09 § EDIT).

- **Cause.** The guest page wraps the Love Story in its region `#site-story`, which the canvas bridge also listens to as
  `f:story`. A tap that region took named no part (`makerPartOfCanvas` knew only `w:our_love_story`): the toolbar picked
  nothing, while the work area opened the region's fixed panel — whose new-Maker Style laid the Details fact's editor
  (`factEditorFor`) inside the look.
- **Fix.** `MAKER_CANVAS_ALIAS` (`lib/maker-parts.ts`): `f:story` names the Love Story part, and the toolbar selects the
  scene itself (no page jump) — Edit shows "Open in Studio › Love Story", Style the Love Story's looks. In the new Maker
  the work area's Style never carries a fact's editor and never opens on Content (`lib/maker-edit-owns-content.ts`
  `makerStyleLook` · `makerWorkAreaTab`). A tap that names no part (a legacy row region) lets the work area's panel go.
  Nothing picked: row 1 says "Tap a part of the page to edit it." — distinct from #6649's "The page isn't answering
  taps." (`stageRowOneLine`).
- **Lab.** `/dev/maker-lab?studio=1&facts=1` hands the Maker lab the same fact editors the launch page hands the real
  Maker, so the owner's state can be seen there.
- **Guard.** `lib/edit-owns-content.test.ts` — every key a canvas tap can send names a part on every stage; the Love
  Story's Edit is its door; Content is never the new Maker's body tab; a fixed part's Style never holds its fact; the
  two row-1 states differ; wiring.

SPEC IMPACT: None (implements TOOLBAR-SPEC 2026-10-09 § EDIT and the approved Love Story door as shipped; the
nothing-picked line is a controller's call recorded in the PR).
