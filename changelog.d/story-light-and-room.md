## 2026-09-09 · feat(story): the page moves from morning to night, and the room lights up

`08` steps 2.2 + 2.3 (S10) · `01_The_Story.md` §1 · §3.4 · §4 · §5 · `04` rules 2, 6, 7 ·
`05` §4 · owner lock 6.

**SPEC IMPACT:** `03_Data_Requirements.md` § 1 is wrong about how a photograph reaches a table,
and `07` Q1's own note is stale. Both corrected in the corpus — see "Corpus edits" below.

### The light

* **`lib/story-light.ts`** — the six stages (before · morning · afternoon · dusk · night ·
  after), derived from `sanitizeRolePalette(events.role_palette).reception`, contrast-corrected.
  Pure; no React, no DOM.
* **The ground crossfades, the ink is CHOSEN each frame** on the ground actually present. The
  forbidden implementation — lerping both — is asserted to be measurably illegible in the guard,
  so it cannot come back as a "simplification".
* Painted through the **shipped re-skin mechanism**: three `--color-*` overrides on the story's
  wrapper, exactly as `buildSitePaletteVars` re-skins the couple's website. No component changed
  colour classes. The tree was measured first — it uses only `ink`, `cream` and `terracotta-700`.
* The wrapper is **server-painted** with the opening stage, so with JavaScript off, in a
  screenshot and to a crawler the story is a legible printed page. Replaces a hard-coded
  `bg-[#e7e2d6]` that was every couple's story whatever they had saved.
* `prefers-reduced-motion` is honoured **in the script**: no crossfade, the light snaps.

**Two measured findings, both fixed rather than accommodated:**

1. 🔴 **`text-ink/55` could not reach the 4.6:1 muted floor on the neutral morning paper — by any
   ink.** Pure black at 55% over `#EFEBE4` composites to `#6C6A67` = **4.54:1**, and nothing is
   darker than black. The story's whole small print sat under the standard the design set. The
   markup moved to the floor (`/55` → `/60`, 20 occurrences), not the floor to the markup.
2. 🔴 **12:1 is unreachable mid-crossfade, by any ink.** The worst ground a light→dark fade passes
   through (`#747474`) allows **4.67:1** at the absolute most. So the contract is split and both
   halves are guarded: 12:1 / 4.6:1 / 4.5:1 **at rest** on each of the six stages (the design's own
   criterion), AA **in the fade**, plus a measured budget on how much of a fade renders muted text
   softly. `groundEase` (smootherstep, twice) took that window from **82% → 32%**; three passes
   would reach 17% but the ground visibly snaps.

### The room

* **`lib/story-room.ts`** — the lens's five states, every one derived: `no_venue` · `not_built` ·
  `designed` · `ceremony` · `reception`. Phases come from `event_schedule_blocks` through the
  shipped `venueStateAt`, **never a clock threshold**; `no_venue` from
  `event_type_profiles.enabled_surfaces` / `layer_mode` (measured: `date`, `hangout` and `travel`
  carry no seating surface, and `travel` is the roaming one).
* **🔒 Owner lock 6** — assigned seats exist only while the reception venue is in use. One
  function, `seatsAreShown`, and the guard fails if the lens tests the state inline instead.
* **🔒 Review blocker** — the public plan carries table numbers and photo heat, **never names**.
  The room's field list is a label, a position and a shape; the loader takes only ids off `guests`;
  `the-room-never-names-anyone.test.ts` reads the stripped source and fails on any name column.
* **`app/[slug]/_components/story/story-lens.tsx`** — the sticky plan, from 1100px. Hidden from
  assistive technology on purpose: every fact is already in each minute's own "In the room" line,
  in the reading order, and a sticky panel rewritten per scroll frame would be a live region
  re-announcing a diagram over the story.
* Table labels render at **~12.2 real px** (13 user units in a 340-unit box at 320px), not the
  prototype's 8.5px. The tables grew to hold the type; the type did not shrink to fit the tables.

### One scroll loop, not three

`lib/story-reader-position.ts` — the clock already owns the only scroll loop on this page and now
publishes where the reader is. The light and the lens subscribe. A second `requestAnimationFrame`
loop reading the same rects would give two answers to one question and a second layout per frame on
a 16,000px page — the failure `story-clock.tsx`'s own header names.

### The heat, and both its gates

* **🔒 The layer gate.** A count of photographs per table is the guests' layer exactly as a bar
  height is — the same fact asked per seat. It rides the same Q1 ruling through the same constant,
  via a new `drawnHeat()` in `the-guests-layer-is-theirs-until-you-publish.ts`. Gating the dial and
  forgetting the floor plan would have published the day's shape where it is easiest to read.
  It returns an **empty list**, never zeroes: nothing is a withholding, zero is a measurement.
* **🔒 The consent veto**, applied per capture through `publicKeyForCapture` — the same exact
  subtraction the dial does, including the arm where a vetoed capture with a baked blurred stand-in
  keeps its count because it IS on the page.
* The read is bounded to a net around each **written minute**, never the day.

### 🔴 `03` § 1 names the wrong path, and it is the empty one

It says a capture reaches a table via `papic_guest_captures.guest_id`. Measured against production
2026-09-09: **`papic_guest_captures` holds zero rows.** Every capture is a `papic_photos` row —
which is also the only table the dial's own counts come from, so building on the documented path
would have produced a lens that can never light AND a heat counted from a different population than
the bars above it.

Resolved instead from `papic_photos` by either link that genuinely exists on it:
`paparazzi_seat_id → paparazzi_seats.guest_id`, or `captured_by_person_id → guests.person_id`.

⚠ **And neither resolves to a table in production today**: 14 photographs, 14 with a person, **0**
whose person is a guest of that event, **0** seats carrying a guest — the one published story is a
`date` with no guest list. The mechanism is built and guarded; it has nothing real to light yet,
and the lens says "no photograph of this minute came from a seat" rather than drawing a cold room
as though it had measured one.

### Guards, and the sabotage counts

Every guard below was broken on purpose and confirmed red before it was trusted.

| Guard | Sabotage | Result |
|---|---|---|
| `story-light.test.ts` (8 tests) | ink lerped with the ground | 8→**3 fail** |
| | accent correction removed | 8→**1 fail** |
| | linear crossfade | 8→**1 fail** |
| | markup back to `text-ink/55` | 8→**1 fail** |
| `story-room.test.ts` (11 tests) | read a clock, not the run of show | 11→**3 fail** |
| | roaming forgotten | 11→**1 fail** |
| | a withheld minute leaks its figure | 11→**1 fail** |
| | seats lit during the ceremony | 11→**1 fail** |
| `the-room-never-names-anyone.test.ts` (6) | `display_name` added to the guests select (0→1) | 6→**2 fail** |
| | a name drawn on the plan (`t.name` 0→1) | 6→**1 fail** |
| | lock 6 tested inline (`seatsAreShown` 1→0) | 6→**1 fail** |
| | `aria-hidden` removed (1→0) | 6→**1 fail** |

### Corpus edits (applied directly, 2026-06-04 standing authorization)

* `03_Data_Requirements.md` § 1 — the guest→table row corrected to the path that has rows, with the
  measurement and the date.
* `07_Open_Questions.md` Q1 — the stale "STILL UNANSWERED" note under a ruling that was made; the
  same shape of staleness `03` § 2.5 already records for this exact question.
* `08_Build_Order.md` steps 2.2 + 2.3 — marked built, with the two contrast findings recorded.
