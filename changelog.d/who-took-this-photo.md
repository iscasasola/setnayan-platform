## 2026-08-26 · fix(papic): the column that records who took a photograph has never held a value

`papic_photos.captured_by_person_id` shipped 2026-05-23 to power the Life Story perspective-shift, and it is what *"each person's own folder"* would have to key on. Its own comment states the rule: resolve from the seat's claimer through `people.claimed_by_user_id`. It has a partial index. It has a reader — `lib/life-story-moment-graph.ts` groups a person's own-event frames by capturer.

🚨 **MEASURED IN PRODUCTION, NOT INFERRED FROM A GREP: 14 photos · 14 carry a seat · 14 have a claimer whose person row resolves right now · and 0 carry the value.** Not "no ongoing writer" — the column has **never held a value at all**. The one-time backfill matched nothing, because every photo in prod was taken after it ran, and nothing has written it since.

🔑 **The sixth gate with no handle**, and the read has been grouping an empty set for three months while looking exactly like a feature nobody uses.

## Why a trigger and not an app-side stamp

The value is **derived** — not a decision anybody makes, a join the seat already answers. Three things follow.

**Enumerate by the column, not by the remembered list of writers.** There are two capture paths today and this project has been bitten repeatedly by fixing the ones somebody remembered. A trigger covers every path that exists and every path added later, including one written by somebody who never reads this.

**It cannot drift from the backfill.** The join is the same join the 2026-05-23 migration used. Written in the app it would be a second copy of a rule, and two copies of a rule always drift.

**It costs nothing on the hot path.** Resolving this in JavaScript is an extra round trip per capture, at a stated peak of 1–250 captures/second. Here it is an index lookup inside a transaction that is already open.

## It derives; it does not defer to the caller

The trigger **overwrites** what was supplied rather than filling only NULLs. A supplied value is either identical (redundant) or different (wrong — the photo did not come from a different person's camera), and `authenticated` holds UPDATE on this column, so *"fill if null"* leaves it forgeable. It fires on UPDATE too, for the same reason.

⚠ **No `current_user` gate — the opposite choice from the verdict pin on the sibling table, deliberately.** That trigger protects a *decision*, so it must let the service role make it. This one reproduces a *join*, and the honest capture path writes **as the service role** — gating it would skip the only writer it exists for and ship the bug it fixes.

⚠ **What it legitimately leaves NULL**, so nobody reads NULL as a fault: a photo with no seat, an unclaimed seat, a claimer with no `people` row. The column's own comment already says *"nullable for unclaimed/ephemeral seats."*

⚠ **The other half is still unanswered, and that is named rather than hidden.** A guest phone's captures go to `papic_guest_captures`, a separate table nothing copies from — and it has **no capturer-person column at all**. So *"each person's own folder"* is solved here **for seat captures only**. That is a separate build and it needs a guest-to-person resolution that does not exist yet.

⚠ **And one accuracy limit:** the Uploads camera is claimed by one host, so a co-host adding photos through it is credited to the claimer. The column means *"whose camera shot this frame"*, which is what the seat answers. Per-uploader credit is a different fact and needs its own column, not a redefinition of this one.

## Re-backfill

⚠ **The 2026-05-23 backfill is not still doing its job** — a backfill is a point-in-time act. This one is scoped identically and idempotent (`IS NULL`), so re-running it where the trigger has been working changes nothing.

## 🛡 Guard + mutations

`tests/db/who-took-this-photo.db.test.ts` — 6 rules: a capture on a claimed seat is credited with nothing supplied · **a supplied value is overwritten**, with the impostor seeded as a real, different person so the FK is not what refuses it · an unclaimed seat stays NULL · **a PATCH cannot move the credit** · the migration **contains** an idempotent re-backfill · and that statement really does re-derive a stranded row.

| sabotage | count | result |
|---|---|---|
| no trigger at all | 1 → 0 | 🔴 (all 6) |
| fires on INSERT only | 1 → 0 | 🔴 (rule 4) |
| "fill only if null" | 0 → 1 | 🔴 (rules 2, 4) |
| the re-backfill removed | 1 → 0 | 🔴 (rule 5) |
| the re-backfill loses `IS NULL` | 1 → 0 | 🔴 (rule 5) |

🪤 **The re-backfill sabotage reported GREEN on its first run.** The rule proving the backfill works ran the statement **inline in the test**, so deleting it from the migration changed nothing the test could see. **A test that carries its own copy of the thing it checks cannot notice that thing going missing.** Split into "the migration contains it" and "the statement works", which is why rule 5 exists separately from rule 6.

🪤 **And the fixture failed twice before it was right, both times for reasons that read like a broken product**: `events.display_name` is NOT NULL, and creating an account already mints its own claimed person node (`people.claimed_by_user_id` is UNIQUE), so seeding one by hand fails with a duplicate key.

**SPEC IMPACT:** None.
