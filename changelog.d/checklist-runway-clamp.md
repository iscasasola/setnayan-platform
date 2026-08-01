## 2026-08-01 · fix(checklist): a task may never be due before the plan existed — compress the template into the runway that actually exists

The owner created a real `date` event, "Movie Night", whose only date candidate
was **that same day**. He opened the checklist and got **0 of 4 done and all
four already red** on a plan twenty minutes old:

| Task | Due (before) |
|---|---|
| Pick the place | Jul 25, 2026 |
| Reserve it (or check if you need to) | Jul 27, 2026 |
| Confirm the time | Jul 29, 2026 |
| Anything to bring or order ahead? | Jul 31, 2026 |

The arithmetic was correct — `DATE_TEMPLATE` runs 7/5/3/1 days *before* the
event, and the event was today — so every due date landed in the past. The
experience was wrong, and it is the **common** case for these types, not an
edge case: `date` and `hangout` are exactly what people plan tonight for
tonight. A brand-new checklist that opens 100 % overdue is worse than no
checklist; it teaches the user that red means nothing.

**Found by the owner, on his own screen, after CI, ~6000 unit tests and ~700 db
tests had all passed on the broken behaviour.** This is the second
human-caught defect of the session. Nothing in the suite asserted that a
freshly-created plan is not already late, because every test supplied an event
date far enough out that the question never arose.

### The rule

`dueOffsetDays` encodes **intent** — "a week ahead, if you have a week." The
renderer now adapts that intent to the runway that exists (the days between the
day the event was created and the event day) instead of subtracting literally.
Templates keep their authored content and offsets untouched.

- **Proportional, not clipped.** Collapsing every over-long offset onto the
  creation day would stack the whole plan on one date, which is not a plan
  either. Scaling preserves the ladder's order and spacing.
- **Opt-in by arithmetic.** Compression engages only when the runway is
  *shorter* than the template span. `checklistRunwayFor` returns `null`
  otherwise, and `null` means every authored offset stands byte-for-byte.
- **Pre-event only.** Offsets ≤ 0 (the day itself; the post-event tasks — claim
  the PSA certificate, thank-you notes) are anchored to the event, not the
  runway, and pass through untouched.
- **The invariant falls out for free.** With an effective offset never
  exceeding the runway, `event_date − offset` can never land before the
  creation day. No separate clamp is applied, and none is needed.

Anchored on `events.created_at`, **not** on `now` — a due date that slid
forward every day would make "overdue" unreachable and delete the feature. The
plan is fixed the moment the event is created.

Movie Night's exact inputs (event `2026-08-01`, created `2026-08-01`, viewed
`2026-08-01`): runway 0 days, span 7 → all four tasks due **2026-08-01**,
nothing overdue, grouped under **"The day itself"** instead of "This week".
An event 3 days out gets 3/2/1/0 — four distinct days, still a plan.

### Same class as PR #3957, one level deeper

#3957 fixed the same shape of bug (a 90-day template on a same-week event) by
**shrinking the template**. The rule underneath was untouched, so the defect
survived at a smaller scale and resurfaced the moment the runway went below
seven days. This fixes the rule. It also means the wedding template no longer
opens with its first 13 tasks red for any couple who starts planning less than
18 months out — the same defect, which had been sitting in plain sight at
wedding scale.

### Derivation-only — already-seeded events heal on next view

No write-side change and no backfill: Movie Night's four persisted rows are
untouched and render correctly on the next page load.

### Changed

- `apps/web/lib/checklist.ts` — new `ChecklistRunway`, `checklistRunwayFor()`,
  `effectiveOffsetDays()`; `dueDateForItem()` / `toChecklistView()` take an
  optional runway (defaulting to "none", so every pre-existing call site keeps
  its exact previous result); `ChecklistItemView` gains `effectiveOffsetDays`;
  `groupChecklistByPhase()` takes `eventCreatedAt` and buckets/sorts on the
  effective offset; `RankOptions` gains `eventCreatedAt`.
- `apps/web/app/dashboard/[eventId]/checklist/page.tsx` — selects
  `events.created_at` and passes it through.
- `apps/web/app/dashboard/(launcher)/page.tsx` — the card's overdue count uses
  the same rule, so the two surfaces cannot disagree.
- `apps/web/lib/events.ts` — `EventRow.created_at` (optional) + selected in
  `fetchUserEvents`. Verified `SELECT`-granted to `authenticated`/`anon` in
  prod and `NOT NULL` since the base migration.
- `apps/web/lib/checklist-runway.test.ts` — new. Pins Movie Night's exact
  shape; the 3-days-out compression; the never-due-before-creation invariant
  swept across runways 0–20 for both short templates; same-day (no
  divide-by-zero, no empty list); back-filled past events; **a 540-day wedding
  proven byte-identical** by diffing full grouped output with and without the
  anchor; and no-date events unchanged. Mutation-checked: disabling the rule
  fails 7 of the 12.

### Known limits (deliberate, documented)

- Linear scaling squashes the tail on extreme compression — a wedding created
  30 days out lands many final-week tasks on the same day. Strictly better than
  ~60 tasks born overdue, and order is preserved; a piecewise curve is a
  follow-up, not a blocker.
- A pre-existing divergence, **not** touched here: the checklist page anchors
  non-wedding events on `date_candidates[0]` when `event_date` is null, while
  the launcher card anchors on `event_date` only. The launcher therefore
  *under*-reports (the safe direction) for events with no locked date — which
  is why Movie Night's card read 0 overdue while its page read 4.

Verification (from `apps/web`): `next lint --dir app --dir lib` → exit 0, 0
errors · `tsx --test "lib/**/*.test.ts" "app/**/*.test.ts"` → **6074/6074 pass**,
exit 0 · `tsc --noEmit` → exit 0, no output (run last, unpiped).

SPEC IMPACT: None. No SKU, price, schema, RLS policy or locked decision is
affected — this changes how an authored offset is rendered into a due date, not
what any template says or what any table stores. The `date`/`hangout`
short-runway templates from PR #3957 keep their exact authored content.
