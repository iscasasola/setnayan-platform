## 2026-07-21 · fix(taxonomy): seed ceremony_venue + reception venue canonicals (dead-tile data fix)

`ceremony_venue` resolved to **zero** canonical services since inception, so the
marketplace short-circuited it to `EMPTY` before any query ran and
`getCoverageTaxonomy()` pruned the branch entirely — a whole trade advertised to
couples and denied to vendors. `reception` resolved to exactly **one** canonical
and it was `accommodation` (lodging), so function halls and ballrooms had to
mis-tag themselves as hotels to surface at all.

Owner-approved 2026-07-21 ("yes"), scoped by the owner correction: *"ceremony
venue are the religious locations for different religions."*

- **17 ceremony canonicals** under `ceremony_venue` — one place of worship per
  live `faith_vocab` key (Catholic · Christian · Born Again · INC · Aglipayan ·
  Orthodox · SDA · JW · LDS · Muslim · Jewish · Hindu · Sikh · Buddhist ·
  Cultural · Civil) plus the **faith-NULL `ceremony_venue_booking` anchor**.
  The anchor is load-bearing: `passesFaithFilter` is include-only and
  `events.ceremony_type` defaults to `catholic`, so without it a couple who
  never picked a rite — or any non-wedding event, which carries an empty faith
  set — would see an empty shelf again.
- **6 reception canonicals** — `reception_venue` · `function_hall` ·
  `events_place` · `hotel_ballroom` · `garden_reception_venue` ·
  `resort_reception_venue`. `accommodation` is untouched and keeps its
  `catering` cross-list (owner directive 2026-05-22); no new cross-listing was
  added.
- `PACKAGE_CANONICAL_TO_VENDOR_CATEGORY` extended so every new leaf routes to a
  real plan group instead of falling through to `misc`.
- `KNOWN_DEAD_TILES` shrinks by one — `ceremony_venue` deleted (the guard
  asserts in both directions, so this is mandatory). `editorial` **stays
  allowlisted on purpose**: the owner defined the category (magazines /
  content companies, explicitly not photographers) but its *grain* is an open
  sign-off.

Additive migration only — `scripts/gen-taxonomy-seed.ts` was NOT regenerated
because it re-emits all 84 nodes / 244 mappings with `ON CONFLICT … DO UPDATE
SET` on `label_en` / `label_short` / `slug` / `sort_order`, clobbering live
admin hand-edits in prod. `applicable_event_types` is deliberately left unset
(NULL = universal = fail-open): a tile-grain write is read live by `/explore`,
the Shortlist and category-search and would un-publish every vendor under the
tile with no vendor action.

Migration `20270830256997_taxonomy_ceremony_reception_venue_leaves.sql` must be
pushed **with** this deploy — the dashboard category search reads the code
constant while the marketplace and vendor coverage picker read the DB.

SPEC IMPACT: `Taxonomy_Expo_Gap_Verdict_2026-07-21.md` §2 (canonicals #1
`reception_venue` and #2 `ceremony_venue_booking` now seeded; §5 sign-off #5 —
"does ceremony_venue ship visible with zero vendors?" — still unanswered) and
`Editorial_and_Content_Creator_Coverage_2026-07-21.md` §6/§7 #1 (editorial
deliberately NOT seeded pending the grain call).
