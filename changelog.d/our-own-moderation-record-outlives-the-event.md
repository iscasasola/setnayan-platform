## 2026-08-25 · fix(admin): our own record of a moderation decision outlives the event

Applying the owner's **standing** rule (2026-08-21) rather than re-asking it:
*"did the supplier take part in it?"* A self-review appeal is a supplier formally
contesting a block on their own reputation, and **our answer to it**. Both parties
took part; the couple did not, and no couple-facing surface reads it.

🚨 Today a couple can erase our audit trail of our own decision as a side effect
of tidying their events — including a **decided** appeal carrying the deciding
admin, the decision and its reasoning.

✅ **The reader already survives, which is why this is one line and not a
feature.** `/admin/reviews` selects appeals with **no event filter**, so an
orphaned appeal stays in the moderation queue exactly where it was. That was
checked *before* writing the migration.

⛔ **Two neighbours were deliberately left out of this change**, because each
would have been preserved-and-invisible — the "gate with no handle" shape this
repo has found five times:

| | why it is not here |
|---|---|
| `event_vendor_policy_acknowledgements` | **Every** read filters `.eq('event_id', …)`. Measured: no supplier-keyed reader exists, despite the denormalised `vendor_profile_id` existing for exactly that purpose. Needs a reader. |
| `event_vendor_payment_plan` | `vendor_payday_installments` **INNER JOINs** `events`, so a preserved plan drops out of the Payday calendar entirely — the slice-2 "row vanishes" costume. Needs a snapshot + a `LEFT JOIN`, and the table's public grants make new columns a judgement call. |

🔑 `reviewer_user_id` still **CASCADEs** from `users`, deliberately untouched: an
appeal is evidence *about an account*, and widening this to the person would
quietly reverse an RA 10173 erasure guarantee. A test pins it.

Migration `20271166289293`. 4 db tests; the FK mutation-checked by occurrence
count (1 → 0, three tests red, the erasure pin correctly unaffected). Exposure
surface unchanged. Prod holds **0 appeals**.

SPEC IMPACT: None — applies the standing 2026-08-21 ruling.
