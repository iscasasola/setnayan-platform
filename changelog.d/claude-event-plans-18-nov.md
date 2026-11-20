## 2026-11-18 · feat(plans): event plan re-cut, part 1 — Setnayan AI moves Plus → Pro (new buyers only), uploads by plan

Owner rulings 18 Nov (PLAN_RULINGS_2026-11-18 rulings 15 · 16 · 20 · 21 · 34 · 36 · 38; DECISION_LOG rows
"EVENT PLANS: Plus · Pro · Ultra, contents re-cut", "EVENT PRO AND ULTRA RAISED", "EVENT ULTRA = 6,000 PAPIC CREDITS").
SKU codes and display names are unchanged.

- **Setnayan AI is Event Pro's and Ultra's, not Event Plus's — for NEW purchases only.** `AI_INCLUDED_PLAN_SKUS`
  (lib/sku-activation.ts) is now `COUPLE_WEBSITE_PRO` + `EVENT_ULTRA`. `activateEventPlan` still grants Plus its
  included Papic credits, but turns `events.setnayan_ai_active` on for an Event Plus order only when that order was
  placed before `EVENT_PLANS_RECUT_AT` (lib/event-plans.ts — see the review fixes below: committed as `null`, set at
  ship time). The refund/move re-derive keeps
  the flag for an event still holding a Plus order from before the line. Past buyers: nothing is removed — a Plus bought
  before the line keeps the AI; an unreadable order date counts as "before".
- **Uploads per event by plan:** Free 10 MB · Event Plus 500 MB · Event Pro 1 GB · Event Ultra 2 GB
  (`coupleMediaCapBytes(plan)`, `eventCoupleMediaPlan`). The Background part alone keeps its 500 MB. The upload
  reservation and every Maker meter read the same helper. Raises caps only — nobody's allowance goes down.
- **Copy** that said Event Plus carries Setnayan AI now says Event Pro and Event Ultra: /features plan cards, the
  Setnayan AI feature page (en + tl, now priced "From" Event Pro), /pricing (Plus and Pro rows), the /pricing/plan quiz
  (the AI question folds into the Pro question; Plus is offered by "Want a nicer look?" — review fixes below), the front-door plan cards, the home
  AI overlay (priced by Event Pro), the help topic, llms.txt, the How-it-works list, the home JSON-LD line. A new
  stale-claim pattern flags "Event Plus adds Setnayan AI" wording.

**Review fixes (19 Nov, GitHub progress check, FIX-FIRST):**
- **The re-cut line can no longer come before the deploy.** `EVENT_PLANS_RECUT_AT` was a guessed
  `2026-11-19T00:00+08:00`, earlier than any possible deploy, so a Plus bought in the gap on the old page (which sold
  the AI) would have lost it. It is now `null` = no cut yet (every Plus order keeps the AI, as before this PR); the
  session that publishes sets it to the moment the deploy is SERVED, in a one-line follow-up. `EVENT_PLANS_RECUT_FLOOR`
  (2026-11-19 17:00 UTC, this change's commit) makes any earlier value inert, and the test fails on one.
- **The plan quiz offers Event Plus again** through "Want a nicer look?" (owner 19 Nov, DECISION_LOG "WEBSITE CONTENT
  — TEN OPEN PLAN AND COPY CALLS ANSWERED" (9)). Its tip names only what Plus unlocks today; a yes to Plus and Pro bills
  Pro once.
- **No plan page types an upload size.** /features, the front-door cards, /pricing and the quiz read
  `formatMakerMediaMB(coupleMediaCapBytes(plan))`; `lib/plan-upload-sizes-are-read.test.ts` fails on a typed size.

NOT BUILT in this PR (each needs an owner answer — see the PR body): the 11 Hub parts + Editorial moving from Event Pro
to Event Ultra, ready-made premium themes and premium Save the Date moving down to Event Plus, the full Today guide.
Credits and original-keep days live in the admin catalogue, not code.

SPEC IMPACT: None in the corpus (the rulings are already recorded in PLAN_RULINGS_2026-11-18.md and DECISION_LOG
2026-11-18). Owner actions listed in the PR body: catalogue `included_papic_credits` (Pro 3,000 · Ultra 6,000),
Event Pro's full-size keep (6 months), App Store product text for Event Plus.
