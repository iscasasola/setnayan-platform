## 2026-10-10 · feat(maker): a fixed block has its own Animate — the Wedding March, The details, E-Gifts, Happening now

Behind `makerStagesStudioEnabled` (internal + phone). A guest's Event Hub page is byte-identical unless the couple
gave a block a motion: then it carries one hidden mark before that block and one `<style>`.

Owner's rule, 2026-10-09: "there should always be animate and background?" → "yes that is what we are doing. giving
the freedom to fix their event hub." — Animate for every element, Background for every block. Animate was grey on
every fixed block.

- **Which blocks**: the four a guest's page draws from one real root. The other six the canvas frames — Your seat ·
  Photos of you · Announcements · Live hub · Digital pass · What to wear — are SAMPLES there (each guest sees their
  own, drawn elsewhere), so a look kept for one would show in the Maker and never reach a guest. They stay grey and
  a tap says why, naming the thing ("This is a sample. Each guest sees their own seat here."). E-Gifts is live only
  while the event has gift details (otherwise: "Guests see nothing here until you add your gift details.").
- **Animate** is the toolbar's own, every phase — Build in · Action · Build out, Movement, Plays, Delay — wired as a
  cover line's is (`stage-panel/block-animate.tsx`), drawn in the toolbar's four rows.
- **It is the Event Hub's own motion** (`lib/block-looks.ts`): the cover line's stored shape, read by its closed-set
  reader (`sanitizeHubElementMotion`) and written by its own builder (`hubElementMotionDeclarations`) inside its two
  gates. A timed Build in waits for the page's one observer (`.pahina-in`), so it plays when the guest GETS to the
  block; one that follows the scroll follows the block's own trip across the screen. Browsers without view
  timelines, and guests who asked for less motion, keep today's still page.
- **Stored** in `events.style_preferences.block_looks = { entourage | details | gifts | spotlight: { motion } }`,
  beside the fixed parts' style picks. No migration: proved on the replayed schema (90 CHECKs on `events`, one on
  `rsvp_ask_config`, none on `style_preferences`; no trigger touches it). Drafted through the one draft door, live
  on Apply by the existing merge; the Apply count moves; the Apply list names it "Event Hub · How a block looks".
- **A guest's page** (`site-body.tsx`): the rules address a block from a hidden mark standing right before it, so no
  block grows an attribute and whichever arrangement it is drawn in is found; Happening now is marked in both places
  it can be drawn. No new wrapper, no extra read (the page already reads `style_preferences`).
- **First load is net smaller for this step** (single-file gz): `lib/hub-draft.ts` 11,698 → 11,765 (+67: carry the
  key, count it, name it); `lib/rsvp-ask.ts` 1,651 → 1,574 (−77: `rsvpAskConfigOnGoingPublic` moved beside its
  draft half in `lib/going-public.ts`, which only server code reads); `lib/maker-parts.ts` untouched. Net −10 B.
  The reader, the rules and the rows load with the toolbar (`details-lazy.tsx`).
- The toolbar's "which tools work" line is now
  `const toolWorks = (t: MakerPartTool) => !picked || ownTool(t) || ((t === 'edit' || t === 'style' || !styleOnly) && makerPartToolWorks(picked, t));`
  with the two exceptions named in `ownTool` (a reply card or line; a fixed block with one real root).
- Found late and registered: the RSVP line's Colour row (six circles: the page's own + the event's five) is now in
  the Maker's colour sweep (`every-studio-colour-opens-the-one-picker.test.ts` `PAINTS`) for what it is — a fixed
  list of slots, no picker of its own. That sweep reads the folder and had not been run for the earlier commits.
- The lab keeps a drafted block look in a cookie (`lab_blocks`) and marks its E-Gifts block, so it can be tried.

