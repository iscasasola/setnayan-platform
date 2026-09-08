## 2026-09-09 · feat(story): the public page stops being a list of sections and becomes the event's clock

Ports `Design_Editorial_By_The_Minute_2026-09-07/prototypes/story.html` — `08` step 2.1,
session S9. The story now runs on one axis: **the road · one segment per calendar day ·
after**, with everything filed under the moment it happened.

- **The cover** replaces the centred masthead and the lead headline (it does not sit on top
  of them): the mark, the volume, the names very large, one sentence, and four facts.
  **The edition number appears only at publish** — before that the masthead reads `Vol. I`
  alone, because `editionNo` is recomputed on every render and a number shown under "theirs
  forever" that can still change is a false claim. A curated sample carries its
  *Sample story — not a real ⟨host⟩* pill **on the cover**, not buried in the colophon.
- **The dial.** Bar heights come from the `story_dial_bucket_counts` aggregate, routed
  through `drawnBins()`; the whole strip is one hit area and the nearest bin wins (a 1.3px
  bar is not a tap target); labels are HTML positioned in percent, never SVG text inside a
  stretched viewBox; the dial is focusable, ←/→ walk the bins and Enter opens one; the
  needle moves by transform. Every bar opens, written-up or not (owner lock 4).
- **The road, the days, and after.** Road entries are real dated facts only — the date being
  set, the saved theme, the first booking, the first pre-day captures, the broadcasts before
  the day — never a filler row. Each day carries its own clock and its own width,
  proportional to the hours that actually happened, and the gaps between minutes are drawn
  **as gaps** so the day keeps its real proportions.
- **A minute's layers**: Said · Asked · Made by · In the film · In the room. Said and Asked
  belong to a minute by the SHUTTER of the capture they anchor to, not by when the words
  were typed. **In the room** is derived from the schedule block in use, never from a clock
  threshold — assigned seats exist only while the reception venue is in use (owner lock 6).
- **Films: one card per broadcast session, not one film.** A minute's timecode is its clock
  time minus *that session's* `went_live_at`. The shipped page reads one embed URL, so a
  timecode measured against it put the money dance at hour seven of a three-hour video.
- **Motion**: entries RISE, never fade — the page is fully legible at rest, in a screenshot
  and with JS off (the offset is applied only once the script has run).
  `prefers-reduced-motion` is honoured by the script as well as the stylesheet.

### The defect S9 inherited, and fixed

`story_dial_bucket_counts` excludes hidden and unscreened captures — but **a consent-vetoed
capture still added to a bar's height.** A bar height is data about the guests' layer exactly
as a photograph is. The subtraction is exact, not blanket: a vetoed capture with a baked
blurred stand-in IS on the page and keeps its height; only the ones `publicKeyForCapture`
resolves to null come off. An unresolvable veto flattens the whole dial.

### Two smaller ones found on the way

- `events.event_end_date` was being READ by the story loader and thrown away, so nothing
  downstream could know how many days the celebration covers without asking the database a
  second question that could disagree. It is on the payload now.
- A backgrounded tab left the needle dead **and it stayed dead after the reader came back**:
  `requestAnimationFrame` does not fire while a tab is hidden, and the coalescing guard was
  only cleared inside the frame that never arrived, so every later scroll was refused.

### Not in this PR, named so nobody looks for it here

The six-stage light from the mood board and the floor-plan lens are S10; the eleven index
tabs, find-in-this-day and Relive are S11; the locked close, print and share are S12. The
shipped sections still render below the clock, in the couple's own order, until S11 folds
them into the index — nothing a host switched on has stopped appearing.

⚠ **A known delta from the prototype, and it is a font-asset decision, not a design one:**
the prototype sets every time stamp in Big Shoulders Display. No condensed face ships in
this repo (the v2.1 marketing quartet was retired 2026-07-12 and `globals.css` aliases
`--font-condensed` to Hanken Grotesk). The spine points at that existing slot rather than
hard-coding a family, so a condensed face can be added later in one line.

⏭ **Still not built, named:** the per-bin presign route (`08` step 0.2's last clause). The
minute sheet names the minute, its count, where the celebration was and the nearest written
moment — it does not show that minute's photographs, because no per-bin API route exists and
the page is ISR.

SPEC IMPACT: None. `08` step 2.1 and `03` §2.5 are already written this way; the only
correction worth carrying is that `03` §2.5's line about the consent veto having "landed in
PR #5331" is optimistic — `drawnBins()` applies the layer and the future check, not the
veto, which is why S9 had to.
