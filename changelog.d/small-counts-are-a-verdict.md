## 2026-09-09 · fix(story): a table with one or two photographs shows a reader nothing

**SPEC IMPACT:** `03_Data_Requirements.md` — a new § 2.8 (the room is read live and a published story
can redraw itself), and a correction: § 1 cited `event_moodboard_saves.palette_snapshot` as the
snapshot precedent and **that table does not exist in production**. Both applied in the corpus.

Follow-up to PR #5349 (S10), which merged while this was being written.

### ⚖ The ruling, and the reason that is the load-bearing half

Owner, 2026-09-09, put to him by the Story Maker session (S6) and relayed here: should a table with
one or two photographs show its count at all? **No — withhold it.**

It was put to him as a PRIVACY question (a low count, plus what a guest already knows about the
seating, can point at one person). His answer was about something else entirely:

> *"this will subconsciously tell them they did not create enough memories for the story"*

🔑 **So this is not a privacy floor.** It is the rule that **the story never passes judgement on the
day it is telling**, and it generalises well past the floor plan: any small number anywhere in this
story reads to the host as a verdict on their wedding. A withheld small count is house style, not a
seating special case. His sentence is written into the code beside the constant, because the reason
is the half that gets lost.

⚠ **Surfaced back to the owner from this side rather than taken as settled** — it reaches this
session as a peer's report, not from him directly.

### What it does

* `SMALL_COUNTS_ARE_A_VERDICT = 3`, and `heatWorthShowing()` takes those tables out of the room
  entirely — **not rounded down, not drawn faintly with the number suppressed.** A table drawn dim
  still says "this table barely shot anything", which is the verdict.
* A new sentence for the case that now exists: photographs came from seats, but too few to say which
  table was loudest. The lens says *"The room, at this minute."* — never *"No photograph of this
  minute came from a seat"*, which would be both untrue and the exact judgement being avoided.

### 🔴 The guard gap this exposed, measured

Sabotaging the CALL to `heatWorthShowing` out of the lens left **all twenty** of `story-room.test.ts`
green. The floor was perfectly implemented and simply never applied — a pure function nobody calls is
the definition of decoration, and it is precisely the shape this build was warned to assume it had.

So the call site is now pinned too: the filtered list is what both the plan and the sentence read, and
the raw list may be touched exactly twice (to filter it, and to tell a quiet minute from an empty one).

| Sabotage | Result |
|---|---|
| the floor removed (`captures >= …` 1→0) | 20→**2 fail** |
| the floor lowered to 2 | 20→**2 fail** |
| a quiet minute reported as empty | 20→**1 fail** |
| the floor implemented but never called (1→0) — *previously slipped through* | 21→**1 fail** |
| the loudest table picked from the raw list | 21→**1 fail** |

### ⏳ Recorded, deliberately not built: freeze the room at publish

Raised by S6, **verified here against production rather than taken on report**: `event_tables` has no
soft-delete column (0 of `deleted_at`/`archived_at`/`soft_deleted_at`), nor does
`event_seat_assignments`, and the arranger wipes and re-solves assignments on every run. So a
published story's floor plan is a live view of a working document — the host tidies up, re-runs the
seating, or reuses the room, and **the story silently redraws or empties.**

The owner agreed the fix is to freeze the room at publish. It is **not** done here: freezing needs a
column and a write on the publish transition, which is the publish ladder (`08` step 1.6 / S8,
unbuilt) and which S6 is editing right now. Two sessions writing one publish action is how a page
ends up with two opinions about when a story was told.

🔑 **Zero exposure today, and cheap to close in S8's own PR:** the one published story owns no room,
and production holds 13 tables across 2 events, both drafts. Nothing can redraw yet. It becomes real
the first time a story with a room is published. Recorded at the live read and in `03` § 2.8.
