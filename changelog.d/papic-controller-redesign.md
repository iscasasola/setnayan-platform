## 2026-09-22 · feat(papic): the credit recommendation knows the kind of celebration

`papic_event_pool_config` stops being a singleton. Migration
`20271239794268_papic_pool_sizing_knows_the_event_type.sql` seeds one SIZING row per
`event_type_vocab` type (17), so a christening is no longer quoted a wedding's 150
credits a head. Owner-confirmed per-head figures, 2026-09-22 — engineering invented
none of them (CLAUDE.md rule 9).

- **The clamp travels with the per-head figure.** `points_per_guest` alone would have
  shipped broken: with the global floor of 5,000 a 2-guest `date` at 50/head computes
  100 and is clamped **up to 5,000** (~₱3,360 of credits recommended for a dinner for
  two). A sizing row carries `floor_points` and `ceiling_points` too.
- **Nothing moves on merge.** `wedding` is seeded byte-identical to the live global row,
  and 9 of the 11 live events are weddings. The migration REFUSES TO APPLY if that is
  not true, and `papic-pool-sizing.test.ts` + the db test pin it.
- **One resolver, two languages.** `public.papic_event_pool_sizing(text)` and
  `pickPoolSizing()` in `lib/papic-pool-sizing.ts` resolve identically, and
  `papic_event_pool_status` now sizes the DB fence through the SQL one — so the figure
  the app shows and the figure the fence enforces cannot drift.
- **New blocking guard** `scripts/lint-pool-config-global-columns.mjs`: `soft_stop_pct`,
  `free_grant_points` and the four other global columns may only be read off
  `config_key = 'default'`. Every existing reader already pinned it, which is the only
  reason 17 new rows changed no behaviour; the next one is the one that would silently
  answer off a sizing row with a plausible number.

⚠ **OPEN FOR THE OWNER — the per-type FLOOR and CEILING are not accepted yet.** He
confirmed `points_per_guest` only. Seeded: wedding keeps floor 5,000 / ceiling 30,000;
every other type gets floor 0 and the same ceiling. One admin edit each if he wants
different.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-22 rows (the per-type table and the two traps)
are now BUILT rather than recorded; the floor/ceiling recommendation is carried into the
corpus with this build.