Guard: `lib/a-fixed-block-has-its-own-motion.test.ts` (6) — the last one holds the first-load rule as a property (no
first-load file may reach the reader, the rules or the rows), not as a byte count. Sabotaged red, each restored: the reader keeping a
made-up motion · a sample given a look · the draft dropping the key · a block look not counted as a change · a mark
served to every guest · the gate left open · a sample's Animate live · Happening now marked in one place only.

SPEC IMPACT: `events.style_preferences` gains one optional key, `block_looks` (per fixed block: its motion, in the
Event Hub's own motion shape). No schema change. Corpus row to be written by the controller with the batch.

## 2026-10-09 · feat(maker): on the RSVP stage every line is its own part, and the whole group is one too

Behind `makerStagesStudioEnabled` (internal + phone), on the Maker's RSVP stage only. A guest's reply pages draw
exactly as before: the only thing served to them is a name on each line (`data-rsvp-line`), which draws nothing.

Owner, 2026-10-09, on the live Maker's RSVP stage: "why is this grouped?" (the eyebrow, the question, both answers and
the hint sat in ONE frame) · "shouldn't it be per element?" — and on the clickable prototype
(`public/review/rsvp-per-element.html`): "i like this idea. heading message then the whole group?" Yes: each line is a
part, and the whole group is a part too.

- **The lines** (`app/[slug]/_components/rsvp-canvas-parts.ts` — `RSVP_SECTION_LINES`, `RSVP_LINE_NAME`, `rsvpLineOf`):
  Form — Eyebrow · Question · Yes answer · No answer · Hint; When yes — Heading · Message · the pass's Save button;
  When no — Heading · Message. Named where they are drawn: `rsvp-widget.tsx`, `rsvp-one-at-a-time.tsx` (the hint),
  `invite/enter/page.tsx` (the two notes; the Save button is named on a box around it, because a button is inert on
  the canvas and the tap lands on what holds it).
- **One frame, on the picked line** (`rsvp-canvas-bridge.tsx` → `stage-tools.tsx` → `add-part-sheet.tsx`
  `usePartEdits`): a tap reports the line under the finger; the frame is drawn on that line and wears its name;
  "You're editing" ends on it. A line is NOT a new part key (`lib/maker-parts.ts` is untouched — no first-load bytes):
  it is kept with the part it belongs to, so another part, a tab or the ground lets it go.
