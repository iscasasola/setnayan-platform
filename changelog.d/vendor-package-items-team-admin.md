## 2026-08-03 · fix(rls): a vendor team admin could start a package and never finish one

**A whole class of vendor cannot author a package, and is told nothing.**

`20260822000000_vendor_admin_table_access.sql:42-46` gave `vendor_packages` a `*_team_admin` policy keyed on `public.current_vendor_profile_ids()`, which unions the owner **and** admin-rank team members. `vendor_package_items` and `vendor_package_item_options` were **not** in that migration — their only write policies remained the direct-owner ones keyed on `vendor_profiles.user_id = auth.uid()` (`20260604110000:194-224`, `20271006413374:241-273`).

So a vendor **team admin** — who resolves to a vendor profile through `vendor_team_members` (`lib/vendor-profile.ts:292-315`) — INSERTs the package row fine, is refused every inclusion row, and `app/vendor-dashboard/packages/actions.ts:227-231` **deletes the package it just created**. Half-write, then self-erase. Nothing surfaces it: an RLS refusal and an empty result are the same value to the client.

### The fix

Two policies mirroring the existing owner-write joins exactly, swapping only the `vendor_profiles.user_id = auth.uid()` leg for the canonical helper. No new predicate invented — RLS patterns are owner-locked.

**No GRANT is added or widened.** The anon-facing policies stay SELECT-only gated on `is_active = TRUE`; a permissive policy `TO authenticated` changes nothing for anon. The regenerated baseline confirms it — the diff is **exactly two added `policy` lines and the two count headers**, nothing else.

`WITH CHECK` restates the predicate in full rather than aliasing `USING`: a WITH CHECK that merely repeats USING would let vendor 1's admin attach a row to vendor 2's package. Test 3 exists for that.

The migration closes with a post-condition `DO` block that RAISEs unless both policies are present in `pg_policies` — a migration that merges green while creating nothing is a failure mode this repo has already been bitten by.

### Verified, in both directions

`tests/db/vendor-package-authoring-rls.db.test.ts`, PGlite replay, four cases:

1. **team admin authors a whole package** — row + 2 items + 2 options. **This fails on `main`** — confirmed by pulling the migration out and re-running. That is the point of it.
2. **agent rank is still refused** — the helper unions admin and above; the fix must not be wider than the bug.
3. **cross-vendor is refused** — guards the `WITH CHECK`.
4. **anon unchanged** — no writes, and still cannot see items of an inactive package.

**Whole `tests/db` suite run, not cherry-picked: 761/761 pass.**

One existing assertion had to move: `package-credit-schema.db.test.ts:241` asserts the **exact** policy list on the options table and correctly caught the new one. Its third entry was added and the comparison **kept closed** (`deepEqual`, not `.includes()`) with a note saying why — loosening it would have been the wrong fix. ⚠ There is **no equivalent closed-set assertion for `vendor_package_items`**; that asymmetry is pre-existing and is left as-is rather than widened here.

### Notes

- Local run needed `@electric-sql/pglite` installed into the worktree — it is absent from the shared checkout, which is why `test:db` normally cannot run here.
- This unblocks authoring; it does not switch it on. The editor still sits behind `NEXT_PUBLIC_PACKAGE_AUTHORING`, and prod holds zero `vendor_packages`.
- ⏭ **Not verifiable by me:** signing in as a real team admin on preview and building a package end to end. Before this migration that sequence leaves no package at all.

SPEC IMPACT: None — restores the team-access parity the 2026-08-22 migration intended. No SKU, price, schema or route change.
