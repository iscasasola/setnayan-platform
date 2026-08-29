## 2026-08-29 · feat(vendor): ₱2,500 buys away the customers-per-date ceiling on Custom

**SPEC IMPACT:** `apps/web/VENDOR_TIERS_AND_BENEFITS.md` §11 (a seventh Custom axis) +
`DECISION_LOG.md` row 2026-08-29.

**Owner 2026-08-29**, asked what going past the 10-customers-per-date ceiling should cost:
**"2500 for no limit."**

Every plan caps how many customers a shop may be **chasing** for one single date — Free 1 · Verified
2 · Solo 3 · Pro 5 · Enterprise 10 · Custom 10. A **Custom** shop can now buy that ceiling away for a
flat **₱2,500 / 28 days**.

### 🔑 RULE 0 PAID: this is not a new mechanism

Custom already sells priced dials through `vendor_custom_plans.composition` — nationwide reach
(₱2,500), a custom domain (₱500), extra event slots (₱500 each), extra seats — quoted by
`computeCustomQuote` and applied by `vendorEffectiveCaps`. **This is one more axis in that
configurator.** No new table, no new purchase flow, no new entitlement store.

⚠ **AND A CORRECTION TO THE REASON THIS WAS ALMOST NOT BUILT.** The owner was told the dials would be
pointless because *"Custom is hidden from every public page"* — a claim inherited from a session
brief and never measured. The catalogue says otherwise: `vendor_custom_base` is ACTIVE at ₱11,000 and
three of its dials are active and selling. **A brief's claim is not a measurement**, and the decision
nearly turned on it.

### The part that makes it real

A catalogue row, a quote line, a stored flag and a screen toggle can all exist while the database
goes on refusing the eleventh customer — **the exact shape of every "gate with no handle" in this
schema, sold instead of switched off.** So:

- `vendor_pipeline_is_unlimited()` asks whether the shop holds an **ACTIVE** composed plan carrying
  the flag (`= 'true'` on the JSON text, so a plan composed before the axis existed fails closed by
  construction rather than by a `COALESCE` somebody can delete);
- **`enforce_vendor_whitelist_per_date` asks it**, and every assertion in the db suite drives a real
  accept through that trigger — including a **control** that a Custom shop *without* the axis is
  still stopped at 10, because an accept that was never going to be refused proves nothing;
- **the pressure line goes silent** for an unlimited shop. *A gate lifted in the database and not on
  the screen is a refusal a person is told about and never receives* — it would invite them to
  decline a real customer to free a slot they do not need. It returns **no rows**, not a big number:
  "of 999" is not a ceiling, it is a lie with a big number in it.

🔑 **A separate boolean, not a NULL cap.** The tempting shortcut is to have `vendor_tier_limit` return
NULL for an unlimited shop, since the trigger already treats NULL as "do not block". Refused: NULL
there means *"unknown key, never silently block an inbox"*, and one value meaning two things is how a
typo becomes an entitlement.

### ⛔ Scope, deliberately narrow

This is the **chasing** ceiling only. It does **not** touch the **booked-out waitlist** (couples
queued on a date already sold, capped at 5 for Enterprise/Custom). Two different lists share the word
"limit"; the owner was asked about the 10 and answered about the 10, and widening the other would
also mean widening the `vendor_profiles_max_waitlist_0_10` CHECK constraint — a second change with a
second consequence. **Two tests pin that it stays put**, so nobody widens a second thing on the back
of one ruling.

### Verification

`tsc --noEmit` exit **0**, 0 errors · `test:unit` **11,376 pass · 0 fail** · `test:db:ci` · all **30**
CI guard scripts.
**Three mutations, occurrence-counted before → after, all RED:** remove the trigger's question
(1 → 0) · remove the pressure silencing (1 → 0) · relax `status = 'active'` to `IS NOT NULL` (1 → 0).

⚠ The trigger and reader bodies were copied from the **live objects** (`pg_get_functiondef`), never
from the migrations that last touched them — the rule this repo learned twice this week, in the two
PRs immediately before this one.