- **The group** is picked from between its lines (the form's own paper, a field that is not a line): the part, with no
  line — the frame goes round the whole of it, as before.
- The stage's own panel is told which line is picked (`stage-panel/store.ts` `line`), ready for Edit / Style /
  Animate per line (next commits). Nothing reads it yet.
- The lab's RSVP screens (`app/dev/maker-lab/guest/page.tsx`) name the same lines and now draw the eyebrow, the hint
  and a Save button, as the real pages do.

Guard: `lib/the-rsvp-stage-is-parts.test.ts` (25) — section 8 executes the tap on a marked page (each line picks
itself; inside a line is that line; between the lines is the group; a line of another section is never accepted), pins
where the pages name the lines, and the wiring. Two older pins re-aimed with the reason written in (the tap's answer
now carries `line`; the pick handler keeps the line with its part). Sabotaged red, each restored: the tap not reading
the line · any line accepted · the frame unable to find a line · a line outliving its part · the widget not naming the
question.

**Edit is the picked line's words** (owner: "shouldn't it be per element?" · "why is this scrolling?"):

- With a line picked and the toolbar on Edit, the stage's panel is THAT line's words and its own Start from, and
  nothing else (`maker-rsvp-ask.tsx` `picked`, `lib/rsvp-form-words.ts` `RSVP_LINE_WORD`). The toolbar hands Edit to
  that panel only for a line with words (`stage-tools.tsx` `rsvpLineTypes`, `data-stage-edit-own`); the pass's Save
  button has none and keeps the toolbar's own Edit.
- With the group picked (or nothing), the panel is the group's settings WITHOUT the words — the long list is gone:
  Form keeps Reply by · How guests answer · How guests get in · What the reply asks; When yes keeps Celebration;
  When no has no settings of its own yet (its Background and Animate come with the card step).
- "You're editing" names the line IN PLACE of its part: "RSVP › Form › Question" (it read "RSVP › Form › RSVP ›
  Question", which also pushed "You're editing ·" off the line).
- The lab only: the app's own chrome (the cookie card) stays off the lab's RSVP screens, as off its other guest
  pages — it covered "Sadly, no", the hint and the Save button. No real page is touched.
- **Three new optional words** — the form's eyebrow, question and hint (`rsvp_ask_config.words.eyebrow | question |
  hint`, capped 40 / 80 / 60; no migration). Absent, the card prints exactly what it did (`RSVP_FORM_WORD_DEFAULT`:
  "Your reply" · "Will you celebrate with us?" / "Will you be with us?" · "Tap one to continue"). No premade lines
  were invented for them: "Automatic" is the one shipped wording.
- The desktop's stage and Studio › RSVP list the same words they did (`RSVP_SCENE_WORDS` unchanged).
- First load: `lib/rsvp-ask.ts` (read by `lib/hub-draft.ts`) +42 B gz; the defaults and the line map live in their
  own module, loaded with the lazy panel.

Guard: `lib/the-rsvp-stage-edits-one-line.test.ts` (5) — the panel is rendered for every line of every screen (one
word field, the right one; one Start from at most), for the group (no word field) and without the phone's `picked`
(the old list). Sabotaged red, each restored: Edit drawing the whole list · Yes and No swapped · the card ignoring
the couple's question · the list keeping its words on the phone · the toolbar keeping its own Edit · the hint
ignoring the couple's · the lab showing the cookie card · the editing line repeating the part. Pins re-aimed with the
reason written in: which screen edits a word (`the-rsvp-stage-is-parts`), the lab's word list
(`studio-rsvp-wears-the-templates`).

**Style is the picked line's Colour and Size, and the card is the group** (owner: "shouldn't it be per element?" ·
"heading message then the whole group?"):

- **Style per line** (`rsvp-line-look.tsx`): Colour — the page's own, or one of the event's five colours — and Size
  (85 · 92 · 100 · 110 · 120 · 132 %), the same swatch and slider a cover line has. A reply page's lines have no
  premade looks and none were invented. A button (the two answers, the pass's Save) has Size only: its colours are
  Look › Buttons'.
- **Stored** in the same one object as the words: `events.rsvp_ask_config.look = { lines: { '<part>.<line>': { c, s } } }`
  (`lib/rsvp-look.ts`). `c` is a colour SLOT (1–5), `s` one of the six sizes — nothing typed ever reaches CSS:
  `readRsvpLook` is the only reader and keeps listed values only. Absent = today's look. No migration; the same
  draft and Apply as the words.
- **Drawn** as ONE `<style>` per reply page (`rsvp-look-style.tsx`), addressed by each line's name. A guest of an
  event with no look is served nothing — the page is byte-identical. No extra read: the colours ride the event row
  each page already selects (`role_palette` joins the reply page's one select). On the Maker's canvas the tag is
  redrawn at the tap by the same strict reader (`rsvp-canvas-bridge.tsx`, message `rsvpLook`).
- **No save drops it**: the first-load sanitiser carries `look` through (+24 B gz in `lib/rsvp-ask.ts`), so the
  older panels' saves, the public-listing switch and the Pro check all keep it, with keys this build does not know.
- **The ceiling is asked before a save** (`rsvpConfigFits`, in the panel's one `save`): the whole object is capped at
  2,048 bytes by the database (`events_rsvp_ask_config_shape`). A save that would pass 1,900 bytes is refused in a
  sentence — "It is too long to keep: your RSVP's words and looks are at their limit. Shorten a message, then try
  again." — for words and looks alike (two long emoji messages used to be met only at Apply). What is already kept
  can always be made shorter.
- **The card is the group**: a tap on the door card's own paper — its edge, the space between its pieces — picks the
  screen's group (the form's lines, the When-yes note, the When-no note), and the group's frame goes round the card
  (`RSVP_CARD_GROUPS`, `data-rsvp-card`). Measured in the lab: a finger's tap in the gap beside an answer is moved by
  the browser onto that answer, so "between the lines" could not be relied on.
- The lab's reply screens are drawn inside one card like the real door, and its two answers say what the real card
  prints ("Joyfully accepts" / "Regretfully declines" — "Yes, with joy" / "Sadly, no" was a stand-in no guest sees).

Guard: `lib/the-rsvp-lines-have-a-look.test.ts` (7) — the strict reader, the rules per page, the rendered tag, every
writer carrying `look`, the panel rendered for every line, the ceiling, the card pick on a stamped door, the wiring.
Sabotaged red, each restored: the sanitiser dropping `look` · the reader keeping a typed colour · rules for a part
the page does not show · a guest served an empty tag · a button given a colour · the ceiling not asked · an
over-limit event locked · the card's paper letting go · the canvas trusting text it was sent.

**The card is a block: Background and Animate are live on the RSVP stage** (owner: "RSVP background not working." ·
"how come background not fixed and no animate?" · his rule: Animate for every element, Background for every block):

- **Background — the card's**: None · Plain · Frosted, the toolbar's own picture tiles, with the prototype's line
  "Behind the card is the Look's background — the same one every page wears." Plain is today's card and stores
  nothing; None lets the page's ground show through; Frosted is the app's own glass (`--sn-glass-*`). A LINE has no
  ground of its own: "This sits on the RSVP card's background." and the one button **Open the card**, which picks
  that card (`RSVP_OPEN_CARD_EVENT`; the pass's Save button sits on the When-yes card).
- **Animate — a line's or the card's own Build in**, on the toolbar's own Animate (`StageAnimate`, new `only="in"`):
  Fade · Blur · Move · Size, the side or the way the ON ones need, and Movement ◆ (Quick · Calm · Cinematic). A reply
  page is one screen with no scroll to follow and no exit, so Action and Build out are not offered — not drawn dead,
  not drawn at all (the prototype drew the three phases; only Build in can be real here).
- **Stored** beside each line's colour and size: `look.lines[id].i` — the Event Hub's own `MotionFx`, read by its own
  closed-set reader — and `.v` (`quick` | `cinematic`; Calm is the absence); `look.card[<part>] = { g, i, v }` with
  `g` = `none` | `frost`. Fixed lists only; no migration; the same draft and Apply.
- **Drawn** by the same one `<style>`: the card is addressed as the block that holds the masthead
  (`div:has(>[data-door-header])` — no attribute is served for it), a Build in is one keyframe reading the Event
  Hub's own frame (`motionFxFrame`) and its feel's seconds, and it stands still under `prefers-reduced-motion`. On
  the Maker's canvas a Build in that was just changed plays again on the thing it belongs to.
- **The group is called "Card"**: "You're editing · RSVP › Form › Card", and the frame's tab says CARD (it read
  "RSVP › Form › RSVP").
- **A guest's bundle never carries the look's reader**: the canvas bridge imports it on the Maker's `rsvpLook`
  message only (the two names it needs moved to `lib/rsvp-stage-shared.ts`).
- **First load is smaller than before this work**: `lib/rsvp-ask.ts` (read by `lib/hub-draft.ts`) is 1,651 B gz, was
  1,848 — the premade lines moved to the lazy `lib/rsvp-stage.ts` (only the lazy panel reads them) and the
  caller-less, Node-only `rsvpAskConfigFits` is gone (the save asks `rsvpConfigFits`, `lib/rsvp-look.ts`).
- The pass's Save line has its Size, its Build in and its ground row in the stage's panel too.

Guard: `lib/the-rsvp-lines-have-a-look.test.ts` (10) — sections 8–10: the strict reading of grounds and motion, the
rules per page fitted against ONE pattern of everything the builder may write, the panel rendered for every card and
line under Background and Animate, the wiring. Sabotaged red, each restored: a made-up ground kept · a feel with no
effect kept · the card's rule on another screen's page · Plain stored as a key · Action and Build out offered ·
Background grey on the card · "Open the card" unheard · the group called by its part's name · the reader in every
guest's bundle.

**fix(maker): choosing a Build in on the RSVP stage no longer throws; When no shows ONE card**

- Controller, on the review copy: choosing Move on the Question threw `SyntaxError: … '@media
  (prefers-reduced-motion:reduce)' is not a valid selector`. The canvas found "what to replay" by splitting the
  look's finished CSS on `}`; the reduced-motion block holds the word `animation`, so it came out as a selector and
  went to `querySelectorAll`. The rules are data now (`rsvpLookRules`, `lib/rsvp-look.ts`: plain selectors only, each
  saying whether it moves); the canvas replays the ones that move AND changed, and never takes the text apart. The
  same code runs on the real canvas and the lab's. (Not the earlier "1 Issue": that one appeared at load, before any
  Build in existed.)
- **When no shows one card** (owner: "why do i see a rounded edge frame as well?"): with nothing chosen, today's look
  stays exactly — the door's card and the note's own inner card. Once the couple gives the card a ground (None or
  Frosted), the inner note card gives up its paper, border and shadow (`RSVP_INNER_CARD_SELECTOR`).
- The lab only: its reply screens sit on a stand-in for the Look's background (a gradient of the lab's own colours),
  so Frosted and None can be told from Plain; its When-no note is drawn in the same inner card the real page has.

