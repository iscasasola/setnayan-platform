## 2026-07-30 · test(security): exercise the activation ownership rule, don't just read it

Closes the follow-up **#3930 stated openly about itself**: its tests are a source scan. They prove
the ownership gate is installed in all four `vendor_*__<id>` hooks and installed before each
hook's first write — but never that the comparison actually refuses a mismatched pair.

### Why it could not be tested where it was

`lib/sku-activation.ts` **cannot be imported by a test.** It reaches `server-only` transitively:
`sku-activation` → `app/dashboard/(account)/profile/concierge/actions` → `lib/notification-emit`
→ `server-only`, which throws under `tsx --test`. Verified by probe before writing anything, not
assumed.

So the decision moved into `lib/vendor-target-ownership.ts` — pure, no I/O, no SDK, no
`server-only` — the same house pattern as `lib/r2-client-ref.ts` and `lib/self-comp-authority.ts`,
both of which exist for exactly this reason. The gate in `sku-activation.ts` now calls it. The
I/O (reading `orders.vendor_profile_id`, resolving the target's owner) stays where it was.

### Coverage is now honest in both halves

| claim | proven by |
|---|---|
| the rule is right | `vendor-target-ownership.test.ts` (new, 11 cases) |
| the rule is called, before anything is written | `activation-ownership-gate.test.ts` (source scan, #3930) |

The 11 cases: the one allowed pair · cross-tenant refusal · **order with no vendor** (the
couple-checkout case that pins `vendor_profile_id` to NULL) · unknown target owner ·
**null-vs-null** (a `===` on two nulls is TRUE in JS — a couple-minted order against an
unresolvable target would otherwise sail through) · empty and whitespace-only ids ·
whitespace-insensitive identity · exact comparison (no case folding, no prefix match) ·
non-string junk · plus both refusal-message shapes, including that an absent id renders as
`null`/`unknown` rather than leaking a literal `undefined` into the log line.

**Mutation-proved, five ways:** drop the null guards → 3 fail. Case-insensitive compare → 1.
Prefix match instead of equality → 1. Stop normalising blanks → 2. Make the gate stop delegating
and inline a second untested copy of the decision → the wiring guard fails. Restored → 18/18.

Wider run: **933/933** across sku / activation / order / vendor / booking / money tests.

### One thing the mutation run caught in this PR's own tests

The "no case folding" case initially passed for the wrong reason: the fixture UUIDs were all
digits, so `A.toUpperCase() === A`. The assertion was testing nothing. Fixtures now contain hex
letters, and the mutation confirms the case actually fails when the compare is loosened.

SPEC IMPACT: None — behaviour is unchanged, the rule is identical, and the four hooks are
untouched. This is the same decision, moved somewhere it can be proven.
