## 2026-11-19 · test(plans): the five 19 Nov §C plan rulings are pinned by one test

- `app/vendor-dashboard/subscription/the-19-nov-plan-rulings-hold.test.ts` fails if any of the owner's "Yes, all five" rulings stops being true: a shop over a lowered limit keeps what it has but cannot add (cards, people, branches); the single seat and branch rows are never offered for sale while a bought branch may renew; a plan purchase reads the catalogue price when it is made and stores it; the Films layer answers yes on every plan.

SPEC IMPACT: None
