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

SPEC IMPACT: `events.rsvp_ask_config` gains three optional words (eyebrow · question · hint) and one optional object
`look` (each line's colour slot and size). No schema change (jsonb, existing 2,048-byte CHECK). Corpus note to follow
with the card's background and motion (the next step), in one edit.
