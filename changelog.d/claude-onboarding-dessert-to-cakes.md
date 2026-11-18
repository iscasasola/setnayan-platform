## 2026-11-17 · fix(onboarding): dessert answers add Cakes & Desserts, not Food Carts

Owner, 17 Nov, on the T1 part 2 follow-up *"Should the 'Dessert spread' answers point at Cakes & Desserts instead?"* —
*"yes"*. T1 part 2 (#7893) folded the old Dessert category into Food Carts and forwarded the onboarding picks with it;
the seven type-question answers and the thirteen persona-pack extras that came from Dessert now add `cake`
(Cakes & Desserts, which holds the Dessert table). Food Truck's picks stay in Food Carts. Guard:
`lib/onboarding/type-questions.test.ts` — no dessert/sweets answer adds Food Carts.

SPEC IMPACT: DECISION_LOG row "T1 PART 2 SHIPPED WITH PART 1" (2026-11-17) records the ruling; no other spec change.
