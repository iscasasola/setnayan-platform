## 2026-09-11 · feat(bench): a supplier with no booking left on the couple's date leaves the bench search

Owner, 2026-09-11: *"if there are no more available booking for that day for
that service card, it should not show"*. With only a month chosen: *"Hide only
if full all month"*. Register session H6.

- **`public.service_cards_unbookable_on(uuid[], date[], boolean)`** (migration
  `20271221805341`): a read-only SECURITY DEFINER function that returns only the
  (card, date) pairs the booking path would refuse. It covers
  `acquire_schedule_pools` (closure, locked day, pool at capacity, external
  clients counted, active pools only) and `acquire_service_time_slot`
  (shop-wide lock, or every active slot taken). Pool resolution mirrors
  `resolvePoolIdsForService` read-only, so it never creates the pool a first
  booking would. It is **server-only**: EXECUTE is held by `service_role`
  alone, revoked from PUBLIC, anon and authenticated. The bench search calls it
  with the admin client and sends the browser only which suppliers stay listed,
  never a (card, date) pair. Granted to signed-in users, any account could have
  read a month of any supplier's full days (orchestrator review). It is also
  capped at 100 cards and 31 dates, and returns no labels and no counts.
- **The three deliberate differences are documented in the migration header.**
  1. `'whitelist'` days are shown (orchestrator ruling).
  2. `vendor_services.daily_capacity` is not read. Its only gate counts through
     the couple's session and so never refuses; a tripwire watches it.
  3. Pool resolution is read-only.
- **`searchCategoryVendors({ hideUnbookable })`**: only the bench callers pass
  it (`inline-more-row.ts` and both calls in `category-search-overlay.tsx`). The
  unlock, the 3-state fallback and the free-venue shortlist are unchanged.
- **Scope:**
  - a day-precise date → that day;
  - a month-only date → every day of the month; a supplier leaves only if
    every day is refused;
  - a year or no date → nobody hidden.
- **Hide rule:** a supplier is hidden only when every in-scope card is refused
  on every day. A supplier the couple already knows is never hidden. The search
  fails open on any error.
- `lib/schedule-pools.ts` `namedCalendarsEnabled()`: the lock and the search now
  read the Named Calendars switch in one place.

Guards:
- `tests/db/a-full-card-leaves-bench-search.db.test.ts` runs a differential
  against the **real** booking functions over 7 cards × 9 days × both flag
  values, inside rolled-back transactions. It was mutation-checked 6 ways
  against sabotaged SQL. It also covers the named cases, the month, the input
  caps, "writes nothing", and a check that anon and signed-in callers are
  refused while service_role is answered. The RLS half of the tripwire lives
  here too.
- `lib/h6-mirrors-the-booking-path.test.ts`:
  - every acquire status is classified;
  - 14 predicates are checked CTE by CTE against the bodies in force, each
    proven load-bearing on both sides;
  - the resolver reads the same sources;
  - the tripwire checks that the #2 gate reads through the couple session;
  - only the bench callers hide;
  - only server code calls the function, with the admin client, and it is
    granted to service_role alone (both mutation-checked).
- `lib/bench-bookable-days.test.ts` covers the pure rules.

SPEC IMPACT: None in this PR. The H6 rulings are recorded in the corpus
`DECISION_LOG.md` (2026-09-11, rows 3873–3876 and the orchestrator's H6
approval), and the orchestrator owns the H-stream status in
`WHATS_NEXT_Build_SEQUENCE_2026-09-10.md`.
