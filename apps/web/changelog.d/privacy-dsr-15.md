## 2026-07-24 · docs(privacy): unify DSR response window at 15 business days

The live `/privacy` page said "within one business day" in two places (the
right-to-erasure processing promise and the Contact section), contradicting the
**15 business days** stated at the top of the same page — and the signed NPC pack
(Privacy Manual doc 01 §6, DPO sheet doc 03), which already commit to 15. Brought
both spots to **15 business days** (owner/DPO directive 2026-07-24). Honesty fix:
a 2-person team can't guarantee 1-business-day erasure; 15 is the window we
actually commit to, consistent everywhere.

SPEC IMPACT: None — the NPC pack docs already state 15; this only aligns the live
page. NPC filing itself is deferred (owner: process next year).
