## 2026-06-28 · fix(faith/inc): give INC weddings their own planning-checklist steps

Gap found in the INC end-to-end audit (follow-up to #2311 + #2315): the couple
planning checklist (`lib/checklist.ts`, live on the dashboard) gated its church-
coordination items behind `isChurchCeremony()` = Catholic-or-unset. Those items
are doctrinally Catholic-worded (Pre-Cana, banns, canonical interview, parish,
priest), so hiding them from INC was correct — but INC was left with NO church-
coordination steps at all, while still seeing the universal tasks.

Fix (root-cause, mirrors the Catholic path rather than leaking its wording):

- New `isIncCeremony()` predicate (INC-only; never matches Catholic/unset).
- Three INC-specific checklist items gated to it, placed beside their Catholic
  counterparts on the countdown:
  - `inc_lokal_coordinate` — "Coordinate your wedding with your local INC
    congregation (lokal)" (≈15 mo out)
  - `inc_premarital_guidance` — "Complete your INC pre-marital guidance with the
    ministry" (≈5 mo out)
  - `inc_confirm_minister` — "Confirm your INC minister and chapel schedule with
    the lokal" (≈3.5 mo out)

INC couples now get congregation-coordination reminders; Catholic-only items
(Pre-Cana/banns/canonical interview) still never leak into an INC checklist, and
INC items never leak into a Catholic one. Updated `checklist.test.ts` count
assertions to be filter-aware and added an INC-coverage test.

NOTE (separate, pre-existing): the day-of schedule seed
(`seedDefaultScheduleBlocks`) is dead code — never called — so the INC reception
spine added in #2315 is correct but currently inert; the INC reception posture is
still delivered live via the enriched /paperwork traditions guide. Tracked in the
spec doc § 6; wiring the seed is a separate platform decision, not an INC fix.

Verified: typecheck + 585 unit tests + production build pass.

SPEC IMPACT: Reflected in
02_Specifications/INC_Wedding_Practices_Reference_2026-06-28.md § 6 +
DECISION_LOG.md (2026-06-28). No schema/SKU/pricing change.
