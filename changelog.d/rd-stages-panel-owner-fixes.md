## 2026-10-07 · fix(maker): the Stages panel's owner preview faults (behind `makerStagesStudioEnabled`)

Owner, on the preview of #6398 — fourteen faults, fixed on top of #6401's one style registry (`lib/scene-styles-parts.ts`, page-drawn look pictures):

- **A canvas tap only picks; it never jumps to Studio.** The four doors (words, Logo mark, schedule moment, fact editors) are fenced under Stages; the Style bar's quiet bar is the only door, and it opens the EXACT Studio field (`MAKER_PART_FOCUS` / `makerPartStudioDoor`) with "✓ Done · back to <Part>" returning to the same stage and part, draft kept.
- **Typing on the second tap on any words** — one keyboard bar (Typing · <Part> · Done).
- **Animate:** five How it moves presets + "Custom" (not "Its own"); Duration and Delay sliders 0–2 s; the Does line under Does; "◆ Into the next scene" on a part reads "Stage default · X" and writes the scene's transition; no row is ever a lone ⓘ.
- **The page:** the lower ＋ sits on the part's frame edge, not over its words.
- Guards: `lib/the-stages-panel-is-the-prototypes.test.ts` (tap never leaves the stage, studio door mapping, Done text), `lib/every-look-draws-a-picture.test.ts` (no lone-ⓘ row, a picture per style).

SPEC IMPACT: None — the prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` is the spec. Not done, for the owner: the prototype's look NAMES/COUNTS (e.g. countdown Big number · Boxes · Offset · Line · Circle) are not adopted — `lib/layouts-are-the-shipped-scene-styles.test.ts` forbids invented families and the words 'Offset'/'Statement'.
