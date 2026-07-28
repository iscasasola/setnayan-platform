## 2026-07-27 · feat(marketplace): Explore Replan PR-C — adaptive category set + per-category ⓘ (flag-dark)

Slice C of the Explore/Marketplace replan wave
(`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-C · design §5.1/§5.2). Every
user-visible piece is behind `isExploreReplanEnabled()`
(`NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED`, default OFF); with the flag off the
bench renders byte-identically to production — no new query, no new markup, no
changed selector.

**Schema** — `supabase/migrations/20271016100000_event_category_decisions_tile_grain.sql`
adds a nullable `tile text` column to `event_category_decisions` plus a partial
`UNIQUE (event_id, tile) WHERE tile IS NOT NULL`, so a decision can be recorded
at TILE grain (the table is plan-group grain today, and the tile→group bridge is
many-to-one — `ceremony_venue` is the catalogTile of both the `ceremony_venue`
and `officiant` groups, so a group-grain row cannot speak for one tile alone).
`plan_group_id` becomes nullable and a `grain CHECK` keeps a row from being about
nothing. Existing rows and every shipped reader/writer are untouched.
Post-conditions `RAISE` on failure (the ledger can lie — verify the object).
**Not applied to prod by this PR.**

Per the default-ACL rule, the migration also `REVOKE ALL ... FROM anon` on the
table: the new column would otherwise inherit the table's open grants and ship
anon-readable. Net exposure-surface change (baseline regenerated in this PR):
six anon capabilities removed, one `authenticated`-only column added.

**Behaviour (flag on)**
- The bench shows the couple's **in-plan** categories; everything else moves to a
  per-folder "＋ Add to your plan" chip pool at the foot of the folder body.
- Every non-locked in-plan category gets a quiet **"Not needed? Remove"** control
  writing a tile-level exclusion. **HARD GUARD:** the server action refuses when
  the tile's categories hold a locked vendor ("unlock first") — and the resolver
  pins a locked tile in plan regardless, so a stale exclusion can never hide a
  booking.
- The **ⓘ** on each category row is wired to `categoryHintForTile()` (authored and
  tested by slice B). No new copy; no ⓘ string in JSX.
- Coverage counts adjust to the in-plan size ("Covered X of {in-plan}") via slice
  B's `coverageSummary`.

**New pure lib** `apps/web/lib/explore-in-plan.ts` (`resolveInPlanTiles`,
`canRemoveTileFromPlan`) with 20 unit tests. It deliberately returns TWO sets:
`inPlan` (bench rows) and `coverage` (strip membership). A wedding has no
onboarding plan to seed from — `plannedTiles` is `undefined` for
`event_type='wedding'` on the vendors page — so seeding "in plan" from an empty
plan would collapse a ~53-row bench to whatever is already shortlisted. Unseeded
events therefore keep their full taxonomy on the bench and get an engaged-tiles
strip; seeded events behave exactly as §5.2 specifies.

Also exported from `lib/shortlist-taxonomy.ts`: `categoriesForTile` (the FULL
inverse of `tileForCategory` — the removal guard must ask about every category
that rolls up to a tile, not the single storage representative) and
`LOCKED_VENDOR_STATUSES` (now the single source for the module's own
`LOCKED_STATUSES` set).

SPEC IMPACT: None — the spec (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-C)
already describes this slice. The one implementation ruling worth recording is
the seeded/unseeded split above (weddings keep the full bench); a DECISION_LOG
row lands with the wave summary.
