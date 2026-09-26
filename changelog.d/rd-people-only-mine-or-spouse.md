## 2026-09-26 · fix(people): the People page lists only my household — never another user's records

Owner, on his own People page: *"i do not have a registered spouse"* — it showed another user's
business ("Indigo Caterers") tagged "Shared by your spouse". RLS admits an admin to every dependent,
and the Alaga list rendered the raw result, labelling every non-own row as the spouse's. The list is
now filtered to: my rows · rows I handed over · rows my actual spouse (`current_spouse_user_ids`)
marked shared. Guard: `lib/the-people-page-lists-only-my-household.test.ts`.

SPEC IMPACT: None
