## 2026-11-17 · feat(supplier): Card Maker HYBRID part 2 — named pay plans, Setnayan's starting What's included, Admin › Quick Forms, description + video link

Stacked on the part 2 migrations. Extends the shipped one-page maker (ruling 2026-11-18 "extend it"); no new server action (1,246 of 1,251).

- **💳 Pay plan** (Payment schedule, More settings): a "Pay plan" dropdown lists the shop's saved plans ("· yours") beside "This card's own". "Save as my plan" names this card's payments, saved with the card. "Use on other cards" ticks other cards. Changing a plan that other cards follow asks once: "Change it on all N cards, or just this one?". The card keeps its own schedule rows; `apply_vendor_pay_plan` copies a plan onto each card. A refused read is said, and the plan part then posts nothing.
- **📋 What's included › From Setnayan**: picks one of Setnayan's starting lists for this service and adds its lines under what is typed (never twice). A choice row becomes one words line ("Type: Buffet or Plated"); no price anywhere.
- **Admin › Categories › a service › Quick Forms**: list (a "Proposal" tag on the seed), tap to edit in place, swipe to delete, "＋ Add template". Three new ops on the existing `formSuggestionsAction` dispatcher, service role, audited.
- **📝 About this card** (More settings): Description (≤ 1,000) and Video link (https only). Shown on the full card a couple opens ("Watch on youtube.com"), carried by "Start another from this" and by Copy to another branch.
- Lab: `/dev/card-maker-lab?…&library=1|unread&plan=on&about=1`, `?view=quick-forms&library=1`; `/dev/shop-preview-lab?view=card&about=1`. Shots: `build-sessions/shots-card-maker-part-2/`.
- Tests: `lib/card-maker-part-2.test.ts` (9).

SPEC IMPACT: None — implements DECISION_LOG 2026-11-17 (bf69604a · 4906a9a8 · 7596f63a) and HYBRID map Q3. Open owner questions are on the PR.
