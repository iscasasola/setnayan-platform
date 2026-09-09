## 2026-09-09 · feat(story): the publish ladder — three states, one consent, a number that never moves

**08 step 1.6 · design `02` §8 · `03` §2.4 + §2.8 (S8).** The host publishes once,
knowing exactly who can then read it.

**The ladder.** The Story Maker's three bare audience buttons become three rungs
ported from `prototypes/story-maker.html`: **Draft** (you) · **Guests only**
(everyone holding the Papic QR — not searchable, not shareable outside the day) ·
**Published** (anyone with the link), each carrying its rung word, its blurb and
its own *"Who can see it: …"* line. The three states themselves already shipped
(`lib/who-can-see-your-story.ts`); this is the screen the design specifies for
them, not a new audience model.

⚠ **One deliberate departure from the prototype.** It selects a state and then
presses a separate *"Publish the story"* button. Here **the rung is the press** —
the shipped editor's own decision, whose reason is stronger than the prototype's
layout: *"Save draft / Publish"* made privacy a side effect of which button you
reached for. "Publish is disabled" therefore means the Published rung is
disabled.

**The gate.** Publishing is refused until the desk is decided, the desk actually
loaded, and the consent is ticked — asked by ONE pure function
(`lib/publish-once-knowing-who-reads-it.ts`) that both the button and
`saveEditorial` call, so the two cannot drift. A disabled button is not a fence.
🔑 **Only the way UP is gated.** Draft and guests-only pass untouched, because the
consent fine print promises the host they can go back to guests-only whenever —
a gate on the way down would break a promise printed on the same screen.
⚠ **An unreadable desk refuses,** with its own sentence: an unreadable source and
an empty one look identical, so a desk that could not be read has not proved it
is clear.

**The consent tick** is verbatim from `02` §8 and is a RECORD
(`event_editorial.publish_consent_at`), not client state — never cleared on the
way back down, because they did agree on that date.

**The last word** is written where the host is standing when they think about how
their story ends — the same `events.special_message` the thank-you-note editor
writes, through the host's own session so RLS stays a second fence, with one
shared cap so two doors cannot disagree.

🔴 **THE EDITION NUMBER WAS RECOMPUTED ON EVERY RENDER.** It counted the weddings
in the awards cycle up to this event's date, on each load — so the number printed
under the words *"theirs forever"* MOVED whenever somebody else's wedding landed
in the same cycle with an earlier date. It is now stamped once, on the **first**
transition to `published` (⚠ *not* on `published_at`, which stamps at the first
guests-only share), and **the database refuses to move it** — the host holds
table-level UPDATE on that row and could otherwise PATCH it straight through
PostgREST. A refused count stamps NOTHING rather than a permanent, uncorrectable
"No. 1". ⚠ It still counts **weddings**: owner question **Q5** is open, and the
reason is recorded in `WEDDING_ONLY_BY_DESIGN`, which moved with the filter.

🔒 **THE ROOM IS FROZEN AT PUBLISH** (`03` §2.8). `event_tables` and
`event_seat_assignments` carry no soft delete and the seat arranger re-solves on
every run, so a host who tidied up after the wedding **silently redrew or emptied
the floor plan of a story that was already published**. The plan is now
snapshotted at publish and preferred over the live read. The snapshot cannot carry
a person — its whole shape is a label, two percentages and a shape. ⛔ The per-table
photo HEAT is deliberately NOT frozen: it rides the consent veto, and a
withdrawal after publish must still come off the plan.

**Taking it back now takes it back.** An audience change revalidates the story,
the recap AND the print sheet; `/${slug}` alone left a narrowed story readable on
two cached routes for up to five minutes.

**Migration** `20271215704492_publish_once_and_the_number_is_theirs.sql` —
`edition_volume` · `edition_no` · `room_snapshot` · `publish_consent_at`, the
stamped-once trigger, and a backfill of the one already-published row with
exactly the number the page renders today (nothing anybody can see changes; it
simply stops moving).

⏭ **Not built here, named:** the full revalidation set on a GUEST's consent write,
the fourth state (*Taken back*) and the printed version stamp are `04` §3 / Q6 —
ruled, and assigned to **S14**. A guests-only story's room is still read live;
`03` §2.8 ties the freeze to publish and this build does exactly that.

SPEC IMPACT: `Design_Editorial_By_The_Minute_2026-09-07/` — `03_Data_Requirements.md`
§2.4 and §2.8 marked RESOLVED with what shipped; `08_Build_Order.md` step 1.6
marked built; `09_SESSIONS_AND_PROMPTS_2026-09-09.md` S8 row moved to the state
table; `02_The_Story_Maker.md` §8 records the one departure from the prototype.
