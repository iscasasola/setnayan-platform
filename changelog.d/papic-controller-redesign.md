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

## 2026-09-22 · feat(papic): the credit recommendation learns — and the naive loop is wrong twice

Owner: *"we will set the initial value. then create an average depending on the total
credits used on actual events."* Migration
`20271240727195_papic_pool_recommendation_learns_from_closed_events.sql` builds the
mechanism. **It starts dormant** and changes no number on merge — the migration refuses
to apply if any row already carries a learned figure.

- **Trap 1 — there is no data.** Nine weddings hold 100,362 credits granted and ONE used
  (measured 2026-09-22). A mean over that recommends ~0 a head, i.e. *"your wedding needs
  no credits"*. A type needs `learning_min_sample` uncensored observations before anything
  overrides the owner's figure; the initial stays as the fallback and is never overwritten.
- **Trap 2 — usage measures supply, not demand.** An event that spent its whole pool may
  have wanted twice as much, so averaging raw usage spirals downward. Exhausted
  celebrations are excluded from the mean and enter as a **lower bound only** — they can
  raise the figure, never lower it. Only closed capture windows count.
- **The admin can see which figure is in force** (`/admin/pricing` → Papic), with the
  sample behind it and what a recompute would do. Nothing recomputes on its own — this
  repo has no scheduler, deliberately, and a number that tells couples how much to spend
  should not move while nobody is looking. The 17 rows are editable there, all three
  numbers together.
- 🪤 **A fixture caught a real defect.** `papic_event_pool_status.guest_count` is a
  literal 0 on every non-flat-pass event — which is every live celebration — so the first
  cut of the sample query returned nothing and would have been permanently, silently
  dormant. The denominator is `papic_event_guest_headcount` now.

SPEC IMPACT: builds the 2026-09-22 ruling on learned recommendations, including both
traps as recorded.

## 2026-09-22 · feat(papic): every guest is promised a minimum, and the promise is payable

`papic_guest_spend_ceilings.ceiling_points` is a CEILING, and the shipped `splitTheRest`
docblock records what that means (measured 2026-09-16): nothing is held back for anybody,
every credit is first come first served, so **nothing in the product guaranteed any guest
anything**. A couple could cap a loud uncle at 40 and still have their mother arrive at
10pm to an empty pot. Migration
`20271241532112_papic_every_guest_is_promised_a_minimum.sql` adds the other half.

- **A floor is a promise, so it is checked.** `minimum × guests` against what the
  celebration holds, with the **shortfall named** — "add 4,000 credits" is actionable,
  "that will not work" is not. It cannot be a CHECK constraint: the pot and the head count
  both move without the column being touched, so it is re-derived every render
  (`guestMinimumVerdict`).
- **A floor can never exceed the ceiling** — a CHECK, not a rule in one action, because
  there are already three writers of these two columns.
- **A named guest is raised to the minimum too.** Ruling 7c protects a named allotment
  from the RELEASE; it is not a licence to promise everybody 25 and hand one named guest 5.
- **Inert on merge.** Every celebration has a NULL minimum, and the db test asserts the
  resolver — including the shipped floor-of-one — is unchanged without one.

SPEC IMPACT: the per-guest allotment model gains a floor; `splitTheRest`'s
"suggestion engine, not an allocation" note still stands for the ceiling half.
