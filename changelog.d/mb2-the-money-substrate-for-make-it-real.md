## 2026-09-03 · feat(moodboard): the money substrate for "Make it real" — ledger, `event_renders`, one SKU, a derived part registry

MB2. The schema behind Mood Board section 04, landed before any pixel of it
exists, because MB7, MB8, MB9 and MB12 all sit on it. Nothing here has a
writer yet: both migrations are inert on apply.

**The one SKU.** `MOODBOARD_RENDER_PACK` — 50 renders for ₱1,000 — into
`platform_retail_catalog_v2`
(`20271199871696_moodboard_render_credits_ledger_and_the_one_pack_sku.sql`).
2026-09-03 produced five render price rows and four are corpses; the migration
header names them (₱300/single · ₱500/5 · ₱200/5 · ₱15-per-photo with ₱60/4 ·
₱750/50) so nobody resurrects one. ⚠ ₱1,000/50 works out to ₱20 a render, which
was retired as an arithmetic fault earlier the same day and then **deliberately
reinstated by the owner**, who was shown the ₱15 → ₱20 arithmetic first —
"fixing" it back to ₱15 would undo a ruling. The peso figure exists in that
catalog row and nowhere else in the repo.

**Credits, which are not pesos.** `moodboard_render_config` (Pattern H, one
admin-editable row) holds `credits_per_part` 1 · `credits_whole_look` 5 ·
`credits_per_pack` 50 · `max_note_chars` 500, and a `pack_service_code` FK to
the catalog rather than a copy of the price. Same reasoning as
`papic_event_pool_config`: a number that governs what a couple may spend must
not be a constant in a bundle.

**The ledger, split on purpose.** `event_render_credit_grants` is append-only
and always positive (one row per pack, partial UNIQUE on `order_id` so
re-running fulfilment cannot double-grant); `event_render_credit_usage` is ONE
row per event holding the spend counter. A spend is not a negative grant row,
because a SUM over an append-only ledger has nothing to lock — two concurrent
renders would both read "one credit left" and both take it.
`moodboard_reserve_render_credits` / `moodboard_release_render_credits` are
reserve-then-release, not debit-on-success: a render that fails must not
silently eat a credit. `moodboard_render_balance` returns **zero rows** — not a
zero balance — to a caller who may not ask, so a refused read can never render
as "you hold nothing". Neither table has a write policy; a couple that could
INSERT a grant could grant itself the pack.

**`event_renders`** (`20271200273322_moodboard_event_renders.sql`) — image key,
design snapshot, prompt, inspirations used, credits debited, timestamp,
per-part identity (`room:` / `people:` / `place:` / `whole_look`), the per-box
free-text note, a versioned `config_digest` (`v<n>:<digest>`, MB9's coarse cache
key — bump the prefix to invalidate, no migration), and `reusable`. RLS Pattern
B, enabled at `CREATE TABLE`.

🔑 **`reusable` is a GENERATED STORED column, not a flag anybody sets:**
`note IS NULL AND image_key IS NOT NULL AND failed_at IS NULL AND NOT
reuse_blocked`. It is the admission test for a pool shared **across couples**,
and the owner's rule is that a note-bearing render is stored but never offered
to anyone else. A settable flag would eventually drift from the note and the
symptom would be invisible on both sides — somebody's "my lola's veil on the
chair" served to a stranger as a library match. The cache index is PARTIAL on
it, so an ineligible render is not merely filtered out of a lookup, it is not in
the index the lookup reads. There is **no trigger on this table**: a DEFAULT
TRUE flag plus a BEFORE INSERT assertion is the construction that refused every
insert for five weeks in the supplier-add outage.

**The part registry** (`lib/moodboard-render-parts.ts` + its test) is derived,
never hand-listed: ROOM from `RECEPTION_PARTS` minus `people`, PEOPLE from the
`PaletteKey` attire roles (minus the four wedding-party fine keys, which fall
back to `wedding_party`), PLACES from the leftover inspiration slot keys. A new
inspiration slot is a **compile error** until it is classified, because
`SLOT_ROLE` is `Record<MoodboardSlotKey, …>`. The 18-slot vocabulary moved from
`app/dashboard/[eventId]/wizard-actions.ts` to `lib/moodboard-slots.ts` with no
change of contents, so the registry reads the one list rather than restating it.

`moodboard-render-parts.test.ts` refuses a hand-written part rather than
describing today's list — sabotage-tested twice (an invented `room:dance_floor`,
and a `people:ceremony` borrowing a real but venue-family `PaletteKey`); each
was caught by three independent assertions.

Ugat: `TYPE-RENDERS` node on `event_renders`, plus joints **J42** (render ↔
event) and **J43** (credits ↔ order) with 30 schema claims between them. Both
`ugat-schema-claims` and `ugat-concept-coverage` pass with no baseline line
added.

⚠ Two things worth an owner's eye, surfaced not silently resolved. First, the
derivation yields **24 parts, not the ~20 the decision row enumerated**: ROOM is
9 as specified, PLACES is 5 because `cake` shipped in the same-day slot widening
the row predates, and PEOPLE is 10 rather than 7 because `muslim_principals`,
`secondary_sponsors` and `officiants` are real shipped attire roles the row's
list omits. Section 04 shows only parts a couple has actually designed, so the
extra three surface only for couples who set those colours — but the count is a
real divergence from the written row and the fix, if it is one, is to drop
roles, not to hand-list. Second, `saas_overhead_cost_php` on the SKU is ₱110 —
the ~₱2.2/image model spend × 50 that the owner was quoted in the same decision
row. It is a cost field, never shown to a customer.

SPEC IMPACT: None — the price, the credit split and the reuse rule are applied
exactly as the 2026-09-03 `DECISION_LOG.md` rows "ONE RENDER PACK ONLY" and
"20 RENDERABLE PARTS" state them. The part-count divergence above is a
measurement of shipped data against that row's illustrative enumeration, not a
change to the decision; it needs an owner's read before the corpus is amended.
