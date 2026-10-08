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

### 2 · the preview only selects

Owner: "on preview screen, you only select. You can change the content there via edit".

- **A tap never types** — `makerStageMayType` (the one rule the Event Hub canvas and the reply pages both ask) answers
  no for every part; it was "typing is a second tap on the picked part". The words are changed in Edit.
- **No buttons on the frame** — ↑ ↓ ✕, the grip and 🗑 are gone; the outline and the name stay. Moving and removing are
  Edit › ↑ Earlier · ↓ Later · Remove (the same landing function the grip had; one order write a step). ＋ stays: it is
  the one control left on the preview and the way a removed part comes back (owner 2026-10-09, decided).
- **Something is always picked on arriving** at a stage's page: the first part the page DRAWS (`ordered()`), once per
  arrival; a tap on the ground still lets go.
- **The last-used tool is remembered** (also while the toolbar is away in Studio), and a part opens on the first tool
  that has something to set there (`makerPartToolFor`).
- **The Camera has only Style** (owner: a full-screen design) — Edit, Background and Animate are grey on it.

Tests: new `lib/the-preview-only-selects.test.ts` (5 rules, each seen red). Re-aimed with the reason written in:
`the-stages-panel-is-the-prototypes` (typing, the frame's chips), `the-rsvp-stage-is-parts` (typing, the fixed page),
`the-stages-panel-wears-the-accent` (the frame's marks), `one-drag-is-one-order-write` (the grip → a step).

### 3 · Edit types the words in place

Owner: "if the edit is just text, then don't need to jump. but it can both adapt to whichever is edited. same goes to
simple edits. Only jump if it has editing that cannot be done there. Example: Schedule, Love Story, Wedding March, Logo".

- **Rows 1–3 are the part's words**, one typed Form row (`TypedRow`) per text the page draws for it — the title, the
  names, the invite line, the link; Your message; Your reminders; a scene of their own's Heading and Words — the text
  last tapped first. The page shows the words as they are typed; keeping (tap out / Enter) is ONE draft write, the
  shipped one (`stage-panel/part-words.ts`: `typedDisplayName` / `withTypedWords` / `sceneTypeWrite`, the typing bar's
  own write keys, held). No new storage.
- **A part that cannot be edited in three rows keeps ONE door** in row 1, in the prototype's words: "Open in Studio ›
  <page>" (Schedule, Love Story, Wedding March, Logo, E-Gifts, RSVP, Mood Board & Dress Code, Seat plan) · "Change it
  in Suppliers" (date, place, venue, the details).
- **The typing bar**: while a field is open the toolbar is "Typing · <part>" + Done (the app's main button) over that
  one field, above the keyboard.
- **One ⓘ**, at the right end of the "You're editing" line, opens the centred explanation with the picked part's own
  sentences (word for word); nothing when it has none. No ⓘ and no name-only row in Edit.
- Arriving at a page never lands on the Reveal: the first drawn part after it (a tap still picks the Reveal).

Tests: new `lib/edit-types-the-words-in-place.test.ts` (6 rules, each seen red). Re-aimed with the reason written in:
`every-look-draws-a-picture` (the lone-ⓘ row), `maker-parts` (the door's words).

SPEC IMPACT: Yes — supersedes the 2026-10-06/07 "Style | Text | Animate" and "the toolbar is half the screen" rows.
The controller holds the spec (`TOOLBAR-SPEC-2026-10-09.md`) and applies the corpus rows; nothing in the corpus was
edited from this branch.
