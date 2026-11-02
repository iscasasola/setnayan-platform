## 2026-07-01 · feat(help): vendor priority support — front-of-queue triage in /admin/help

The help inbox (`help_messages`, iteration 0029) was a flat status+created_at
FIFO. Paid vendors now float to the front of the support queue.

- **Migration** `20270411213000_vendor_priority_support.sql` (ALTER only; RLS
  already enabled on `help_messages`): adds nullable `submitter_vendor_tier TEXT`
  (CHECK-constrained to the vendor-tier vocabulary) plus a GENERATED STORED
  `priority_rank SMALLINT` derived from the tier (enterprise>pro>solo>
  verified/free>NULL) and a composite `(priority_rank DESC, created_at DESC)`
  index. Column snapshots the tier at submission time (a later downgrade can't
  demote an in-flight request).
- **Submit action** (`app/help/actions.ts`): resolves the signed-in submitter's
  vendor tier via `resolveVendorTier` across owned stores + team memberships
  (highest tier wins) and stamps `submitter_vendor_tier`. Couple / guest / anon
  submissions leave it NULL. Best-effort — never blocks a support request.
- **Admin queue** (`app/admin/help/page.tsx`): orders by `priority_rank DESC`
  then `created_at DESC`, and renders a per-row tier chip next to the status
  chip. Non-vendor rows render no chip.

SPEC IMPACT: None (additive triage signal; no pricing/SKU/schema-contract change).
