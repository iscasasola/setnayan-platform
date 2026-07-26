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
