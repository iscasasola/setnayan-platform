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

SPEC IMPACT: `events.rsvp_ask_config.words` gains three optional keys (eyebrow · question · hint). No schema change
(the column is jsonb); corpus note to follow with the per-line looks, once their stored shape is agreed.
