## 2026-08-07 · feat(venues): a venue states its own size, so the couple stops guessing

**SPEC IMPACT:** Applied — `DECISION_LOG.md` 2026-08-07 +
`VENUE_DIMENSIONS_BUILD_SPEC_2026-08-07.md`. Owner: *"allowing vendors to set the
sizes of their venues so customers can fillup the space."*

**What a couple does today.** They open their seating plan and pick a room from
six generic presets — Intimate 14×10 · Standard 20×30 · Grand 30×20 · Garden
60×40 · Estate 120×90 · Field 200×200 — defaulting to Standard. They have
already booked a real venue with real walls. Every table they place, every aisle
they leave, and the whole 3D walk-through their guests explore is built on that
guess.

`event_floor_plan.venue_width_m`/`venue_length_m` already existed and already
drove both the editor and `public_venue_scene`. The only missing piece was a
venue ever being asked.

**Ships all three halves together, deliberately:**

1. `vendor_profiles.venue_width_m` / `venue_length_m`, nullable (most vendors are
   not venues), with a **pairwise CHECK** — both or neither. A one-sided pair is
   a half-answer the couple-side read cannot use, and it would arrive silently.
2. The vendor states it on My Shop → Business Profile, through the **inline**
   per-field action. ⚠ Deliberately NOT `saveVendorProfile` — a full-form action
   called by no component that nulls every column absent from the submission.
   **`capacity_min`/`capacity_max` are picked up here too**: they already existed
   with no writer anywhere, and it is the same screen and the same audience.
3. `lib/venue-room-size.ts` reads it, **the seating page calls it**, and the
   editor seeds from it — showing *"Sized from {venue} — change it if your room
   is different"* while the size still matches what the venue stated.

🔴 **THE FIRST PUSH OF THIS PR SHIPPED THAT READER WITH NO CALLER.** The columns
and the vendor form went in, `venue-room-size.ts` went in, and **nothing called
it** — a venue could type its room size and nothing anywhere would change. That
is a reader with no caller: the same defect as a column with no writer, wearing
the other shoe, in the same PR whose body claimed "ships all three halves
together, on purpose". It did not. Caught by the owner asking *"all complete?"*
and by grepping for the caller instead of trusting the claim. Two assertions now
make the answer checkable rather than remembered, and unwiring the fetch turns
them red.

🔑 **A SUGGESTION, NEVER AN OVERWRITE.** The couple's own number always wins, and
"already set" includes a room sized once and furnished ever since — a vendor
editing their profile months later must never reshape a plan with tables in it.
A half-set room counts as theirs, so a suggestion cannot overwrite the side they
did set.

⚠ **The lookup fails toward silence and the file says why.** Everywhere else on
this codebase, collapsing "failed" and "absent" has been a defect; here the only
consequence is no suggestion and the couple picks a preset exactly as today. The
reasoning is pinned by a test, because the next reader would otherwise "fix" it
into a throw that stops a seating plan from opening.

Mutation-verified: making it always suggest, renaming the venue category, or
letting an enquiry count as a booking each turn it red.


---

## 🔴 THREE SHAPES OF ONE BUG, ALL SHIPPED IN THIS FEATURE BEFORE IT WAS DONE

This PR is the whole day's lesson happening to me, three times, in the one change
where I had written the rule down:

1. **A reader with no caller.** The columns, the vendor action and
   `venue-room-size.ts` went in — and nothing called it. The PR body said
   "ships all three halves together, on purpose". It did not.
2. **An action with no form.** `venue_size` was allowlisted and validated four
   numbers, and no screen posted any of them, so a venue still could not state
   its room.
3. Which is the same defect as the **column with no writer** this feature exists
   to fix — `capacity_min`/`capacity_max`, sitting unwritten for months.

All three now have assertions rather than intentions: unwire the fetch, rename
one input, or drop the columns from the profile select, and the suite goes red.

**Both were caught by the owner asking a one-word question**, not by CI, and not
by me re-reading my own claim.
