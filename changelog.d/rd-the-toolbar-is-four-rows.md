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

`HubSectionCanvas.outSpeed` ('fast' | 'gentle', regular = absent) is NEW (commit 7): a scroll-driven scene's Build out
feel. No migration; absent draws what every scene drew.

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

### 6b · three things seen on the review copy

- Animate's row 2: Fade · Blur · Move · Size sat in one grey track like row 1's selector and read as a single choice
  with nothing picked. They are four on/offs, so they are the app's CHIPS now (`app/_components/chips.tsx` — each
  its own pill, filled when on), four even on one line (`SP_ANIMATE_CHIPS`). Still | Drift keeps the selector.
- The two-line dropdown's name was 10.5 px, under the template's smallest type; it is 12 px (the Form row's small
  line) over a 14-px value (the Form row's pill), and the two lines with their margins are the pill's 44 px.
- Background's Darker ↔ Lighter bar filled from the left end; it fills from the CENTRE out to the knob, and nothing
  at rest. `Slider` gains ONE optional prop, `from="centre"` (one attribute; left out, the markup is byte-identical —
  guarded) and `.sn-slider[data-slider-from='centre']` draws it from the same `--sn-slider-fill`. `slider.tsx` is
  imported only by the Maker's lazy pieces.

### 7 · Movement is each phase's own feel

Owner: *"movement independent from each. not universal for all"* · *"i thought this would be like how does the
effect execute its effect, calmly, cinematic, etc"*. Movement ◆ was ONE preset shown under all three phases that set
the effect, the side, the Action, the drive and the tempo at once. Now (`lib/animate-feel.ts`):

- Movement ▾ = Quick · Calm · Cinematic, per end. It writes a TEMPO and nothing else — never an effect (the chips),
  never the drive. A part: Build in → `speed`, Build out → `outSpeed` (both shipped). A scene: Build in → `duration`
  + `stagger`; Build out → the one new field, `outSpeed`. Auto scroll → the run's `autoSpeed`.
- There is no "Auto": Calm is what plays when nothing is stored, so the word shown is always what plays.
- Row 4 — Build in: Movement ◆ · Plays (On arrival | On scroll) · Delay (a part) or Rows (a scene of rows; "One by
  one"). Build out: Movement ◆ · Leaves ◆ (As it scrolls away | Scrub out ◆ | Auto scroll ◆ — "Next scene", renamed,
  the same stored `transition`). Action: rows 1–2 only.
- A Movement with nothing to time (no effect on · Scrub out · on arrival) is grey and a tap says why.
- On arrival a scene / part has no Build out: Build out's row 2 says so, with the switch that makes it follow the
  scroll — no chips that do nothing. The hidden "last Build out off → back to plays once" of commit 6 is gone: Plays
  is the one place the drive is chosen.
- The old preset (Still · Calm · Editorial · Cinematic · Custom) is not offered in the toolbar; a stored one keeps
  playing and nothing is rewritten on open. Movement stays ◆: all of a scene's motion and a part's motion are Event
  Hub Pro today (the removed Duration was too), and `outSpeed` joins `HUB_CANVAS_MOTION_KEYS`.

Guest page: a scroll-driven scene's ranges read two new values with the OLD ranges as their fallback
(`--hub-in-end`, `--hub-out-range`, `globals.css`), emitted only from a value the couple set themselves — every old
preset scene gets byte-identical values and classes (guarded for every preset × fine-tune × drive). One honest
exception: a scene that follows the scroll AND carries its own `duration` (only the internal new Maker's removed
Duration could write that) now obeys it; before, that number did nothing there.

First load (the file minified alone, esbuild, gzip -9): `lib/hub-canvas.ts` 6,459 → 6,556 = +97 B; `lib/hub-look-pro.ts`
1,126 → 1,128 = +2 B. Everything else is in lazy pieces (guarded). The real budget check is the controller's build.

Guard: `lib/movement-is-a-feel-per-phase.test.ts` (7 rules, nine sabotages seen red); `animate-is-four-rows` and
three pinning tests re-aimed with the reason written in.

### 9 · ▶ plays where they are; held, it is the whole page as a guest

Owner: *"preview button allow preview the animate on where they are"* · *"long press will preview that whole page
(they can scroll, tap around, and an exit preview button should show)"*.

- TAP: in Animate, ▶ plays the phase on screen alone — Build in, the Action or Build out (`playSeq` + `only`,
  `app/[slug]/_components/play-sequence.ts`); in any other tool, the part's whole life as before. A Build in that
  plays on arrival runs for the page's own seconds (the Movement picked — it was a flat 0.9 s); an end that follows
  the scroll is shown once on a clock and the status line says so; under "reduce motion" nothing plays and it says so.
- HOLD (0.5 s): the whole page as a guest, in place — the toolbar, the frame and the work area's tool step aside,
  the guests' pages still turn, and the canvas takes no tap (`{ t:'guest' }`, `editor-bridge.tsx`): the page's own
  buttons, tabs and sheets answer. A link that leaves the page and a form being sent are refused and said in the
  toast. "Exit preview" is the one ActionButton, above the safe area and the guests' bar; it returns to the page,
  the part and the tool held. Nothing is saved by being there, no request is added (the same canvas, no reload).
- The hold's twin: the first tap of ▶ says "Hold ▶ to preview the whole page." (once a visit); a screen reader
  hears it in the button's name.

All of it is in the lazy toolbar and the editor-only canvas bridge — nothing in a Maker first-load file (guarded).
Guard: `lib/the-play-button-previews.test.ts` (5 rules, eight sabotages seen red); seven assertions in five pinning
tests re-aimed with the reason written in.

### 9b · the preview, seen on the review copy

- The canvas never went into the preview: the Maker's message names no section, and the bridge read it after the
  line that drops every message without a `key` — so every tap in the "preview" still picked a part. It is read
  with the other keyless messages now (guarded by its place, and by the message having no key).
- The work area's tool stayed on the page while the toolbar was away (▶ playing too) and covered "Exit preview": it
  is hidden whenever the toolbar's root is away.
- A keyboard way in: Shift + Enter (or Shift + Space) on ▶; the one button takes the focus, Esc leaves.

### 9c · the toasts could not be seen (seen on the review copy)

The toolbar's toast was drawn inside the toolbar, which leaves by a transform — so while it was away (▶ playing, the
whole-page preview) "Hold ▶ to preview the whole page." and both refusals were in the page and invisible. It is drawn
on the page's body now. And the Maker's own top bar (✕ · the stage · undo · Apply) slides away for the preview as it
does for ▶: a guest's page carries nothing of the Maker's but "Exit preview".

