## 2026-11-19 · feat(supplier-today): the cards row — "You can turn on N more service cards", a 🔒 row at zero

Owner 18 Nov ("deplete their cards … maximize their potential") and 19 Nov ("we already agreed they can add as many …
so we can motivate them to upgrade"): making a card is unlimited; the plan counts the LIVE ones (#8001,
`lib/live-cards-cap.ts`). The Today row that was switched off in #7994 returns under that rule, in "Also for your page":

- **Room, and a card waiting hidden:** "You can turn on N more service cards" · "H hidden · your plan shows A live" ·
  **Turn on** → Shop › Services.
- **Room, nothing hidden:** the same label · "Your plan shows A live · L on now" · **Make a card**.
- **Every live spot used and a card waiting hidden:** 🔒 "Your plan shows A service cards live" · "H hidden · hide one,
  or upgrade to show more" · **See plans** (the Problem, then the Solution — the gate's own sentence).
- Full with nothing hidden, a founder (no live limit), or any unread number: no row.
- Each row can be put aside for the day with "Not now"; none counts toward "done".

**The numbers are read, never typed:** N = `fetchCapsWithAddOns(...).serviceCardsTotal` (the plan's caps + bought
add-ons) minus the live cards, counted exactly as the live gate counts them (branch copies left out). Whatever the plan
table holds is what the row says — today 1 · 3 · 10 · 20 · 80; the 19 Nov numbers (1 · 3 · 10 · 27 · 68, Ultra Add-on
+15) arrive with #8019 and need no change here.

Tests: `lib/supplier-today-v2.test.ts` 7 (rewritten on purpose) and 7b (no plan number typed; counted as the gate counts).

SPEC IMPACT: None — builds the 18/19 Nov rulings already in DECISION_LOG.
