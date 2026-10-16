## 2026-10-16 · fix(maker): a scene just styled takes a tap again

Owner, live on production f687fde: *"cannot select on maker preview screen anymore"*.

- **Cause (#6568, rd/maker-fast-edits):** a Style card's pick is laid on the canvas at the tap — a COPY of the card's
  section, cut from the card's own `editor=1` frame, whose bridge had bound it. The copy arrived wearing
  `data-setnayan-editor-bound="1"` with no listener behind it. The canvas bridge read that mark as "already bound" and
  never listened; its stray-tap check read the same mark as "a section has this tap". Every tap on the styled scene
  went nowhere — no selection, no tap-outside, no message. The copy is posted to every canvas frame, so a kept stage
  wore it until its owed redraw on show.
- **Fix:** `canvas-section-binder.ts` — what is bound is what THIS bridge bound (its own map), never a mark read off a
  node; the stray-tap check asks the binder. The page is swept again when a picture is laid (`sceneLook`) and when an
  in-place redraw lands (a style can bring a new section node). `scene-look-lay.ts` takes the copied marks off the
  picture. A ↺'s BEFORE picture (copied from the canvas itself) is covered by the same path.
- **Guard:** `app/[slug]/_components/a-styled-scene-still-takes-a-tap.test.ts` drives the real binder,
  `sectionPicture` and `layScenePicture` and taps the laid copy; sabotaged twice (the shipped bug back · the sweep after
  a lay removed) — red both times. `the-day-toolbar-is-the-prototypes.test.ts` now reads the mark's writer in the binder.

SPEC IMPACT: None