Guard: `lib/the-rsvp-lines-have-a-look.test.ts` (12) — section 11: a look holding the reduced-motion block, every
selector a page may be asked for is one of three plain kinds, the replay done as the canvas does it (first time ·
unchanged · one line recoloured). Sabotaged red, each restored: the tail put among the rules · the canvas splitting
the text again · two cards still showing · the inner card stripped with nothing set.

**fix(maker): a reply page drawn in the Maker's canvas never shows the cookie card**

A host who had never answered the cookie card saw it lying over the RSVP stage's canvas. The Event Hub's canvas
already hid the app's floating notices (`EDITOR_CANVAS_HIDES_APP_CHROME`, `site-body.tsx`); the two reply pages the
RSVP stage draws (`invite/reply`, `invite/enter`) now carry the same rule — on the host-verified canvas only, so a
guest's page is unchanged and still asks. A server-rendered rule: no JavaScript added to any first load.
Guard: `lib/the-maker-sample-shows-no-app-notices.test.ts` (4) — every guest route that answers the canvas door is
read off the tree and must carry the rule (or hand its canvas to `SiteBody`). Sabotaged red: the rule off the reply
page · the rule served to every guest.

SPEC IMPACT: `events.rsvp_ask_config` gains three optional words (eyebrow · question · hint) and one optional object
`look` = { lines: { '<part>.<line>': { c, s, i, v } }, card: { '<part>': { g, i, v } } } — each line's colour slot,
size and Build in; each reply screen's card ground and Build in. No schema change (jsonb, existing 2,048-byte CHECK).
Corpus `DECISION_LOG.md` row: NOT yet written — this builder works local-only with no push, and a corpus edit must
be committed and pushed; flagged to the controller to apply with the batch.

