## 2026-07-30 · fix(events): the Save-the-Date backfill dated an event at YEAR precision — every countdown skipped it

**Live defect, both production events affected.** `events.event_date` and
`events.event_date_precision` describe one fact in two columns. Precision is
`NOT NULL DEFAULT 'year'` (migration 20260603100000), so an UPDATE that writes a
real calendar day and forgets precision leaves the row saying *"sometime in
2026"* — and countdown maths only runs at `'day'` (`lib/progress-stages.ts:53`),
so **everything that counts down silently skips that event.** No error, no empty
state.

**Root cause.** The Save-the-Date builder backfills the canonical `event_date`
from the film's date when the event has none (so the public page's lifecycle
phase can show the film). It was the **one** `events.event_date` writer of five
that didn't set precision alongside it — the other four
(`[eventId]/actions.ts`, `date-selection/actions.ts`, `wizard-actions.ts`,
`onboarding/simple/actions.ts`) all do.

Confirmed against prod, not inferred: **both** events show
`event_date = std_film_date` with `event_date_precision = 'year'` —
`044f7e64…` (2026-12-18) and `947e7bab…` (2026-12-12).

- **Fix:** the backfill now writes `event_date_precision: 'day'` in the same
  update. `std_film_date` is a specific day, so `'day'` is the honest value; and
  year → day is a **narrowing**, which the refine-only ratchet in
  `[eventId]/actions.ts` permits. The `.is('event_date', null)` guard is
  untouched, so a real date is still never clobbered. `date_status` is
  deliberately left alone — committing to a date belongs to
  `date-selection/actions.ts`, not to a film.
- **New guard, `lib/event-date-precision-scan.test.ts`** — a repo scan, not a
  unit test: *any `.update({…})` on `events` whose payload names `event_date`
  must also name `event_date_precision`.* INSERTs are excluded on purpose (a new
  event legitimately starts at the `'year'` default with a null date). Non-literal
  payloads can't be read statically and are **named in the failure message** so
  the scan's blind spot is visible instead of passing as a false green, and the
  scan asserts it still matches ≥3 real call sites so it can never pass vacuously.
  A second test pins the exact original write. **Mutation-checked:** reverting the
  one-line fix turns both red, and the failure prints the offending file + payload.

⏭ **OWNER ACTION — the two prod rows are NOT corrected here.** The code fix stops
the leak for every future event, but flipping the existing rows to `'day'` turns
on countdown behaviour that has been dark since 2026-06-18, on events whose
`date_status` is still `'undecided'` — a product-state call, not a code one. The
one-line SQL + the exact before-values are in the PR body.

SPEC IMPACT: None on decisions. `WHATS_NEXT_Explore_Marketplace_2026-07-29.md`
§5.1 is closed on the code side (its "find the write path" is answered: the STD
backfill) with the row correction left owner-gated; logged in `DECISION_LOG.md`.
