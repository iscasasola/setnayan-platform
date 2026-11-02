## 2026-07-26 · fix(date-selection): the vendor-availability pool was ALWAYS empty

`app/dashboard/[eventId]/date-selection/page.tsx` fetched its marketplace vendor pool with a
query naming **two columns that do not exist** on `public.vendor_profiles`:

- **`id`** — the primary key is `vendor_profile_id`
- **`is_setnayan_service`** — a COMPUTED column of the `public.vendor_market_stats` VIEW
  (array-membership over `vendor_profiles.services`, migration `20260607020000`)

PostgREST fails the WHOLE query on an unknown column, so `vpRes.data` was null, `vpRows` was
permanently `[]`, and the marketplace-coverage figure the date picker shows was blank for every
candidate date. **"Pick a date that works for your vendors" has been silently doing nothing in
production.** The branch is reachable (`!path && hasCandidates && !hasDate`) — unlike the identical
wrong-table read on the vendor workspace page, which was unreachable and was removed in #3769.

Measured against prod, not assumed:

```
old shape → ERROR 42703: column "id" does not exist
new shape → runs clean (0 rows today: the only vendor is coming_soon, not verified — a
            GENUINE empty, which is now distinguishable from a failure)
```

### A third defect in the same query

`marketplaceCoverage` does `blockedOnDate.has(vp.id)`, and `blockedOnDate` is built from
`blockRows.vendor_profile_id`. So `id` was always *meant* to be `vendor_profile_id` — the two are
compared directly. Fixing only the `is_setnayan_service` predicate would have left the comparison
wrong even if `id` had existed. `VpRow` is renamed accordingly.

### Why the predicate is DROPPED, not re-pointed at the view

Setnayan's own services are no longer marketplace vendors at all (owner 2026-07-26 — they live on
their studio page or in the suite); Explore removed its first-party float the same day; and #3769
deleted the concept from the vendor workspace. Prod has **0** profiles where it is true, so it
filtered nothing even when it was intended to. Re-pointing would reintroduce a concept that was
deliberately removed hours earlier.

### The `?? []` that hid it

A bare `?? []` turned a failed read into "no rows", so the page rendered a confident
*"0 of 0 categories available"* instead of admitting it could not tell — the same fail-open shape
SEC-2b's T9 auditor rejects on the export route. The read error is now reported to Sentry. The
coverage figure still degrades to blank rather than throwing (a date picker that renders beats one
that 500s), but the failure is observable instead of silent.

SPEC IMPACT: None.

---

## 2026-07-27 · fix(vendors): the guard that keeps the date-selection vendor pool honest

The 2026-07-26 entry above fixed the query. It shipped **without a regression test**, so nothing
stopped the same class recurring — and the class is the point: this repo has no generated Supabase
types, so a column name inside a `.select()` / `.eq()` / `.or()` string is unchecked free text.

**`lib/date-selection-vendor-pool.ts`** now owns the column surface of both marketplace-coverage
reads (`vendor_profiles` pool + `vendor_calendar_blocks`), and `page.tsx` builds its queries from
it. **`lib/date-selection-vendor-pool.columns.test.ts`** checks every one of those names against
`supabase/migrations`, parsed via the existing `lib/security/migration-schema` rather than a fourth
copy of that parser. Shaped after `vendor-packages.columns.test.ts`: the names are read out of the
migrations, never hard-coded a second time, because a second list drifts the way the first one did.

### Why a bespoke guard when `select-column-scan` already exists

That scanner sweeps every `.from().select()` in `apps/web`, and it *would* have caught `id`. Its own
HONEST LIMITS block, limit 5, says it checks **selects only** — `.eq()`, `.or()`, `.not()`, `.in()`
and `.order()` are invisible to it. So it could never have caught `is_setnayan_service`, which lived
in an `.or()` predicate. Half a 42703 caught still leaves a dead feature. T2/T4 cover the filter half.

Proven non-vacuous by neutralisation, not assumed:

```
VENDOR_POOL_SELECT  'vendor_profile_id, services' → 'id, services'   ⇒ T1 + T5 RED (4 pass / 2 fail)
VENDOR_POOL_FILTER_COLUMNS  + 'is_setnayan_service'                  ⇒ T2      RED (5 pass / 1 fail)
reverted                                                             ⇒ 6 pass / 0 fail
```

### Two more silent failures in the same block

- **`vendor_calendar_blocks` had the identical fail-open `?? []`.** A silent failure there is worse
  than the pool's: an empty block list does not blank the coverage number, it **inflates** it —
  every vendor reads as free on every candidate date, so the page recommends a date nobody is
  available for. It now reports to Sentry alongside the pool read.
- **The UI asserted coverage it had not read.** With `totalCategories === 0` the card rendered a
  reassuring *"Marketplace available"* — the same confident string on a genuine empty and on a
  42703. `CandidateInsight.marketplace.readFailed` now distinguishes them: a failed read shows
  *"Coverage unavailable"* / *"We couldn't check vendor coverage just now"*. Ranking is untouched
  (`award` already required a uniquely-positive winner, so a uniform 0 mints no badge).

SPEC IMPACT: None.
