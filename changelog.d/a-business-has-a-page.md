## 2026-08-31 · feat(people): a business has a record, a page and a timeline

Three connected pieces, one branch (session C4).

**1 · Opening a shop creates its record.** `app/open-shop/actions.ts` wrote
`vendor_profiles` and nothing else, so a business appeared on the People page
only if somebody typed the same name in again on a different screen. It now also
writes a `dependents` row of kind `business`, linked by the new
`dependents.vendor_profile_id` column (migration
`20271186070892_dependents_vendor_profile_link.sql`). The partial UNIQUE index
`dependents_owner_vendor_profile_key` on `(owner_user_id, vendor_profile_id)` is
the idempotency key — re-running the wizard creates no duplicate, and a lost race
returns 23505, which `isAlreadyRecorded()` reads as the success it is. The whole
block is best-effort: nothing in it can redirect, throw, or cost a supplier their
shop. Gated on `dependentPeopleEnabled()` AND the `dependent_minor_profiles`
control, exactly as `addDependent` gates — both measured ON in production.

**2 · A dependent has a page.** There was NO route to one anywhere under
`apps/web/app`, which is why a business had no timeline and why a CHILD had none
either. `app/dashboard/(account)/people/[dependentId]/page.tsx` is the page, built
against the KIND so both are solved at once, with `lib/dependent-timeline.ts` as
the pure history builder. Every optional source arrives as `T[] | null` — NULL
meaning WE DO NOT KNOW — and the page renders the `unmeasured` list, so a refused
read can never draw as an empty life. Nothing is invented: a business with no
founding date on file gets no founding entry.

**3 · A business can be an event's subject.** `isGatedLifeType` was doing double
duty — the CAP's vocabulary and, by accident, the gate on whether an event could
name a subject at all — so `corporate` and `gala_night` dropped the
`honoree_dependent_id` one line before it would have been verified. New predicate
`eventTypeAcceptsHonoreeLink()` separates the two. The cap itself
(`blocksLifeEventCreation`) still keys on `isGatedLifeType` and is untouched, so
a business contends for no singleton slot. A WEDDING is in neither list and still
cannot name a dependent — now enforced on the SERVER in both doors
(`create-event/actions.ts` and `onboarding/_shared/commit-event.ts`, which had no
type gate at all).

Migration dry-run against production in `BEGIN … ROLLBACK`: column created, FK
delete rule `SET NULL`, index unique + partial, and a second insert of the same
`(owner, shop)` pair inserted zero rows.

SPEC IMPACT: None. No locked decision moves — the dependent-kind vocabulary, the
person-only sensitive-PI rule, the age fence and the one-in-planning cap are all
byte-identical. `corporate`/`gala_night` gaining an optional honoree is a
capability the column already described.
