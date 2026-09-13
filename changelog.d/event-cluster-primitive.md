## 2026-09-02 · feat(events): a celebration can belong to a year — and the pot still cannot

Item 7 "the year", **phase 7a: the linking primitive and nothing else.** Owner-locked
2026-07-15 (`Composable_Event_Build_Map_2026-07-15.md`): *"a separate event is only for a
different OCCASION … shown as a linked cluster beside the wedding."* Measured against
`origin/main` @ `6267be4a8`: **nothing linked two celebrations** — no parent, no cluster,
no relation. Three later phases sit on this shape, which is why it is argued in the
migration header rather than assumed.

### 🛑 The one thing this ships to protect

**The shot pot stays per-celebration.** It is not a display detail — it is the primitive
people pay for. `papic_event_pool_usage` is keyed `event_id PRIMARY KEY`, grants are keyed
`event_id`, every door takes `p_event_id`. "The year has 30,000 shots" reads beautifully
and would **silently reprice every celebration already sold.**

🛡 `tests/db/a-pot-belongs-to-one-celebration.db.test.ts` — 8 checks, and the first one is
**behavioural**: two celebrations really in one cluster, 5,000 points really granted to
one, the sibling's total asserted **before → after**. The name-shaped checks (no Papic
column or function learns the word cluster; the usage PK is exactly `{event_id}`; no
cluster table holds a value-bearing column) catch the same mistake one commit earlier.

🔑 **The patient list is derived from the schema, never typed.** This repo's recorded guard
failure is `one-top-bar.test.ts` — right about the disease, wrong about the patient list.
So each sweep asks `information_schema` / `pg_proc` which objects are Papic's and then
**asserts the discovered list is non-empty**: a rename that empties the sweep fails loudly
instead of passing vacuously.

🪤 **The first cut of that behavioural test failed, and the schema was innocent.** It
asserted the un-topped-up sibling had *no pot at all* — but `papic_seed_free_grant`
(20270902100836) is an AFTER INSERT trigger giving **every** new celebration 50 free
points. Measuring before → after needs no belief about what a fresh pot holds and still
catches the only thing that matters.

### 🛡 Mutations — every check proved red, counts printed before → after

Both guards were sabotaged and restored. All ran; none was assumed.

| # | Sabotage | Result |
|---|---|---|
| A | pool **grants** summed across the cluster | 8→6 pass · tests 1 + 5 red |
| A2 | pool **usage** summed across the cluster | 8→6 pass · tests 2 + 5 red |
| B | `event_clusters` grows `pool_points` | 8→7 · test 6 red |
| C | `papic_event_point_grants` grows `event_cluster_id` | 8→7 · test 4 red |
| D | `UNIQUE (event_id)` dropped | 8→7 · test 7 red |
| E | anchor partial index dropped | 8→7 · test 8 red |
| F | usage PK becomes `(event_id, bucket)` | 8→6 · tests 2 + 3 red |
| G | link policy loses the **celebration** half | 8→7 · test 2 red |
| H | link policy loses the **cluster** half | 8→7 · test 3 red |
| I | read policy widened to `current_event_ids()` | 8→7 · test 4 red |
| J | table-level `GRANT UPDATE` restored | 8→6 · tests 6 + 7 red |

G and H matter most: **one query, many predicates.** The honest path satisfies both halves,
so deleting either leaves the happy case green — each refusal test is built to be the row
that one predicate **alone** would let through.

### 🪤 Both names you will reach for are already taken

- `related_event_id` — exists with an unrelated meaning on `token_ledger` (20260703000000)
  and `telemetry_events` (20260704010000).
- `cluster_id` — exists meaning an **anti-fraud identity cluster** (20270516600000). A grep
  for it returns ~20 hits and **not one is a celebration**.

⇒ The column is `event_cluster_id`. Greppable, returns only this concept, cannot be pasted
into a fraud query by accident. **Do not "tidy" it back to `cluster_id`.**

### Why two tables, not one column on `events`

1. **A cluster outlives its anchor** — delete the wedding and the engagement party and
   bridal shower are still a year.
2. **The link carries facts of its own** — which celebration is the anchor, who linked it,
   when. A column has nowhere to put them.
3. 🔑 **Friction in the right direction.** `events.cluster_id` is one word away from
   `SUM(points) … WHERE cluster_id = $1`. A membership table makes that rollup require a
   deliberate join — a thing a reviewer can see.

⚠ **`events.is_primary` is NOT this** and was checked before the column was added: it is
account-scoped ("your main celebration"), and the repo's write-detector finds **no writer**
for it on `events`. `is_anchor` is per-cluster. Do not conflate them.

### Deliberately absent

- **No `year` / `season` / `starts_on` / `ends_on`.** The span is derived from the members'
  own `event_date`s. Item 3's share was kept derived for the same reason and it is why the
  year is survivable at all — *do not optimise it into a stored value.*
- **No days, no sub-events, no lodging.** A multi-day celebration stays ONE celebration
  with days (`event_schedule_blocks`). A membership row per day means the lock has been
  broken, not extended.
- **No screen, no server action, no read path.** Both tables ship empty; every existing
  query returns exactly what it returned yesterday.

### 🔑 Two things for the owner, flagged not decided

1. **No occasion event types were added.** `public.event_type` holds wedding · birthday ·
   celebration · travel · corporate · burial · anniversary · debut · gender_reveal ·
   graduation · reunion — there is **no `engagement_party` or `bridal_shower`**, so those
   occasions are created as `celebration`/`travel` today. Adding them also touches
   `event_type_profiles` seeding. The primitive is type-agnostic either way.
2. **A tasting and a venue walkthrough are appointments with no guests** — under our own
   rule they are not celebrations, so they cannot be members. Two of the seven "chapters"
   in circulation are exactly these. Decide it deliberately; do not let a drawing decide.

### Ugat map — checked, not forgotten

`ugat-concept-coverage` and `ugat-schema-claims` both stay green, and that is the guard
working as designed, not a miss: two tables with one inbound FK, no spine→new edge, and a
name family of two is below `FAMILY_MIN`. **It arms itself for the later phases** — a third
`event_cluster*` table makes the family fire and demands a map entry then.

Also green alongside: full `tests/db/*.db.test.ts` suite · `check-migration-timestamps`
(1287 migrations, unique + allocator-sourced).

SPEC IMPACT: `DECISION_LOG.md` — new row recording phase 7a shipped, the shape and the two
rejected names. `WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 7 and
`WHATS_NEXT_Papic_Items_3_7_HANDOFF_2026-08-29.md` § 7 both say "nothing links two
celebrations in code" — no longer true; updated in place.