### 10 · Background's choices are picture tiles

Owner, choosing among three drawings of row 2: *"A- picture tiles"* (`review/bg-tiles.html`).

- The name is written ON the tile (12 px semibold, at its foot) — no white sticker. Each tile decides how its name
  reads (`lib/bg-tile-name.ts`): a flat tile (None · Plain · Opaque · Frosted) by its own colour, ink or white; a
  picture (Diagonal · Glow · a ready-made scene · an upload) on a soft fade at its own foot, strong enough for any
  picture — white on a dark fade, ink on a light one for a light picture.
- The picked tile has ONE ring (2 px of the toolbar's ground, 2 px of the accent), no inner border; the tile is 10 px
  shorter than its row (38 px, 34 on a short phone) so the ring is never cut. The button is still a 44-px tap.
- "None" is a white tile with one thin stroke. Opaque is the flat tint at its opacity and Frosted the tint under a
  soft haze — they were diagonal stripes, which read as "switched off".
- A scene's picture and the couple's uploads wear the same tile; "＋ Upload" keeps the add look.

The older editor's rows (`preview()`) are untouched. Lazy files only. Guard: `background-is-four-rows` (7) — names
executed for 729 colours × Plain / Opaque / Frosted and for the worst picture; seven sabotages seen red.

### 10b · the tiles' fade was too heavy (owner's eye on the first version)

Diagonal and Glow both ended as one dark block and Peony field wore a grey band. Now a COLOUR tile has no fade at
all — its swatch is exactly what the page draws — and its name takes ink or white from the colour at its own foot
(a gradient by the stops of its ramp the name sits over). A PHOTO wears a light fade (35 %, the bottom half only)
and the reference's soft shadow, chosen by the colour MEASURED at the picture's foot (`TILE_FOOT`; the guard measures
the ten files again with sharp): Peony field and Misty sunrise read as light pictures. An upload is not measured
(reading its pixels needs a second, cross-origin fetch) and wears the dark default.

What that promises, measured over 729 colours: a ready-made scene's name 4.5 : 1 on its foot; a flat colour tile
never under 3.78 : 1; Glow never under 2.96 and Diagonal never under 2.65 at the worst stop under the name (no fade
is laid over a colour tile, so 4.5 : 1 cannot be promised there — the soft shadow is not counted).

### 8a · in a Scrub run the hand-over plays each scene's own effect

Owner: *"build out from current element and build in on next element under it applies at the same time on scrub
like a cross fade for both"*. A run used to switch the scenes' own Build in / Build out off and play one fixed
cross-fade. Now, inside that same cross-fade — the same spans, the same spacer's timeline — the outgoing scene plays
its own Build out and the incoming one its own Build in: the travel, the size, the blur. Their opacity is held
(`hub-run-keep`, last in the list), so the cross-fade stays the only fade. Stylesheet only (`globals.css`, 3 rules
+ 1 keyframe), inside every gate the run is in. No stored value, no first-load byte, no script.

Played in Chromium when built (a three-scene run + a Fade / Fade pair, 243 scroll positions, the stylesheet before
and after): every cross-fade identical at every position; A travelled 0 → −26 px over exactly the span it faded
out on; B came −28 → 0 px while fading in; a composed one grew from 0.9 out of an 8-px blur; the Fade / Fade
bodies never moved; under reduce motion nothing moved and nothing faded.

WHAT CHANGES FOR A SCENE ALREADY ON SCRUB: nothing if its effects are Fade or none (the default). A scene with Move,
Size or Blur — the old Editorial / Cinematic presets included — now moves that way during its hand-over.
"One part after another" scenes keep their parts' arrival while pinned; only their way out is the whole scene's.

On a PART, Build out's dropdown is named "Scene leaves ◆": the hand-off is scene to scene, and the name says whose
it is. Guard: `lib/the-scrub-hand-over-plays-own-effects.test.ts` (6 rules, six sabotages seen red).

### 8c · Scrub is a held hand-over, in the same place, on a page that scrolls natively

Owner, on the prototype he approved (`review/scrub-prototype.html`): *"them must be on the same position to create
that keynote like transistion"* · *"let it enter on the last 20% of the build out"* · *"it entered when the previous
element is not yet done"* · *"it never completed the schedule"* · *"if no build out, then animation will be under
it"* · *"element run completely normal. we only control the effect"*. This REPLACES the stacked Scrub run (production
holds no Scrub scene, so nothing live changes).

