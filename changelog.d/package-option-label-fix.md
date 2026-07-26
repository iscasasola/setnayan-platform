## 2026-07-26 · fix(packages): choice options asked for a column that does not exist

The package authoring surface (PRs #3733 / #3737 / #3739, merged earlier the
same day) addressed the choice-option label column as `label`. The column is
`option_label`. PostgREST rejects an unknown column with a 400, so **all three
sites failed**:

| Site | Statement | Effect |
|---|---|---|
| `vendor-dashboard/packages/[packageId]/page.tsx` | `SELECT … label …` | editor hydrated every choice line with zero options |
| `vendor-dashboard/packages/actions.ts` (load) | `SELECT … label …` | edit-scope / freeze check saw no options |
| `vendor-dashboard/packages/actions.ts` (save) | `INSERT { label }` | **every option a vendor typed was discarded** |

Net effect: a vendor could not save or reload a choice option at all — the
headline capability of the package wave was non-functional as merged.

**No user was affected.** The surface is behind `packageAuthoringEnabled()`
(`NEXT_PUBLIC_PACKAGE_AUTHORING`, default OFF) and prod holds
`vendor_package_item_options = 0` / `vendor_packages = 0` — nothing was ever
written, so there is no corrupt data to repair.

### Why nothing caught it

This project has no generated Supabase types, so a column name inside a
`.select()` string or an `.insert()` key is unchecked free text. The DB tests
(`tests/db/package-credit-schema.db.test.ts`) used `option_label` correctly and
the app code used `label` — the two never met, and both were green.

### The guard

- `VendorPackageItemOptionRow`, `PACKAGE_ITEM_OPTION_COLUMNS` and
  `PACKAGE_ITEM_OPTION_SELECT` now live once in `lib/vendor-packages.ts`; both
  SELECT sites use the shared constant instead of a literal.
- The INSERT payload is typed `Omit<VendorPackageItemOptionRow, 'option_id'>`,
  so a mis-named key is now a **compile error** rather than a runtime 400.
- `lib/vendor-packages.columns.test.ts` parses the `CREATE TABLE` out of
  migration `20271006413374` and asserts every name we use is a real column.
  It reads the migration rather than hard-coding a second list, because a
  second hard-coded list would drift exactly the way the first one did.

**Falsifiable:** restoring `label` in the constant turns 3 of the 4 tests red
(`# pass 1 / # fail 3`); with the fix, 4 pass and 0 fail.

SPEC IMPACT: `HANDOFF_Package_Wave_2026-07-26.md` § 6.1 listed the column as
`label` in its "schema is already in prod" note — corrected to `option_label`
there, since that line is what propagated the wrong name into the code.
