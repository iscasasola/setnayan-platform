## 2026-07-27 · refactor(packages): make the two recurring money bugs not compile

Three times in this wave the same two mistakes shipped. Each was caught by a
human reading code, or by a test written *after* the damage. This makes both
mechanical.

### Bug 1 — a client value persisted as truth

`chosen_option_ids`, then `credit_additions` weeks later. Both times the cause
was one line: `{ ...customizations }`, spreading the browser's own object into
the row we store.

**Fix: two types, and the compiler refuses to confuse them.**

- `PackageCustomizationsInput` — what a browser may send. Ids and quantities.
  **No money** (`unit_price_centavos?: never`).
- `PackageCustomizationsStored` — what we persist. Sanitised, with every price
  **frozen** (`unit_price_centavos: number`, required).

`persist({ ...input })` no longer typechecks, because the client cannot supply
the frozen price the stored shape requires. The bug is now *unrepresentable*.

### Bug 2 — one write site forgot what the other knew

`priceCustomizedPackage` took positional args with defaults. `additions` was
added at the lock site and forgotten at the remove site, and `tsc` said nothing
— a defaulted parameter is legal to omit. Removing a line silently handed back
credit the couple had already spent.

**Fix: one required options object, no optional fields.** Adding a field is now
a compile error at *every* call site. Verified: a simulated new field breaks
**both** production callers and the single test helper.

### The guard file that cannot rot

`lib/package-credit-contracts.guard.ts` asserts the WRONG code does not compile,
using `@ts-expect-error`. TypeScript flags an *unused* `@ts-expect-error`, so if
anyone later widens a type until the mistake is legal again, **the guard itself
fails the build**.

Proven: making `unit_price_centavos` optional produces
`TS2578: Unused '@ts-expect-error' directive` on two lines. The guard detects
its own defeat.

**Verification:** 4229 unit + 396 DB green, `tsc --noEmit` exit=0,
`next lint` exit=0. No migration, no behaviour change — this is the same code
with mistakes made unrepresentable.

SPEC IMPACT: none. ⚠ Unchanged and still open: no vendor UI for credit prices or
per-head upgrades, no couple UI for the picker, and the **dead-pool** default
(`credit_price_centavos` NULL ⇒ a vendor who prices nothing hands their couples
an unusable pool).
