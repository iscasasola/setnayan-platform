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

### 3b · four things seen on the review copy

- **Only parts the page drew are parts of the page** (`makerPartIsDrawn`): the plain cover draws no invite line and no
  link, yet both could be picked — the frame fell back to the whole cover and Edit was blank. And arriving lands on the
  first drawn part Edit has a row for (`makerArrivalPart`), never an empty tool.
- **The editing line is shortened from the front** (`stageEditingLine`): "You're editing ·" goes first, then the stage,
  then the page — the part's name is always whole. The whole path is still what a screen reader hears.
- **A grey Earlier / Later / Remove says why when tapped** (`makerPartStepWhy`) — the grey is the template's "cannot be
  used" look (`waiting`); a live step is the neutral button, Remove the danger tone.
- The open field selects its words: that is the app's typed row everywhere (`FormRowField`), left as it is.

### 4 · Style is cards, Colour and Size

Owner: "maximize the height … portrait" · "color and size share the same row" · "Color just 1 circle…" · "row 3 is
palette style".

- **Rows 1–3: the look cards**, a strip as tall as its rows, a card as tall as the strip (the one phone-shaped frame
  at the rows' height), the picked one in the middle with the previous and the next in view; each picture centred and
  scaled to fit, never cut (`styleCardFit`), on the page's own ground. A look that draws one long line gets a wider
  card — 60 % of the toolbar's inner width (`styleCardIsWide`). The Reveal's, the Camera's, the pass's and the Themes'
  cards are unchanged.
- **Row 4: Colour (one circle → the one colour picker) + Size (the app's slider)**, drawn by the toolbar for the picked
  part's own words (a line of the cover; a scene's heading) — the part sheet's own write (`stage-panel/part-look.ts`:
  `withElementChoice`, the same queue key, held). A part with neither has no row and its cards take all four.
- **Dress code**: cards over ONE row of the five palette looks (`PaletteLookStrip`), then Colour + Size — it was three
  carousels and a dropdown, 614 px in a 210-px box.
- **No longer drawn in the toolbar** (stored values still honoured): Font, Alignment, Spacing (commit 1); the Dress
  code's Do's & Don'ts look (owner, decided: Studio › Mood Board & Dress Code — not built here) and its Figures ▾ (the
  Mood Board's own switch is the same setting); an editor of a part's content under Style (the Love Story page's —
  it is Edit's door).

Tests: new `lib/style-is-cards-colour-and-size.test.ts` (6 rules, each seen red). Re-aimed with the reason written in:
`every-style-card-is-phone-shaped` (the toolbar's Style cards only — the owner's newer sentence), `every-look-draws-a-
picture`, `the-stages-panel-is-the-prototypes` (Dress code), `the-stage-panel-fits-a-phone`,
`every-studio-colour-opens-the-one-picker` (+1 trigger). `scripts/port-control-baseline.json` regenerated: −
`DosLookCards`, − `DressFiguresRow`, − `PaletteLookCards` (the three above), + `PaletteLookStrip`, + `StageLookRow`.

### 4b · Style cards, seen on the review copy

A row's gap above the cards (the picked card's ring was cut at the selector's band); "one long line" measured on what
a part draws, not on its block (the Logo's cards came out wide); a palette look's picture fills its button.

### 5 · Background is four rows

Owner: "copy the background on studio look" · "remove the Background Text" · "darker lighter line bar" · "no picking
where just automatic center" · "remove how close" · "it is meant for just this element".

- **Row 1** the source ▾, no label: The Event Hub's · Colour · Scene ◆ · Upload ◆ (the Look's own names and ◆ table,
  `lib/background-source.ts`). A source picked only SHOWS its choices; the Event Hub's own is one choice and is taken
  at once.
- **Row 2** that source's choices, one row of small pictures: None · Plain · Diagonal · Glow · Opaque · Frosted — the
  ready-made scenes — "＋ Upload" and the couple's own photos and clips.
- **Row 3** the choice's one control: a colour's ONE circle (the one picker), with Opacity beside it on a glass; a
  picture's ONE "Darker ━ Lighter" bar — the page follows the thumb, one write on release.
- **Row 4** Framed | Full width, and Still | Parallax for a photo.
- **Not drawn any more** (stored values still read by the page): In frame, How close, "Use this background on every
  scene?", "Remove this scene's photo", the Gallery sheet, the ⓘ's sentence.
- **Asked for and NOT built — a scene cannot store it** (no migration, nothing invented): "Dawn" (needs a scene kind
  `dawn`), a second colour (needs `canvas.color2` and a two-colour ombré), "Video" as a ready-made loop (a scene's clip
  must be the couple's own upload: needs `hubMediaRef` to admit the loops' closed list). The couple's own video and
  clips are under Upload.

Tests: new `lib/background-is-four-rows.test.ts` (5 rules, each seen red). Re-aimed with the reason written in:
`every-studio-colour-opens-the-one-picker`, `the-slider-is-one-drawing`, `the-stages-panel-wears-the-accent`.

### 5b · a scene's Darker ↔ Lighter is a place on the bar (its own commit — revert it alone to go back to three stops)

`HubSectionCanvas.shade` takes the Look's own shape (`HubMainShadeValue`): 'darker' | 'lighter' as before, or a
non-zero whole number −100…100; the centre is never stored. No migration: the two words stored before keep reading,
at the Look's places for them (−70 · +70), and lay exactly the veils they laid (`lib/scene-media-shade.ts`
`sceneShadeStep`, guarded for every theme and every position — never under the reading floor). The scene sanitizer
calls the Look's `sanitizeHubMainShade` (one rule, not two). `lib/hub-canvas.ts` is a Maker first-load file: minified
alone it is 17 bytes smaller raw and 4 bytes larger gzipped — the real budget check is the controller's build.
`lib/scene-shade-bar.ts` loses its three stops (a release rests where it is let go, snapping to the centre).

