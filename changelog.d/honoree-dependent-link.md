## 2026-08-01 · fix(create-event): originate `events.honoree_dependent_id` — the cap now keys on a record, not a spelling

`events.honoree_dependent_id` shipped in migration `20270821100000` and was read by
`lib/life-event-gate.ts` as the STRONGEST half of the one-in-planning life-event key —
but **no create path ever wrote it.** The only assignment anywhere in `apps/web` was
`lib/event-recurrence.ts:80`, which *copies* the value forward when an event recurs; it
propagates a link and never originates one. Verified on prod: 4 events, 0 with a link.

So this branch could never execute:

```ts
if (candidate.honoreeDependentId && existing.honoree_dependent_id) { … }
```

and the cap always fell back to comparing the normalised `honoree_label` **string**. Two
consequences, both silent:

- two alaga who share a first name shared **one** in-planning slot; and
- **renaming an alaga changed which events it capped against** — the cap keyed on a
  spelling instead of on the person.

This wires the value through from the two places that already know which alaga was
chosen, and verifies it server-side before it is written.

**What changed**

- `lib/honoree-dependent-link.ts` (new) — `resolveHonoreeDependentId()` re-reads the
  client-supplied id from `dependents` under an explicit `owner_user_id = <caller>`
  predicate and drops anything that does not come back. The id arrives from a hidden
  field / sessionStorage and is therefore forgeable: writing an unowned one would leak a
  relationship *and* corrupt another account's cap. Every failure (forged id, handed-over
  record, unreadable table, a label the user edited away from the alaga's name) resolves
  to `NULL`, which is byte-identical to today — a cardinality *refinement* must never
  become a new way to fail at creating an event.
- `lib/create-subjects.ts` — `subjectHonoreeDependentId()`, symmetric with the shipped
  `subjectHonoreeLabel()`: `null` for "You" and "Someone else" (the unlabeled/unlinked
  slot has always meant the account holder), the `dependent_id` for a named alaga.
- `lib/onboarding/honoree-handoff.ts` — the create → onboarding carry now ships
  `{ name, dependentId }`. Same sessionStorage route, same single-read, same 10-minute
  TTL, same degrade-to-nothing on every failure. A stash written before this field
  existed still reads, as name-only.
- `create-event/actions.ts`, `onboarding/_shared/commit-event.ts` — resolve the link,
  pass it to the guard candidate (so the stronger key can finally fire) and into the
  insert. `commit-event.ts` **overwrites** the payload's `honoreeDependentId` with the
  verified value so a forged one cannot survive the object spread.
- `event-type-picker.tsx`, `generic-onboarding.tsx` — carry the chosen alaga. Editing the
  honoree name in the wizard clears the link client-side, and the server drops it anyway
  when label and record disagree: filing an event under the *previous* person because the
  user overtyped the name is the one corruption this must not allow.

**Deliberately not done**

- No migration — the column, its FK (`ON DELETE SET NULL`) and its partial index already
  exist. No RLS, policy or `USING`/`WITH CHECK` change, so no exposure-baseline churn.
- Owner-only scope. `dependents` also grants a spouse READ on a `shared_with_spouse` row;
  a spouse picking a shared alaga gets `NULL` and keeps label-based capping (today's
  behaviour) rather than having the married-household rule re-implemented in app code,
  where it could drift from the policy and start writing links across accounts.
- No birthdate is read or written. The resolver selects `name` only, and the counsel gate
  in `lib/onboarding/event-insert.ts` that forces `anchor_date` NULL for
  `person_birthdate` types is untouched.
- Existing rows with a NULL link behave exactly as before — this is additive.

**Inert in prod for now.** The subject roster is only populated when
`NEXT_PUBLIC_DEPENDENT_PEOPLE=1` (counsel-gated, currently unset), so until that flag
flips every account still sees "You" + "Someone else" and the column stays NULL. The
wiring is complete and tested; nothing about the current live behaviour changes.

SPEC IMPACT: None. The council verdict `Event_Creation_Limits_Council_Verdict_2026-07-17.md`
and migration `20270821100000` already specify `honoree_dependent_id` as the cardinality
key that takes precedence over `honoree_label` ("NULL until the person-picker PR"). This
is that PR — it implements the documented decision, it does not change it.