- THE PAGE STAYS ONE PAGE. Every scene is an ordinary scene in page order. A scene that hands over is wrapped — with
  the rest of the page — in a cell (`hub-scenes.tsx` `flow`): `hub-cell › hub-stage › [the scene, hub-after › the
  rest]`. Unarmed these are plain blocks.
- NATIVE SCROLLING. A hold is real page LENGTH (the cell's `::after`) and the stand-still is the browser's own
  `position: sticky` on the stage; "the same place" is a negative margin on the rest of the page, in the flow. No
  script sets a scroll position or prevents a default; no transform is put on anything that holds scenes.
- THE ENGINE ONLY MEASURES AND SETS (`hub-scrub-engine.ts`, numbers in `hub-scrub-math.ts`): heights and the screen
  → custom properties and `data-hub-*` marks; it reads the browser's own sticky back to know how far a hand-over
  has gone. Re-measures on resize, orientation change, fonts, pictures, and a scene changing height.
- THE HAND-OVER: the leaving scene is held centred (a list whose rows build one by one, or anything taller than the
  room, is scrolled through first and held at bottom-at-centre — at ANY window height); its Build out plays over 55 %
  of a screen of thumb travel; the arrival, in the same place, begins when that is 80 % done and runs 22 %; a list's
  rows wait until the leaving one has completely gone, then build as each reaches the centre line, all complete by
  the time the list's bottom is on it. Two back-to-back hand-overs are parted by a rest (30 %). No Build out → no
  hold: the scene stays and the next builds in below it. The page is always long enough for the last one to finish.
- ONE FADE (the hand-over's, on the scene); the scene's own keyframes give the travel, size and blur (8a's
  `hub-run-keep`). 8a's three stacked-run rules are retired. The stacked run's other rules stay in the stylesheet,
  unused by Scrub, for a cleanup that removes the block whole; Auto scroll is untouched.
- FAIL-VISIBLE: every rule needs `data-hub-scrub-on` (set only by the engine) behind `screen` + "no reduced motion".
  No script, a blocked chunk, an error, reduce motion, print → the plain page, everything visible.
- BUDGETS: Maker first load — nothing (`lib/hub-scenes.ts`, `lib/hub-canvas.ts` not touched; guarded). Guest page —
  the island (`hub-scrub.tsx`, draws nothing) is rendered only by a page with a Scrub scene and fetches the engine
  after hydration: one chunk, about 2.5 KB gzipped (esbuild, engine + its numbers), no other request.

PLAYED IN CHROMIUM (`scripts/scrub-browser-check.mjs` — the real renderer, stylesheet and engine; 890 × 1548,
940 × 1608, 1280 × 770, 375 × 812, 375 × 667; every 16 px down and back): 92 checks, all green — back == down; no
overlap outside a pair; never two readable at once; rows in order and complete before the list leaves; nothing of
the scene before once the rows begin; every hand-over finished before the page ends; the page standing still while
one plays; the script never set the scroll position, prevented nothing and holds no wheel / touch listener; a real
wheel and a real touch drag moved the page; with no script and with reduce motion, the plain page.

Guard in the suite: `lib/scrub-is-a-held-hand-over.test.ts` (6 rules, nine sabotages seen red); eight pinning tests
re-aimed with the reason written in.

### 8c · the lab plays the real Scrub, and a Scrub scene while editing is the plain page

`/dev/maker-lab?studio=1&scrub=1` — the Maker lab on the prototype's chain, as REAL scenes through the guest page's
own renderer (`HubScenes`): Countdown → A note from us (two short hand-overs in the same place) → Schedule (eight
moments, row by row, then it leaves) → Venue (no Build out: it stays, the next builds in below) → Dress code (an
ordinary one, hands over) → Our love story (the last arrival). `app/dev/maker-lab/lab-scrub.ts` is the one chain:
the page the browser check plays takes its six canvases from it. The canvas address is a path
(`/dev/maker-lab/guest/scrub` — the Maker writes its query after the address it is given); opened plainly it is a
guest's page. What is saved on the chain rides its own cookie (`lab_widgets_scrub`), so an old lab draft cannot take
a scene off Scrub and the chain cannot follow the owner back into the ordinary lab.

WHILE EDITING, NOTHING IS HELD. On the Maker's canvas a Scrub scene is drawn as the plain page draws it — whole, in
page order, the top thing at its own place, so every part can be picked. The hand-overs run only while the page is
shown as a guest (▶ held — the bridge's `data-maker-guest`); leaving the preview disarms the engine, which takes
every mark off. The island knows the Maker's canvas by the section marker only a verified host's canvas draws, and
does not even fetch the engine until ▶ is held. Because a hold is page length, opening or closing the preview
changes the page under the host: the scene that was mid-screen is put back (and scrolled on until it can be read, if
it is now an arrival) by `hub-scrub-place.ts` — fetched on the Maker's canvas only; a guest's page never loads it
and is never moved by script.

Browser check, case 7 added (`scripts/scrub-browser-check.mjs`, the page's own island on a page with a marker, at
375 × 812 and 1280 × 770): nothing held while editing; every scene pickable; armed under ▶ held with the mid-screen
scene still there and readable; a hand-over plays; the place kept on the way out; every mark gone. 106 checks, all
green; the editing rule sabotaged in the browser → six red.

Sizes (minified, gzipped): the island 552 B (was ~330), the place-keeping 460 B (Maker's canvas only), the engine
unchanged. Maker first load: 0 B (the lab and `app/[slug]` only).

Guard: `lib/the-lab-plays-the-scrub-chain.test.ts` (4 rules, each sabotaged red); `scrub-is-a-held-hand-over` (5)
re-aimed (the engine is fetched beside the place-keeping).

SPEC IMPACT: Yes — supersedes the 2026-10-06/07 "Style | Text | Animate" and "the toolbar is half the screen" rows.
The controller holds the spec (`TOOLBAR-SPEC-2026-10-09.md`) and applies the corpus rows; nothing in the corpus was
edited from this branch.
