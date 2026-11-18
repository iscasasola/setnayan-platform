## 2026-11-18 · feat(plans): event plan re-cut, part 1 — Setnayan AI moves Plus → Pro (new buyers only), uploads by plan

Owner rulings 18 Nov (PLAN_RULINGS_2026-11-18 rulings 15 · 16 · 20 · 21 · 34 · 36 · 38; DECISION_LOG rows
"EVENT PLANS: Plus · Pro · Ultra, contents re-cut", "EVENT PRO AND ULTRA RAISED", "EVENT ULTRA = 6,000 PAPIC CREDITS").
SKU codes and display names are unchanged.

- **Setnayan AI is Event Pro's and Ultra's, not Event Plus's — for NEW purchases only.** `AI_INCLUDED_PLAN_SKUS`
  (lib/sku-activation.ts) is now `COUPLE_WEBSITE_PRO` + `EVENT_ULTRA`. `activateEventPlan` still grants Plus its
  included Papic credits, but turns `events.setnayan_ai_active` on for an Event Plus order only when that order was
  placed before `EVENT_PLANS_RECUT_AT` (2026-11-19 00:00 Manila, lib/event-plans.ts). The refund/move re-derive keeps
  the flag for an event still holding a Plus order from before the line. Past buyers: nothing is removed — a Plus bought
  before the line keeps the AI; an unreadable order date counts as "before".
- **Uploads per event by plan:** Free 10 MB · Event Plus 500 MB · Event Pro 1 GB · Event Ultra 2 GB
  (`coupleMediaCapBytes(plan)`, `eventCoupleMediaPlan`). The Background part alone keeps its 500 MB. The upload
  reservation and every Maker meter read the same helper. Raises caps only — nobody's allowance goes down.
- **Copy** that said Event Plus carries Setnayan AI now says Event Pro and Event Ultra: /features plan cards, the
  Setnayan AI feature page (en + tl, now priced "From" Event Pro), /pricing (Plus and Pro rows), the /pricing/plan quiz
  (the AI question folds into the Pro question — Plus is no longer offered there), the front-door plan cards, the home
  AI overlay (priced by Event Pro), the help topic, llms.txt, the How-it-works list, the home JSON-LD line. A new
  stale-claim pattern flags "Event Plus adds Setnayan AI" wording.

NOT BUILT in this PR (each needs an owner answer — see the PR body): the 11 Hub parts + Editorial moving from Event Pro
to Event Ultra, ready-made premium themes and premium Save the Date moving down to Event Plus, the full Today guide.
Credits and original-keep days live in the admin catalogue, not code.

SPEC IMPACT: None in the corpus (the rulings are already recorded in PLAN_RULINGS_2026-11-18.md and DECISION_LOG
2026-11-18). Owner actions listed in the PR body: catalogue `included_papic_credits` (Pro 3,000 · Ultra 6,000),
Event Pro's full-size keep (6 months), App Store product text for Event Plus.