### 5c · a page change never ends on nothing picked (seen on the review copy)

A tap on a guest tab let the picked part go BEFORE asking the canvas for the page; the lab's sample — drawn as one
page — refused the switch, and the toolbar was left on Welcome with nothing picked and every tool an empty box. The
tap itself did reach the tab (the swipe handler takes nothing from it). Now: a tab tap asks for the page and lets go
of nothing; the part is let go when the canvas HAS switched and the part is not on the new page; a canvas that did
not switch within 450 ms gets that page's first part Edit has a row for; arriving replaces a part held from another
stage or left on a hidden page (`makerArrivalKeeps`, `lib/maker-parts.ts`). Background: a source that is only being
looked at opens at its first choice (it kept the last source's scroll place). Guard: `the-preview-only-selects`
(3b), three sabotages red.

### 6 · Animate is four rows

It was one column of eleven rows (364–416 px in a 210-px box, scrolling). Now (`stage-panel/stage-animate.tsx`,
`TOOLBAR-SPEC-2026-10-09.md` § ANIMATE + decision 8):

- row 1 Build in | Action | Build out;
- row 2 Build in / Build out: Fade · Blur · Move · Size, each on or off (the app's row of toggles); Action: the two
  shipped words (a part Still | Drift, a scene Still | Slow lift);
- row 3 only what the ON ones need, a half each: From / To ▾ for Move, Grow | Shrink for Size;
- row 4 Build in: Movement ◆ + Rows (a scene of rows) + Delay (a part); Action: Movement ◆; Build out: Movement ◆ +
  Next scene ◆ — no Delay.

Not drawn any more, and NOT touched in what is stored (it still plays): Duration (a part's `speed`, a scene's
`duration`), Timing (a part's / a scene's `timeline`), the line under "Does", the ⓘ of its own. Delay is a dropdown of
the three shipped steps (it was a slider that settled on them). One behaviour added: a part's Build out makes it
follow the scroll (shipped) — and the last one switched off now puts it back to playing once, because Timing ▾ was
the only other way back. A save's error takes row 3 while it stands. Two or three dropdowns share a row as the
prototype's two-line pill (`Dd stacked`); its classes live in `lib/maker-animate-rows.ts`, imported only by the
toolbar's lazy pieces, so the Maker's first-load JS gains nothing. Guard: `lib/animate-is-four-rows.test.ts` (6
rules, one sabotage each seen red); five pinning tests re-aimed with the reason written in. Flag-off and desktop:
the older editor's Animate (`scene-animate-tab.tsx` outside `ss`, `PartAnimateTab`) is not touched.

SPEC IMPACT: Yes — supersedes the 2026-10-06/07 "Style | Text | Animate" and "the toolbar is half the screen" rows.
The controller holds the spec (`TOOLBAR-SPEC-2026-10-09.md`) and applies the corpus rows; nothing in the corpus was
edited from this branch.
