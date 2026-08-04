## 2026-07-30 · fix(security): close the SEC-4b DELETE lane on orders + payments

**🔴 A signed-in user could DELETE their own PAID order via PostgREST, cascading away the
payment record, the BIR receipt and the audit trail.** Verified against production before
writing the fix — not inferred from a diff:

```
has_table_privilege('authenticated','public.orders','DELETE') -> TRUE
has_table_privilege('anon',         'public.orders','DELETE') -> TRUE
pg_policies: orders_owner_write  PERMISSIVE  cmd=ALL  {authenticated}
             USING (user_id = auth.uid())      -- no RESTRICTIVE counterpart
```

`supabase/security/exposure-surface.baseline.txt` recorded the same fact in its own words:
`tpriv  public.orders|authenticated  SUD` — SELECT, UPDATE, DELETE, with INSERT already
stripped by the half that did land.

### What the delete took with it

`ON DELETE CASCADE` children of `public.orders`, confirmed in prod via `pg_constraint`:
`payments` · `receipts` · `order_ledger` · `vendor_payouts` ·
`discount_code_redemptions` · `papic_guest_orders` · `papic_one_orders`.

One request erased the payment record, the **BIR official receipt** and the audit trail, and
freed a spent voucher for re-use. Only `order_refunds` is RESTRICT. This is a
records-integrity and tax-compliance problem as much as a security one — the receipt is the
artifact we are legally required to be able to produce.

### Why it was open

Migration `20271008178212` (SEC-4b, PR **#3738**) revoked INSERT. Its adversarial review found
DELETE was the other half of the same lane, and the repair commit that closed it —
`9743f1f4f`, *"close the DELETE lane, un-vacuum the guards"* — was authored **54 minutes
before #3738 merged** and never landed. The PR reads MERGED and the migration is present, so
nothing looked wrong. Found while pruning stale worktrees: the branch was not an ancestor of
`main` despite its PR being merged.

### The fix

New forward migration `20271024090000` — the applied migration cannot be edited into
re-running. It REVOKEs DELETE from `authenticated` + `anon` on both tables, re-GRANTs
INSERT/DELETE to `service_role` explicitly, and ends with a `DO` block that RAISEs unless the
end state is reached (a REVOKE can be a silent no-op when the privilege is held by another
path — the exact "reads rigorous, enforces nothing" failure the original repair was named
for). Also asserts INSERT has not regressed and that `service_role` was not caught by the
revoke.

**Safe:** all 13 orders/payments DELETE call sites in `apps/web` already run through
`createAdminClient()` / `moneyWriter`, never the user's session client (grepped over
`origin/main`). Users still cancel — `cancelOrder` UPDATEs `status='cancelled'`; cancel is the
supported verb, delete never was.

### Tests

`tests/db/orders-payments-insert-revoke.db.test.ts` — 19 total (6 new): the catalog agrees
DELETE is gone for both session roles and kept for the server; the attack is refused; the
cascade did not fire; a direct `payments` delete is refused; the identical DELETE succeeds as
`service_role` (differential); and self-cancel still works, proving the revoke did not
overreach onto UPDATE. The harness re-applies the new migration after its blanket
`GRANT ALL`, or the new tests would exercise the pre-fix schema.

**Mutation-proved twice.** Commenting out the REVOKE turns the suite all-red (the migration's
own post-condition RAISEs in `before()`). Re-granting DELETE *and* blinding that
post-condition — so only the tests can catch it — fails exactly the 4 delete-lane tests.

That second run also caught a defect in this PR's own tests: the cascade test originally
reused the shared order, so once the attack succeeded under mutation it compared 0 payments to
0 payments and **passed while the hole was open**. It now mints its own order + payment and
asserts the fixture landed first. Exactly the pass-for-the-wrong-reason this suite's header
warns about.

### Not in this PR

The rest of commit `9743f1f4f` is still unlanded and is **not** covered here:
`lib/vendor-surface-service-keys.ts` + its test, the `isVendorSurfaceServiceKey` check in
checkout, `createMoneyWriterClient` (absent from `lib/supabase/admin.ts` on main, 0 callers),
and additions to `lib/sku-activation.ts` / `lib/order-mint-identity.ts`. Copies are preserved
in the spec corpus at `99_Recovered_Orphaned_Work_2026-07-30/`. Landing those touches money
paths and deserves its own review — this PR is scoped to the exploitable lane.

Also included: `changelog.d/suite-surface.md`, the fragment for the already-merged Silid →
Suite rename that was orphaned on the same kind of stale branch (cosmetic — that entry would
otherwise be missing when `CHANGELOG.md` is regenerated).

SPEC IMPACT: `DECISION_LOG.md` row added 2026-07-30. No exposure-baseline regeneration: this
is a NARROWING (`SUD` → `SU`), which the baseline README states does not fail CI, and it
changes GRANTs rather than policy predicates. The baseline will drop those two capability
lines the next time it is generated against prod.
