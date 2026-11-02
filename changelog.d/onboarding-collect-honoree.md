## 2026-07-31 · fix(onboarding): the second child can have a party

**The live defect.** The generic onboarding wizard — the flow every non-wedding type has routed through since `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` went on in prod — never collected `honoree_label`, but it still ran the one-in-planning cap.

`blocksLifeEventCreation` treats two **unlabeled** events of the same gated type as competing for a single slot. So the second **birthday · debut · christening · graduation · gender reveal** an account created was refused, and the user saw:

> Something went wrong saving your plan. Please try again.

Nothing went wrong, and trying again is precisely what cannot work. `commit-event.ts` even said so in a comment — *"The generic onboarding collects no honoree yet, so a life-type commit contends for the per-type singleton slot"* — the consequence just wasn't followed through to the screen. Neither escape existed: `archived` has no UI anywhere in the app for a personal event, and new events are created with no date, so the `event_date < today` release never fires.

A mother planning her second child's 7th birthday hit a permanent wall. Nobody has yet — prod holds 3 events, all weddings.

### The fix is the question that was missing

A `honoree` screen now sits after `name`, for the five gated types only (`isGatedLifeType`) — lifestyle types are untouched, because a user legitimately has many dates, hangouts and reunions.

> **Who are we celebrating?**
> Their first name is enough. It keeps each birthday on its own plan, so you can have one for each person.

The name flows `payload.honoreeLabel` → `buildGenericEventInsert` → `events.honoree_label`, and into the guard candidate, where two different names now resolve to two different celebrations. Ordinary PI — a first name, never a birthdate, never a dependent link, so the counsel gate on minors' data is untouched.

### The refusal now lands on the field that resolves it

`GenericCommitResult` carries `blocking: { eventId, displayName }` alongside `life_event_exists`. On that result the wizard **walks the user back to the honoree screen** and explains, next to the input:

> You already have a birthday in planning — "Nina turns 7". If this one is for someone else, put their name above and we'll keep the two apart.

Typing clears it. This is the part that turns a dead end into a door: the old copy stranded the user on the last screen with a retry button and nothing to change.

Skipping is still allowed — the council's rule is that opening a second slot costs exactly one non-sensitive act, not that the act is mandatory. Skip and you take the singleton slot, exactly as before.

### Tests

`honoree-cardinality.test.ts` — 7 cases pinning both halves: the insert carries the name; whitespace/absent/null all store NULL rather than an empty string; **two unlabeled birthdays still collide** (the rule is not weakened); a different name opens a second slot; the **same** name is still capped, and casing cannot buy a slot; the five gated types are gated and six lifestyle types are not; pre-epoch rows still never block, so no existing account is retroactively frozen out.

`honoreeLabel` is optional on the payload so every existing constructor and fixture stays valid — absent and null mean the same thing.

**Full suite: 5,720 tests, 0 failures.** `tsc --noEmit` clean · `next lint` clean.

SPEC IMPACT: None. The cap, its honoree key and its epoch exemption behave exactly as designed — this is the first flow that actually feeds them.
