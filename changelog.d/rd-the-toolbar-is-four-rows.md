## 2026-10-09 · feat(maker): the Stages toolbar is one fixed height — a handle, "You're editing", four tools, four rows

Behind `makerStagesStudioEnabled` (internal + phone). The shipped Maker (flag off) and the desktop are untouched: the
toolbar is mounted only by the new Maker on a phone, and every rule it writes names the toolbar itself
(`lib/the-toolbar-is-four-rows.test.ts` (6)).

Owner, 2026-10-09 (the approved clickable prototype `public/review/studio-head-prototype.html`;
`controller-2026-10-08/TOOLBAR-SPEC-2026-10-09.md`): "make toolbar just the lower third" → "330 px it is" · "make the
upper part of the bottom toolbar curve" · "so it is just Edit | Style | Background | Animate" · "the rule is always
start from the top".

- **The frame** (`stage-tools.tsx`, `lib/maker-stage-room.ts` `stageBarPx`): handle 14 · "You're editing · Stage ›
  Page › Part" 20 · the selector's band 52 · four rows (48 px, 6 apart; 44 / 4 under 740 px tall) · the phone's safe
  area, never under 10 px. 330 px on an iPhone. Nothing is dragged, folded or remembered.
- **Four tools, words only**, each as wide as its word, one sliding thumb; ▶ stays at the right. It was Style | Text |
  Animate as icons. `MAKER_PART_TOOLS` = Edit · Style · Background · Animate; the work area is still asked `style` or
  `animate` (`makerWorkTool`), and `StageStyle` shows the tool's part of the scene's Format (one selector, not two —
  Style's own Look | Background | Arrange is gone).
- **Edit** (`stage-panel/stage-edit.tsx`) — the toolbar's own rows: row 1 the part's one door (the shipped quiet row),
  row 4 always ↑ Earlier · ↓ Later · Remove (the frame's own writes, `usePartEdits`: one order write a step, the one
  confirm before a remove).
- **Gone from the toolbar**: the stage ▾ (the top bar's Stages ▾ opens the same `StageItemMenu`), "Tap a part of the
  page", the part tiles, the drag and the fold. "You're editing" left the guests' bar, which stays a bar under the page.
- Not drawn any more (stored values still honoured where they are read): Style › Arrange's On this stage ▾ ·
  Alignment ▾ · Spacing ▾, and the Text tool (Font · Colour · Size) — Colour and Size return on Style's last row in a
  later commit of this branch; Font is Studio › Look › Elements.

Tests: new `lib/the-toolbar-is-four-rows.test.ts` (6 rules, each seen red). Re-aimed with the reason written in:
`a-tool-with-nothing-to-do-says-so`, `maker-parts`, `selectors-are-pills-that-slide`, `the-accent-is-one-token`,
`the-rsvp-stage-is-parts`, `the-stage-panel-fits-a-phone`, `the-stages-panel-is-the-prototypes`.
`scripts/port-control-baseline.json` regenerated: − `PartEdits` (the same frame, drawn by the hook now), − `Phases`
(Style's second selector), + `StageEdit`.

SPEC IMPACT: Yes — supersedes the 2026-10-06/07 "Style | Text | Animate" and "the toolbar is half the screen" rows.
The controller holds the spec (`TOOLBAR-SPEC-2026-10-09.md`) and applies the corpus rows; nothing in the corpus was
edited from this branch.
