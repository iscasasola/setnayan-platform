## 2026-07-24 · docs(privacy): unify DSR response SLA at 15 business days + honest erasure carve-out

Two copy-only fixes to the public `/privacy` notice so it stops contradicting
itself and stops over-stating what erasure deletes:

- **One response-time SLA.** The DPO section already promised "within 15
  business days"; the Contact section separately promised "within one business
  day". Aligned Contact → "within 15 business days (usually much sooner)" so the
  formal RA 10173 data-subject-request guarantee is a single number everywhere.
  (Owner decision 2026-07-24: standardize on 15.)
- **Erasure statutory-retention carve-out.** The Right-to-erasure copy said we
  "permanently erase your personal data within one business day" — but the
  erasure code deliberately retains statutory records (BIR/tax/receipts). Added
  an explicit "except records we are legally required to keep … which we retain
  for the required period and then delete" clause so the notice matches
  `lib/account-erasure.ts` behavior.

No behavior change — the app's data handling is unchanged; this only makes the
disclosure accurate and internally consistent.

SPEC IMPACT: Aligns the binding Privacy Manual (§6) + DPO Designation sheet DSR
SLA from 7 → 15 business days to match the live notice + owner decision; applied
directly in the corpus NPC_Compliance pack.
