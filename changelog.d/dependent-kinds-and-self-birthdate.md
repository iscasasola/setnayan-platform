## 2026-07-31 · feat(people): the four alaga kinds the owner named, and "You" reads your own birthday

Owner, verbatim: *"their birthdays shows based from their account. and these are
only for their own account and their dependents (children, business, items,
pets)."* — followed by *"fix dependents."* Two things followed.

**1. The dependant vocabulary matches the product again.**
`dependents.dependent_kind` was CHECK-constrained to `person | pet | other`, so a
business and a car were both `other` — one bucket for two things that celebrate
two different dates. Widened to `person | pet | business | item | other`
(migration `20271027404378_dependents_kind_business_item.sql`). A *child* is
`person` + relationship `child`, which is why `children` did not need a kind of
its own.

`other` is **kept**, not replaced: rows may hold it and code branches on it. The
CHECK is dropped/recreated so a replay is safe, and the migration ends in a
post-condition that RAISEs (aborting) if any row is left outside the vocabulary —
verified to actually fire, not decorate. No new table/view/function/column, so
there is no new object to `REVOKE` from `anon`. No policy or `USING`/`WITH CHECK`
clause is touched: the exposure baseline regenerates **unchanged** (6228 facts).

**2. The "You" subject now folds the create grid from `users.birth_date`.**
A previous pass deliberately skipped this, saying reading the account's own SPI
to sort a grid "deserves an explicit decision rather than a side effect". The
owner has now made that decision, so it is wired: `buildSelfSubject` takes the
profile the account holder filled in themselves, and a saved birthday replaces
the household reading exactly as a named alaga's does. **No saved birthday ⇒
byte-identical to what shipped** — the path every current account takes (0 of 6
prod users have one). It stays a *fold*: "show all event types" is one tap away.

It is a READ, used only to sort a picker, disclosed to nobody, and no date is
written onto an event — the counsel gate in `lib/onboarding/event-insert.ts` is
untouched. `users.sex` is deliberately **not** read: it would only sharpen 18F/21M
on the debut ladder, it carries its own RA 10173 consent stamp, and the owner
directed birthdays. Omitting it checks both debut ages, which folds *less* — the
documented fail-open direction.

**A live bug found on the way, fixed here.** `app/claim/[token]/actions.ts`
matched the rehome/transfer-of-care redemption with a hand-typed
`.in('dependent_kind', ['pet','other'])`, while the mint side derives its purpose
as "not a person". Adding two kinds would have issued perfectly valid transfer
links that redeemed against **zero rows** and died as `error=invalid`, with
nothing in any log. Now derived from `NON_PERSON_DEPENDENT_KINDS`, with a test
that pins the derivation so the next widening cannot re-strand it.

**Two smaller correctness fixes in the same blast radius:**
- The Year view ran the **human** milestone ladder over every dependant kind, so a
  12-year-old sari-sari store would have printed *"Aling Nena's Store's debut"*.
  `buildDependentMoments` now skips non-person kinds (a missing kind still reads
  as `person` — the column default and the legacy value).
- `relationship` was stored for non-person rows, so a business defaulted to
  `child` and would have said so in its RA 10173 data export. Now person-only,
  matching how `sex`/`religion` were already handled.

**Consent and the age fence are unchanged, on purpose.** `birth_date_consent_at`
stays **person-only** — a person's birthday is sensitive PI under RA 10173; a
company's founding date and a car's purchase date are not, and stamping them
would dilute the stamp that guards a child's. The `<18 / >50 / 18–50 blocked`
fence stays **person-only** and stays app-side: a 12-year-old business is not a
minor.

Files: `supabase/migrations/20271027404378_dependents_kind_business_item.sql` ·
`apps/web/lib/dependent-people.ts` (+`NON_PERSON_DEPENDENT_KINDS`,
`isPersonDependent`, `DEPENDENT_DATE_LABELS`) · `apps/web/lib/create-subjects.ts` ·
`apps/web/lib/dependent-moments.ts` · `apps/web/app/claim/[token]/actions.ts` ·
`apps/web/app/dashboard/(account)/create-event/page.tsx` ·
`apps/web/app/dashboard/(account)/year/page.tsx` ·
`apps/web/app/dashboard/(account)/people/dependent-actions.ts` ·
`apps/web/app/dashboard/(account)/people/_components/dependents-section.tsx` ·
tests in `create-subjects.test.ts`, `dependent-people.test.ts`,
`dependent-moments.test.ts`.

SPEC IMPACT: **Yes — owner-directed, not a side effect.** (a) The alaga/dependant
vocabulary is product surface and now reads `person · pet · business · item ·
other`; any corpus text describing it as "person | pet | other" is stale. (b) The
create flow's "para kanino ito?" step now measures the account holder from
`users.birth_date`, reversing the earlier "You sorts nothing away" note — the
reversal is the owner's explicit instruction of 2026-07-30. Both belong in
`DECISION_LOG.md` as dated rows. Unchanged and worth restating in the corpus: the
guardian-consent stamp and the age fence remain person-only.
