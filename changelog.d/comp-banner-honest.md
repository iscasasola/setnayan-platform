## 2026-11-16 · fix(admin): the customer comp banner says no second admin checked it

Owner ruling 16 Nov (DECISION_LOG 75a46e3c, (7)): keep the ₱10,000 rule and reword the banner. A customer/event comp worth more than the § 9.1 limit is granted at once by one admin. The success banner used to say "flag for owner+spouse co-approval (exceeds ₱10,000 · two-admin primitive lands V1.x)", which promised a check that never runs. It now says the comp is over the limit where § 9.1 asks for a second admin, that nobody else checks a customer comp yet, and to tell the owner. The limit is read from `COMP_GRANT_CO_REVIEW_PESOS` (it was typed as `10_000` here) and is unchanged; the audit row's `requires_two_admin_review` is untouched. Guard `lib/the-comp-banner-says-what-happens.test.ts`. Sabotage: putting the old banner back (0 → 1) turned it red.

Not changed (same promise, outside this ruling's scope): the comp form's hint on the Users surface still says grants over the limit "get flagged for co-approval".

SPEC IMPACT: None — wording only; the rule and its number are kept.

The comp form's hint on the Users surface ("Grants over ₱… get flagged for co-approval") now says the same thing:
the grant still goes through at once, nobody else checks it yet, so tell the owner. Guarded in the same test file.
