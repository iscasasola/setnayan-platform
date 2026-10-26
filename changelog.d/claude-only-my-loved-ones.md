## 2026-10-27 · fix(people): Create Event and the Events board list only MY loved ones

Owner, verbatim, on Create Event's "Who is it for?": *"Why do i have flowerstoreph and indigocaterers"* · *"It only has
setnaprod"* · *"It should not"*. RLS on `dependents` admits an ADMIN to every dependent on the platform; the picker
listed whatever came back (three of four were other users' businesses), and the Events board's loved-ones count was a
bare platform-wide `count: 'exact'`. Both now go through the one rule in `lib/my-loved-ones.ts` (mine · a real
spouse's shared · handed-over history), the same rule the People page uses since 2026-09-29. Non-admin accounts were
never affected (RLS scopes them). Guard `lib/the-people-page-lists-only-my-household.test.ts` now pins both readers and
fails any future app/ LIST read of `dependents` that has neither a single-row scope nor the rule (sabotage: each reader
reverted → red).

SPEC IMPACT: None.