## 2026-10-10 · fix(maker): an RSVP line's Style is Font ▾, one colour circle and the Size slider

Owner, looking at a picked RSVP line's Style (2026-10-10, verbatim): *"Should be Font instead of Look and should be
drop down"* · *"i thought our plan for colour is just 1 colour with a color picker pop up?"* · *"use slider or button
for size?"* (the slider — what a cover line's Style already uses; Size is as built).

**What changed for the couple.** Pick a line on the RSVP stage (e.g. "Will you celebrate with us?") and open Style:

- **Font ▾** on its own row — the app's one font dropdown (`FontPick`, on `PickMenu`): the same faces a part of the
  Event Hub is offered (`HUB_FONTS`; a part's font is free since 2026-10-06). First choice **"Event Hub font"** = the
  line as designed, nothing stored.
- **Colour** is ONE circle (striped while it is the page's own) that opens the app's one colour picker
  (`ColourSheet`), with **Size** — the slider — beside it on the same row. This is a cover line's own last row
  (`stage-panel/stage-look-row.tsx`); it was six circles (the page's own + the event's five) and no picker.
- A **button** line (Yes answer · No answer · the pass's Save) has Font and Size and still no Colour, with its one
  line "A button's colours are your Look's."

**How it is stored** (`events.rsvp_ask_config.look.lines['<part>.<line>']`, read only by `lib/rsvp-look.ts`):

- `c` — what the one picker hands back, the same shape a cover line's colour is kept in: `#rrggbb`, kept only through
  the app's colour gate (`hubElementColor`) on the way in (`rsvpLookWith`), on read (`readRsvpLook`) and again when
  the rule is written (`rsvpLookRules`). A slot `1`–`5` stored the day before is still read and still drawn from the
  event's colours; it is never written again.
- `f` — a key of the app's font list (`sanitizeHubFontKey`), drawn as the Event Hub draws a part's font: that face's
  own variable and its fallback (`font-family:var(--font-…), Georgia, serif`). The variables are declared on the root
  layout, so a reply page already carries them; a face nobody chose is not downloaded.
- `s`, `i`, `v` — unchanged.

⚠ **For the controller — one sentence of the brief could not be held as written.** "The page draws it through the
Look's own font variables so it follows the Look when the Look changes": the shipped per-part font choice is a FACE
(a `HUB_FONTS` key), not one of the Look's four roles, so a line given a face keeps that face when the Look changes —
exactly as a part of the Event Hub does (owner 2026-09-26: the universal font is "bypassed" by an element's own).
"Event Hub font" (nothing stored) is the choice that follows the Look. No font list was invented.

**First load.** No first-load file is touched (`lib/rsvp-ask.ts`, `lib/hub-draft.ts`, `lib/maker-parts.ts` are
byte-identical). The rows, the picker, the font dropdown and the reader all load with the panel
(`every-studio-colour-opens-the-one-picker.test.ts` § H now names `rsvp-line-look.tsx`, `maker-rsvp-ask.tsx`,
`font-pick.tsx` and `lib/rsvp-look.ts` as not in the Maker's first load).

**Guards.** `lib/the-rsvp-lines-have-a-look.test.ts` — § 1–3 gained the picked colour and the font (the reader, the
rules, the writer); § 4 RE-AIMED with the reason written in (six circles and "no picker here" → one circle that opens
the one picker, Font ▾ on its own row, Colour · Size sharing the next); § 5 keeps its pinned save line word for word
and pins the Font save beside it. `lib/every-studio-colour-opens-the-one-picker.test.ts` — the sweep's entry for
`rsvp-line-look.tsx` re-aimed (count unmoved), § E gained the RSVP line's circle, § H the four files above.
Sabotaged red, each restored: the reader keeping a colour the gate refuses · the reader keeping a font not on the
list · a button given a picked colour · the rules writing a colour unchecked · the rules writing a font without the
list · the writer storing a typed colour · the circle not opening the picker · a button offered a colour · the font
with no way back to the line as designed · the five circles back · the look reader joining the first load.

SPEC IMPACT: `events.rsvp_ask_config.look.lines['<part>.<line>']` — `c` is now a checked colour (`#rrggbb`) from the
one picker (an older slot 1–5 is still read), and gains `f`, a key of the app's font list. No schema change (jsonb,
the existing 2,048-byte CHECK; the app still refuses a save past 1,900 bytes). Corpus `DECISION_LOG.md` row: NOT
written — this builder works local-only with no push; flagged to the controller to apply with the batch.
