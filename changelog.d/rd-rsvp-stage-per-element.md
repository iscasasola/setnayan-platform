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

SPEC IMPACT: None
