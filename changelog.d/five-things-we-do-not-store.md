## 2026-09-09 · feat(story): the five things the story does not store yet

Phase 0 step 0.5 of the by-the-minute story build
(`Design_Editorial_By_The_Minute_2026-09-07`, `03` §2.2/§2.5–2.7, `08` step 0.5).
**Columns only — nothing reads them.** The point is that they exist *before* the
Story Maker and the cover screen are built, so those two do not collide over one
migration.

| Column | Why |
|---|---|
| `events.story_cover_kind` · `story_cover_ref` | There is no story-cover concept today: the `/realstories` card and the OG card both inherit the LIVING hero, so a couple cannot choose the one picture their story is known by. Closed vocabulary of the five candidates `02` §6 offers. |
| `events.previous_event_id` | No `parent_event_id` / `series_id` / chronicle column existed anywhere. "Previously · No. 1" and the back cover's door both need one. `ON DELETE SET NULL`, never CASCADE — an actor leaving keeps the record. |
| `panood_broadcasts.peak_concurrent_viewers` | Nothing stored the live figure. NULL means *never measured*, which is a different fact from 0. |
| `photo_messages.author_named_publicly` | ⚖ DPO ruling 2026-09-09 — see below. |

### ⚖ The DPO ruling, stated precisely

The DPO had ruled for `guest_columns` that a byline is opt-in, and `DECISION_LOG`
recorded plainly that whether it extended to photo messages *"was never put to
the DPO and is NOT decided"*. It was put to them on 2026-09-09 and **it
extends**: a photo message runs unnamed unless the guest asked. Modelled exactly
on `guest_columns.author_named_publicly` — `BOOLEAN NOT NULL DEFAULT FALSE`, so
the safe value is the default and every pre-existing row publishes unnamed
without a backfill.

🔑 **The owner IS the registered DPO** (NPC DPO system, 2026-07-07), so this is
the ruling itself, **not** outside counsel, and must never be written up as
"counsel cleared".

### 🪤 A guard that was decoration, found by sabotaging it

`lint-events-column-grants.mjs` matches `ALTER TABLE events` **immediately**
followed by `ADD COLUMN`, so in a comma-separated statement **it sees only the
first column**. Written as one statement, `story_cover_ref` was invisible to the
guard: its `GRANT` line was deleted and the lint still **exited 0**.

Fixed here by splitting into one `ALTER TABLE` per column — all three are now
checked, and deleting any one of the three grants, or removing the `events_host`
rebuild, now fails the lint (verified four ways, occurrence counts printed
before and after). **Do not tidy those three statements back into one.**

⚠ **THE HOLE IS MUCH WIDER THAN THIS CHANGE AND IS NOT FIXED HERE.** Measured
2026-09-09: **81 `events` columns across 37 multi-clause statements are invisible
to that guard** — 80 of them pre-existing. Checked against prod: **none of the 75
that still exist is accidentally unreadable**, so the trap has not yet cost
anything; every unreadable column is in a deliberate deny set. Widening the
regex would surface 80 columns needing adjudication, which is its own change.
Flagged, not silently fixed.

### Verified against prod, not against the documents

Dry-run inside `BEGIN … ROLLBACK` against prod (`njrupjnvkjkitfctetvi`) after
first proving with a throwaway table that `ROLLBACK` actually rolls back on that
connection: all three `events` columns readable by `authenticated`, `events_host`
rebuilt over all three, **no secret column newly projected**, counts 213→216 base
and 206→209 projected, and the 7 existing event rows survive the new CHECKs. Prod
re-queried afterwards and confirmed untouched at 213/206.

🔑 **The brief named the wrong FK target and it happens to work.** It asked for
`REFERENCES events(event_id)` — but `events`' PRIMARY KEY is `id bigint`, the
hidden bigserial the canonical-ID lock keeps for internal joins. The reference is
still legal because `event_id uuid` carries its own UNIQUE index, and it is the
right target: it is the uuid the app already passes around and the one
`events_host` itself filters on.

🔑 **`events_host`'s 15-name private list is correct and was checked, not
copied.** Prod has 22 `events` columns `authenticated` cannot SELECT — seven more
than that list. Projecting all 22 would newly expose `master_qr_token` and two
OAuth token columns through the view. A proof block in the migration now fails if
anyone "fixes" the list that way.

### ⚠ Merge-order note for whoever lands second

This bumps the exposure baseline header 6582 → 6587. A concurrent PR that also
adds a column bumps the same counter, git takes the one value both sides agree
on, and `main` goes RED with *"header declares N but the body holds N+1"* — the
2026-08-16 failure, which was neither truncation nor hand-editing. **S3 also adds
a column.** Whoever merges second should regenerate:
`pnpm --filter @setnayan/web exposure:baseline`.

### Not in this change, on purpose

The per-layer visibility flag (`03` §2.5) belongs to the guests-layer session,
which is building it in parallel and owns it in its own brief. Adding it here too
would mean two migrations on one concept.

SPEC IMPACT: None. `03_Data_Requirements.md` §2.5–2.7 and `08_Build_Order.md`
step 0.5 describe exactly this and need no edit. The one correction worth folding
into the corpus is the FK target wording (`events(event_id)` is a UNIQUE column,
not the primary key) — noted here rather than silently changing a design doc
mid-build.
