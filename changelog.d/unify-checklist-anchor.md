## 2026-08-01 · fix(checklist): one deadline anchor for both checklist surfaces — the launcher card no longer under-reports overdue tasks

The couple checklist is rendered on two screens a click apart, and they dated
the same event differently.

| Surface | How it resolved the deadline anchor |
|---|---|
| `/dashboard/[eventId]/checklist` | locked `event_date` → earliest `date_candidates` → `date_window_start`, with weddings pinned to `event_date` alone |
| the launcher's per-event card | `event_date` — and nothing else |

The non-wedding event types (`date`, `hangout`, `birthday`, …) ship
**date-as-output**: `event_date` stays NULL until it locks, while creation seeds
`date_candidates` / `date_window_start` with the best-known day. So the page
computed real due dates for exactly the events the card could not date at all —
`dueDateForItem(null, …)` returns null, every task counted as not-overdue, and
the card said **0**.

**Reproduced in prod** on event `9b41095a-3f51-4baa-8b91-ffc718f5dfa9` ("Movie
Night", `event_type='date'`, `event_date` NULL, `date_candidates
['2026-08-01']`): the page listed due dates for all 4 tasks, the card reported 0
overdue.

The launcher under-reported, which is the safe direction — and that is precisely
why it survived. A surface that says "nothing needs you" is never opened in
anger. But two surfaces must not answer the same question differently, and the
one the user checks first was the one that was wrong.

### The change

The page's shipped predicate is lifted verbatim into
`checklistAnchorDateFor()` in `apps/web/lib/checklist.ts`, and **both** surfaces
now call it. The ladder is unchanged — only its address is. No rule was
"improved" while being moved; a behaviour change smuggled into a
de-duplication is the hardest kind to review.

It lives in `lib/checklist.ts`, not `lib/events.ts`, on purpose. This is the
CHECKLIST's anchor, deliberately narrower than "the event's date": day-of/recap
mode, the countdown, the launcher's own `isPast()`, and SetDateNudge all keep
reading `events.event_date` directly, because a candidate date is a guess and a
guess must not flip an event into "day-of" or file it under "Completed". An
`eventAnchorDate()` sitting next to `EventRow` would advertise itself as the
event's date to every surface that imports events — exactly the spread this
rule must not have.

`fetchUserEvents` now selects `date_candidates` + `date_window_start` so the
launcher has the columns to resolve it. Both are `SELECT`-granted to
`authenticated` — **verified against prod** with `has_column_privilege` before
the column was added, because this query runs on the RLS client and a revoked
column errors the *whole* read, which would blank the home page for every user.

### How it composes with the runway rule (PR #4017, merged into `main` 2026-08-01)

#4017 measures the planning runway as **(creation → anchor)**, so changing which
anchor is used changes the runway too. The two are one decision, and the fix
feeds the same resolved anchor to `checklistRunwayFor()` **and**
`dueDateForItem()` on both surfaces. Feed it to only one and they disagree
silently about the compression as well as the dates — the same class of defect,
one level down.

Worth noting: #4017's own test file already hard-coded `MOVIE_NIGHT_DATE =
'2026-08-01'` — the candidate date. It was asserting against the anchor the
launcher was not computing.

### ⚠ User-visible consequence

**Cards that read "nothing needs you" may start showing a number.** Every
non-wedding event with candidate/window dates and no locked `event_date` now
reports the overdue count the checklist page was already showing. That is the
fix, not a side effect.

Blast radius in prod today (5 events total — pre-launch): **1 event** matches
`event_date IS NULL AND date_candidates IS NOT NULL`, the Movie Night row above.
Its rendered card count does **not** change (0 → 0), because #4017's runway
compression — merged to `main` while this branch was being built — pulls all
four offsets onto the event day. Without #4017 this anchor fix alone would have
taken that card 0 → 4 (offsets 7/5/3/1 from a 2026-08-01 anchor land on Jul
25/27/29/31, all in the past). The
change is therefore latent in prod and will fire for the ordinary case: a
non-wedding event created well before its candidate date, where the runway is
long enough that the authored offsets stand.

**Weddings are unchanged** — their anchor was already `event_date`-only on both
surfaces. Pinned by tests over the full cross-product of candidate/window
states, for `event_type='wedding'` *and* for a NULL `event_type` (legacy rows).

### Tests

New `apps/web/lib/checklist-anchor.test.ts` (19 cases). Because a test that only
exercises the helper would stay green if a surface *stopped calling it* — which
is how the two drifted apart in the first place — it also asserts from source
that both call sites invoke the helper, that neither passes a bare
`e.event_date` into the due-date math, and that both SELECT all four columns the
ladder reads. Falsifiability confirmed: restoring `dueDateForItem(e.event_date,
…)` in the launcher turns case 13 red.

`dueDateForItem` and `toChecklistView` semantics are untouched — only what is
passed in.

SPEC IMPACT: None. No pricing, schema, SKU, or locked-decision change — this
unifies two existing read paths onto the checklist page's already-shipped
anchor rule. Prod columns read-only; no migration.
